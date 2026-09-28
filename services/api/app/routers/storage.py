"""Presigned S3 (or Supabase/MinIO S3-compatible) multipart upload
sessions, so large raw video sources never transit through this API
process itself.
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

S3_BUCKET = os.getenv("S3_MEDIA_BUCKET", "viral-trending-media-lake")
S3_REGION = os.getenv("AWS_REGION", "us-east-1")

_s3_client = None


def _client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            region_name=S3_REGION,
            endpoint_url=os.getenv("S3_ENDPOINT_URL"),  # set for Supabase Storage / MinIO compatibility
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )
    return _s3_client


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
            "final_resource_url": f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{storage_key}",
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
