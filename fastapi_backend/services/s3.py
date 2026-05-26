import boto3
from botocore.config import Config
from config import get_settings


def get_s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        config=Config(signature_version="s3v4"),
    )


def upload_to_s3(buffer: bytes, key: str, content_type: str) -> str:
    """Upload bytes to S3. Returns the storage key."""
    settings = get_settings()
    client = get_s3_client()
    client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=buffer,
        ContentType=content_type,
    )
    return key


def get_public_url(key: str) -> str:
    settings = get_settings()
    base = settings.s3_public_base_url.rstrip("/")
    if base:
        return f"{base}/{key}"
    return f"https://{settings.s3_bucket_name}.s3.{settings.aws_region}.amazonaws.com/{key}"


def delete_from_s3(key: str) -> None:
    settings = get_settings()
    client = get_s3_client()
    client.delete_object(Bucket=settings.s3_bucket_name, Key=key)


def generate_presigned_url(key: str, expiry: int = 3600) -> str:
    settings = get_settings()
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expiry,
    )
