import { createHash } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const previewFields = ["previewModeId", "previewModeSigningKey", "previewModeEncryptionKey"];
export class SecurityCheckError extends Error {}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function actionDigest(value) {
  try {
    if (typeof value !== "string" || !value) throw new Error();
    const bytes = Buffer.from(atob(value), "binary");
    if (![16, 24, 32].includes(bytes.length)) throw new Error();
    return digest(bytes);
  } catch {
    throw new SecurityCheckError("Server Actions key metadata is missing or invalid.");
  }
}

function assertNoOverride(env) {
  if (env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) {
    throw new SecurityCheckError("A fixed Server Actions key is configured. This fresh-key workflow requires it to be unset; have the deployment owner review it privately.");
  }
}

async function readJson(path, optional = false) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (optional && error.code === "ENOENT") return undefined;
    // JSON parser errors may contain key values; do not propagate their messages.
    throw new SecurityCheckError("Cannot read Next.js key metadata. No values were logged.");
  }
}

export async function prepareFreshBuild(distDir, env = process.env) {
  assertNoOverride(env);
  // Comparisons live only in this process; neither values nor hashes are persisted.
  const previous = Object.fromEntries([...previewFields, "actions"].map((key) => [key, new Set()]));
  const previewCache = resolve(distDir, "cache/.previewinfo");
  const rscCache = resolve(distDir, "cache/.rscinfo");
  for (const file of [previewCache, resolve(distDir, "prerender-manifest.json")]) {
    const data = await readJson(file, true);
    const preview = file === previewCache ? data : data?.preview;
    for (const field of previewFields) {
      if (typeof preview?.[field] === "string") previous[field].add(digest(preview[field]));
    }
  }
  for (const file of [rscCache, resolve(distDir, "server/server-reference-manifest.json")]) {
    const data = await readJson(file, true);
    const value = file === rscCache ? data?.["encryption.key"] : data?.encryptionKey;
    if (value) previous.actions.add(actionDigest(value));
  }
  for (const file of [previewCache, rscCache]) {
    try { await unlink(file); } catch (error) {
      if (error.code !== "ENOENT") throw new SecurityCheckError("Cannot remove the old Next.js key cache.");
    }
  }
  return previous;
}

export async function verifyFreshBuild(distDir, previous, env = process.env) {
  assertNoOverride(env);
  const prerender = await readJson(resolve(distDir, "prerender-manifest.json"));
  for (const field of previewFields) {
    const value = prerender?.preview?.[field];
    if (typeof value !== "string" || !value) {
      throw new SecurityCheckError("Preview metadata is incomplete; this build cannot be verified.");
    }
    if (previous[field].has(digest(value))) {
      throw new SecurityCheckError("Preview material was reused; this build is not a fresh-key build.");
    }
  }
  const actions = await readJson(resolve(distDir, "server/server-reference-manifest.json"));
  if (previous.actions.has(actionDigest(actions?.encryptionKey))) {
    throw new SecurityCheckError("Server Actions material was reused; this build is not a fresh-key build.");
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some((arg) => !["--webpack", "--turbopack"].includes(arg))) {
      throw new SecurityCheckError("Usage: npm run build:fresh-keys -- [--webpack | --turbopack]");
    }
    const { default: nextEnv } = await import("@next/env");
    nextEnv.loadEnvConfig(projectDir, false, {
      info() {},
      error() { throw new SecurityCheckError("Cannot load the production environment safely."); },
    });
    const distDir = resolve(projectDir, ".next");
    const previous = await prepareFreshBuild(distDir);
    console.info("Next.js fresh-key build: old key caches cleared; other caches preserved.");
    const code = await new Promise((accept, reject) => {
      const child = spawn(process.execPath, [resolve(projectDir, "node_modules/next/dist/bin/next"), "build", ...args], { cwd: projectDir, stdio: "inherit" });
      child.once("error", () => reject(new SecurityCheckError("Cannot launch the Next.js build.")));
      child.once("exit", (status) => accept(status ?? 1));
    });
    if (code !== 0) { process.exitCode = code; return; }
    await verifyFreshBuild(distDir, previous);
    console.info("Next.js fresh-key build passed: no fixed key override and no reuse of the inspected prior material. Hosted deployments remain unverified.");
  } catch (error) {
    console.error(error instanceof SecurityCheckError ? error.message : "Fresh-key build failed. No key values were logged.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
