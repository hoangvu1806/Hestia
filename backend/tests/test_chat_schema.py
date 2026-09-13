import pytest
from pydantic import ValidationError

from schemas.chat import InlineFile, MessageCreate


def test_message_accepts_text_or_file() -> None:
    assert MessageCreate(text="Xin chào").text == "Xin chào"
    message = MessageCreate(files=[InlineFile(mime_type="image/png", data="aGVzdGlh")])
    assert message.files[0].mime_type == "image/png"


def test_message_rejects_empty_content() -> None:
    with pytest.raises(ValidationError):
        MessageCreate()
