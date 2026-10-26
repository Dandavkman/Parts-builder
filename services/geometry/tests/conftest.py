import pytest


@pytest.fixture(autouse=True)
def _auth_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Most tests call the API directly; test_auth.py turns the check back on."""
    monkeypatch.delenv("GEOMETRY_SERVICE_TOKEN", raising=False)
    monkeypatch.setenv("GEOMETRY_AUTH_DISABLED", "1")
