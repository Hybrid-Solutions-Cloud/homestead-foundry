#!/usr/bin/env node
// Generates infra/params/model-catalog.json from a live Azure catalog query.
//
// ADR-0002 requires that deploy-time model names and versions are re-queried
// immediately before a deployment and never hardcoded, because preview models
// change version without notice. This script is how that requirement is met:
// it reads your model registry, asks Azure what is actually available in your
// target region right now, and writes the modelCatalog map the Bicep consumes.
//
// Usage:
//   node scripts/build-model-catalog.mjs --location eastus
//   node scripts/build-model-catalog.mjs --location eastus --registry models/registry.starter.json
//
// Requires the Azure CLI, logged in to the subscription you intend to deploy to.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const location = arg('location')
const registryPath = arg('registry', 'models/registry.starter.json')
const outPath = arg('out', 'infra/params/model-catalog.json')
const skip = new Set((arg('skip', '') || '').split(',').filter(Boolean))

if (!location) {
  console.error('error: --location is required, for example --location eastus')
  process.exit(2)
}

const registry = JSON.parse(readFileSync(resolve(registryPath), 'utf8'))

// On Windows the Azure CLI is a batch shim (az.cmd). Node refuses to execute a
// .cmd through execFileSync without a shell, so Windows takes the shell path.
// Because that path goes through a shell, location is validated first: it is
// the only value from the command line that reaches it.
if (!/^[a-z0-9]+$/i.test(location)) {
  console.error(`error: invalid --location "${location}". Expected a region name like eastus.`)
  process.exit(2)
}

const isWindows = process.platform === 'win32'
const azBin = isWindows ? 'az.cmd' : 'az'

const azArgs = ['cognitiveservices', 'model', 'list', '--location', location, '-o', 'json']

let available
try {
  // On Windows the whole invocation is passed as one pre-built string, because
  // Node warns when it concatenates an argument array into a shell command
  // itself. Every part of this string is either a literal or the validated
  // location above, so there is nothing unescaped reaching the shell.
  const raw = isWindows
    ? execFileSync(`${azBin} ${azArgs.join(' ')}`, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        shell: true,
      })
    : execFileSync(azBin, azArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  available = JSON.parse(raw)
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error(`error: could not find the Azure CLI (${azBin}) on PATH.`)
    console.error('Install it from https://aka.ms/azure-cli, then run `az login`.')
    process.exit(1)
  }
  console.error('error: the Azure CLI query failed. Are you logged in with `az login`?')
  console.error(err.stderr?.toString?.() ?? err.message)
  process.exit(1)
}

// Index the live catalog by lowercased model name, keeping the highest version
// Azure reports for each. Azure returns one current version per model, but
// guarding against duplicates keeps this stable if that ever changes.
const live = new Map()
for (const entry of available) {
  const m = entry.model ?? entry
  if (!m?.name || !m?.version) continue
  const key = m.name.toLowerCase()
  const existing = live.get(key)
  if (!existing || String(m.version) > String(existing.version)) {
    live.set(key, { name: m.name, version: m.version, format: m.format ?? entry.kind })
  }
}

// A registry id is kebab-cased and version-free (grok-4-3), while the catalog
// name is the vendor's own spelling (grok-4.3). Match on a normalized form.
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const liveByNormalized = new Map()
for (const [, v] of live) liveByNormalized.set(normalize(v.name), v)

// Vendors publish long catalog names (Llama-4-Maverick-17B-128E-Instruct-FP8)
// while deployment names are usually shortened (llama-4-maverick-17b). Fall
// back to a prefix match, but only when exactly one live model matches, so an
// ambiguous shortening is reported rather than silently resolved to whichever
// model happened to sort first.
function resolveModel(candidate) {
  const key = normalize(candidate)
  const exact = liveByNormalized.get(key)
  if (exact) return { match: exact }

  const prefixed = [...liveByNormalized.entries()].filter(([k]) => k.startsWith(key))
  if (prefixed.length === 1) return { match: prefixed[0][1] }
  if (prefixed.length > 1) {
    return { ambiguous: prefixed.map(([, v]) => v.name) }
  }
  return {}
}

const catalog = {}
const missing = []
const ambiguous = []

for (const entry of registry) {
  if (entry.status !== 'deployed') continue
  if (skip.has(entry.id)) continue

  const byDeploymentName = resolveModel(entry.deploymentName)
  const result = byDeploymentName.match || byDeploymentName.ambiguous
    ? byDeploymentName
    : resolveModel(entry.id)

  if (result.ambiguous) {
    ambiguous.push({ id: entry.id, candidates: result.ambiguous })
    continue
  }

  const match = result.match
  if (!match) {
    missing.push(entry.id)
    continue
  }

  catalog[entry.id] = {
    name: match.name,
    version: String(match.version),
    format: match.format ?? entry.provider,
  }
}

writeFileSync(resolve(outPath), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

console.log(`wrote ${Object.keys(catalog).length} catalog entries to ${outPath} (region ${location})`)

if (ambiguous.length) {
  console.log('')
  console.log('The following registry entries matched more than one catalog model:')
  for (const a of ambiguous) {
    console.log(`  - ${a.id} matches: ${a.candidates.join(', ')}`)
  }
  console.log('')
  console.log('Set that entry\'s deploymentName to the exact catalog name you want.')
}

if (missing.length) {
  console.log('')
  console.log('The following deployed registry entries are NOT available in this region:')
  for (const id of missing) console.log(`  - ${id}`)
  console.log('')
  console.log('Either remove them from your registry, change their status to planned,')
  console.log('add them to --skip if they are reached without a deployment resource')
  console.log('(a voice model selected by SSML voice name, for example), or deploy to a')
  console.log('region that offers them. The deployment fails fast on a deployable entry')
  console.log('with no catalog entry, by design.')
}

if (missing.length || ambiguous.length) process.exit(1)
