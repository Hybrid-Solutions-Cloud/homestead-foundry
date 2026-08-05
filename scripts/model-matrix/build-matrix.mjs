// Builds the model x region matrix from the per-region az dumps plus the two
// on-premises rosters. Emits one JSON the VitePress component consumes.
//
// The compression is the finding, not an optimisation: every region a model
// appears in is reduced to a "profile" (the deployment SKUs, capacity ceiling,
// token limits and lifecycle it carries there). A model with one profile is
// identical everywhere. A model with three profiles differs by region, and the
// profile list says exactly how. That count is what the owner asked for.

import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const ONPREM = process.argv[3];
const OUT = process.argv[4];
const SNAPSHOT = process.argv[5]; // ISO date, passed in
const QUOTA = process.argv[6]; // optional: directory of usage-<region>.json

// ---------- subscription quota ----------
// The catalog's capacity.maximum is what the deployment TYPE accepts. It is not
// what a subscription may allocate, and the two differ by a thousandfold on real
// models. Without this join the matrix cannot answer the only capacity question
// anyone actually asks, which is "where do I have room left".
//
// Keyed by the SKU's own `usageName` (for example
// AIServices.GlobalStandard.DeepSeek-V4-Pro), which the catalog hands us, so the
// two datasets join on a value neither side had to guess.
const quotaByRegion = new Map();
if (QUOTA && fs.existsSync(QUOTA)) {
  for (const f of fs.readdirSync(QUOTA)) {
    if (!f.startsWith('usage-') || !f.endsWith('.json')) continue;
    const region = f.slice('usage-'.length, -'.json'.length);
    let rows;
    try {
      rows = JSON.parse(fs.readFileSync(path.join(QUOTA, f), 'utf8'));
    } catch {
      continue;
    }
    const byName = new Map();
    for (const u of rows) {
      const n = u?.name?.value;
      if (!n) continue;
      byName.set(n, { used: u.currentValue ?? 0, limit: u.limit ?? 0 });
    }
    quotaByRegion.set(region, byName);
  }
}

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.json'));

// ---------- region metadata ----------
const geoRaw = JSON.parse(fs.readFileSync(path.join(SRC, '_locations.json'), 'utf8'));
const geoBy = new Map(geoRaw.map((r) => [r.name, r]));

const regions = [];
const entriesByRegion = new Map();

for (const f of files) {
  if (f.startsWith('_')) continue;
  const region = f.replace(/\.json$/, '');
  const rows = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) continue; // no Foundry presence
  entriesByRegion.set(region, rows);
  const g = geoBy.get(region) || {};
  regions.push({
    id: region,
    label: g.display || region,
    geo: g.geo || 'Unknown',
    kind: 'cloud',
    count: rows.length,
  });
}
// The two on-premises targets are modelled as regions, exactly as asked.
regions.push({ id: 'foundry-local', label: 'Foundry Local', geo: 'On-premises', kind: 'onprem', count: 0 });
regions.push({ id: 'azure-local-foundry', label: 'Azure Local Foundry', geo: 'On-premises', kind: 'onprem', count: 0 });

// Column order: the two on-premises targets, then the US regions, then
// everything else alphabetically. Most readers of this repository are working
// in a US region or on their own hardware, so those columns sit where the eye
// lands first rather than being reached by scrolling past twenty-nine others.
// `group` is carried into the data so the table can rule a line between the two
// blocks; sorting alone does not make a boundary visible in 42 columns.
const rank = (r) => (r.kind === 'onprem' ? 0 : r.geo === 'US' ? 1 : 2);
for (const r of regions) r.group = rank(r) === 2 ? 'international' : 'home';
regions.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, 'en'));

// ---------- classify ----------
function modality(name, caps, kind) {
  const c = caps || {};
  const n = name.toLowerCase();
  if (c.imageGenerations === 'true' || /dall-e|flux|image|gpt-image|mai-image|stable-|sdxl|seedream/.test(n)) return 'image';
  if (/sora|video|veo/.test(n)) return 'video';
  if (c.embeddings === 'true' || /embed/.test(n)) return 'embedding';
  if (/whisper|transcribe|asr|speech-to-text|nemotron-speech|stt/.test(n)) return 'speech-to-text';
  if (/tts|text-to-speech|mai-voice|voice/.test(n)) return 'text-to-speech';
  if (c.audio === 'true' || /realtime|audio/.test(n)) return 'audio';
  if (/rerank/.test(n)) return 'rerank';
  if (c.chatCompletion === 'true' || c.completion === 'true') {
    if (/^o\d|reasoning|-r1|deepseek-r|thinking|magistral|openreasoning|acereason/.test(n)) return 'reasoning';
    return 'chat';
  }
  if (kind === 'MaaS') return 'chat';
  return 'other';
}

function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Capability flags worth surfacing. Anything else stays in the raw capability
// bag so the page can show it without this list having to predict it.
// Keys are the ones the API actually returns, enumerated from a full region dump
// rather than assumed. There is no toolCalling and no streaming key; do not add
// them back on the belief that they ought to exist.
const FLAGS = [
  ['chatCompletion', 'Chat completions'],
  ['completion', 'Legacy completions'],
  ['responses', 'Responses API'],
  ['assistants', 'Assistants'],
  ['agentsV2', 'Agents v2'],
  ['jsonObjectResponse', 'JSON mode'],
  ['jsonSchemaResponse', 'Structured outputs'],
  ['imageGenerations', 'Image generation'],
  ['imageEdits', 'Image edits'],
  ['videoGenerations', 'Video generation'],
  ['embeddings', 'Embeddings'],
  ['audio', 'Audio'],
  ['audioSpeech', 'Text to speech'],
  ['audioTranscriptions', 'Transcription'],
  ['audioTranslations', 'Translation'],
  ['realtime', 'Realtime'],
  ['realtimeTranscription', 'Realtime transcription'],
  ['realtimeTranslation', 'Realtime translation'],
  ['fineTune', 'Fine-tuning'],
  ['globalFineTune', 'Global fine-tuning'],
  ['devTierFineTune', 'Developer-tier fine-tuning'],
  ['router', 'Model router'],
  ['inference', 'Inference'],
];

// ---------- gather ----------
const models = new Map(); // key -> model record

for (const [region, rows] of entriesByRegion) {
  for (const row of rows) {
    const m = row.model;
    if (!m || !m.name) continue;
    const key = `${(m.format || row.kind || 'Unknown')}::${m.name}`.toLowerCase();
    if (!models.has(key)) {
      models.set(key, {
        key,
        name: m.name,
        publisher: m.format || 'Unknown',
        kinds: new Set(),
        versions: new Set(),
        cells: new Map(), // region -> array of raw version records
      });
    }
    const rec = models.get(key);
    rec.kinds.add(row.kind);
    rec.versions.add(m.version);
    if (!rec.cells.has(region)) rec.cells.set(region, []);
    rec.cells.get(region).push({ row, m });
  }
}

// ---------- build per-region profiles ----------
function profileOf(records) {
  // Prefer the default version for the headline attributes; a region's cell can
  // legitimately carry several versions at once.
  const def = records.find((r) => r.m.isDefaultVersion) || records[0];
  const caps = def.m.capabilities || {};

  const skus = new Map();
  for (const r of records) {
    for (const s of r.m.skus || []) {
      const prev = skus.get(s.name);
      const cap = s.capacity || {};
      // rateLimits is [{count, renewalPeriod}] - requests allowed per N seconds.
      // usageName is the quota bucket the portal and `az cognitiveservices usage`
      // report against, which is the string you actually need to raise a limit.
      const cand = {
        name: s.name,
        default: cap.default ?? null,
        max: cap.maximum ?? null,
        min: cap.minimum ?? null,
        step: cap.step ?? null,
        deprecates: s.deprecationDate ? String(s.deprecationDate).slice(0, 10) : null,
        usageName: s.usageName ?? null,
        rateLimits: (s.rateLimits || [])
          .map((rl) => ({ count: rl.count, per: rl.renewalPeriod }))
          .filter((rl) => rl.count != null),
      };
      // The API can return SEVERAL entries under one SKU name in a single
      // region, each with a different ceiling (Ministral-3B returns a
      // GlobalStandard capped at 1 and another capped at 1000, side by side).
      // Collapsing to the highest would hide that, and would also make a region
      // that carries ONLY the low entry look identical to one that carries both.
      // Keep every ceiling seen, so the page can show the real shape.
      if (!prev) {
        cand.allMax = cand.max == null ? [] : [cand.max];
        skus.set(s.name, cand);
      } else {
        if (cand.max != null && !prev.allMax.includes(cand.max)) prev.allMax.push(cand.max);
        prev.allMax.sort((a, b) => a - b);
        if ((cand.max ?? 0) > (prev.max ?? 0)) {
          prev.max = cand.max;
          prev.default = cand.default;
          prev.usageName = cand.usageName ?? prev.usageName;
        }
      }
    }
  }

  const flags = {};
  for (const [k] of FLAGS) if (caps[k] === 'true' || caps[k] === true) flags[k] = 1;

  const versions = [...new Set(records.map((r) => r.m.version))].sort();
  const lifecycles = [...new Set(records.map((r) => r.m.lifecycleStatus).filter(Boolean))].sort();
  const depr = records
    .map((r) => r.m.deprecation?.inference)
    .filter(Boolean)
    .sort();

  return {
    ctx: num(caps.maxContextToken),
    out: num(caps.maxOutputToken),
    skus: [...skus.values()].sort((a, b) => a.name.localeCompare(b.name)),
    maxCapacity: Math.max(...records.map((r) => r.m.maxCapacity ?? 0)) || null,
    flags,
    versions,
    defaultVersion: def.m.version,
    lifecycle: lifecycles,
    deprecation: depr.length ? String(depr[depr.length - 1]).slice(0, 10) : null,
    replacedBy: def.m.replacementConfig?.targetModelName || null,
    kinds: [...new Set(records.map((r) => r.row.kind))].sort(),
    rawCaps: caps,
  };
}

function profileSignature(p) {
  return JSON.stringify({
    ctx: p.ctx,
    out: p.out,
    skus: p.skus.map((s) => `${s.name}:${s.default}:${(s.allMax || [s.max]).join('/')}`),
    cap: p.maxCapacity,
    flags: Object.keys(p.flags).sort(),
    v: p.versions,
    lc: p.lifecycle,
    dep: p.deprecation,
    kinds: p.kinds,
  });
}

// ---------- on-premises rosters ----------
const onprem = JSON.parse(fs.readFileSync(ONPREM, 'utf8'));

const out = { snapshot: SNAPSHOT, regions, models: [] };

// Alias map: normalises a cloud model name to the on-premises alias namespace so
// a model present on more than one target lands on ONE row rather than three.
function normName(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-instruct$/, '')
    .replace(/^-|-$/g, '');
}

const onpremByNorm = new Map();
for (const entry of onprem.models) {
  const n = normName(entry.alias);
  if (!onpremByNorm.has(n)) onpremByNorm.set(n, []);
  onpremByNorm.get(n).push(entry);
}

const usedOnprem = new Set();

for (const rec of models.values()) {
  const perRegion = {};
  const profiles = [];
  const sigIndex = new Map();

  for (const [region, records] of rec.cells) {
    const p = profileOf(records);
    const sig = profileSignature(p);
    if (!sigIndex.has(sig)) {
      sigIndex.set(sig, profiles.length);
      profiles.push(p);
    }
    perRegion[region] = sigIndex.get(sig);
  }

  // Attach on-premises presence if the same model exists there.
  const n = normName(rec.name);
  const op = onpremByNorm.get(n);
  const onpremProfiles = {};
  if (op) {
    usedOnprem.add(n);
    for (const e of op) {
      for (const t of e.targets) {
        onpremProfiles[t] = onpremProfiles[t] || { runtimes: new Set(), notes: new Set(), aliases: new Set() };
        (e.runtimes || []).forEach((r) => onpremProfiles[t].runtimes.add(r));
        if (e.note) onpremProfiles[t].notes.add(e.note);
        onpremProfiles[t].aliases.add(e.alias);
      }
    }
  }

  // Quota is per region AND per deployment type, so it cannot live on a profile:
  // profiles are shared across regions precisely because they are identical, and
  // quota is the thing that is not. A model exhausted on GlobalStandard can hold
  // untouched capacity on DataZoneStandard in the same region, which is the most
  // actionable fact this dataset carries.
  const quota = {};
  let anyQuota = false;
  for (const [region, pi] of Object.entries(perRegion)) {
    const byName = quotaByRegion.get(region);
    if (!byName) continue;
    const entries = [];
    for (const s of profiles[pi].skus) {
      if (!s.usageName) continue;
      const q = byName.get(s.usageName);
      if (!q) continue;
      entries.push({ sku: s.name, used: q.used, limit: q.limit, free: q.limit - q.used });
    }
    if (entries.length) {
      quota[region] = entries;
      anyQuota = true;
    }
  }

  // Headroom summary, so the table can be filtered and sorted on it directly.
  let bestFree = null;
  let freeRegions = 0;
  let exhaustedRegions = 0;
  for (const [region, entries] of Object.entries(quota)) {
    const free = Math.max(...entries.map((e) => e.free));
    if (free > 0) {
      freeRegions++;
      if (bestFree === null || free > bestFree.free) {
        bestFree = { region, free, sku: entries.find((e) => e.free === free).sku };
      }
    } else if (entries.some((e) => e.limit > 0)) {
      exhaustedRegions++;
    }
  }

  const headline = profiles[0] || {};
  const ctxs = [...new Set(profiles.map((p) => p.ctx).filter((v) => v != null))];
  const outs = [...new Set(profiles.map((p) => p.out).filter((v) => v != null))];
  const skuSets = [...new Set(profiles.map((p) => p.skus.map((s) => s.name).join(',')))];
  const caps = [...new Set(profiles.map((p) => p.maxCapacity).filter((v) => v != null))];

  // A ceiling difference is per SKU name, not per model: the question is whether
  // the SAME deployment type buys you a different maximum in a different region.
  const ceilBySku = {};
  for (const p of profiles) {
    for (const s of p.skus) {
      (ceilBySku[s.name] = ceilBySku[s.name] || new Set()).add((s.allMax || [s.max]).join('/'));
    }
  }
  const ceilingVaries = Object.entries(ceilBySku)
    .filter(([, v]) => v.size > 1)
    .map(([k]) => k);

  // Pay-as-you-go means one of the three Standard families. A region offering
  // only provisioned or batch capacity cannot be used without a reservation,
  // which is a materially different product at a materially different price.
  const PAYGO = new Set(['GlobalStandard', 'Standard', 'DataZoneStandard']);
  const provisionedOnly = Object.entries(perRegion)
    .filter(([, i]) => {
      const names = profiles[i].skus.map((s) => s.name);
      return names.length > 0 && !names.some((n) => PAYGO.has(n));
    })
    .map(([r]) => r);

  const varies = [];
  if (ctxs.length > 1) varies.push('context window');
  if (outs.length > 1) varies.push('max output');
  if (skuSets.length > 1) varies.push('deployment types');
  if (ceilingVaries.length) varies.push('capacity ceiling');
  if ([...new Set(profiles.map((p) => p.versions.join(',')))].length > 1) varies.push('versions');
  if ([...new Set(profiles.map((p) => p.lifecycle.join(',')))].length > 1) varies.push('lifecycle');

  out.models.push({
    key: rec.key,
    name: rec.name,
    publisher: rec.publisher,
    kinds: [...rec.kinds].sort(),
    modality: modality(rec.name, headline.rawCaps, [...rec.kinds][0]),
    regionCount: Object.keys(perRegion).length,
    profileCount: profiles.length,
    varies,
    ceilingVaries,
    provisionedOnly,
    ctxRange: ctxs.sort((a, b) => a - b),
    outRange: outs.sort((a, b) => a - b),
    allSkus: [...new Set(profiles.flatMap((p) => p.skus.map((s) => s.name)))].sort(),
    lifecycle: [...new Set(profiles.flatMap((p) => p.lifecycle))].sort(),
    deprecation: profiles.map((p) => p.deprecation).filter(Boolean).sort().pop() || null,
    replacedBy: profiles.map((p) => p.replacedBy).filter(Boolean)[0] || null,
    flags: Object.keys(headline.flags || {}),
    profiles: profiles.map((p) => ({
      ctx: p.ctx, out: p.out, skus: p.skus, maxCapacity: p.maxCapacity,
      flags: Object.keys(p.flags), versions: p.versions, defaultVersion: p.defaultVersion,
      lifecycle: p.lifecycle, deprecation: p.deprecation, kinds: p.kinds,
    })),
    byRegion: perRegion,
    quota: anyQuota ? quota : null,
    bestFree,
    freeRegions,
    exhaustedRegions,
    onprem: Object.fromEntries(
      Object.entries(onpremProfiles).map(([t, v]) => [
        t, { runtimes: [...v.runtimes], aliases: [...v.aliases], notes: [...v.notes] },
      ])
    ),
  });
}

// On-premises-only models get their own rows: available on those targets,
// explicitly not available in any cloud region.
for (const [n, entries] of onpremByNorm) {
  if (usedOnprem.has(n)) continue;
  const first = entries[0];
  const byTarget = {};
  for (const e of entries) {
    for (const t of e.targets) {
      byTarget[t] = byTarget[t] || { runtimes: new Set(), aliases: new Set(), notes: new Set() };
      (e.runtimes || []).forEach((r) => byTarget[t].runtimes.add(r));
      byTarget[t].aliases.add(e.alias);
      if (e.note) byTarget[t].notes.add(e.note);
    }
  }
  out.models.push({
    key: `onprem::${n}`,
    name: first.alias,
    publisher: first.origin || 'Microsoft',
    kinds: ['OnPremises'],
    modality: first.modality || 'chat',
    regionCount: 0,
    profileCount: 0,
    varies: [],
    ctxRange: first.ctx ? [first.ctx] : [],
    outRange: [],
    allSkus: [],
    lifecycle: [],
    deprecation: null,
    replacedBy: null,
    flags: [],
    profiles: [],
    byRegion: {},
    onprem: Object.fromEntries(
      Object.entries(byTarget).map(([t, v]) => [
        t, { runtimes: [...v.runtimes], aliases: [...v.aliases], notes: [...v.notes] },
      ])
    ),
    gpu: first.gpu || null,
  });
}

out.models.sort((a, b) => b.regionCount - a.regionCount || a.name.localeCompare(b.name));

// Region counts including on-prem rows
for (const r of regions) {
  if (r.kind === 'onprem') {
    r.count = out.models.filter((m) => m.onprem && m.onprem[r.id]).length;
  }
}

out.hasQuota = quotaByRegion.size > 0;
out.quotaRegions = quotaByRegion.size;

fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`regions: ${regions.length}  models: ${out.models.length}`);
if (out.hasQuota) {
  const withQ = out.models.filter((m) => m.quota).length;
  const exhausted = out.models.filter((m) => m.quota && m.freeRegions === 0 && m.exhaustedRegions > 0).length;
  console.log(`quota joined for ${quotaByRegion.size} regions; ${withQ} models carry quota`);
  console.log(`models with NO free capacity anywhere: ${exhausted}`);
}
console.log(`cloud rows: ${out.models.filter((m) => m.regionCount > 0).length}`);
console.log(`on-prem only rows: ${out.models.filter((m) => m.regionCount === 0).length}`);
console.log(`cross-target rows: ${out.models.filter((m) => m.regionCount > 0 && Object.keys(m.onprem).length).length}`);
console.log(`models that vary by region: ${out.models.filter((m) => m.varies.length).length}`);
console.log(`bytes: ${fs.statSync(OUT).size}`);
