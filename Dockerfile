# API image. Build from the REPO ROOT (the API reads lesson data from /content):
#   docker build -t 3d-school-api .
# syntax=docker/dockerfile:1
ARG PYTHON_IMAGE=python:3.13-slim

FROM ${PYTHON_IMAGE} AS build
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never PIP_DISABLE_PIP_VERSION_CHECK=1
RUN pip install --no-cache-dir uv
WORKDIR /app/api
# dependencies first, so code edits don't invalidate this layer
COPY api/pyproject.toml api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM ${PYTHON_IMAGE}
RUN useradd --system --uid 10001 --no-create-home app
WORKDIR /app
COPY --from=build /app/api/.venv /app/api/.venv
COPY api/app /app/api/app
COPY content /app/content
ENV PATH="/app/api/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=8000
USER app
WORKDIR /app/api
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.environ.get('PORT','8000'), timeout=3)"
# --proxy-headers: trust X-Forwarded-* from the platform's load balancer
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
