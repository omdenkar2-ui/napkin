# Next.js generated key exposure: response and verification

Reviewed on 2026-10-16. **Historical exposure is confirmed; use in a hosted
deployment has not been verified.** Repository checks alone do not close this
incident. Do not publish key values, manifests, environment dumps or raw logs.

## Evidence and scope

- Commit `c07f594325b059a2cccfb5a8cf1efa26a6f8f609` introduced
  `.next/cache/.previewinfo` and `.next/cache/.rscinfo` on 2026-04-09.
- Commit `cc7485e7760dedb761d0ad5fb56dff9468630dcd` removed them and ignored
  `.next/`. The old values remain publicly accessible in history.
- The historical `.next/diagnostics/framework.json` identifies Next.js 16.2.3.
  The frontend lockfile before cleanup specified 16.2.1; the current lockfile
  specifies 16.4.1. This discrepancy prevents assuming which build was deployed.
- `.previewinfo` contains Preview Mode signing/encryption keys and the
  Preview/Draft identifier, also used for on-demand revalidation. `.rscinfo`
  contains the Server Actions encryption key, not a Supabase or provider API key.
- Both historical cache timestamps ended on 2026-04-23. Next.js evaluates that
  expiration when building; it does not revoke material in an existing deployment.
- The later backend signing-key refresh changes concern Supabase's public JWKS
  cache. They do not regenerate this Next.js material.
- The current frontend source has no explicit Server Actions or Preview/Draft
  use. That observation does not cover older/private deployments or dependencies.
- The exact GitGuardian incident occurrence and any deployed keys have not been
  inspected. A generic detector does not prove that material is active.

## Repository mitigation

The independent CI artifact check inspects Git's index, without reading file
contents. It rejects `.next/`, `node_modules/`, `.vercel/output/` and the two cache
filenames, including force-added ignored files. It does not scan historical refs
or replace a general secret scanner or branch protection.

The explicit `npm run build:fresh-keys` command loads the production environment
using Next.js's own loader. It refuses a fixed `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`,
clears only the two key cache files, and builds Next.js. It compares the new
manifests with the previous local caches and manifests, retaining comparisons only
in process memory. Neither historical values nor their fingerprints are published.
Other caches are preserved. CI exercises this build workflow.

Normal `npm run build` and `npm start` retain their existing behavior. The owner
must explicitly choose the fresh-key build for incident remediation. This command
does not inspect historical deployments, and its comparisons cover only the local
artifacts available before the build. On a clean checkout, removing key caches and
refusing overrides ensures Next.js generates random replacement material.

If changing `distDir` in the future, update the workflow's default `.next` path.
Never run the workflow inside a live instance's build directory. If a shared key
is required across separate builds, the owner must privately rotate it and use
the normal build workflow instead; do not remove that configuration blindly.

## Owner checklist for Vercel

The Vercel project belongs to a separate account. Its owner should perform the
following privately, without pasting secrets into a chat:

1. Identify the project linked to `omdenkar2-ui/napkin`, its Root Directory and
   Build Command, the production alias, deployed commit and build time. The
   leaked files were in the repository root; normal frontend output is under
   `frontend/.next/`. Check whether either output was copied or restored.
2. Inventory production, preview and old deployments still reachable by their
   own URLs, including any version-skew routing to older builds.
3. Check whether `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is set in the relevant
   environments or shared/branch overrides. Compare privately against the exposed
   key; do not infer a match or mismatch merely from its presence.
4. If build output is available, privately compare `preview` in
   `.next/prerender-manifest.json`, `encryptionKey` in
   `.next/server/server-reference-manifest.json`, and the effective environment
   override against the historical material. Output only match/no-match, never
   values or fingerprints. If artifacts cannot be inspected, request a provider-side
   comparison or perform the clean replacement below.
5. If material matches, or its use cannot be ruled out, review this repository
   mitigation and build the intended commit without **Use existing Build Cache**.
   If no fixed key is needed, ensure the override is unset and explicitly use
   `npm run build:fresh-keys` as the Vercel Build Command in `frontend/`. If a shared
   key is needed, privately replace it when exposed or of uncertain provenance,
   clear the two key caches, and use the normal build. Keep build and runtime
   configuration consistent; rebuild after changing it. Use the provider's secret
   store, never Git, command arguments, screenshots or chat.
6. Require the new deployment to reach Ready and confirm its alias and commit.
   Use ordinary login/navigation checks and inspect errors; do not probe attacks.
   Remove or restrict affected old deployments using approved provider controls.
   A new production alias alone does not disable their direct URLs.
7. Record only project/deployment IDs, commit, time, comparison result and the
   disposition of old deployments. Mark the GitGuardian incident remediated only
   when no reachable deployment relies on the exposed material. Do not label it a
   false positive solely because the files were removed.

For a deployment proven never to have used the exposed values, no key rotation
is needed for this incident. Do not rotate Supabase, OAuth or unrelated API keys
without separate evidence.

## Effects and history

Replacing Preview/Draft material invalidates those preview sessions. Replacing
the Server Actions key can invalidate open forms or old page references; users
may need to reload. Coordinate replicas and build/runtime variables. These
changes do not inherently sign users out of Supabase. Rotation cannot restore
confidentiality of any previously captured encrypted payloads.

History rewriting is not required to invalidate the material. Consider it only
after addressing live deployments and evaluating the residual data risk. It
changes commit hashes, affects PRs and requires coordinated clone/branch cleanup;
it cannot erase copies already downloaded. No history rewrite is part of this fix.

## Official references

- [Next.js key cache implementation, 16.2.3](https://github.com/vercel/next.js/blob/v16.2.3/packages/next/src/server/app-render/encryption-utils-server.ts)
- [Next.js Preview key generation, 16.2.3](https://github.com/vercel/next.js/blob/v16.2.3/packages/next/src/build/preview-key-utils.ts)
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security)
- [Vercel deployment management](https://vercel.com/docs/deployments/managing-deployments)
- [GitGuardian generic encryption detector](https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/generics/generic_encryption_key)
- [GitHub sensitive-data removal and limitations](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
