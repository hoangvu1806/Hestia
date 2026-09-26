from __future__ import annotations

import hashlib
import threading
from collections.abc import Iterator
from dataclasses import dataclass
from functools import lru_cache
from typing import BinaryIO
from uuid import UUID

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from core.config import Settings, get_settings


class ObjectStoreError(RuntimeError):
    pass


@dataclass(frozen=True)
class StoredObject:
    body: bytes | BinaryIO
    content_type: str
    size: int

    def iter_bytes(self, chunk_size: int = 128 * 1024) -> Iterator[bytes]:
        """Yield an object without buffering its full payload in application memory."""
        if isinstance(self.body, bytes):
            yield self.body
            return
        try:
            while chunk := self.body.read(chunk_size):
                yield chunk
        finally:
            self.body.close()


class S3ObjectStore:
    """Private S3-compatible storage scoped by Firebase user and ADK session."""

    def __init__(self, settings: Settings) -> None:
        if not all(
            (
                settings.s3_endpoint_url,
                settings.s3_access_key_id,
                settings.s3_secret_access_key,
                settings.s3_bucket,
            )
        ):
            raise ObjectStoreError("S3 object storage is not configured")
        self.bucket = settings.s3_bucket
        self.region = settings.s3_region
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name=settings.s3_region,
            config=Config(
                signature_version="s3v4",
                connect_timeout=5,
                read_timeout=30,
                retries={"max_attempts": 3, "mode": "standard"},
                max_pool_connections=16,
                tcp_keepalive=True,
                s3={"addressing_style": "path"},
            ),
        )
        self._bucket_ready = False
        self._bucket_lock = threading.Lock()

    @staticmethod
    def _scope(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def _error_code(exc: BotoCoreError | ClientError) -> str:
        if isinstance(exc, ClientError):
            return str(exc.response.get("Error", {}).get("Code", ""))
        return ""

    def _key(self, user_id: str, session_id: str, kind: str, object_id: UUID) -> str:
        return f"users/{self._scope(user_id)}/sessions/{self._scope(session_id)}/{kind}/{object_id}"

    def ensure_bucket(self) -> None:
        if self._bucket_ready:
            return
        with self._bucket_lock:
            if self._bucket_ready:
                return
            try:
                self.client.head_bucket(Bucket=self.bucket)
            except (BotoCoreError, ClientError) as exc:
                code = self._error_code(exc)
                if code not in {"404", "NoSuchBucket", "NotFound"}:
                    raise ObjectStoreError("Unable to access the S3 bucket") from exc
                options: dict[str, object] = {"Bucket": self.bucket}
                if self.region != "us-east-1":
                    options["CreateBucketConfiguration"] = {"LocationConstraint": self.region}
                try:
                    self.client.create_bucket(**options)
                except (BotoCoreError, ClientError) as create_exc:
                    raise ObjectStoreError("Unable to create the S3 bucket") from create_exc
            self._bucket_ready = True

    def put_attachment(
        self,
        user_id: str,
        session_id: str,
        attachment_id: UUID,
        body: bytes,
        content_type: str,
    ) -> None:
        self._put(self._key(user_id, session_id, "attachments", attachment_id), body, content_type)

    def get_attachment(self, user_id: str, session_id: str, attachment_id: UUID) -> StoredObject:
        return self._get(self._key(user_id, session_id, "attachments", attachment_id))

    def attachment_exists(self, user_id: str, session_id: str, attachment_id: UUID) -> bool:
        self.ensure_bucket()
        try:
            self.client.head_object(
                Bucket=self.bucket,
                Key=self._key(user_id, session_id, "attachments", attachment_id),
            )
            return True
        except (BotoCoreError, ClientError) as exc:
            code = self._error_code(exc)
            if code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise ObjectStoreError("Unable to inspect the object") from exc

    def put_generated_image(
        self, user_id: str, session_id: str, image_id: UUID, body: bytes
    ) -> None:
        self._put(self._key(user_id, session_id, "generated", image_id), body, "image/png")

    def get_generated_image(self, user_id: str, session_id: str, image_id: UUID) -> StoredObject:
        return self._get(self._key(user_id, session_id, "generated", image_id))

    def _put(self, key: str, body: bytes, content_type: str) -> None:
        self.ensure_bucket()
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=body,
                ContentLength=len(body),
                ContentType=content_type,
                CacheControl="private, max-age=86400",
            )
        except (BotoCoreError, ClientError) as exc:
            raise ObjectStoreError("Unable to store the object") from exc

    def _get(self, key: str) -> StoredObject:
        self.ensure_bucket()
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
            body = response["Body"]
            return StoredObject(
                body=body,
                content_type=response.get("ContentType") or "application/octet-stream",
                size=int(response.get("ContentLength") or 0),
            )
        except self.client.exceptions.NoSuchKey as exc:
            raise FileNotFoundError(key) from exc
        except (BotoCoreError, ClientError) as exc:
            code = self._error_code(exc)
            if code in {"404", "NoSuchKey", "NotFound"}:
                raise FileNotFoundError(key) from exc
            raise ObjectStoreError("Unable to read the object") from exc


@lru_cache
def get_object_store() -> S3ObjectStore:
    return S3ObjectStore(get_settings())
