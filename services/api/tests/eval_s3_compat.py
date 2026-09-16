"""Proves the storage router works against a self-hosted S3 store, not just AWS.

Runs a real presigned multipart upload end to end: initiate -> PUT each part
via the presigned URL -> complete -> download and compare bytes.

    S3_ENDPOINT_URL=http://127.0.0.1:8333 AWS_ACCESS_KEY_ID=... \
    AWS_SECRET_ACCESS_KEY=... S3_MEDIA_BUCKET=test python tests/eval_s3_compat.py
"""
import hashlib
import os
import sys
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.routers.storage import S3_BUCKET, _client, public_url_for  # noqa: E402

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))


def main():
    s3 = _client()
    key = "evals/multipart-probe.bin"
    # Two parts; S3 requires every part except the last to be >= 5 MiB.
    parts_data = [os.urandom(5 * 1024 * 1024), os.urandom(1024)]
    original = b"".join(parts_data)

    try:
        s3.create_bucket(Bucket=S3_BUCKET)
    except Exception:
        pass  # already exists

    check("1. addressing style follows endpoint",
          _client().meta.config.s3["addressing_style"] == "path",
          _client().meta.config.s3["addressing_style"])

    url = public_url_for(key)
    check("2. public URL is not hardcoded to AWS",
          "amazonaws.com" not in url, url)

    init = s3.create_multipart_upload(Bucket=S3_BUCKET, Key=key, ContentType="video/mp4")
    upload_id = init["UploadId"]
    check("3. multipart upload initiates", bool(upload_id), f"id={upload_id[:16]}...")

    etags = []
    for i, chunk in enumerate(parts_data, start=1):
        presigned = s3.generate_presigned_url(
            "upload_part",
            Params={"Bucket": S3_BUCKET, "Key": key, "UploadId": upload_id, "PartNumber": i},
            ExpiresIn=3600,
        )
        req = urllib.request.Request(presigned, data=chunk, method="PUT")
        with urllib.request.urlopen(req, timeout=120) as resp:
            etags.append({"PartNumber": i, "ETag": resp.headers["ETag"]})
    check("4. presigned part PUTs accepted", len(etags) == 2, f"{len(etags)} parts")

    s3.complete_multipart_upload(
        Bucket=S3_BUCKET, Key=key, UploadId=upload_id, MultipartUpload={"Parts": etags}
    )
    fetched = s3.get_object(Bucket=S3_BUCKET, Key=key)["Body"].read()

    check("5. reassembled object matches byte-for-byte",
          hashlib.sha256(fetched).hexdigest() == hashlib.sha256(original).hexdigest(),
          f"{len(fetched)} bytes")

    s3.delete_object(Bucket=S3_BUCKET, Key=key)
    check("6. cleanup", True, "object deleted")

    print()
    failed = 0
    for name, ok, detail in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"   [{detail}]" if detail else ""))
        failed += 0 if ok else 1
    print(f"\n{len(results) - failed}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
