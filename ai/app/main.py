import logging
import os
import secrets
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import service
from .models import ChatRequest, ExtractRequest, IngestRequest, JobRequest, ScreenRequest

load_dotenv()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    token = os.getenv("AI_SERVICE_TOKEN", "").strip()
    if len(token) < 32 or token.startswith(("replace", "change-me")):
        raise RuntimeError("AI_SERVICE_TOKEN must contain at least 32 random characters.")
    yield


app = FastAPI(
    title="PeopleOS AI",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if os.getenv("NODE_ENV") == "production" else "/docs",
)


def authenticate(authorization: str | None = Header(default=None)):
    expected = os.getenv("AI_SERVICE_TOKEN", "")
    if len(expected) < 32 or not secrets.compare_digest(authorization or "", f"Bearer {expected}"):
        raise HTTPException(401, "Service authentication required.")


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    # Default FastAPI validation includes the rejected input, potentially resume PII.
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
                for item in exc.errors()
            ]
        },
    )


@app.exception_handler(Exception)
async def service_error(_request: Request, exc: Exception):
    logging.getLogger("peopleos.ai").error("AI operation failed: %s", type(exc).__name__)
    return JSONResponse(
        status_code=503, content={"detail": "AI is temporarily unavailable. Please try again."}
    )


@app.get("/health")
def health():
    return {"status": "ok", "configured": service.configured()}


@app.post("/v1/jd/generate", dependencies=[Depends(authenticate)])
def generate(request: JobRequest):
    return service.generate_job(request)


@app.post("/v1/resume/screen", dependencies=[Depends(authenticate)])
def screen(request: ScreenRequest):
    return service.screen_resume(request)


@app.post("/v1/handbook/ingest", dependencies=[Depends(authenticate)])
def ingest(request: IngestRequest):
    return service.ingest(request)


@app.post("/v1/handbook/chat", dependencies=[Depends(authenticate)])
def chat(request: ChatRequest):
    return service.chat(request)


@app.post("/v1/extract-text", dependencies=[Depends(authenticate)])
def extract(request: ExtractRequest):
    return service.extract_pdf(request.data)
