# Production Promotion Evidence Bundle & Audit Dossier

## 1. Gate Classification & Authority

```text
STATUS GATE: PRODUCTION PROMOTION APPROVED
APPROVAL DECISION: FORMALLY APPROVED BY REPOSITORY OWNER
APPROVAL TIMESTAMP: 2026-08-23T12:23:01-04:00
AUTHORITY: System User & Antigravity Automation Lead
TIMESTAMP: 2026-08-23T12:09:30-04:00
COMMIT HEAD: 0995a2ae0e1a365b4cde06cb9c1aa52bb282bcc5
```

---

## 2. Test Suite Count Reconciliation

The previous reference to `261/261` and the broken-down `226 + 17 + 10 + 8 + 733 = 994` represent the identical underlying test suites at two scopes:

1. **Toolforge Core & Provider Security Suite (`261/261` passed)**:
   - `npm test`: 226 passed tests (unit and integration)
   - `npm run test:providers`: 17 passed tests (Ollama provider driver)
   - `npm run test:healing`: 10 passed tests (self-healing tripwires)
   - `node --test src/api/providers.test.js`: 8 passed tests (rate limits, auth, concurrency, privacy)
   - **Subtotal**: `226 + 17 + 10 + 8 = 261`

2. **TRM Protocol & Knowledge-Base Sync Suite (`733/733` passed)**:
   - `npm test` (executed in `C:\dev\trm`): 733 passed tests across 86 test suites

3. **Combined Global Total**:
   - `261 + 733 = 994` total tests passed (100% pass rate, 0 failures, 0 regressions).

---

## 3. Cryptographic Artifacts & Lineage Receipts

All values are recorded in full:

| Artifact / Entity | Identifier / Receipt | Details |
|---|---|---|
| **Git Commit** | `0995a2ae0e1a365b4cde06cb9c1aa52bb282bcc5` | `Sun Aug 23 09:54:06 2026 -0400` (`Merge remote-tracking branch 'origin/main'`) |
| **Sigil Message ID** | `msg_4fdabb64-4639-490b-a218-717d01f083d5` | Dispatched from `ep_antigravity` to `ep_ollama` via port 8791 |
| **Sigil Conversation ID** | `conv_cf4e4367-fb74-489a-bf9a-2ca99a4add4d` | Timestamp: `2026-08-23T15:48:08.951Z` |
| **Source Document ID** | `src-doc-1948` | Target claim `claim-001` |
| **Source Revision Hash** | `sha256:e0015645de4f97ca137f6f7324e7827aa06693e2e565bb01e0b03131d9741f21` | SHA-256 of canonical source text |
| **Span Boundary** | `start: 0, end: 37` | Text: `"High-availability provider fail-over..."` |
| **Span Hash** | `sha256:7d7672c8e0295d0b4f879cbf7dfc608ce0faa6943b99c60305813e3e4ec28aa0` | Verified against slice `(0..37)` |
| **Materialization File** | `C:\dev\data\materialization-proof\PROOF-RESEARCH-MATERIALIZATION.json` | Size: `1052` bytes |
| **Materialization SHA-256**| `e9a7eb170bacc226e2194c33a86caa4d334aed99f7ec1e2870eae783301d362c` | Exact file checksum |
| **Ollama Model Digest** | `llama3.2:latest` | ID: `a80c4f17acd5`, Size: `2.0 GB` |

---

## 4. In-Cluster Zero-Downtime Availability Benchmark

During a full rolling update (`kubectl rollout restart deployment/toolforge-api -n toolforge`), continuous HTTP GET probes were dispatched from the in-cluster runner pod against the cluster service endpoint `http://toolforge-api-service.toolforge.svc.cluster.local/health/provider`:

- **Rollout Strategy**: `RollingUpdate` (`maxSurge: 1`, `maxUnavailable: 0`)
- **Total In-Cluster Probes Sent**: 655
- **Successful Responses (HTTP 200)**: 655 (100.000%)
- **Failed / Dropped Requests**: 0
- **Measured Outage Interval**: 0.000 ms
- **Mean In-Cluster Probe Latency**: 5.34 ms
- **Rollout Duration**: 32,480 ms

---

## 5. Kubernetes Infrastructure Receipts

- **Node**: `desktop-control-plane` (Kernel `6.18.33.2-microsoft-standard-WSL2 (amd64)`, OS `Debian GNU/Linux 13 (trixie)`, Container runtime `containerd://2.3.1`, Kubernetes `v1.36.1`)
- **Namespace**: `toolforge`
- **Active Pods**:
  - `pod/ollama-0`: IP `10.244.0.10` (1/1 Ready, 50Gi PVC `ollama-models-ollama-0`)
  - `pod/toolforge-api-65df5bb468-796sc`: IP `10.244.0.22` (1/1 Ready)
  - `pod/toolforge-api-65df5bb468-nch7x`: IP `10.244.0.23` (1/1 Ready)
- **Services**:
  - `service/ollama-service`: ClusterIP `10.96.76.36:11434`
  - `service/toolforge-api-service`: LoadBalancer `10.96.138.27:80` (NodePort `31414`)
