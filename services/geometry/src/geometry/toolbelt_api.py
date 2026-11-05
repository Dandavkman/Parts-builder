"""HTTP faces of the CAD tool belt: a plain JSON API and an MCP endpoint (JSON-RPC over HTTP).

Both are stateless and protected by the same bearer token as /build. See geometry.toolbelt.
"""

import json
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Response

from geometry import __version__
from geometry.api import require_token
from geometry.toolbelt import call_tool, tool_definitions

router = APIRouter(dependencies=[Depends(require_token)])

MCP_PROTOCOL = "2025-03-26"
JsonObject = dict[str, Any]


@router.get("/tools")
def list_tools() -> JsonObject:
    """Every tool with its name, description and JSON Schema for the arguments."""
    return {"tools": tool_definitions()}


@router.post("/tools/{name}")
def run_tool(name: str, arguments: Annotated[JsonObject, Body()]) -> JsonObject:
    """Run one tool. The body is the tool's arguments, including the current `spec`."""
    if name not in {t["name"] for t in tool_definitions()}:
        raise HTTPException(status_code=404, detail=f"unknown tool '{name}'")
    return call_tool(name, arguments)


def _error(request_id: Any, code: int, message: str) -> JsonObject:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def _handle(message: Any) -> JsonObject | None:
    """One JSON-RPC message in, one response out (None for notifications)."""
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return _error(None, -32600, "Invalid Request")
    if "id" not in message:
        return None  # a notification such as notifications/initialized
    request_id, method = message["id"], message.get("method")
    params = message.get("params") or {}
    if method == "initialize":
        asked = params.get("protocolVersion")
        result: JsonObject = {
            "protocolVersion": asked if isinstance(asked, str) else MCP_PROTOCOL,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "parts-builder-cad", "version": __version__},
            "instructions": (
                "Start with new_part, then call one tool at a time. Pass the spec from the "
                "previous result to the next call. A failed call leaves the spec unchanged."
            ),
        }
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": tool_definitions()}
    elif method == "tools/call":
        name = params.get("name")
        if name not in {t["name"] for t in tool_definitions()}:
            return _error(request_id, -32602, f"Unknown tool: {name}")
        outcome = call_tool(str(name), params.get("arguments") or {})
        result = {
            "content": [{"type": "text", "text": json.dumps(outcome)}],
            "structuredContent": outcome,
            "isError": not outcome["ok"],
        }
    else:
        return _error(request_id, -32601, f"Method not found: {method}")
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


@router.post("/mcp")
def mcp(message: Annotated[Any, Body()]) -> Response:
    """MCP over HTTP (JSON responses, no sessions): initialize, ping, tools/list, tools/call."""
    if isinstance(message, list):
        replies = [r for r in (_handle(m) for m in message) if r is not None]
        body = json.dumps(replies) if replies else ""
    else:
        reply = _handle(message)
        body = json.dumps(reply) if reply is not None else ""
    if not body:
        return Response(status_code=202)
    return Response(content=body, media_type="application/json")


@router.get("/mcp")
def mcp_get() -> Response:
    """This server does not stream; clients should POST."""
    return Response(status_code=405, headers={"Allow": "POST"})
