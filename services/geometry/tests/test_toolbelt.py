"""The CAD tool belt: tool functions, the JSON API and the MCP endpoint."""

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from geometry.api import app
from geometry.toolbelt import call_tool, tool_definitions

client = TestClient(app)
SKETCH = {
    "id": "sk",
    "plane": {"name": "XY"},
    "shapes": [{"outer": {"kind": "circle", "diameter_mm": 30}}],
}


def _start() -> dict[str, Any]:
    result = call_tool("new_part", {"name": "cup"})
    assert result["ok"]
    spec: dict[str, Any] = result["spec"]
    return spec


def _step(spec: dict[str, Any], tool: str, **args: Any) -> dict[str, Any]:
    return call_tool(tool, {"spec": spec, **args})


def test_every_tool_schema_is_valid_and_self_contained() -> None:
    for tool in tool_definitions():
        Draft202012Validator.check_schema(tool["inputSchema"])
        text = json.dumps(tool["inputSchema"])
        for ref in {part.split('"')[0] for part in text.split('"$ref": "#/$defs/')[1:]}:
            assert ref in tool["inputSchema"]["$defs"], (tool["name"], ref)


def test_build_a_cup_one_tool_at_a_time() -> None:
    spec = _start()
    sketch = _step(spec, "add_sketch", **SKETCH)
    assert sketch["ok"] and sketch["summary"]["solid_count"] == 0
    extruded = _step(sketch["spec"], "extrude", id="body", sketch="sk", distance_mm=40)
    assert extruded["summary"]["free_solids"] == ["body"]
    cup = _step(
        extruded["spec"], "hollow", id="cup", solid="body", thickness_mm=2, open_sides=["top"]
    )
    assert cup["ok"]
    assert cup["summary"]["free_solids"] == ["cup"]
    assert cup["summary"]["bbox_mm"]["z"] == [0.0, 40.0]
    assert cup["summary"]["volume_mm3"] == pytest.approx(8099.0, rel=1e-3)


def test_a_rejected_call_leaves_the_spec_unchanged() -> None:
    spec = _step(_start(), "add_sketch", **SKETCH)["spec"]
    bad = _step(spec, "extrude", id="body", sketch="nope", distance_mm=40)
    assert bad["ok"] is False
    assert any("'nope' is not a sketch" in e for e in bad["errors"])
    assert bad["spec"] == spec


def test_schema_mistakes_come_back_as_sentences() -> None:
    spec = _step(_start(), "add_sketch", **SKETCH)["spec"]
    bad = _step(spec, "extrude", id="body", sketch="sk", distance_mm=-5)
    assert bad["ok"] is False and bad["errors"]


def test_remove_feature_and_inspect() -> None:
    spec = _step(_start(), "add_sketch", **SKETCH)["spec"]
    spec = _step(spec, "extrude", id="body", sketch="sk", distance_mm=10)["spec"]
    info = _step(spec, "inspect_part")
    assert info["summary"]["solid_count"] == 1 and info["spec"] == spec
    assert _step(spec, "remove_feature", id="ghost")["ok"] is False
    removed = _step(spec, "remove_feature", id="body")
    assert removed["ok"] and removed["summary"]["solid_count"] == 0


def test_older_4_x_specs_are_upgraded_and_others_refused() -> None:
    old = {"spec_version": "4.0", "name": "x", "features": []}
    assert _step(old, "add_sketch", **SKETCH)["spec"]["spec_version"] == "4.3"
    refused = _step({"spec_version": "1.0", "name": "x", "features": []}, "inspect_part")
    assert refused["ok"] is False and "new_part" in refused["errors"][0]


def test_http_api_needs_a_token_and_lists_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEOMETRY_AUTH_DISABLED", raising=False)
    monkeypatch.setenv("GEOMETRY_SERVICE_TOKEN", "secret")
    assert client.get("/tools").status_code == 401
    assert client.post("/mcp", json={}).status_code == 401
    auth = {"Authorization": "Bearer secret"}
    names = [t["name"] for t in client.get("/tools", headers=auth).json()["tools"]]
    assert "extrude" in names and "new_part" in names
    reply = client.post("/tools/new_part", json={"name": "p"}, headers=auth).json()
    assert reply["ok"] and reply["spec"]["spec_version"] == "4.3"
    assert client.post("/tools/rm_rf", json={}, headers=auth).status_code == 404


@pytest.fixture(autouse=False)
def open_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEOMETRY_AUTH_DISABLED", "1")


def _rpc(method: str, params: dict[str, Any] | None = None, rid: int = 1) -> Any:
    return client.post(
        "/mcp", json={"jsonrpc": "2.0", "id": rid, "method": method, "params": params or {}}
    )


def test_mcp_handshake_list_and_call(open_auth: None) -> None:
    init = _rpc("initialize", {"protocolVersion": "2025-03-26"}).json()["result"]
    assert init["capabilities"]["tools"] is not None and init["serverInfo"]["name"]
    assert (
        client.post(
            "/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"}
        ).status_code
        == 202
    )
    tools = _rpc("tools/list").json()["result"]["tools"]
    assert {"name", "description", "inputSchema"} <= set(tools[0])
    started = _rpc("tools/call", {"name": "new_part", "arguments": {"name": "p"}}).json()["result"]
    assert started["isError"] is False and started["structuredContent"]["ok"]
    failed = _rpc(
        "tools/call",
        {
            "name": "extrude",
            "arguments": {
                "spec": started["structuredContent"]["spec"],
                "id": "e",
                "sketch": "x",
                "distance_mm": 5,
            },
        },
    ).json()["result"]
    assert failed["isError"] is True and "errors" in failed["structuredContent"]


def test_mcp_errors(open_auth: None) -> None:
    assert _rpc("nope").json()["error"]["code"] == -32601
    assert _rpc("tools/call", {"name": "nope"}).json()["error"]["code"] == -32602
    assert client.post("/mcp", json={"hello": 1}).json()["error"]["code"] == -32600
    assert client.get("/mcp").status_code == 405
