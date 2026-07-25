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

let available
try {
  const raw = execFileSync(
    'az',
    ['cognitiveservices', 'model', 'list', '--location', location, '-o', 'json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  available = JSON.parse(raw)
} catch (err) {
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

const catalog = {}
const missing = []

for (const entry of registry) {
  if (entry.status !== 'deployed') continue
  if (skip.has(entry.id)) continue

  const match =
    liveByNormalized.get(normalize(entry.deploymentName)) ??
    liveByNormalized.get(normalize(entry.id))

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
  process.exit(1)
}
