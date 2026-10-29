# n8n-nodes-raposa

An [n8n](https://n8n.io) community node for **Raposa Aval** — a human approval layer for AI agents. Put it in front of any step that moves money or changes something irreversible: the workflow pauses until an authorised person approves, and the decision is sealed in a hash-chained audit log you can export and verify.

## Before your first run — you need an approver

**Ask and Wait** only completes when a human presses **Approve**. That human is an *approver* on your Raposa account (a console login, or a linked Slack/Telegram). **If your account has no approver, the request has no one to go to and can only run to timeout** — that is the single most common reason a first run never succeeds.

- **Self-service sandbox key** ([raposa.group/start?plan=sandbox](https://raposa.group/start/?plan=sandbox)): your own email is set as the **default approver** automatically. You will receive an approve/reject link by email on your first request — no extra setup.
- **Removed it, or want more people?** Add approvers (or connect Slack/Telegram) in your account: [dcescrypt.com/api/portal](https://dcescrypt.com/api/portal). See [Who approves](https://raposa.group/docs/#who-approves).

From **0.1.6**, *Ask and Wait* checks for an approver first and fails immediately with a clear message instead of hanging for the full timeout.

## Try it in two minutes

Import [`docs/example-workflow.json`](docs/example-workflow.json) (**Workflows → ⋯ → Import from File**), pick your Raposa credential on the middle node, and run it.

![Example workflow: Manual Trigger → Raposa Ask and Wait → the guarded step](docs/example-workflow.svg)

## Operations

| Operation | What happens |
|---|---|
| **Ask and Wait** | Creates the approval and polls for a human decision. Only `approved` reaches the first (*Approved / Success*) output. Timeout, expiry, malformed responses, and unknown statuses always fail closed. Rejection fails unless you explicitly turn *Fail on Reject* off; then it is isolated on the second (*Not Approved*) output and can never reach the guarded connection. |
| **Create** | Creates the approval and returns its `id` immediately on the neutral *API Result* output. Give a *Webhook URL* to receive the HMAC-signed decision instead of polling. |
| **Get** | Reads an approval by `id` on *API Result*. A fetched status is data, not permission to run a protected action. |

## Credentials

*Raposa API*: base URL (default `https://dcescrypt.com/api`) and your client API key. The credential test calls `GET /v1/me`.

Get a free sandbox key at https://raposa.group/start/?plan=sandbox — you receive a one-time reveal link by email in seconds (100 approvals/month, no card), and your email is set as the default approver so your first *Ask and Wait* can be approved right away.

> Note on domains: the product is **Raposa**, run on **DC ESCRYPT** infrastructure. You request the key at `raposa.group`, and the API base URL in the credential is `dcescrypt.com/api` — that is expected, not a mistake.

## Install

Self-hosted n8n: **Settings → Community Nodes → Install** → `n8n-nodes-raposa`.

*Ask and Wait* has two outputs; *Create* and *Get* have one neutral output. For
a mandatory effect gate, connect the protected action only to *Approved /
Success*. n8n's own *Continue On Fail* and arbitrary workflow wiring are not a
security boundary; the target credential and final execution enforcement must
remain in the Raposa backend.

Upgrade note for `0.2.0`: existing *Ask and Wait* workflows with *Fail on
Reject* enabled keep the approved path on output 0. A workflow that deliberately
sets *Fail on Reject* off must connect its rejection handler to the new *Not
Approved* output; a rejection no longer shares the success connection.

## Develop

```bash
npm install
npm test        # builds, then runs the behaviour tests against a fake API
npm run scan:community
```

Maintainers must also complete the repository's
[controlled release checklist](https://github.com/agentlabbusiness/n8n-nodes-raposa/blob/main/RELEASE.md).
A local green build does not authorize a tag, npm publication, or production
deployment.

## Links

- Docs: https://raposa.group/docs/
- Legal (DPA, sub-processors): https://dcescrypt.com/legal/

MIT © DC ESCRYPT SL
