#!/usr/bin/env node
// Pre-commit / CI guard against leaking identity, real resource names, brand
// content, Lucid invitation tokens, em-dashes, and malformed CAF names.
//
// Scans a *diff* by default (staged changes locally, or a commit/PR range in
// CI) rather than the whole tree, because this repo intentionally still
// carries real values under ai/ and pmo/ while private (see DECISIONS.md
// D-14). Retroactive re-scrubbing of existing content happens at the
// genericization pass (ROADMAP.md Track 2 Phase B/F), not here. Pass --full
// to scan the entire tracked tree instead - that mode is for the pre-public
// flip check in Phase F, not routine CI.
//
// Usage:
//   node scripts/scan-public-safety.mjs                 # staged diff (pre-commit)
//   node scripts/scan-public-safety.mjs --range=A..B     # explicit commit range (CI)
//   node scripts/scan-public-safety.mjs --full           # whole tracked tree (Phase F)
//
// Worked-example regions (Phase B, D-03): a genericized ai/ doc keeps the
// real Gunner the Lab / Holdfast Press instance as a "Worked example"
// appendix rather than deleting it. Wrap that content between
//   <!-- safety-scan-worked-example:start -->
//   <!-- safety-scan-worked-example:end -->
// to downgrade brand-token and caf-naming-lint findings inside it from
// blocking to a non-blocking warning (still visible for the Phase F
// pre-public-flip review). Every other rule (em-dash, email, Lucid token,
// local denylists) still blocks everywhere, including inside the region.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const fullScan = args.includes("--full");
const rangeArg = args.find((a) => a.startsWith("--range="));
const explicitRange = rangeArg ? rangeArg.slice("--range=".length) : null;

const SELF_EXEMPT_FILES = new Set([
  "scripts/scan-public-safety.mjs",
  "scripts/scan-public-safety.config.example.json",
]);
const IGNORE_MARKER = "safety-scan-ignore-line";
// Phase B (pmo/DECISIONS.md D-03) keeps the real Gunner the Lab / Holdfast
// Press instance as a clearly-marked "Worked example" appendix in each
// genericized ai/ doc rather than deleting it. Brand tokens inside a marked
// region are downgraded from blocking to a warning (still visible for the
// Phase F pre-public-flip review) instead of failing every commit that
// touches these files. Region markers are HTML comments, invisible in
// rendered markdown.
const WORKED_EXAMPLE_START = "safety-scan-worked-example:start";
const WORKED_EXAMPLE_END = "safety-scan-worked-example:end";

const DEFAULT_BRAND_TOKENS = ["gunner", "holdfast", "storyreader"];
const CAF_PREFIXES = ["rg", "aif", "ais", "kv", "sg", "st", "vnet", "log", "appi"];
const KNOWN_ENVS = ["dev", "test", "stage", "staging", "uat", "prod"];
// Real, pre-existing, shared platform resources this repo reuses but did not
// create, so they were never named to this repo's own CAF pattern (documented
// in AGENTS.md's Key Facts table). Not a placeholder and not a leak, just a
// name from an external naming convention - exempt from the malformed-shape
// lint entirely rather than re-litigating this same false positive per file.
const KNOWN_EXTERNAL_RESOURCE_NAMES = ["kv-hcs-vault-01"];
const PLACEHOLDER_MARKERS = [
  "example",
  "contoso",
  "sample",
  "demo",
  "placeholder",
  "myworkload",
  "workload",
  "xxx",
  "changeme",
];

function loadLocalConfig() {
  const configPath = path.join(__dirname, "scan-public-safety.config.local.json");
  if (!existsSync(configPath)) return { identityTokens: [], resourceNameTokens: [], brandTokens: [] };
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8"));
    return {
      identityTokens: parsed.identityTokens ?? [],
      resourceNameTokens: parsed.resourceNameTokens ?? [],
      brandTokens: parsed.brandTokens ?? [],
    };
  } catch (err) {
    console.error(`Could not parse ${configPath}: ${err.message}`);
    return { identityTokens: [], resourceNameTokens: [], brandTokens: [] };
  }
}

function git(argv) {
  // 64 MB: a large multi-file diff or a --full scan of a big tree can exceed
  // Node's 1 MB execFileSync default and throw ENOBUFS instead of returning.
  return execFileSync("git", argv, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function getAddedLines() {
  if (fullScan) {
    const files = git(["ls-files"]).split("\n").filter(Boolean);
    const lines = [];
    for (const file of files) {
      const abs = path.join(repoRoot, file);
      let content;
      try {
        content = readFileSync(abs, "utf8");
      } catch {
        continue; // binary or unreadable, skip
      }
      content.split("\n").forEach((text, idx) => {
        lines.push({ file, line: idx + 1, text });
      });
    }
    return lines;
  }

  const range = explicitRange
    ? [explicitRange]
    : ["--cached"];
  const diff = git(["diff", "-U0", ...range]);

  const lines = [];
  let currentFile = null;
  let currentLine = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      const p = raw.slice(4).trim();
      currentFile = p === "/dev/null" ? null : p.replace(/^b\//, "");
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      currentLine = parseInt(hunk[1], 10);
      continue;
    }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      if (currentFile) lines.push({ file: currentFile, line: currentLine, text: raw.slice(1) });
      currentLine += 1;
      continue;
    }
    if (!raw.startsWith("-")) {
      // context line in a -U0 diff shouldn't occur, but guard anyway
      currentLine += 1;
    }
  }
  return lines;
}

function isCafShaped(token) {
  const parts = token.split("-");
  if (parts.length < 4) return false;
  const [prefix, , ...rest] = parts;
  if (!CAF_PREFIXES.includes(prefix)) return false;
  return KNOWN_ENVS.includes(parts[parts.length - 3]) || rest.some((p) => KNOWN_ENVS.includes(p));
}

function looksPlaceholder(token) {
  const lower = token.toLowerCase();
  return PLACEHOLDER_MARKERS.some((m) => lower.includes(m));
}

// Worked-example region membership is determined from each file's CURRENT
// full content, not from the diff's stateful line walk. A diff only
// contains changed lines (-U0), so an edit that touches a line inside an
// already-marked region without also touching the start/end marker lines
// would otherwise be invisible to a stateful walk over just the diff -
// the scanner would never "see" the start marker for that pass and would
// wrongly treat the edited line as unmarked. Reading the real file and
// locating markers by absolute line number is correct regardless of which
// lines happen to be part of a given diff.
const workedExampleRangesCache = new Map();

function getWorkedExampleRanges(file) {
  if (workedExampleRangesCache.has(file)) return workedExampleRangesCache.get(file);
  const abs = path.join(repoRoot, file);
  let content;
  try {
    content = readFileSync(abs, "utf8");
  } catch {
    workedExampleRangesCache.set(file, []);
    return [];
  }
  const ranges = [];
  let start = null;
  content.split("\n").forEach((text, idx) => {
    const lineNo = idx + 1;
    if (text.includes(WORKED_EXAMPLE_START)) start = lineNo;
    if (text.includes(WORKED_EXAMPLE_END) && start !== null) {
      ranges.push([start, lineNo]);
      start = null;
    }
  });
  workedExampleRangesCache.set(file, ranges);
  return ranges;
}

function isInWorkedExample(file, line) {
  return getWorkedExampleRanges(file).some(([s, e]) => line >= s && line <= e);
}

function run() {
  const local = loadLocalConfig();
  const brandTokens = [...DEFAULT_BRAND_TOKENS, ...local.brandTokens];
  const lines = getAddedLines();
  const findings = [];

  const emDash = /—/;
  const lucidToken = /lucid\.app\/[^\s"')]*[?&](invitation|inviteToken|token)=/i;
  const email = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
  const placeholderEmailDomain = /@example\.(com|org|net)$/i;
  const cafToken = /\b(?:rg|aif|ais|kv|sg|st|vnet|log|appi)(?:-[a-z0-9]+){2,}\b/gi;
  const brandRegex = new RegExp(`\\b(${brandTokens.join("|")})\\b`, "i");

  for (const { file, line, text } of lines) {
    const inWorkedExample = isInWorkedExample(file, line);

    if (SELF_EXEMPT_FILES.has(file) || text.includes(IGNORE_MARKER)) continue;
    if (emDash.test(text)) {
      findings.push({ rule: "em-dash", file, line, detail: "em-dash (U+2014) found", blocking: true });
    }
    if (lucidToken.test(text)) {
      findings.push({ rule: "lucid-invitation-token", file, line, detail: "Lucid URL carries an invitation/token query param", blocking: true });
    }
    if (email.test(text) && !placeholderEmailDomain.test(text.match(email)[0])) {
      findings.push({ rule: "identity-email", file, line, detail: `possible email address: ${text.match(email)[0]}`, blocking: true });
    }
    if (brandRegex.test(text)) {
      findings.push({
        rule: "brand-token",
        file,
        line,
        detail: `brand token found: ${text.match(brandRegex)[0]}${inWorkedExample ? " (inside a marked Worked-example region)" : ""}`,
        blocking: !inWorkedExample,
      });
    }
    for (const needle of local.identityTokens) {
      if (needle && text.includes(needle)) {
        findings.push({ rule: "identity-token", file, line, detail: "matched local identity denylist entry", blocking: true });
      }
    }
    for (const needle of local.resourceNameTokens) {
      if (needle && text.includes(needle)) {
        findings.push({ rule: "resource-name-token", file, line, detail: "matched local resource-name denylist entry", blocking: true });
      }
    }
    const cafMatches = text.match(cafToken) ?? [];
    for (const token of cafMatches) {
      if (looksPlaceholder(token)) continue;
      if (KNOWN_EXTERNAL_RESOURCE_NAMES.includes(token.toLowerCase())) continue;
      if (!isCafShaped(token)) {
        findings.push({
          rule: "caf-naming-lint",
          file,
          line,
          detail: `"${token}" starts with a CAF prefix but does not match <prefix>-<workload>-<env>-<region>-<instance>${inWorkedExample ? " (inside a marked Worked-example region)" : ""}`,
          blocking: !inWorkedExample,
        });
      } else {
        // A real-looking CAF name is expected in private-phase content (pmo/, ai/implementation) per
        // DECISIONS.md D-14 - warn so it gets caught at the Phase F pre-public scrub, don't block every commit.
        findings.push({ rule: "caf-shaped-non-placeholder", file, line, detail: `"${token}" is a fully CAF-shaped, non-placeholder name - confirm it is safe to publish`, blocking: false });
      }
    }
  }

  if (findings.length === 0) {
    console.log(`scan-public-safety: clean (${lines.length} line(s) scanned, ${fullScan ? "full tree" : "diff"} mode)`);
    return 0;
  }

  const blocking = findings.filter((f) => f.blocking);
  const warnings = findings.filter((f) => !f.blocking);

  if (warnings.length > 0) {
    console.error(`scan-public-safety: ${warnings.length} warning(s) (non-blocking)\n`);
    for (const f of warnings) {
      console.error(`  [${f.rule}] ${f.file}:${f.line} - ${f.detail}`);
    }
  }

  if (blocking.length === 0) {
    console.log(`\nscan-public-safety: clean, no blocking findings (${lines.length} line(s) scanned, ${fullScan ? "full tree" : "diff"} mode)`);
    return 0;
  }

  console.error(`\nscan-public-safety: ${blocking.length} blocking finding(s)\n`);
  for (const f of blocking) {
    console.error(`  [${f.rule}] ${f.file}:${f.line} - ${f.detail}`);
  }
  return 1;
}

process.exit(run());
