# Controlled release checklist

`0.2.0` is a security release: only an exact `approved` decision may leave the
*Approved / Success* output. Preparation does not authorize publication.

Before pushing the release tag, all of the following must be true:

1. The GitHub environment `npm-publish` exists and has Darius Ceponas as a
   required reviewer. Merely naming an environment in the workflow is not an
   approval gate.
2. The npm Trusted Publisher for `n8n-nodes-raposa` names this repository, the
   workflow `.github/workflows/publish.yml`, and the same `npm-publish`
   environment. npm publisher configuration is checked in the npm account UI;
   package metadata does not expose it.
3. The owner has approved the exact commit and the exact `v0.2.0` tag.
4. `npm ci`, `npm run lint`, `npm test`, `npm run scan:community`,
   `npm audit --omit=dev`, and `npm pack --dry-run` pass from that clean commit.
5. The published workflow must finish its registry tarball SHA-1 comparison,
   SLSA provenance readback, and exact-version n8n registry scan.

Do not retry a partial publication under the same version. Reconcile npm and
GitHub state first, then select a new version if the registry accepted the
artifact.
