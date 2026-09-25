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
