# PeopleOS AI service

Python 3.12, FastAPI, LangChain/OpenAI and private embedded Chroma. Start from the [repository README](../README.md) for the full application.

```sh
python -m venv .venv
# Activate .venv using your shell's activation script.
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

`ai/.env` requires a random `AI_SERVICE_TOKEN` matching the API. `OPENAI_API_KEY` is optional at startup; provider-backed operations return an unavailable response until configured. `/health` reports liveness/configuration. All `/v1` operations require the service bearer token. Never publish this port directly.

Routes: `/v1/jd/generate`, `/v1/resume/screen`, `/v1/handbook/ingest`, `/v1/handbook/chat`, `/v1/extract-text`. NestJS supplies organization/document identity; callers do not choose collection configuration or embedding plugins. Generated text is returned as structured data and rendered safely by the client.

```sh
python -m pytest -q
python -m ruff check app tests scripts
python scripts/audit.py
```

Tests use deterministic providers plus real persistent Chroma; they do not incur provider charges. See [security](../docs/SECURITY.md) for the expiring, version-scoped Chroma advisory exception. Regenerate `requirements.lock` in an isolated Python 3.12 environment when updating dependencies, retain platform markers, and validate the Linux container and Windows tests before committing.
