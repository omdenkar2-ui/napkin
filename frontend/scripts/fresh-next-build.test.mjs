import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { prepareFreshBuild, verifyFreshBuild } from "./fresh-next-build.mjs";

// Public synthetic fixtures, never historical or deployment keys.
const oldAction = Buffer.alloc(32, 1).toString("base64");
const newAction = Buffer.alloc(32, 2).toString("base64");
const oldPreview = { previewModeId: "synthetic-old-id", previewModeSigningKey: "synthetic-old-signing", previewModeEncryptionKey: "synthetic-old-encryption" };
const newPreview = { previewModeId: "synthetic-new-id", previewModeSigningKey: "synthetic-new-signing", previewModeEncryptionKey: "synthetic-new-encryption" };

async function fixture(t) {
  const dir = await mkdtemp(resolve(tmpdir(), "napkin-key-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(resolve(dir, "server"));
  await mkdir(resolve(dir, "cache"));
  return dir;
}
async function manifests(dir, preview = oldPreview, encryptionKey = oldAction) {
  await writeFile(resolve(dir, "prerender-manifest.json"), JSON.stringify({ preview }));
  await writeFile(resolve(dir, "server/server-reference-manifest.json"), JSON.stringify({ encryptionKey }));
}

test("clears only key caches, even with future expiry, and keeps comparisons in memory", async (t) => {
  const dir = await fixture(t);
  await writeFile(resolve(dir, "cache/.previewinfo"), JSON.stringify({ ...oldPreview, expireAt: Date.now() + 86400000 }));
  await writeFile(resolve(dir, "cache/.rscinfo"), JSON.stringify({ "encryption.key": oldAction }));
  await writeFile(resolve(dir, "cache/keep.txt"), "unrelated-cache");
  const previous = await prepareFreshBuild(dir, {});
  for (const name of [".previewinfo", ".rscinfo"]) await assert.rejects(readFile(resolve(dir, "cache", name)), { code: "ENOENT" });
  assert.equal(await readFile(resolve(dir, "cache/keep.txt"), "utf8"), "unrelated-cache");
  await manifests(dir, newPreview, newAction);
  await verifyFreshBuild(dir, previous, {});
});

test("works on a checkout with no prior build", async (t) => {
  const dir = await fixture(t);
  const previous = await prepareFreshBuild(dir, {});
  await manifests(dir, newPreview, newAction);
  await verifyFreshBuild(dir, previous, {});
});

test("a fixed key is refused before mutating caches", async (t) => {
  const dir = await fixture(t);
  await writeFile(resolve(dir, "cache/.previewinfo"), JSON.stringify(oldPreview));
  await assert.rejects(prepareFreshBuild(dir, { NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: oldAction }), /fixed Server Actions/);
  assert.deepEqual(JSON.parse(await readFile(resolve(dir, "cache/.previewinfo"), "utf8")), oldPreview);
});

test("each reused Preview field is detected from the prior manifest", async (t) => {
  const dir = await fixture(t);
  await manifests(dir);
  const previous = await prepareFreshBuild(dir, {});
  for (const field of Object.keys(oldPreview)) {
    await manifests(dir, { ...newPreview, [field]: oldPreview[field] }, newAction);
    await assert.rejects(verifyFreshBuild(dir, previous, {}), /Preview material was reused/);
  }
});

test("detects reused RSC bytes despite base64 whitespace and refuses runtime overrides", async (t) => {
  const dir = await fixture(t);
  await manifests(dir);
  const previous = await prepareFreshBuild(dir, {});
  await manifests(dir, newPreview, `\n${oldAction}\n`);
  await assert.rejects(verifyFreshBuild(dir, previous, {}), /Server Actions material was reused/);
  await manifests(dir, newPreview, newAction);
  await assert.rejects(verifyFreshBuild(dir, previous, { NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: newAction }), /fixed Server Actions/);
});

test("missing, incomplete and malformed artifacts fail without disclosing contents", async (t) => {
  const dir = await fixture(t);
  const previous = await prepareFreshBuild(dir, {});
  await assert.rejects(verifyFreshBuild(dir, previous, {}), /Cannot read/);
  await manifests(dir, {});
  await assert.rejects(verifyFreshBuild(dir, previous, {}), /incomplete/);
  await manifests(dir, newPreview, "invalid-key");
  await assert.rejects(verifyFreshBuild(dir, previous, {}), /missing or invalid/);
  await writeFile(resolve(dir, "prerender-manifest.json"), "SYNTHETIC-MUST-NOT-BE-LOGGED");
  await assert.rejects(verifyFreshBuild(dir, previous, {}), (error) => !error.message.includes("SYNTHETIC") && error.message.includes("No values were logged"));
});

test("CLI refuses an override without echoing its value", () => {
  const marker = "SYNTHETIC-MUST-NOT-BE-LOGGED";
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./fresh-next-build.mjs", import.meta.url))], { env: { ...process.env, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: marker }, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fixed Server Actions/);
  assert.equal((result.stdout + result.stderr).includes(marker), false);
});
