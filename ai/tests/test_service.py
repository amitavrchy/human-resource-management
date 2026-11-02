from fastapi.testclient import TestClient

from app.main import app
from app.service import UNKNOWN, chunk_text, collection_name, redact_identifiers


def test_chunks_overlap_and_cover_source():
    source = "a" * 3000
    chunks = chunk_text(source)
    assert len(chunks) == 3
    assert chunks[0][-180:] == chunks[1][:180]


def test_tenant_collection_names_are_distinct_and_safe():
    assert collection_name("tenant-a") != collection_name("tenant-b")
    assert "/" not in collection_name("../../other")


def test_redacts_obvious_identity_numbers():
    assert "123-45-6789" not in redact_identifiers("SSN: 123-45-6789. React developer")


def test_private_endpoints_require_service_token(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "x" * 32)
    with TestClient(app) as client:
        assert (
            client.get(
                "/api/v2/tenants/default_tenant/databases/default_database/collections"
            ).status_code
            == 404
        )
        assert (
            client.post(
                "/v1/handbook/chat", json={"orgId": "a", "message": "hello", "documentIds": []}
            ).status_code
            == 401
        )
        response = client.post(
            "/v1/handbook/chat",
            headers={"Authorization": "Bearer " + "x" * 32},
            json={"orgId": "a", "message": "hello", "documentIds": []},
        )
        assert response.json() == {"answer": UNKNOWN, "citations": []}


def test_validation_does_not_echo_resume_pii(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "x" * 32)
    with TestClient(app) as client:
        response = client.post(
            "/v1/resume/screen",
            headers={"Authorization": "Bearer " + "x" * 32},
            json={"resumeText": "secret-123", "jobDescription": "short"},
        )
        assert response.status_code == 422
        assert "secret-123" not in response.text
