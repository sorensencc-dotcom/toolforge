"""Loopback reference for MCP Python SDK 2.x, plus an in-memory ledger.

Verified against mcp 2.3.0. `MCPServer.run` accepts `stateless_http` only on
the ``streamable-http`` overload, and the default is False.
`streamable_http_app(stateless_http=True)` takes the same flag.
mcp 1.29.0 does not export `MCPServer`; do not run this file on that line.

Default invocation binds `127.0.0.1:8765` with fixed principal `local:kb-sync`
and no bearer token. `python <this-file> auth` binds `127.0.0.1:8767` with
`StubVerifier` and no fixed principal. `python <this-file> edge` illustrates
the empty-inventory proxy rule inside this process. It is not an edge
implementation to copy. In that illustration, `GET /mcp` is 405 and a
handshake-era `POST /mcp` is HTTP 400 `-32022`. The three processes do not
share a ledger.

This process does not open a database. The ledger is one dict and one
`asyncio.Lock` per process. That lock is the single commit for the task row
and the stored result. It is the stand-in for a database transaction, not a
substitute for Redis or Postgres across workers.

Do not copy routes onto a new Starlette app. That drops the SDK lifespan.
Do not wrap this in CORSMiddleware and call it an Origin check.
"""

from __future__ import annotations

import asyncio
import contextvars
import hashlib
import json
import sys
import time
import uuid
from dataclasses import dataclass
from typing import Any

from mcp.server import MCPServer
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.shared.exceptions import MCPError
from mcp_types import INVALID_PARAMS, CallToolResult, TextContent

LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})
CLIENT_REQUEST_ID = "dev.toolforge/clientRequestId"
RETRY_AFTER_SECONDS = 5
FAILED_RETRY_CAP = 3
IN_PROGRESS_TTL_SECONDS = 900.0
HANDSHAKE_VERSIONS = frozenset({"2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"})
MAX_REQUEST_BODY_SIZE = 4 * 1024 * 1024
_LOOPBACK_ORIGINS = ("http://127.0.0.1:", "http://localhost:", "http://[::1]:")

_subject: contextvars.ContextVar[str] = contextvars.ContextVar("caller_subject")


def require_loopback_or_auth(host: str, *, authenticated: bool) -> str:
    """Refuse a non-loopback bind when the process has no authentication."""
    if host not in LOOPBACK_HOSTS and not authenticated:
        raise ValueError(f"refusing to bind {host} without authentication")
    return host


def current_subject() -> str:
    """Return the subject the middleware published for this request."""
    return _subject.get()


def send_mutation(post):
    """Resend once, and only for `idempotency_in_progress`.

    `post` must send the same bytes both times. Any other `MCPError`, including
    every other `-32602`, propagates on the first call.
    """
    try:
        return post()
    except MCPError as exc:
        data = exc.data if isinstance(exc.data, dict) else {}
        if exc.code == -32602 and data.get("reason") == "idempotency_in_progress":
            time.sleep(data["retryAfterSeconds"])
            return post()
        raise


def _scope_header(scope: dict[str, Any], name: str) -> str | None:
    target = name.lower().encode("latin-1")
    for key, value in scope.get("headers", []):
        if key.lower() == target:
            return value.decode("latin-1")
    return None


def _origin_is_loopback(origin: str) -> bool:
    return any(origin.startswith(prefix) for prefix in _LOOPBACK_ORIGINS)


class EmptyInventoryEdge:
    """Illustration of the gate 5 proxy rule inside this process.

    Not a production proxy. Copying this class into a server is the
    repository-local parser the spec forbids.

    Reads the method, `Origin`, `Content-Length`, and `MCP-Protocol-Version`.
    Does not parse the JSON-RPC body. A disallowed `Origin` or a body over
    4 MiB is forwarded so the SDK still owns those two checks. Every other
    scope, including the lifespan, is forwarded.
    """

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http" or scope.get("path") != "/mcp":
            await self.app(scope, receive, send)
            return
        origin = _scope_header(scope, "origin")
        if origin is not None and not _origin_is_loopback(origin):
            await self.app(scope, receive, send)
            return
        length = _scope_header(scope, "content-length")
        if length is not None:
            try:
                oversized = int(length) > MAX_REQUEST_BODY_SIZE
            except ValueError:
                oversized = False
            if oversized:
                await self.app(scope, receive, send)
                return
        method = scope.get("method", "")
        if method == "GET":
            await send(
                {
                    "type": "http.response.start",
                    "status": 405,
                    "headers": [(b"allow", b"POST"), (b"content-length", b"0")],
                }
            )
            await send({"type": "http.response.body", "body": b""})
            return
        version = _scope_header(scope, "mcp-protocol-version")
        if method == "POST" and version in HANDSHAKE_VERSIONS:
            payload = json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {
                        "code": -32022,
                        "message": "Unsupported protocol version",
                        "data": {"supported": ["2026-07-28"], "requested": version},
                    },
                },
                separators=(",", ":"),
            ).encode("utf-8")
            await send(
                {
                    "type": "http.response.start",
                    "status": 400,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(payload)).encode("ascii")),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": payload})
            return
        await self.app(scope, receive, send)


def canonical_fingerprint(method: str, name: str, arguments: Any) -> str:
    """SHA-256 of a sorted JSON object.

    For the string and int arguments this sample sends, that encoding matches
    RFC 8785. Production code uses a JCS library and does not re-derive number
    formatting.
    """
    payload = {"method": method, "name": name, "arguments": arguments}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


class StubVerifier:
    """Map the bearer string `subject-a` or `subject-b` onto `AccessToken.subject`.

    Any other token is rejected. This is a conformance stub, not an OAuth server.
    """

    async def verify_token(self, token: str) -> AccessToken | None:
        if token not in {"subject-a", "subject-b"}:
            return None
        return AccessToken(token=token, client_id="probe", scopes=[], subject=token)


def _as_mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if value is None:
        return {}
    return dict(value)


def _structured(body: dict[str, Any]) -> dict[str, Any]:
    raw = body.get("structuredContent", body.get("structured_content"))
    return raw if isinstance(raw, dict) else {}


@dataclass
class LedgerRow:
    status: str
    fingerprint: str
    owner: str
    body: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    retries: int = 0
    retryable: bool = False
    started_at: float = 0.0


class Ledger:
    """One process-local store. Task id and idempotency row share this object."""

    def __init__(self) -> None:
        self.rows: dict[str, LedgerRow] = {}
        self.tasks: dict[str, str] = {}
        self._lock: asyncio.Lock | None = None

    def lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock


def _reject(reason: str, message: str, **extra: Any) -> MCPError:
    data: dict[str, Any] = {"reason": reason, **extra}
    return MCPError(INVALID_PARAMS, message, data)


class IdempotencyMiddleware:
    """Compare-and-set for tools registered with `@mutation`.

    `ServerMiddleware` is `mcp.server.context.ServerMiddleware`: async
    `(ctx, call_next)`. `ctx.method` and `ctx.params` are the raw request.
    Raising `MCPError` lets `mcp.shared.inbound.ERROR_CODE_HTTP_STATUS` pick
    the HTTP status. Application code does not import that table.
    """

    def __init__(self, mutations: set[str], ledger: Ledger, fixed_principal: str | None) -> None:
        self.mutations = mutations
        self.ledger = ledger
        self.fixed_principal = fixed_principal

    def _resolve_subject(self) -> str:
        token = get_access_token()
        if token is not None:
            if not token.subject:
                raise _reject("missing_caller_subject", "bearer token has no subject")
            return token.subject
        if self.fixed_principal:
            return self.fixed_principal
        raise _reject("missing_caller_subject", "no caller subject")

    async def __call__(self, ctx: Any, call_next: Any) -> Any:
        if ctx.method == "tasks/get":
            return await self._tasks_get(ctx)
        params = _as_mapping(ctx.params)
        name = params.get("name")
        if ctx.method != "tools/call" or name not in self.mutations:
            return await self._call(ctx, call_next, required=False)
        return await self._mutate(ctx, params, str(name), call_next)

    async def _call(self, ctx: Any, call_next: Any, *, required: bool) -> Any:
        if not required and get_access_token() is None and not self.fixed_principal:
            return await call_next(ctx)
        subject = self._resolve_subject()
        token = _subject.set(subject)
        try:
            return await call_next(ctx)
        finally:
            _subject.reset(token)

    async def _tasks_get(self, ctx: Any) -> dict[str, Any]:
        subject = self._resolve_subject()
        task_id = _as_mapping(ctx.params).get("taskId")
        if not isinstance(task_id, str):
            raise _reject("unknown_task", "tasks/get requires taskId")
        async with self.ledger.lock():
            key = self.ledger.tasks.get(task_id)
            row = self.ledger.rows.get(key) if key else None
            if row is None:
                raise _reject("unknown_task", "unknown task")
            if row.owner != subject:
                raise _reject("handle_owner_mismatch", "task owner does not match the caller")
            if row.error is not None:
                raise MCPError(row.error["code"], row.error["message"], row.error["data"])
            if row.body is None:
                return {"resultType": "task", "structuredContent": {"taskId": task_id, "status": "working"}}
            return json.loads(json.dumps(row.body))

    async def _mutate(self, ctx: Any, params: dict[str, Any], name: str, call_next: Any) -> Any:
        subject = self._resolve_subject()
        meta = _as_mapping(params.get("_meta"))
        client_request_id = meta.get(CLIENT_REQUEST_ID)
        if not isinstance(client_request_id, str) or not client_request_id:
            raise _reject("missing_client_request_id", "mutation requires dev.toolforge/clientRequestId")
        arguments = params.get("arguments")
        fingerprint = canonical_fingerprint(ctx.method, name, arguments)
        key = f"idempotency:v1:{subject}:{client_request_id}"
        async with self.ledger.lock():
            if name == "finish_job":
                # Validate before the insert so a bad task id cannot strand a row.
                self._owned_task(_as_mapping(arguments).get("taskId"), subject)
            cached = self._read_or_insert(key, fingerprint, subject)
            if cached is not None:
                return cached
        token = _subject.set(subject)
        try:
            result = await call_next(ctx)
        except BaseException as exc:
            # No await here, so the row update is atomic on the event loop.
            self._fail(key, exc)
            raise
        finally:
            _subject.reset(token)
        body = result if isinstance(result, dict) else dict(result)
        async with self.ledger.lock():
            return self._commit(key, name, arguments, body, subject)

    def _fail(self, key: str, exc: BaseException) -> None:
        """Release an IN_PROGRESS row after the tool raised or was cancelled.

        A cancelled or crashed call may or may not have had an effect, so the
        row is retryable and counts toward the retry cap. An MCPError is a
        deliberate rejection and is stored as the final answer.
        """
        row = self.ledger.rows[key]
        if isinstance(exc, MCPError):
            row.status = "COMPLETED"
            row.retryable = False
            row.body = None
            row.error = {"code": exc.code, "message": exc.message, "data": exc.data}
            return
        row.status = "FAILED"
        row.retryable = True
        row.body = None
        row.error = None

    def _read_or_insert(self, key: str, fingerprint: str, subject: str) -> Any | None:
        row = self.ledger.rows.get(key)
        if row is None:
            self.ledger.rows[key] = LedgerRow(
                status="IN_PROGRESS", fingerprint=fingerprint, owner=subject, started_at=time.monotonic()
            )
            return None
        if row.fingerprint != fingerprint:
            raise _reject("idempotency_fingerprint_mismatch", "client request id was reused with a different call")
        if row.status == "COMPLETED":
            if row.error is not None:
                raise MCPError(row.error["code"], row.error["message"], row.error["data"])
            return json.loads(json.dumps(row.body))
        if row.status == "IN_PROGRESS" and row.body and row.body.get("resultType") == "task":
            return json.loads(json.dumps(row.body))
        if row.status == "IN_PROGRESS" and time.monotonic() - row.started_at > IN_PROGRESS_TTL_SECONDS:
            # A crash left this row behind. Treat it as a retryable failure.
            row.status = "FAILED"
            row.retryable = True
        if row.status == "IN_PROGRESS":
            raise _reject(
                "idempotency_in_progress",
                "this client request id is still running",
                retryAfterSeconds=RETRY_AFTER_SECONDS,
            )
        if row.status == "FAILED" and row.retryable and row.retries < FAILED_RETRY_CAP:
            row.status = "IN_PROGRESS"
            row.body = None
            row.retries += 1
            row.started_at = time.monotonic()
            return None
        exhausted = {
            "code": INVALID_PARAMS,
            "message": "retry cap exhausted",
            "data": {"reason": "idempotency_retry_exhausted"},
        }
        row.status = "COMPLETED"
        row.retryable = False
        row.error = exhausted
        row.body = None
        raise MCPError(exhausted["code"], exhausted["message"], exhausted["data"])

    def _commit(self, key: str, name: str, arguments: Any, body: dict[str, Any], subject: str) -> dict[str, Any]:
        row = self.ledger.rows[key]
        stored = json.loads(json.dumps(body))
        if name == "finish_job":
            self._complete_task(_as_mapping(arguments).get("taskId"), subject)
        structured = _structured(stored)
        retryable = bool(stored.get("isError") and structured.get("retryable"))
        if stored.get("resultType") == "task":
            row.status = "IN_PROGRESS"
            row.body = stored
            task_id = structured.get("taskId")
            if isinstance(task_id, str):
                self.ledger.tasks[task_id] = key
        elif retryable:
            row.status = "FAILED"
            row.retryable = True
            row.body = stored
            row.error = None
        else:
            row.status = "COMPLETED"
            row.retryable = False
            row.body = stored
            row.error = None
        return stored

    def _owned_task(self, task_id: Any, subject: str) -> LedgerRow:
        """Return the task row, or reject when it is unknown or owned by another subject."""
        if not isinstance(task_id, str):
            raise _reject("unknown_task", "finish_job requires taskId")
        origin = self.ledger.tasks.get(task_id)
        task = self.ledger.rows.get(origin) if origin else None
        if task is None or task.body is None:
            raise _reject("unknown_task", "unknown task")
        if task.owner != subject:
            raise _reject("handle_owner_mismatch", "task owner does not match the caller")
        return task

    def _complete_task(self, task_id: Any, subject: str) -> None:
        task = self._owned_task(task_id, subject)
        prior = _structured(task.body)
        task.status = "COMPLETED"
        task.retryable = False
        task.error = None
        task.body = {
            "content": [{"type": "text", "text": "done"}],
            "structuredContent": {
                "taskId": task_id,
                "executions": prior.get("executions"),
                "subject": prior.get("subject"),
                "label": prior.get("label"),
                "status": "done",
            },
            "isError": False,
            "resultType": "complete",
        }


def mutation(mutations: set[str]):
    def wrap(fn):
        mutations.add(fn.__name__)
        return fn

    return wrap


def build_server(*, authenticated: bool) -> MCPServer:
    """Build one server. Authenticated mode installs the stub verifier and no fixed principal."""
    if authenticated:
        fixed_principal = None
        auth = AuthSettings(
            issuer_url="http://127.0.0.1:8767",
            resource_server_url="http://127.0.0.1:8767",
            validate_token_resource=False,
        )
        verifier: TokenVerifier | None = StubVerifier()
    else:
        fixed_principal = "local:kb-sync"
        auth = None
        verifier = None
    mutations: set[str] = set()
    ledger = Ledger()
    mcp = MCPServer(
        "kb-sync",
        instructions="Loopback knowledge-cache tools on Streamable HTTP.",
        middleware=[IdempotencyMiddleware(mutations, ledger, fixed_principal)],
        auth=auth,
        token_verifier=verifier,
    )
    _register(mcp, mutations)
    return mcp


def _register(mcp: MCPServer, mutations: set[str]) -> None:
    mark = mutation(mutations)
    executions = {"start_job": 0, "hold_note": 0, "flaky_note": 0, "boom_note": 0}
    hold = asyncio.Event()

    @mcp.tool()
    def search_kb(query: str, limit: int = 3) -> list[dict[str, str]]:
        """Search cached knowledge documents.

        Args:
            query: Search string.
            limit: Maximum records to return.
        """
        rows = [{"id": "doc_1", "title": query, "snippet": "cached"}]
        return rows[: max(0, limit)]

    @mcp.tool()
    @mark
    async def start_job(label: str) -> CallToolResult:
        """Start one stub task. A retry returns the stored task id."""
        executions["start_job"] += 1
        return CallToolResult(
            content=[TextContent(type="text", text="task")],
            structuredContent={
                "taskId": str(uuid.uuid4()),
                "executions": executions["start_job"],
                "subject": current_subject(),
                "label": label,
            },
            result_type="task",
        )

    @mcp.tool()
    @mark
    async def finish_job(taskId: str) -> str:
        """Ask the middleware to commit `taskId` in the same lock as this call."""
        return taskId

    @mcp.tool()
    @mark
    async def hold_note(note: str) -> dict[str, Any]:
        """Block until `release_hold`. A concurrent retry sees no stored result."""
        await hold.wait()
        executions["hold_note"] += 1
        return {"note": note, "executions": executions["hold_note"], "subject": current_subject()}

    @mcp.tool()
    @mark
    async def flaky_note(note: str) -> CallToolResult:
        """Always fail with a retryable error. Exercises the retry cap."""
        executions["flaky_note"] += 1
        return CallToolResult(
            content=[TextContent(type="text", text="try again")],
            structuredContent={"retryable": True, "executions": executions["flaky_note"]},
            isError=True,
        )

    @mcp.tool()
    @mark
    async def boom_note(note: str) -> str:
        """Raise. Exercises row release after a tool exception."""
        executions["boom_note"] += 1
        raise RuntimeError("boom")

    @mcp.tool()
    async def release_hold() -> str:
        """Unblock `hold_note`. This tool is not a mutation."""
        hold.set()
        return "released"


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "loopback"
    if mode == "auth":
        server = build_server(authenticated=True)
        host = require_loopback_or_auth("127.0.0.1", authenticated=True)
        port = 8767
    elif mode == "loopback":
        server = build_server(authenticated=False)
        host = require_loopback_or_auth("127.0.0.1", authenticated=False)
        port = 8765
    elif mode == "edge":
        # Illustration of the proxy rule. Not a proxy to copy into a server.
        server = build_server(authenticated=False)
        host = require_loopback_or_auth("127.0.0.1", authenticated=False)
        app = EmptyInventoryEdge(server.streamable_http_app(stateless_http=True, host=host))
        import uvicorn

        uvicorn.run(app, host=host, port=8765, log_level="warning")
        return
    else:
        raise SystemExit(f"unknown mode {mode!r}")
    server.run(transport="streamable-http", host=host, port=port, stateless_http=True)


if __name__ == "__main__":
    main()
