---
source_title: "Mobile Browser WebSocket Heartbeats Specification & Analysis"
repository: "CIC Architecture & Research Archive - Accession 65, Box 69"
document_date: "2026-08-23"
verification_status: "verified"
category: "willow-run"
topic: mobile-websocket-heartbeats
status: active
synthesized_by: "llama3:8b-instruct-fp16"
bfcl_score: 0.694
model_selection_hash: "0548cb1e6856ccd29e3c73d212ef13bad6e566cc74c30a5ad8e8997d7cc8e42c"
last_updated: 2026-08-23T18:59:16.752832+00:00
---
# Mobile Browser WebSocket Heartbeats

Mobile operating systems heavily throttle background JS intervals (e.g., locking `setInterval` to 1 ping/minute or pausing it entirely). 

To ensure liveness under **Workstream H**:
1. Leverage the **Page Visibility API** to trigger immediate reconnection and ping when the user focuses the page.
2. Store WebSocket backoff state in a persistent client cookie or local storage to resist sleep cycles.
