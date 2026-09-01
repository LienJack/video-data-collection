import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const MAX_TRACKED_FILE_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_FIXTURE_BYTES = 250 * 1024;
const mediaExtensions = new Set([".mp4", ".mov", ".insv", ".avi", ".mkv", ".webm"]);
const textExtensions = new Set([
  ".css", ".env", ".example", ".html", ".js", ".json", ".jsx", ".md",
  ".mjs", ".mts", ".sql", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);
const secretPatterns = [
  { name: "private key PEM", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "provider secret", expression: /\b(?:sk|sb_secret)_[A-Za-z0-9_-]{20,}\b/ },
  {
    name: "committed environment secret",
    expression: /(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|CRON_SECRET|JWT_SECRET|MARKER_PRIVATE_KEY_JWK)\s*=\s*(?!replace-|\$\{|<)[A-Za-z0-9_+/.=-]{32,}/,
  },
];

function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("git ls-files failed");
  return result.stdout.split("\0").filter(Boolean);
}

const failures: string[] = [];
for (const file of trackedFiles()) {
  const size = statSync(file).size;
  const extension = path.extname(file).toLowerCase();
  if (size > MAX_TRACKED_FILE_BYTES) failures.push(`${file}: tracked file exceeds 5 MiB`);
  if (mediaExtensions.has(extension) && size > MAX_MEDIA_FIXTURE_BYTES) {
    failures.push(`${file}: media fixture exceeds 250 KiB`);
  }
  if (size <= 1024 * 1024 && (textExtensions.has(extension) || path.basename(file).startsWith(".env"))) {
    const text = readFileSync(file, "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.expression.test(text)) failures.push(`${file}: possible ${pattern.name}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Repository safety check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Repository safety check passed: no large tracked media or obvious committed secrets");
}
