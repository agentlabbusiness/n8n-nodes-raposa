# n8n-nodes-raposa

An [n8n](https://n8n.io) community node for **Raposa Aval** — a human approval layer for AI agents. Put it in front of any step that moves money or changes something irreversible: the workflow pauses until an authorised person approves, and the decision is sealed in a hash-chained audit log you can export and verify.

## Operations

| Operation | What happens |
|---|---|
| **Ask and Wait** | Creates the approval, polls until a human approves or rejects. Timeout is an error — silence never counts as approval. Rejection fails the workflow unless you turn *Fail on Reject* off and route on `status` yourself. |
| **Create** | Creates the approval and returns its `id` immediately. Give a *Webhook URL* to receive the HMAC-signed decision instead of polling. |
| **Get** | Reads an approval by `id`. |

## Credentials

*Raposa API*: base URL (default `https://dcescrypt.com/api`) and your client API key. The credential test calls `GET /v1/me`.

Get a free sandbox key by email: https://raposa.group/start/?plan=sandbox

## Install

Self-hosted n8n: **Settings → Community Nodes → Install** → `n8n-nodes-raposa`.

## Develop

```bash
npm install
npm test        # builds, then runs the behaviour tests against a fake API
```

## Links

- Docs: https://raposa.group/docs/
- Legal (DPA, sub-processors): https://dcescrypt.com/legal/

MIT © DC ESCRYPT SL
