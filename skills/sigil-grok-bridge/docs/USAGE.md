# Usage Guide: Sigil Grok Bridge

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SIGIL_CONNECTOR_URL` | `http://127.0.0.1:4411` | Local loopback connector API address |

## Step-Up Authentication Flow

Tasks flagged as requiring elevated authority enter `approval.status = "pending"`. The bridge rejects dispatch until the human operator completes the step-up challenge on the local connector.
