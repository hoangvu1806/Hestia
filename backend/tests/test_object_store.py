from io import BytesIO
from unittest.mock import Mock
from uuid import uuid4

import pytest
from botocore.exceptions import ClientError

from services.object_store import ObjectStoreError, S3ObjectStore


def client_error(code: str, operation: str = "HeadObject") -> ClientError:
    return ClientError(
        {"Error": {"Code": code, "Message": "test error"}},
        operation,
    )


def object_store_with_client(client: Mock) -> S3ObjectStore:
    store = S3ObjectStore.__new__(S3ObjectStore)
    store.bucket = "test-bucket"
    store.client = client
    store._bucket_ready = True
    return store


@pytest.mark.parametrize("code", ["404", "NoSuchKey", "NotFound"])
def test_attachment_exists_returns_false_for_missing_object(code: str) -> None:
    client = Mock()
    client.head_object.side_effect = client_error(code)
    store = object_store_with_client(client)

    assert store.attachment_exists("user", "session", uuid4()) is False


def test_attachment_exists_wraps_non_missing_client_error() -> None:
    client = Mock()
    client.head_object.side_effect = client_error("AccessDenied")
    store = object_store_with_client(client)

    with pytest.raises(ObjectStoreError, match="Unable to inspect the object"):
        store.attachment_exists("user", "session", uuid4())


def test_attachment_is_stored_and_loaded_with_content_metadata() -> None:
    client = Mock()
    client.get_object.return_value = {
        "Body": BytesIO(b"image-bytes"),
        "ContentType": "image/webp",
    }
    store = object_store_with_client(client)
    attachment_id = uuid4()

    store.put_attachment(
        "user",
        "session",
        attachment_id,
        b"image-bytes",
        "image/webp",
    )
    loaded = store.get_attachment("user", "session", attachment_id)

    expected_key = store._key("user", "session", "attachments", attachment_id)
    client.put_object.assert_called_once_with(
        Bucket="test-bucket",
        Key=expected_key,
        Body=b"image-bytes",
        ContentLength=11,
        ContentType="image/webp",
        CacheControl="private, max-age=86400",
    )
    client.get_object.assert_called_once_with(Bucket="test-bucket", Key=expected_key)
    assert loaded.body == b"image-bytes"
    assert loaded.content_type == "image/webp"
    assert loaded.size == 11
