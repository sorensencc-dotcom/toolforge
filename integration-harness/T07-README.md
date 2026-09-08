# T07 Open Notebook consumer integration

Phase B consumer integration contract.

Consumer checkout: `C:\dev\dev-sandbox\toolforge-herdr-trm-integration`,
fast-forwarded to `98442b2d` (`v2.65.0`) on `main`.

Pinned fixture: `lfnovo/open-notebook` at
`2d2df8a3cbb098776e56ca5ee77b9832f848228e` (MIT). Runner: Ubuntu/WSL2 Linux.

The integration test uses `API_PORT=<isolated-port> uv run --with uvicorn
python run_api.py` from the pinned checkout, an isolated loopback port, a 30-second health wait, and only
`PATH`, `HOME`, `OPEN_NOTEBOOK_PORT`, and explicitly declared provider
variables. It sends one bounded `POST /chat/execute`, then terminates the
supervised process group and verifies no owned processes remain.

When the fixture or `uv` runtime is absent, the test reports
`RUNTIME_FIXTURE_UNAVAILABLE` and skips. That skip is not lifecycle or
production proof.

Placeholder commands, unpinned dependency versions, and example credentials
are not executable CI configuration.
