"""Presigned multipart upload sessions against any S3-compatible store, so
large raw video sources never transit through this API process itself.

Deliberately vendor-neutral: set S3_ENDPOINT_URL and it targets a
self-hosted store (SeaweedFS, Garage, Ceph RGW), Supabase Storage, or R2;
leave it unset for AWS. Note that MinIO's community server was archived in
April 2026 and no longer receives security patches -- SeaweedFS and Garage
are the maintained self-hosted options.
"""
import os
from typing import Any, Dict, List

import boto3
from botocore.config import Config
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.models import User

router = APIRouter(prefix="/api/v1/storage", tags=["Storage & Ingestion"])

S3_BUCKET = os.getenv("S3_MEDIA_BUCKET", "viralvision-media-lake")
S3_REGION = os.getenv("AWS_REGION", "us-east-1")

_s3_client = None


def _client():
    global _s3_client
    if _s3_client is None:
        endpoint = os.getenv("S3_ENDPOINT_URL") or None
        # Virtual-host addressing (bucket.host) needs a wildcard DNS record,
        # which a self-hosted store on an IP or single hostname does not
        # have -- every request 404s or resolves nowhere. Path addressing
        # (host/bucket) is what those expect, so the style follows the
        # endpoint rather than being hardcoded to AWS's.
        addressing = "path" if endpoint else "virtual"
        _s3_client = boto3.client(
            "s3",
            region_name=S3_REGION,
            endpoint_url=endpoint,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            config=Config(signature_version="s3v4", s3={"addressing_style": addressing}),
        )
    return _s3_client


def public_url_for(storage_key: str) -> str:
    """Browser-reachable URL for an uploaded object.

    S3_PUBLIC_BASE_URL wins when the objects sit behind a CDN or reverse
    proxy. Otherwise this mirrors the addressing style the client is
    actually using -- the previous hardcoded amazonaws.com URL was simply
    wrong for every non-AWS backend, handing callers a link to a bucket
    that does not exist.
    """
    base = os.getenv("S3_PUBLIC_BASE_URL")
    if base:
        return f"{base.rstrip('/')}/{storage_key}"

    endpoint = os.getenv("S3_ENDPOINT_URL")
    if endpoint:
        return f"{endpoint.rstrip('/')}/{S3_BUCKET}/{storage_key}"

    return f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{storage_key}"


class InitiateUploadRequest(BaseModel):
    filename: str
    file_size_bytes: int = Field(..., gt=0, le=5 * 1024 * 1024 * 1024)
    content_type: str = Field(..., pattern=r"^(video|audio|image)/[a-zA-Z0-9\-_.]+$")
    part_count: int = Field(..., ge=1, le=1000)


class CompleteUploadRequest(BaseModel):
    upload_id: str
    key: str
    parts: List[Dict[str, Any]]  # [{"PartNumber": 1, "ETag": "..."}]


@router.post("/multipart/initiate")
def initiate_multipart_upload(payload: InitiateUploadRequest, current_user: User = Depends(get_current_user)):
    storage_key = f"uploads/{current_user.id}/{os.urandom(8).hex()}_{payload.filename}"
    s3 = _client()

    try:
        response = s3.create_multipart_upload(
            Bucket=S3_BUCKET, Key=storage_key, ContentType=payload.content_type,
            Metadata={"owner_user_id": current_user.id},
        )
        upload_id = response["UploadId"]

        parts = [
            {
                "part_number": part_num,
                "upload_url": s3.generate_presigned_url(
                    ClientMethod="upload_part",
                    Params={"Bucket": S3_BUCKET, "Key": storage_key, "UploadId": upload_id, "PartNumber": part_num},
                    ExpiresIn=3600,
                ),
            }
            for part_num in range(1, payload.part_count + 1)
        ]

        return {
            "upload_id": upload_id,
            "key": storage_key,
            "parts": parts,
            "final_resource_url": public_url_for(storage_key),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to initiate S3 session: {exc}") from exc


@router.post("/multipart/complete")
def complete_multipart_upload(payload: CompleteUploadRequest, current_user: User = Depends(get_current_user)):
    if not payload.key.startswith(f"uploads/{current_user.id}/"):
        raise HTTPException(status_code=403, detail="Unauthorized key scope")

    try:
        result = _client().complete_multipart_upload(
            Bucket=S3_BUCKET, Key=payload.key, UploadId=payload.upload_id, MultipartUpload={"Parts": payload.parts}
        )
        return {"status": "completed", "location": result.get("Location"), "key": payload.key}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Multipart completion failed: {exc}") from exc
