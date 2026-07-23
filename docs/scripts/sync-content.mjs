// Copies the canonical architecture content from ai/ into the VitePress site
// tree so the published site renders the ADRs, design docs, research spikes,
// and implementation guide directly (instead of linking out to private-repo
// GitHub URLs that 404).
//
// The copies are generated at build time and are gitignored: ai/ stays the
// single source of truth. Runs automatically before docs:dev and docs:build.
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// First H1 of a markdown file, used for index link text.
function firstHeading(absPath, fallback) {
  const m = readFileSync(absPath, "utf8").match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

// The canonical ai/ docs use CAF placeholders like <workload>, <region>, <env>
// in prose. VitePress compiles every page through Vue after markdown-it, and a
// bare <tag> with no close is a hard compile error. Escape the tag-opening "<"
// to &lt; in prose only, leaving fenced code, inline code, and <https://...>
// autolinks exactly as authored (they render identically). The source under
// ai/ is untouched; only the generated copy under docs/ is sanitized.
function sanitizeForVue(md) {
  // Split out fenced code blocks (``` or ~~~) and leave them verbatim.
  return md
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // fenced code block
      // Within prose, leave inline code spans verbatim too.
      return seg
        .split(/(`[^`]*`)/g)
        .map((s, j) => {
          if (j % 2 === 1) return s; // inline code span
          // Escape every "<" that opens a pseudo-tag, but leave real markdown
          // autolinks (<https://...>, <http://...>, <mailto:...>) intact.
          return s.replace(/<(?!(?:https?:\/\/|mailto:))/g, "&lt;");
        })
        .join("");
    })
    .join("");
}

function copySanitized(srcAbs, destAbs) {
  writeFileSync(destAbs, sanitizeForVue(readFileSync(srcAbs, "utf8")));
}

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(docsRoot, "..");

// dest dir (under docs/, wiped and regenerated) <- source dir in ai/, with an
// optional filename filter. README index files in the source dirs are skipped.
const jobs = [
  {
    dest: "adr",
    src: "ai/adr",
    keep: (f) => /^ADR-\d+.*\.md$/i.test(f),
    index: {
      title: "ADR index",
      intro:
        "Every Architecture Decision Record this project has locked, in decision order. Each links to the full record, rendered here from the canonical source in `ai/adr/`.",
    },
  },
  {
    dest: "architecture",
    src: "ai/design",
    keep: (f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md",
  },
  {
    dest: "implementation",
    src: "ai/implementation",
    keep: (f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md",
  },
  {
    dest: "research",
    src: "ai/research",
    keep: (f) => /^SPIKE-\d+.*\.md$/i.test(f),
    index: {
      title: "Research spikes",
      intro:
        "Every research spike behind the architecture decisions, in order. Each grounds its findings in a first-party Microsoft Learn source or a named vendor's own documentation, and each traces forward to one or more ADRs.",
    },
  },
];

// One-off single-file copies (source path -> dest path under docs/).
const singles = [{ src: "ai/diagrams/INDEX.md", dest: "architecture/diagrams.md" }];

let copied = 0;
for (const job of jobs) {
  const destAbs = join(docsRoot, job.dest);
  rmSync(destAbs, { recursive: true, force: true });
  mkdirSync(destAbs, { recursive: true });
  const srcAbs = join(repoRoot, job.src);
  const files = readdirSync(srcAbs).filter(job.keep).sort();
  for (const f of files) {
    copySanitized(join(srcAbs, f), join(destAbs, f));
    copied++;
  }
  if (job.index) {
    const rows = files.map((f) => {
      const slug = f.replace(/\.md$/i, "");
      const title = firstHeading(join(srcAbs, f), slug);
      return `| [${slug}](./${slug}) | ${title.replace(/^[^:]+:\s*/, "")} |`;
    });
    const md =
      `# ${job.index.title}\n\n${job.index.intro}\n\n` +
      `| Record | Summary |\n|---|---|\n${rows.join("\n")}\n`;
    writeFileSync(join(destAbs, "index.md"), md);
    copied++;
  }
}

for (const s of singles) {
  const srcAbs = join(repoRoot, s.src);
  if (!existsSync(srcAbs)) continue;
  const destAbs = join(docsRoot, s.dest);
  mkdirSync(dirname(destAbs), { recursive: true });
  copySanitized(srcAbs, destAbs);
  copied++;
}

console.log(`[sync-content] copied ${copied} files from ai/ into the docs site tree`);
