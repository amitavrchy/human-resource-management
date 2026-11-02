FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NODE_ENV=production CHROMA_PATH=/app/data/chroma
COPY requirements.lock requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.lock
COPY app ./app
RUN useradd --create-home --uid 10001 peopleos && mkdir -p /app/data/chroma && chown -R peopleos:peopleos /app/data
USER peopleos
EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health',timeout=3)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--limit-concurrency", "16", "--timeout-keep-alive", "5"]
