# Security notes

Reviewed 2026-11-02. Automated checks support the implementation; they do not constitute an independent penetration test or legal/compliance certification.

## Deployment boundary

Use HTTPS before serving real users, set `CLIENT_ORIGIN` to the exact public origin and keep API/PostgreSQL/AI ports private. The default Compose web binding is loopback for local evaluation or an ingress on the same host. Secure cookies remain enabled in production. Do not add wildcard credentialed CORS origins.

`TRUST_PROXY` is an explicit trusted-hop count; Compose uses one internal web proxy. Your public ingress must overwrite untrusted forwarding headers. The bounded per-process limiter is a baseline, not distributed throttling; use an ingress/shared limiter before adding replicas.

Use a secrets manager for production credentials. Restrict access to the database, upload volume, Chroma volume and backups. Tenant isolation is enforced by application authorization and scoped queries; PostgreSQL row-level security is not enabled. Do not give tenants database credentials.

Private downloads require a live session and are served as attachments. File signatures and size limits are checked. Malware scanning is an operator extension if arbitrary employee documents are accepted in a regulated environment. Uploads are never served as executable web content.

## Chroma advisories and reviewed exception

The package registry's newest available Chroma release at verification was **1.5.9**. The audit reports five findings across four advisory IDs, with no published fixed version:

| Advisory                         | Upstream path                                                                        | PeopleOS control                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| PYSEC-2026-311 / CVE-2026-45829  | Python Chroma collection/configuration endpoints and embedding configuration loading | No Chroma HTTP server; private Rust-backed `PersistentClient`; no user-supplied collection config; `embedding_function=None`; explicit vectors |
| PYSEC-2026-3814 / CVE-2026-45833 | Collection update/configuration code injection                                       | No configuration-update endpoint or arbitrary model repository input                                                                           |
| PYSEC-2026-3815 / CVE-2026-45831 | SimpleRBAC tenant-resource checks                                                    | SimpleRBAC is unused; NestJS derives the tenant and authorizes all requests                                                                    |
| PYSEC-2026-3813 / CVE-2026-45830 | Chroma HTTP data endpoints crossing tenants                                          | No Chroma HTTP endpoints; hashed tenant collections plus document allowlists                                                                   |

This is our deployment-specific mitigation assessment, not a claim that the upstream package is fixed. The allowlist in [ai/audit-policy.json](../ai/audit-policy.json) is limited to this exact version and expires **2026-12-02**. `python scripts/audit.py` fails on new advisories, a changed Chroma version or an expired review. Reassess and upgrade when a patched release is published. Do not reuse this exception for an exposed Chroma server or accept collection/model configurations from users.

Primary upstream discussions: [code-injection report](https://github.com/chroma-core/chroma/issues/6717), [tenant-scope fix proposal](https://github.com/chroma-core/chroma/pull/7602). Regression tests verify actual persistent retrieval isolation, document allowlists, disabled embedding plugins, unavailable Chroma HTTP routes and refusal for fabricated citations.

## Dependency checks

Both Node applications' production dependency audits passed with zero findings during verification. Remaining npm findings concern development-only minimatch chains in the upstream Nest CLI/ESLint toolchain. Deployment runtimes omit those development tools. Forced audit downgrades are not applied. Dependabot monitors the manifests and GitHub Actions; inspect lockfile changes and run the test matrix before merging upgrades.

Python runtime dependencies are pinned in `requirements.lock`, including the Linux-only uvloop dependency. Test/audit tools are separated in `requirements-dev.txt`. The raw audit still reports the reviewed Chroma findings; the policy wrapper makes that exception explicit.

## Operational controls

- Preserve at least one owner. Revoke member access or archive a linked employee to end sign-in; changing a role invalidates its existing sessions.
- Existing account passwords are never reset by another workspace's administrator when adding that account as a member.
- Password changes revoke all of the user's sessions. Account invitation email and automated password-reset delivery require a future mail integration; distribute initial passwords securely.
- Keep resume/handbook content, authentication cookies, provider keys and database URLs out of logs. Basic service logs are available; external monitoring is not silently connected to an account.
- Treat handbook answers and resume assessments as assistance. Human reviewers remain responsible for decisions; policies/legal obligations must be maintained by the organization.
- Back up PostgreSQL and files together, protect backups and test restoration. Rotate exposed secrets and restart affected services; do not commit `.env` or diagnostic traces from real-user sessions.
