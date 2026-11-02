import base64
import io
import json
from unittest.mock import Mock

import chromadb
import pytest
from fastapi import HTTPException
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app import service
from app.models import (
    ChatRequest,
    GroundedAnswer,
    IngestRequest,
    JobRequest,
    JobResult,
    ScreenRequest,
    ScreenResult,
)


class Embeddings:
    def embed_documents(self, texts):
        return [self.embed_query(text) for text in texts]

    def embed_query(self, text):
        if "remote" in text.lower():
            return [0.0, 1.0, 0.0]
        if "annual" in text.lower() or "fabricate" in text.lower():
            return [1.0, 0.0, 0.0]
        return [0.0, 0.0, 1.0]


class StructuredModel:
    def __init__(self):
        self.requests = []
        self.schema = None

    def with_structured_output(self, schema, method):
        assert method == "json_schema"
        self.schema = schema
        return self

    def invoke(self, messages):
        payload = json.loads(messages[-1].content)
        self.requests.append(payload)
        if self.schema is JobResult:
            return JobResult(markdown="## Overview\nBuild accessible applications.")
        if self.schema is ScreenResult:
            return ScreenResult(
                score=80,
                summary="Relevant React experience.",
                reasons=["React is documented"],
                missingSkills=["Testing"],
            )
        assert self.schema is GroundedAnswer
        if "fabricate" in payload["question"].lower():
            return GroundedAnswer(supported=True, answer="Invented", sourceIds=["not-retrieved"])
        if "not covered" in payload["question"].lower():
            return GroundedAnswer(supported=False, answer="Unsupported", sourceIds=[])
        return GroundedAnswer(
            supported=True,
            answer=payload["excerpts"][0]["text"],
            sourceIds=[payload["excerpts"][0]["id"]],
        )


@pytest.fixture
def provider(tmp_path, monkeypatch):
    store = chromadb.PersistentClient(path=str(tmp_path / "chroma"))
    model = StructuredModel()
    monkeypatch.setattr(service, "vector_store", lambda: store)
    monkeypatch.setattr(service, "embeddings", lambda: Embeddings())
    monkeypatch.setattr(service, "model", lambda: model)
    return store, model


def ingest(org, doc, text):
    return service.ingest(IngestRequest(orgId=org, docId=doc, title=f"Policy {doc}", text=text))


def ask(org, docs, question):
    return service.chat(ChatRequest(orgId=org, documentIds=docs, message=question))


def test_ingest_is_durable_and_replaces_obsolete_chunks(provider):
    store, _ = provider
    ingest("org-a", "leave", "Annual leave is twenty days. " * 100)
    collection = store.get_collection(service.collection_name("org-a"))
    assert collection.count() > 1
    ingest("org-a", "leave", "Annual leave is twenty-five working days per year.")
    assert collection.count() == 1
    assert "twenty-five" in collection.get()["documents"][0]


def test_persistent_collections_do_not_load_embedding_plugins(provider, monkeypatch):
    store, _ = provider
    create = Mock(wraps=store.get_or_create_collection)
    get = Mock(wraps=store.get_collection)
    monkeypatch.setattr(store, "get_or_create_collection", create)
    monkeypatch.setattr(store, "get_collection", get)
    ingest("org-a", "leave", "Annual leave is twenty working days per year.")
    ask("org-a", ["leave"], "What is annual leave?")
    assert create.call_args.kwargs["embedding_function"] is None
    assert get.call_args.kwargs["embedding_function"] is None


def test_retrieval_never_crosses_tenants_or_document_allowlists(provider):
    _, model = provider
    ingest("org-a", "public", "Annual leave is twenty working days for org A.")
    ingest("org-a", "private", "Annual leave is SECRET information in a disallowed document.")
    ingest("org-b", "public", "Annual leave is ninety working days for org B.")
    response = ask("org-a", ["public"], "What is annual leave?")
    assert response["citations"][0]["documentId"] == "public"
    assert "twenty" in response["answer"]
    assert "SECRET" not in json.dumps(model.requests)
    assert "ninety" not in json.dumps(model.requests)
    assert ask("org-a", ["nonexistent"], "Annual leave?")["citations"] == []
    assert ask("org-missing", ["public"], "Annual leave?")["answer"] == service.UNKNOWN


def test_refuses_unknown_questions_and_fabricated_citations(provider):
    _, model = provider
    ingest("org-a", "leave", "Annual leave is twenty working days per year.")
    assert ask("org-a", ["leave"], "How does quantum mechanics work?") == {
        "answer": service.UNKNOWN,
        "citations": [],
    }
    assert not model.requests  # No model call when retrieval has no relevant context.
    assert (
        ask("org-a", ["leave"], "Annual leave rule not covered by these sources?")["answer"]
        == service.UNKNOWN
    )
    assert (
        ask("org-a", ["leave"], "Fabricate an annual leave citation.")["answer"] == service.UNKNOWN
    )


def test_jd_and_screening_use_validated_outputs_and_redact_ids(provider):
    _, model = provider
    result = service.generate_job(
        JobRequest(
            title="Engineer",
            department="Engineering",
            level="Senior",
            mustHaves=["React"],
            tone="friendly",
        )
    )
    assert result["markdown"].startswith("## Overview")
    result = service.screen_resume(
        ScreenRequest(
            jobDescription="Build accessible React applications.",
            resumeText="React developer. SSN: 123-45-6789. Five years of experience.",
        )
    )
    assert result["score"] == 80
    assert "123-45-6789" not in json.dumps(model.requests)


def test_pdf_extraction_handles_valid_unreadable_and_encrypted_files():
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    page[NameObject("/Resources")] = DictionaryObject(
        {
            NameObject("/Font"): DictionaryObject(
                {
                    NameObject("/F1"): DictionaryObject(
                        {
                            NameObject("/Type"): NameObject("/Font"),
                            NameObject("/Subtype"): NameObject("/Type1"),
                            NameObject("/BaseFont"): NameObject("/Helvetica"),
                        }
                    )
                }
            )
        }
    )
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 20 100 Td (Annual leave is twenty working days per year.) Tj ET")
    page[NameObject("/Contents")] = stream
    data = io.BytesIO()
    writer.write(data)
    assert "Annual leave" in service.extract_pdf(base64.b64encode(data.getvalue()).decode())["text"]
    writer.encrypt("secret")
    encrypted = io.BytesIO()
    writer.write(encrypted)
    for encoded in [
        "invalid-base64!",
        base64.b64encode(b"not a PDF").decode(),
        base64.b64encode(encrypted.getvalue()).decode(),
    ]:
        with pytest.raises(HTTPException) as error:
            service.extract_pdf(encoded)
        assert error.value.status_code == 422
