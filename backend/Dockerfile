# Tarot backend (FastAPI + Vision + RAG + ASR)
# Multi-stage build để giảm image size.
# Image base có sẵn Python 3.11 slim.

FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    APP_HOME=/app

# System deps cần cho opencv, faiss, sentence-transformers, faster-whisper.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        libsndfile1 \
        libgl1 \
        libglib2.0-0 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR ${APP_HOME}

# Cài deps trước để Docker cache hoạt động khi code thay đổi.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy source code.
COPY . .

# Tạo non-root user.
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p ${APP_HOME}/data ${APP_HOME}/tmp_uploads ${APP_HOME}/models \
    && chown -R appuser:appuser ${APP_HOME}

USER appuser

EXPOSE 8000

# Healthcheck dùng endpoint /api/health (operator-friendly, kiểm tra DB).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

# Production server: gunicorn + uvicorn workers.
# Workers số CPU * 2 + 1 thường, nhưng vision model nặng → giữ 2 workers cho 1 CPU.
ENV WEB_CONCURRENCY=2
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY}"]
