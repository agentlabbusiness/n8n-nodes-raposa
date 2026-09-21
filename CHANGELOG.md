# Changelog

All notable changes to `n8n-nodes-raposa` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.7] — 2026-09-21

### Changed
- Republished through CI so the npm release carries a provenance attestation.
  0.1.6 was published locally (its npm metadata shows a non-CI Node runtime) and
  therefore shipped without provenance, which n8n's verified-community-node review
  flagged. No functional or code changes — this release is byte-for-byte the same
  node, re-released through the `publish.yml` GitHub Actions workflow (`id-token:
  write` + `npm publish --provenance`) so the attestation is present.

## [0.1.6] — 2026-09-21

### Added
- **Fail-fast when no approver is configured.** *Ask and Wait* now does a preflight
  `GET /v1/approvers` and, if the account has no approver, stops immediately with a
  clear, actionable error instead of polling until the timeout. Was the single most
  common reason a first production run never completed.
- **Approver notice in the credential** and a **“Before your first run”** section at
  the top of the README: *Ask and Wait* can only complete when a human can press
  Approve; a self-service sandbox key now has the owner's email set as the default
  approver automatically.
- **Importable example workflow** ([`docs/example-workflow.json`](docs/example-workflow.json))
  and a workflow diagram — import, pick your credential, run.

### Changed
- The timeout error now names the likely cause (no approver notified) and where to fix it.

## [0.1.5] — 2026-09-10

### Fixed
- An omitted optional **Context** no longer 422s: the API requires `context`
  (`min_length=1`), so an empty Context now sends the action text as the context.

## [0.1.4] — 2026-09-08

### Changed
- Republished through CI so the npm release carries a provenance attestation
  (0.1.3 was published locally, without provenance). Test updated to the
  `additionalFields` shape.

## [0.1.3] — 2026-09-05

### Fixed
- n8n manual-review fixes: optional fields and a proper `resource`/`operation`
  split; `dist` rebuilt.

## [0.1.0] — 2026-09-02

### Added
- First release: **Ask and Wait**, **Create**, and **Get** approval operations,
  bearer-token credential with a `GET /v1/me` test, light/dark icons, and
  `usableAsTool` support so the node works as a tool for AI agents.

[0.1.7]: https://github.com/agentlabbusiness/n8n-nodes-raposa/releases/tag/v0.1.7
[0.1.6]: https://github.com/agentlabbusiness/n8n-nodes-raposa/releases/tag/v0.1.6
[0.1.5]: https://github.com/agentlabbusiness/n8n-nodes-raposa/releases/tag/v0.1.5
[0.1.4]: https://github.com/agentlabbusiness/n8n-nodes-raposa/releases/tag/v0.1.4
[0.1.3]: https://github.com/agentlabbusiness/n8n-nodes-raposa/releases/tag/v0.1.3
[0.1.0]: https://github.com/agentlabbusiness/n8n-nodes-raposa/releases/tag/v0.1.0
