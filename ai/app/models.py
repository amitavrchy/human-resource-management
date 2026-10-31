from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class JobRequest(StrictModel):
    title: str = Field(min_length=2, max_length=160)
    department: str = Field(min_length=1, max_length=120)
    level: str = Field(min_length=1, max_length=80)
    mustHaves: list[str] = Field(max_length=30)
    tone: Literal["professional", "friendly", "concise"] = "professional"


class JobResult(StrictModel):
    markdown: str


class ScreenRequest(StrictModel):
    jobDescription: str = Field(min_length=20, max_length=30000)
    resumeText: str = Field(min_length=20, max_length=60000)


class ScreenResult(StrictModel):
    score: int = Field(ge=0, le=100)
    summary: str
    reasons: list[str]
    missingSkills: list[str]


class IngestRequest(StrictModel):
    orgId: str = Field(min_length=1, max_length=100)
    docId: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=160)
    text: str = Field(min_length=20, max_length=200000)


class ChatRequest(StrictModel):
    orgId: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=2, max_length=3000)
    documentIds: list[str] = Field(max_length=500)


class GroundedAnswer(StrictModel):
    supported: bool
    answer: str
    sourceIds: list[str]


class ExtractRequest(StrictModel):
    data: str = Field(min_length=1, max_length=14000000)
