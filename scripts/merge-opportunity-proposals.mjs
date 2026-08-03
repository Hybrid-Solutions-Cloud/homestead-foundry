#!/usr/bin/env node
/**
 * Merge a discovery pass's proposals into a LIVE opportunity registry.
 *
 * This is the half that makes the list live rather than regenerated. Discovery
 * emits proposals; this merges them under rules that protect human decisions.
 * Nothing here is specific to any publisher: registry path, proposal path and
 * output path are all supplied by the caller.
 *
 * THE RULES, in the order they are enforced:
 *
 *   1. A proposal for an id that already exists NEVER changes its status.
 *      Discovery may only create entries at 'candidate'.
 *   2. A 'rejected' entry stays rejected, permanently. Re-proposing declined
 *      work on every pass is the single failure that makes these systems
 *      useless, so a proposal matching a rejected id is dropped and counted.
 *   3. Human edits win. Any field a human set is preserved; discovery may only
 *      refresh the evidence fields it owns: gapMeasurement, marketSignal,
 *      evidenceSources, and provenance.
 *   4. Re-measurement, not re-assertion. When a proposal carries a
 *      gapMeasurement with occurrences > 0 for an entry whose recorded gap was
 *      0, the gap has closed and the entry is FLAGGED for review rather than
 *      silently altered.
 *   5. Nothing is deleted. An entry that stops being confirmed ages via
 *      provenance.lastConfirmed and is proposed for retirement by a human.
 *
 * Usage:
 *   node merge-opportunity-proposals.mjs \
 *     --registry <path> --proposals <path> [--out <path>] [--apply]
 *
 * Without --apply it prints the decision report and writes nothing, which is
 * the mode a review runs in.
 *
 * Exit codes: 0 clean, 1 usage or validation error, 2 merged with conflicts
 * that need a human.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function usage(message) {
  if (message) console.error(`error: ${message}`);
  console.error(
    'usage: merge-opportunity-proposals.mjs --registry <path> --proposals <path> [--out <path>] [--apply]'
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--apply') { args.apply = true; continue; }
    if (!key.startsWith('--')) usage(`unexpected argument ${key}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) usage(`${key} needs a value`);
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    usage(`could not read ${label} at ${path}: ${error.message}`);
  }
}

/** Discovery owns these and may refresh them. Everything else is the human's. */
const DISCOVERY_OWNED = ['gapEvidence', 'gapMeasurement', 'marketSignal', 'evidenceSources'];

/** A status discovery is allowed to have set, and may therefore overwrite. */
const DISCOVERY_SETTABLE = new Set(['candidate']);

export function mergeProposals(registry, proposals, now) {
  const report = {
    added: [], refreshed: [], blockedByRejection: [], statusProtected: [],
    gapClosed: [], unchanged: [], invalid: [],
  };

  const byId = new Map();
  for (const entry of registry.opportunities ?? []) byId.set(entry.id, entry);

  for (const proposal of proposals.opportunities ?? []) {
    if (!proposal?.id || !proposal?.title) {
      report.invalid.push(proposal?.id ?? '(no id)');
      continue;
    }

    const existing = byId.get(proposal.id);

    // RULE 1 and 2: dedup against the WHOLE registry, rejected included.
    if (!existing) {
      const created = {
        ...proposal,
        status: 'candidate',
        statusSetBy: 'discovery',
        statusSetOn: now,
        provenance: {
          ...(proposal.provenance ?? {}),
          firstSeen: proposal.provenance?.firstSeen ?? now,
          lastConfirmed: now,
          confirmCount: 1,
        },
      };
      registry.opportunities.push(created);
      byId.set(created.id, created);
      report.added.push(created.id);
      continue;
    }

    if (existing.status === 'rejected') {
      report.blockedByRejection.push({
        id: existing.id,
        rejectionReason: existing.rejectionReason ?? '(no reason recorded)',
      });
      continue;
    }

    // RULE 3: a status a human set is untouchable.
    if (existing.statusSetBy === 'human' && !DISCOVERY_SETTABLE.has(existing.status)) {
      report.statusProtected.push({ id: existing.id, status: existing.status });
    }

    // RULE 4: re-measure. A gap that has closed is flagged, never silently changed.
    const previous = existing.gapMeasurement?.occurrences;
    const current = proposal.gapMeasurement?.occurrences;
    if (typeof previous === 'number' && typeof current === 'number' && previous === 0 && current > 0) {
      report.gapClosed.push({ id: existing.id, previous, current });
    }

    let changed = false;
    for (const field of DISCOVERY_OWNED) {
      if (proposal[field] === undefined) continue;
      if (JSON.stringify(existing[field]) === JSON.stringify(proposal[field])) continue;
      existing[field] = proposal[field];
      changed = true;
    }

    // RULE 5: age it, never delete it.
    existing.provenance = {
      ...(existing.provenance ?? {}),
      firstSeen: existing.provenance?.firstSeen ?? now,
      lastConfirmed: now,
      confirmCount: (existing.provenance?.confirmCount ?? 0) + 1,
      suggestedBy: [
        ...new Set([
          ...(existing.provenance?.suggestedBy ?? []),
          ...(proposal.provenance?.suggestedBy ?? []),
        ]),
      ],
    };

    (changed ? report.refreshed : report.unchanged).push(existing.id);
  }

  return report;
}

function bumpPatch(version) {
  const parts = String(version ?? '0.0.0').split('.').map((n) => Number.parseInt(n, 10) || 0);
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.registry) usage('--registry is required');
  if (!args.proposals) usage('--proposals is required');

  const registry = readJson(args.registry, 'registry');
  const proposals = readJson(args.proposals, 'proposals');
  if (!Array.isArray(registry.opportunities)) usage('registry has no opportunities array');

  const now = new Date().toISOString();
  const report = mergeProposals(registry, proposals, now);

  const line = (label, items) => {
    if (!items.length) return;
    console.log(`${label} (${items.length}):`);
    for (const item of items) {
      console.log(typeof item === 'string' ? `  ${item}` : `  ${JSON.stringify(item)}`);
    }
  };

  line('ADDED as candidate', report.added);
  line('REFRESHED evidence', report.refreshed);
  line('UNCHANGED', report.unchanged);
  line('BLOCKED, previously rejected', report.blockedByRejection);
  line('STATUS PROTECTED, human-owned', report.statusProtected);
  line('GAP CLOSED, needs review', report.gapClosed);
  line('INVALID, dropped', report.invalid);

  const conflicts = report.gapClosed.length + report.invalid.length;

  if (!args.apply) {
    console.log('\nDRY RUN. Nothing written. Pass --apply to write.');
    process.exit(conflicts > 0 ? 2 : 0);
  }

  registry.registryVersion = bumpPatch(registry.registryVersion);
  registry.lastReviewed = now.slice(0, 10);
  writeFileSync(args.out ?? args.registry, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  console.log(`\nWritten. registryVersion ${registry.registryVersion}`);
  process.exit(conflicts > 0 ? 2 : 0);
}

// pathToFileURL, not string concatenation. On Windows import.meta.url is
// file:///D:/... with three slashes while `file://${path}` produces two, so a
// hand-built comparison silently never matches and main() never runs. That
// failure is invisible: the process exits 0 having done nothing, which reads
// exactly like a successful run with no changes.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
