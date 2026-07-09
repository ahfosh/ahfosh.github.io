#!/usr/bin/env node
/**
 * Netlify file-digest deploy (no git build, no ZIP of whole site).
 *
 * Flow:
 *   1. Walk publish root, SHA1 every file
 *   2. POST full digest → Netlify returns only missing SHA1s
 *   3. PUT only those changed/new files
 *   4. Poll until deploy is ready
 *
 * Env:
 *   NETLIFY_AUTH_TOKEN  Personal access token (required)
 *   NETLIFY_SITE_ID     Site id or domain, e.g. abc123 or mysite.netlify.app (required)
 *
 * Usage:
 *   node scripts/netlify-deploy.mjs
 *   node scripts/netlify-deploy.mjs --dir .
 *   node scripts/netlify-deploy.mjs --draft
 *   node scripts/netlify-deploy.mjs --dry-run
 *   node scripts/netlify-deploy.mjs --message "hotfix styles"
 */

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.netlify.com/api/v1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set([
  ".git",
  ".github",
  ".gitlab",
  ".idea",
  ".vscode",
  "node_modules",
  "scripts",
  ".netlify",
]);

const SKIP_FILES = new Set([
  ".gitignore",
  ".gitattributes",
  ".DS_Store",
  "Thumbs.db",
  ".gitlab-ci.yml",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "netlify.toml",
  "README.md",
  "LICENSE",
  "LICENSE.md",
]);

function parseArgs(argv) {
  const opts = {
    dir: ".",
    draft: false,
    dryRun: false,
    message: "",
    concurrency: 6,
    timeoutMs: 5 * 60 * 1000,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") opts.dir = argv[++i];
    else if (a === "--draft") opts.draft = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--message" || a === "-m") opts.message = argv[++i] ?? "";
    else if (a === "--concurrency") opts.concurrency = Number(argv[++i]);
    else if (a === "--timeout") opts.timeoutMs = Number(argv[++i]) * 1000;
    else if (a === "--help" || a === "-h") opts.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function usage() {
  console.log(`Netlify API deploy (file digest / only upload changed files)

Required env:
  NETLIFY_AUTH_TOKEN
  NETLIFY_SITE_ID

Options:
  --dir <path>         Publish root (default: repo root)
  --draft              Draft deploy (not published)
  --dry-run            Hash files and print digest stats, no API calls
  --message, -m <msg>  Deploy title / message
  --concurrency <n>    Parallel uploads (default: 6)
  --timeout <sec>      Wait for ready (default: 300)
`);
}

function sha1(buf) {
  return createHash("sha1").update(buf).digest("hex");
}

async function walkFiles(dir, base = dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      await walkFiles(full, base, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (SKIP_FILES.has(ent.name)) continue;
    if (ent.name.startsWith(".")) continue;
    out.push(full);
  }
  return out;
}

/** Netlify path: posix, leading slash */
function toDeployPath(abs, publishRoot) {
  const rel = path.relative(publishRoot, abs).split(path.sep).join("/");
  return "/" + rel;
}

/** Encode path for PUT /files/{path} — encode each segment, keep slashes */
function encodeDeployPath(deployPath) {
  return deployPath
    .split("/")
    .map((seg) => (seg ? encodeURIComponent(seg) : ""))
    .join("/");
}

async function api(token, method, urlPath, { body, binary, headers = {} } = {}) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "ahfosh.github.io-netlify-deploy",
      ...(binary
        ? { "Content-Type": "application/octet-stream" }
        : body
          ? { "Content-Type": "application/json" }
          : {}),
      ...headers,
    },
    body: binary ? body : body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data
        ? JSON.stringify(data)
        : String(data ?? res.statusText);
    throw new Error(`${method} ${urlPath} → ${res.status}: ${msg}`);
  }
  return data;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitReady(token, deployId, timeoutMs) {
  const start = Date.now();
  let delay = 800;
  while (Date.now() - start < timeoutMs) {
    const d = await api(token, "GET", `/deploys/${deployId}`);
    const state = d.state;
    process.stdout.write(`\r  state: ${state}          `);
    if (state === "ready" || state === "current") {
      process.stdout.write("\n");
      return d;
    }
    if (state === "error" || state === "failed") {
      process.stdout.write("\n");
      throw new Error(`Deploy failed: ${d.error_message || state}`);
    }
    await sleep(delay);
    delay = Math.min(delay * 1.3, 5000);
  }
  process.stdout.write("\n");
  throw new Error(`Timed out waiting for deploy ${deployId}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!opts.dryRun && (!token || !siteId)) {
    usage();
    throw new Error("Set NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID");
  }

  const publishRoot = path.resolve(ROOT, opts.dir);
  const st = await stat(publishRoot);
  if (!st.isDirectory()) throw new Error(`Not a directory: ${publishRoot}`);

  console.log(`Scanning ${publishRoot} ...`);
  const absFiles = await walkFiles(publishRoot);
  absFiles.sort();

  /** @type {Record<string, string>} */
  const files = {};
  /** @type {Map<string, string>} sha1 -> first deploy path */
  const shaToPath = new Map();
  /** @type {Map<string, Buffer>} deployPath -> content */
  const contentByPath = new Map();

  let totalBytes = 0;
  for (const abs of absFiles) {
    const buf = await readFile(abs);
    const hash = sha1(buf);
    const deployPath = toDeployPath(abs, publishRoot);
    files[deployPath] = hash;
    contentByPath.set(deployPath, buf);
    if (!shaToPath.has(hash)) shaToPath.set(hash, deployPath);
    totalBytes += buf.length;
  }

  const fileCount = Object.keys(files).length;
  console.log(
    `Digest: ${fileCount} files, ${(totalBytes / 1024).toFixed(1)} KiB unique paths`,
  );

  if (opts.dryRun) {
    console.log("Dry run — sample paths:");
    for (const p of Object.keys(files).slice(0, 8)) {
      console.log(`  ${p}  ${files[p]}`);
    }
    if (fileCount > 8) console.log(`  ... +${fileCount - 8} more`);
    return;
  }

  console.log(
    `Creating ${opts.draft ? "draft " : ""}deploy on site ${siteId} ...`,
  );
  const createBody = {
    files,
    async: true,
    draft: opts.draft || undefined,
    title: opts.message || undefined,
  };

  let deploy = await api(token, "POST", `/sites/${siteId}/deploys`, {
    body: createBody,
  });

  // async create may still be preparing
  if (!deploy.required && deploy.state === "preparing") {
    console.log("Waiting for deploy manifest ...");
    const start = Date.now();
    while (Date.now() - start < 60_000) {
      deploy = await api(token, "GET", `/sites/${siteId}/deploys/${deploy.id}`);
      if (deploy.state !== "preparing" || deploy.required) break;
      await sleep(500);
    }
  }

  const required = deploy.required ?? [];
  console.log(`Deploy id: ${deploy.id}`);
  console.log(
    `Upload required: ${required.length} file(s) (unchanged reused by Netlify)`,
  );

  // One upload per unique required SHA (same content → same SHA)
  const uploads = [];
  for (const hash of required) {
    const deployPath = shaToPath.get(hash);
    if (!deployPath) {
      throw new Error(
        `Netlify asked for unknown SHA1 ${hash} (not in local digest)`,
      );
    }
    uploads.push({ hash, deployPath, body: contentByPath.get(deployPath) });
  }

  let done = 0;
  await mapPool(uploads, opts.concurrency, async ({ deployPath, body }) => {
    const encoded = encodeDeployPath(deployPath).replace(/^\//, "");
    // Retry a few times on transient failures
    let lastErr;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await api(token, "PUT", `/deploys/${deploy.id}/files/${encoded}`, {
          binary: true,
          body,
        });
        done++;
        process.stdout.write(
          `\r  uploaded ${done}/${uploads.length}: ${deployPath}                    `,
        );
        return;
      } catch (e) {
        lastErr = e;
        await sleep(400 * attempt);
      }
    }
    throw lastErr;
  });
  if (uploads.length) process.stdout.write("\n");

  console.log("Waiting for post-processing ...");
  const ready = await waitReady(token, deploy.id, opts.timeoutMs);

  console.log("Done.");
  console.log(`  state:     ${ready.state}`);
  console.log(`  url:       ${ready.ssl_url || ready.url || "(n/a)"}`);
  console.log(
    `  deploy:    ${ready.deploy_ssl_url || ready.deploy_url || "(n/a)"}`,
  );
  console.log(`  admin:     ${ready.admin_url || "(n/a)"}`);
}

main().catch((err) => {
  console.error("\nDeploy failed:", err.message || err);
  process.exit(1);
});
