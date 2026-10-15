# Security and validation scope

This repository is a public development base. The later private client deployments have their own configuration and behavior. Passing CI here is not a security certification or evidence that all external integrations are ready for deployment.

## Authentication and data boundaries

- Protected API routes require a Supabase JWT in every environment. The frontend attaches the current access token, refreshes the session, and redirects unauthenticated visitors to login.
- The API's verifier currently accepts ES256 tokens from the configured project's JWKS. Configure compatible Supabase signing keys and test actual token expiry, refresh, and logout flows before hosting.
- The service-role key bypasses database row-level security. Keep it in backend environment variables only. API ownership/organization checks and the database's RLS policies both need review when adding endpoints.
- Migration `008_profile_authorization.sql` restricts browser-side profile updates so users cannot assign their own organization or role. Workspace provisioning is an administrator operation in this demo; signing up does not grant organization membership.
- Use the public anon/publishable key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never put the service-role key, Anthropic key, or OAuth client secrets in a `NEXT_PUBLIC_*` variable.
- Keep `.env` and `.env.local` untracked. The supplied examples contain placeholders. If a real secret is ever committed, revoke it and inspect repository history; removing the current file is insufficient.

## Feedback and generated output

Feedback, repository files, scraped pages, and uploaded documents are untrusted input. Synthesis prompts distinguish data from instructions, but prompts alone do not prevent prompt injection. Review proposed actions and specifications before executing or exporting them to real systems.

Analysis failures now preserve feedback for retry instead of creating random embeddings, arbitrary clusters, or synthetic findings. Empty categories remain valid. Model estimates and RICE scores still require human judgment; they are not measured customer impact or calibrated confidence.

Use synthetic or permissioned data while testing. Review retention, access, provider data handling, logging, and webhook authentication before connecting private business information.

## Dependency checks

From `frontend/`:

```bash
npm ci
npm audit --omit=dev
npm audit
```

The first audit covers production dependencies and is enforced in CI. The second also includes development tooling.

At the October 2026 review, the development toolchain still included `braces` through Next.js ESLint dependencies. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) describes stack exhaustion with deeply nested patterns and lists no patched version. This remains a known tooling limitation, not a claim that the full dependency tree is vulnerability-free. Avoid accepting arbitrary user-provided glob patterns in tooling and review upstream releases. Do not use a force-fix downgrade of Next.js or its ESLint configuration merely to clear the audit report.

Backend versions are recorded in `uv.lock`; `uv sync --locked --extra dev` rejects a stale lock. The unit suite is not a Python dependency vulnerability scan. Review advisories and update both lockfiles deliberately, running the checks after changes.

## Before enabling a hosted instance

1. Use HTTPS, a strong app secret, explicit frontend/CORS origins, and correct Supabase redirect URLs.
2. Apply numbered migrations to a controlled database and verify user/organization isolation with separate accounts. Do not run historical repair scripts automatically.
3. Test signup, confirmation, login, refresh, logout, unauthorized requests, and a feedback-to-result flow against real configured services.
4. Validate enabled OAuth callbacks, webhook signatures, integration permissions, file limits, and outbound destination handling.
5. Run one API instance while jobs use the in-process scheduler. Monitor failures, backups, rate limits, and external-provider usage.
6. Review the unfinished interface paths in the README before exposing them as working features.

Report vulnerabilities privately to the repository maintainers through GitHub's private vulnerability reporting option if enabled. Do not include credentials or customer data in public issues.
