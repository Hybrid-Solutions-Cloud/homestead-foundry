#!/usr/bin/env node
// Fails when published documentation has drifted from reality.
//
// Documentation goes stale quietly. An audit of this repository found the
// changelog page saying "nothing here yet", the model catalog listing fourteen
// deployed models as planned, and the landing page describing the project as
// private, all weeks after none of it was true. Nothing caught any of it,
// because nothing was looking. This is what looks.
//
// Six checks, none of which need Azure:
//   1. No published page uses language that asserts an undeployed or private state.
//   2. The root CHANGELOG.md and the docs site changelog agree on the latest release.
//   3. Every registry entry marked deployed appears in the model catalog as deployed.
//   4. Guides point at the starter registry, not the placeholder one.
//   5. Published spike and ADR counts match the number of files on disk.
//   6. Every spike and ADR is reachable from the site sidebar and its own index.
//
// Checks 5 and 6 exist because both failure modes had already happened. The
// landing page claimed seventeen spikes and twelve ADRs, the roadmap claimed
// nineteen and fourteen, and there were twenty-one and sixteen. Separately,
// ADR-0013 through ADR-0016 were authored, indexed, and left out of the sidebar,
// so the two records defining deployment tracks 2 and 3 could not be navigated
// to. Both are cheap to catch and expensive to notice by eye. See ADR-0017.
//
// With --live it adds a seventh check, comparing the registry against the model
// deployments that actually exist on an account. That one needs the Azure CLI.
//
// Point --live at the registry you actually deployed from. Comparing your own
// account against the starter roster reports every difference between the two,
// which is noise rather than drift.
//
// Usage:
//   node scripts/check-docs-currency.mjs
//   node scripts/check-docs-currency.mjs --registry models/registry.mine.json \
//     --live --account <name> --resource-group <rg> --skip <ids-with-no-deployment-resource>

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = (name) => process.argv.includes(`--${name}`)

const read = (p) => (existsSync(resolve(p)) ? readFileSync(resolve(p), 'utf8') : null)
const findings = []
const fail = (check, detail) => findings.push({ check, detail })

// ---------------------------------------------------------------------------
// 1. Staleness language in anything published.
// ---------------------------------------------------------------------------
// These phrases assert a state. When the state changes they become lies rather
// than merely out of date, which is why they are worth failing a build over.
const STALE_PHRASES = [
  'not yet deployed',
  'nothing here yet',
  'no live deployment',
  'has not been deployed',
  'repo is private',
  'repository is private',
  'while it is being generalized',
  'while it\'s being generalized',
  'planned shape',
  'not yet live-deployed',
  'smoke test pending',
]

const PUBLISHED = [
  'README.md',
  'docs/index.md',
  'docs/roadmap.md',
  'docs/changelog.md',
  'docs/guide/getting-started.md',
  'docs/guide/deployment.md',
  'docs/guide/methodology.md',
  'docs/guide/model-registry.md',
  'docs/reference/model-catalog.md',
  'docs/implementation/as-built.md',
]

for (const path of PUBLISHED) {
  const text = read(path)
  if (text === null) {
    fail('published-page-missing', `${path} is referenced as a published page but does not exist`)
    continue
  }
  const lower = text.toLowerCase()
  for (const phrase of STALE_PHRASES) {
    if (lower.includes(phrase)) {
      const line = text.split('\n').findIndex((l) => l.toLowerCase().includes(phrase)) + 1
      fail('stale-language', `${path}:${line} says "${phrase}"`)
    }
  }
}

// ---------------------------------------------------------------------------
// 2. The two changelogs are separate files and drift apart. They must not.
// ---------------------------------------------------------------------------
const version = (text) => text?.match(/^##\s*\[?(\d+\.\d+\.\d+)\]?/m)?.[1] ?? null

const rootChangelog = read('CHANGELOG.md')
const siteChangelog = read('docs/changelog.md')
const rootVersion = version(rootChangelog)
const siteVersion = version(siteChangelog)

if (!rootVersion) fail('changelog', 'CHANGELOG.md has no version heading')
if (!siteVersion) fail('changelog', 'docs/changelog.md has no version heading')
if (rootVersion && siteVersion && rootVersion !== siteVersion) {
  fail(
    'changelog-drift',
    `CHANGELOG.md is at ${rootVersion} but the site changelog is at ${siteVersion}. ` +
      'These are separate files and both need updating.'
  )
}

// ---------------------------------------------------------------------------
// 3. Registry and prose catalog must agree on what is deployed.
// ---------------------------------------------------------------------------
const catalog = read('docs/reference/model-catalog.md')
const registryPath = arg('registry', 'models/registry.starter.json')
const registryRaw = read(registryPath)

if (!registryRaw) {
  fail('registry-missing', `${registryPath} does not exist`)
} else if (catalog) {
  let registry
  try {
    registry = JSON.parse(registryRaw)
  } catch (err) {
    fail('registry-invalid', `${registryPath} is not valid JSON: ${err.message}`)
    registry = []
  }

  // Match on the vendor-ish token rather than the exact name, because the prose
  // catalog uses the vendor's spelling (grok-4.3) and the registry uses a
  // kebab-case id (grok-4-3).
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const catalogRows = catalog
    .split('\n')
    .filter((l) => l.trim().startsWith('|') && l.includes('|'))

  for (const entry of registry) {
    if (entry.status !== 'deployed') continue
    const key = normalize(entry.id)
    const row = catalogRows.find((l) => {
      const cells = l.split('|').map((c) => c.trim())
      const name = normalize(cells[1] ?? '')
      return name && (name === key || name.startsWith(key) || key.startsWith(name))
    })
    if (!row) {
      fail('catalog-missing-model', `${entry.id} is deployed in the registry but has no row in the model catalog`)
    } else if (!/`?deployed`?/i.test(row.split('|')[3] ?? '')) {
      fail(
        'catalog-status-drift',
        `${entry.id} is deployed in the registry but the model catalog does not mark it deployed`
      )
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Guides must send deployers to the real roster, not the placeholder.
// ---------------------------------------------------------------------------
for (const path of ['docs/guide/deployment.md', 'README.md']) {
  const text = read(path)
  if (text && text.includes('registry.example.json') && !text.includes('registry.starter.json')) {
    fail('placeholder-registry', `${path} points deployers at registry.example.json instead of the starter roster`)
  }
}

// ---------------------------------------------------------------------------
// 5. Published spike and ADR counts must match the files on disk.
// ---------------------------------------------------------------------------
// A landing page that miscounts its own evidence is the cheapest possible tell
// that nobody re-read it. Both of the pages checked here were wrong, in
// different directions, at the same time.
const ls = (dir, prefix) =>
  existsSync(resolve(dir))
    ? readdirSync(resolve(dir)).filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
    : []

const spikeFiles = ls('docs/research', 'SPIKE-')
const adrFiles = ls('docs/adr', 'ADR-')

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function spell(n) {
  if (n < 20) return ONES[n]
  if (n > 99) return String(n)
  const t = TENS[Math.floor(n / 10)]
  const o = n % 10
  return o === 0 ? t : `${t}-${ONES[o]}`
}

// Both the spelled form and the digits are accepted, so a page may say
// "twenty-one research spikes" or "21 research spikes".
const COUNTED = [
  { label: 'research spikes', actual: spikeFiles.length, pattern: /([\w-]+)\s+research spikes/gi },
  {
    label: 'ADRs',
    actual: adrFiles.length,
    pattern: /([\w-]+)\s+(?:Architecture Decision Records|ADRs)\b/gi,
  },
]

for (const path of ['docs/index.md', 'docs/roadmap.md', 'README.md']) {
  const text = read(path)
  if (!text) continue
  for (const { label, actual, pattern } of COUNTED) {
    const expected = spell(actual).toLowerCase()
    for (const m of text.matchAll(pattern)) {
      const claimed = m[1].toLowerCase()
      // Only judge tokens that are actually a number. "the research spikes" and
      // "several ADRs" are prose, not claims, and are none of this check's business.
      const isNumeric = /^\d+$/.test(claimed)
      const isSpelled = /^(?:[a-z]+)(?:-[a-z]+)?$/.test(claimed) && spellIsNumber(claimed)
      if (!isNumeric && !isSpelled) continue
      if (claimed !== expected && claimed !== String(actual)) {
        const line = text.slice(0, m.index).split('\n').length
        fail(
          'count-drift',
          `${path}:${line} says "${m[1]} ${label}" but there are ${actual} (${expected}) on disk`
        )
      }
    }
  }
}

function spellIsNumber(word) {
  if (ONES.includes(word)) return true
  const [tens, ones] = word.split('-')
  return TENS.includes(tens) && tens !== '' && (ones === undefined || ONES.slice(1, 10).includes(ones))
}

// ---------------------------------------------------------------------------
// 6. Every spike and ADR must be reachable: sidebar plus its own index.
// ---------------------------------------------------------------------------
// A document nobody can navigate to is not published. ADR-0013 through ADR-0016
// were authored, indexed, and omitted from the sidebar, which left the two
// records defining deployment tracks 2 and 3 unreachable from the site.
const siteConfig = read('docs/.vitepress/config.ts')
const adrIndex = read('docs/adr/index.md')
const researchIndex = read('docs/research/index.md')

if (!siteConfig) fail('config-missing', 'docs/.vitepress/config.ts does not exist')

const reachability = [
  { files: adrFiles, dir: 'docs/adr', index: adrIndex, indexPath: 'docs/adr/index.md' },
  { files: spikeFiles, dir: 'docs/research', index: researchIndex, indexPath: 'docs/research/index.md' },
]

for (const { files, dir, index, indexPath } of reachability) {
  if (index === null) fail('index-missing', `${indexPath} does not exist`)
  for (const file of files) {
    const slug = file.replace(/\.md$/, '')
    if (siteConfig && !siteConfig.includes(slug)) {
      fail('unreachable-doc', `${dir}/${file} is not in the docs/.vitepress/config.ts sidebar`)
    }
    if (index && !index.includes(slug)) {
      fail('unlinked-doc', `${dir}/${file} is not linked from ${indexPath}`)
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Optional: compare the registry against a real account.
// ---------------------------------------------------------------------------
if (has('live')) {
  const account = arg('account')
  const group = arg('resource-group')
  if (!account || !group) {
    fail('live-args', '--live needs --account and --resource-group')
  } else {
    const isWindows = process.platform === 'win32'
    const azBin = isWindows ? 'az.cmd' : 'az'
    const azArgs = [
      'cognitiveservices', 'account', 'deployment', 'list',
      '-n', account, '-g', group, '-o', 'json',
    ]
    try {
      const raw = isWindows
        ? execFileSync(`${azBin} ${azArgs.join(' ')}`, { encoding: 'utf8', shell: true, maxBuffer: 32 * 1024 * 1024 })
        : execFileSync(azBin, azArgs, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      const liveNames = new Set(JSON.parse(raw).map((d) => d.name))
      const registry = JSON.parse(registryRaw ?? '[]')
      const skip = new Set((arg('skip', '') || '').split(',').filter(Boolean))

      for (const entry of registry) {
        if (entry.status !== 'deployed' || skip.has(entry.id)) continue
        if (!liveNames.has(entry.deploymentName)) {
          fail('live-drift', `${entry.deploymentName} is deployed in the registry but not on ${account}`)
        }
      }
      for (const name of liveNames) {
        const known = registry.some((e) => e.deploymentName === name)
        if (!known) fail('live-drift', `${name} exists on ${account} but is not in the registry`)
      }
    } catch (err) {
      fail('live-query', `could not list deployments on ${account}: ${err.stderr?.toString?.().trim() ?? err.message}`)
    }
  }
}

// ---------------------------------------------------------------------------

if (findings.length === 0) {
  console.log('check-docs-currency: clean, published docs match the current state')
  process.exit(0)
}

console.error(`check-docs-currency: ${findings.length} finding(s)\n`)
for (const f of findings) console.error(`  [${f.check}] ${f.detail}`)
console.error('\nA published page that describes a state which is no longer true is a defect,')
console.error('not bookkeeping. Fix the page, or fix the thing it describes.')
process.exit(1)
