# Backend/app/utils/storage.py
import os
from pathlib import Path
from typing import Union
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
class StorageManager:
    def __init__(self):
        self.storage_type = os.getenv("STORAGE_TYPE", "local").lower()
        self.root = Path(os.getenv("STORAGE_ROOT", "storage")) if self.storage_type == "local" else None
        self.bucket = os.getenv("STORAGE_ROOT")  # bucket name for cloud

        if self.storage_type == "local":
            self.root.mkdir(parents=True, exist_ok=True)
        elif self.storage_type in ["s3", "aws"]:
            session = boto3.session.Session()
            self.s3_client = session.client(
                's3',
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION"),
                endpoint_url=os.getenv("AWS_ENDPOINT_URL"),
            )
        else:
            raise ValueError(f"Unsupported STORAGE_TYPE: {self.storage_type}")

    async def save_file(self, rel_path: str, content: Union[str, bytes], is_text: bool = True):
        if self.storage_type == "local":
            full_path = self.root / rel_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            mode = "w" if is_text else "wb"
            encoding = "utf-8" if is_text else None
            with open(full_path, mode, encoding=encoding) as f:
                f.write(content)
        else:  # S3
            data = content.encode('utf-8') if isinstance(content, str) else content
            extra_args = {}
            acl = os.getenv("AWS_DEFAULT_ACL")
            if acl:
                extra_args["ACL"] = acl
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=rel_path,
                Body=data,
                **extra_args
            )

    async def load_file(self, rel_path: str) -> bytes:
        if self.storage_type == "local":
            full_path = self.root / rel_path
            if not full_path.exists():
                raise HTTPException(404, "File not found")
            return full_path.read_bytes()
        else:
            try:
                obj = self.s3_client.get_object(Bucket=self.bucket, Key=rel_path)
                return obj['Body'].read()
            except ClientError as e:
                if e.response['Error']['Code'] == 'NoSuchKey':
                    raise HTTPException(404, "File not found")
                raise

    async def delete_file(self, rel_path: str):
        if self.storage_type == "local":
            full_path = self.root / rel_path
            if full_path.exists():
                full_path.unlink()
        else:
            try:
                self.s3_client.delete_object(Bucket=self.bucket, Key=rel_path)
            except ClientError:
                pass  # Ignore if not exists

    async def exists(self, rel_path: str) -> bool:
        if self.storage_type == "local":
            return (self.root / rel_path).exists()
        else:
            try:
                self.s3_client.head_object(Bucket=self.bucket, Key=rel_path)
                return True
            except ClientError:
                return False

    def get_url(self, rel_path: str, expires_in: int = 3600) -> str:
        """Get presigned URL (only for cloud)"""
        if self.storage_type == "local":
            return f"/uploads/{rel_path}"
        else:
            return self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': rel_path},
                ExpiresIn=expires_in
            )

# Global instance
storage_manager = StorageManager()