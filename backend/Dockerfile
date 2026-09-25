# syntax=docker/dockerfile:1.7

FROM python:3.11-slim-bookworm AS dependencies

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=0 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends build-essential

COPY pyproject.toml README.md ./
RUN mkdir -p src && touch src/main.py
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    python -m pip wheel --wheel-dir /wheels .

FROM python:3.11-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/src \
    HESTIA_HOST=0.0.0.0 \
    HESTIA_PORT=8484

WORKDIR /app

RUN groupadd --gid 10001 hestia \
    && useradd --uid 10001 --gid hestia --no-create-home --shell /usr/sbin/nologin hestia

COPY --from=dependencies /wheels /wheels
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    python -m pip install /wheels/* \
    && rm -rf /wheels

COPY --chown=hestia:hestia src ./src
COPY --chown=hestia:hestia scripts ./scripts
COPY --chown=hestia:hestia dataset/NutrientRetention.csv ./dataset/NutrientRetention.csv
RUN mkdir -p /app/.runtime/generated-images \
    && chown -R hestia:hestia /app/.runtime

USER hestia

EXPOSE 8484

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8484/api/v1/health', timeout=3)"]

CMD ["python", "-m", "uvicorn", "main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8484", "--proxy-headers", "--forwarded-allow-ips=*"]
