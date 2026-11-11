FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

RUN useradd --create-home --uid 10001 focusflow
COPY --chown=focusflow:focusflow . .
RUN mkdir -p /app/logs && chown focusflow:focusflow /app/logs && chmod +x scripts/start.sh

USER focusflow
ENV ENVIRONMENT=production LOG_DIR=/app/logs LOG_JSON_CONSOLE=true
VOLUME ["/app/logs"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

CMD ["./scripts/start.sh"]
