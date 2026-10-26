import pytest
from fastapi.testclient import TestClient

from geometry.api import app

client = TestClient(app)


@pytest.fixture
def token(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.delenv("GEOMETRY_AUTH_DISABLED")
    monkeypatch.setenv("GEOMETRY_SERVICE_TOKEN", "s3cret-token")
    return "s3cret-token"


def test_health_is_open(token: str) -> None:
    assert client.get("/health").status_code == 200


def test_build_without_header_is_401(token: str) -> None:
    assert client.post("/build?format=stl").status_code == 401


def test_build_with_wrong_token_is_401(token: str) -> None:
    r = client.post("/build?format=stl", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_build_with_wrong_scheme_is_401(token: str) -> None:
    r = client.post("/build?format=stl", headers={"Authorization": token})
    assert r.status_code == 401


def test_build_with_right_token_works(token: str) -> None:
    r = client.post("/build?format=stl", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


def test_fails_closed_when_token_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEOMETRY_AUTH_DISABLED")
    r = client.post("/build?format=stl", headers={"Authorization": "Bearer "})
    assert r.status_code == 503
