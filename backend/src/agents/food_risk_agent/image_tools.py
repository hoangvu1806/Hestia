"""On-demand culinary illustration generation through the configured image model."""

import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

from google.adk.tools import ToolContext

from services.object_store import ObjectStoreError, get_object_store

GENERATED_IMAGE_DIR = Path(__file__).resolve().parents[3] / ".runtime" / "generated-images"
ALLOWED_ASPECT_RATIOS = {"1:1", "3:2", "4:3", "16:9"}


def generate_food_illustration(
    prompt: str, tool_context: ToolContext, aspect_ratio: str = "4:3"
) -> dict:
    """Generate one AI culinary illustration when a visual would aid cooking or plating.

    Args:
        prompt: A self-contained English visual prompt describing the dish, assembly, camera angle,
            important visible ingredients, and desired instructional detail. Do not request text,
            labels, measurements, scientific evidence, or safety claims inside the image.
        aspect_ratio: One of 1:1, 3:2, 4:3, or 16:9. Prefer 4:3 for a finished dish and 16:9 for
            a preparation layout.

    Returns:
        A status plus Markdown that can be placed directly in the final answer. The image is an AI
        illustration and must never be presented as evidence that food is cooked or safe.
    """
    clean_prompt = " ".join(prompt.split()).strip()
    if not clean_prompt:
        return {"status": "error", "error": "A visual prompt is required."}
    if len(clean_prompt) > 1800:
        return {"status": "error", "error": "The visual prompt is too long."}
    if aspect_ratio not in ALLOWED_ASPECT_RATIOS:
        return {"status": "error", "error": "Unsupported aspect ratio."}

    model = os.getenv("CUSTOM_IMAGE_GEN_MODEL_NAME", "").strip()
    api_key = os.getenv("CUSTOM_API_KEY", "").strip()
    api_base = os.getenv("CUSTOM_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
    if not model or not api_key:
        return {"status": "error", "error": "Image generation is not configured."}

    provider_model = model.removeprefix("openrouter/")
    payload = json.dumps(
        {
            "model": provider_model,
            "prompt": clean_prompt,
            "n": 1,
            "resolution": "1K",
            "aspect_ratio": aspect_ratio,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{api_base}/images",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.load(response)
        encoded = result["data"][0]["b64_json"]
        image_bytes = base64.b64decode(encoded, validate=True)
        if not image_bytes or len(image_bytes) > 20 * 1024 * 1024:
            raise ValueError("Invalid generated image size")
        image_id = uuid4()
        get_object_store().put_generated_image(
            tool_context.user_id,
            tool_context.session.id,
            image_id,
            image_bytes,
        )
        return {
            "status": "ok",
            "image_id": str(image_id),
            "markdown": f"![AI-generated culinary illustration](hestia-image://{image_id})",
            "disclosure": "AI-generated illustration, not a photograph or food-safety evidence.",
        }
    except (
        urllib.error.URLError,
        TimeoutError,
        KeyError,
        IndexError,
        ValueError,
        TypeError,
        ObjectStoreError,
    ) as exc:
        return {"status": "error", "error": f"Image generation failed: {type(exc).__name__}."}
