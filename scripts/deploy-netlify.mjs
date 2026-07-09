/**
 * CLI draft upload + restoreSiteDeploy (same flow as students/heishi).
 * Avoids `netlify deploy --prod` (may return Forbidden when credits are tight)
 * and avoids Git-triggered Netlify builds.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteId = "436960d0-e806-404d-86db-9a07a1a682ed";
const prodUrl = "https://ahfosh.netlify.app";
const projectSlug = "ahfosh";

function quoteArg(value) {
  return /[\s"]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

function runNetlify(args) {
  const command = ["netlify", ...args].map(quoteArg).join(" ");
  return execSync(command, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
}

function extractDeployId(output) {
  const fromDraftUrl = output.match(/Draft URL:\s*<?https:\/\/([a-f0-9]+)--/i);
  if (fromDraftUrl) return fromDraftUrl[1];

  const fromUniqueUrl = output.match(
    /Unique Deploy URL:\s*<?https:\/\/([a-f0-9]+)--/i,
  );
  if (fromUniqueUrl) return fromUniqueUrl[1];

  const fromDeployId = output.match(/Deploy ID:\s*([a-f0-9]+)/i);
  if (fromDeployId) return fromDeployId[1];

  const fromDeployIdAlt = output.match(/deployId:\s*([a-f0-9]+)/i);
  if (fromDeployIdAlt) return fromDeployIdAlt[1];

  throw new Error(
    "无法从 netlify deploy 输出中解析 deploy ID\n--- output ---\n" + output,
  );
}

console.log("Uploading site root (draft, no build) ...");
let deployOutput;
try {
  deployOutput = runNetlify(["deploy", "--dir=.", "--message", "CLI draft deploy"]);
} catch (err) {
  const stdout = err.stdout?.toString?.() ?? "";
  const stderr = err.stderr?.toString?.() ?? "";
  console.error(stdout);
  console.error(stderr);
  throw err;
}

// Always show CLI summary lines for debugging
const summary = deployOutput
  .split(/\r?\n/)
  .filter((line) =>
    /draft|deploy|url|upload|hash|function|edge|unique|build/i.test(line),
  )
  .slice(-40);
if (summary.length) console.log(summary.join("\n"));

const deployId = extractDeployId(deployOutput);
console.log(`Draft deploy ready: ${deployId}`);

console.log("Publishing to production (restoreSiteDeploy) ...");
try {
  runNetlify([
    "api",
    "restoreSiteDeploy",
    "--data",
    JSON.stringify({ site_id: siteId, deploy_id: deployId }),
  ]);
} catch (err) {
  const stdout = err.stdout?.toString?.() ?? "";
  const stderr = err.stderr?.toString?.() ?? "";
  console.error(stdout);
  console.error(stderr);
  throw err;
}

console.log(`Production live: ${prodUrl}`);
console.log(
  `Deploy: https://app.netlify.com/projects/${projectSlug}/deploys/${deployId}`,
);
