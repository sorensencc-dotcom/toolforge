-
# Mobile Browser WebSocket Heartbeats

Mobile operating systems heavily throttle background JS intervals (e.g., locking `setInterval` to 1 ping/minute or pausing it entirely). 

To ensure liveness under **Workstream H**:
1. Leverage the **Page Visibility API** to trigger immediate reconnection and ping when the user focuses the page.
2. Store WebSocket backoff state in a persistent client cookie or local storage to resist sleep cycles.
