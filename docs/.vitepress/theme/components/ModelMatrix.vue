<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { withBase } from 'vitepress'

// The dataset is ~470 KB, so it is fetched rather than bundled: bundling it
// would put it in every page's JS payload, and only this page needs it.
const data = shallowRef(null)
const error = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const r = await fetch(withBase('/data/model-matrix.json'))
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    data.value = await r.json()
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
})

// Full screen is a component state rather than the Fullscreen API. The native
// API paints the element on a black backdrop outside the page's stacking
// context, which drops the theme variables the table is styled with; a fixed
// overlay keeps the site's own light and dark themes intact.
const fullscreen = ref(false)

function toggleFullscreen() {
  fullscreen.value = !fullscreen.value
}

function onKey(e) {
  if (e.key === 'Escape' && fullscreen.value) fullscreen.value = false
}

// The page behind the overlay must not scroll, or dismissing full screen returns
// the reader somewhere they did not choose to be.
watch(fullscreen, (on) => {
  if (typeof document === 'undefined') return
  document.documentElement.style.overflow = on ? 'hidden' : ''
})

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (typeof document !== 'undefined') document.documentElement.style.overflow = ''
})

const q = ref('')
const publisher = ref('')
const modality = ref('')
const target = ref('')
const sku = ref('')
const onlyVaries = ref(false)
const onlyProvOnly = ref(false)
// 'profile' answers "is this model the same thing here as there".
// 'quota' answers "where do I have room left", which is the question people
// actually arrive with when a deployment starts returning 429.
const colourMode = ref('profile')
const quotaFilter = ref('')
const sortKey = ref('regionCount')
const sortDir = ref('desc')
const expanded = ref(new Set())
const geoFilter = ref('')

const regions = computed(() => data.value?.regions ?? [])
const shownRegions = computed(() =>
  geoFilter.value ? regions.value.filter((r) => r.geo === geoFilter.value) : regions.value
)
// The first international column gets a rule down its left edge. Ordering the
// columns is not enough on its own: at 42 columns the boundary between the home
// block and the rest is invisible without one.
const firstIntl = computed(() => {
  const r = shownRegions.value.find((x) => x.group === 'international')
  return r ? r.id : null
})
const geos = computed(() => [...new Set(regions.value.map((r) => r.geo))].sort())
const publishers = computed(() =>
  [...new Set((data.value?.models ?? []).map((m) => m.publisher))].sort()
)
const modalities = computed(() =>
  [...new Set((data.value?.models ?? []).map((m) => m.modality))].sort()
)
const skus = computed(() =>
  [...new Set((data.value?.models ?? []).flatMap((m) => m.allSkus))].sort()
)

const rows = computed(() => {
  let out = data.value?.models ?? []
  const term = q.value.trim().toLowerCase()
  if (term) {
    out = out.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.publisher.toLowerCase().includes(term) ||
        m.modality.includes(term)
    )
  }
  if (publisher.value) out = out.filter((m) => m.publisher === publisher.value)
  if (modality.value) out = out.filter((m) => m.modality === modality.value)
  if (sku.value) out = out.filter((m) => m.allSkus.includes(sku.value))
  if (onlyVaries.value) out = out.filter((m) => m.varies.length > 0)
  if (onlyProvOnly.value) out = out.filter((m) => m.provisionedOnly?.length > 0)
  if (quotaFilter.value === 'exhausted')
    out = out.filter((m) => m.quota && m.freeRegions === 0 && m.exhaustedRegions > 0)
  else if (quotaFilter.value === 'headroom') out = out.filter((m) => m.freeRegions > 0)
  else if (quotaFilter.value === 'partial')
    out = out.filter((m) => m.freeRegions > 0 && m.exhaustedRegions > 0)
  if (target.value === 'cloud') out = out.filter((m) => m.regionCount > 0)
  else if (target.value === 'onprem') out = out.filter((m) => Object.keys(m.onprem).length > 0)
  else if (target.value === 'both')
    out = out.filter((m) => m.regionCount > 0 && Object.keys(m.onprem).length > 0)
  else if (target.value === 'foundry-local') out = out.filter((m) => m.onprem['foundry-local'])
  else if (target.value === 'azure-local-foundry')
    out = out.filter((m) => m.onprem['azure-local-foundry'])

  const dir = sortDir.value === 'asc' ? 1 : -1
  const k = sortKey.value
  return [...out].sort((a, b) => {
    let x = a[k]
    let y = b[k]
    if (k === 'name' || k === 'publisher' || k === 'modality') return dir * String(x).localeCompare(String(y))
    if (k === 'varies') { x = a.varies.length; y = b.varies.length }
    return dir * ((x ?? 0) - (y ?? 0)) || a.name.localeCompare(b.name)
  })
})

function sortBy(k) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = k
    sortDir.value = k === 'name' || k === 'publisher' || k === 'modality' ? 'asc' : 'desc'
  }
}
function arrow(k) {
  return sortKey.value === k ? (sortDir.value === 'asc' ? '▲' : '▼') : ''
}
function toggle(key) {
  const s = new Set(expanded.value)
  s.has(key) ? s.delete(key) : s.add(key)
  expanded.value = s
}
function reset() {
  q.value = ''; publisher.value = ''; modality.value = ''; target.value = ''
  sku.value = ''; onlyVaries.value = false; onlyProvOnly.value = false; geoFilter.value = ''
  quotaFilter.value = ''; colourMode.value = 'profile'
}

// Cell state for one model in one region. `null` means the honest answer:
// this model is not offered there.
function cell(m, r) {
  if (r.kind === 'onprem') {
    const op = m.onprem?.[r.id]
    return op ? { kind: 'onprem', op } : null
  }
  const idx = m.byRegion?.[r.id]
  if (idx === undefined) return null
  return { kind: 'cloud', idx, profile: m.profiles[idx], quota: m.quota?.[r.id] || null }
}

// Best remaining capacity in one region, across every deployment type it offers.
function freeIn(c) {
  if (!c || !c.quota || !c.quota.length) return null
  return Math.max(...c.quota.map((q) => q.free))
}

// Profile index drives the colour. A model with one profile paints one flat
// band; gpt-4.1-mini, with seventeen, paints a mosaic. The variance is meant to
// be visible before it is read.
const HUES = [205, 145, 32, 265, 350, 175, 95, 15, 300, 230, 60, 320, 120, 250, 45, 190]
function cellStyle(c) {
  if (!c) return {}
  if (c.kind === 'onprem') return { '--h': 145, '--s': '55%' }
  if (colourMode.value === 'quota') {
    const free = freeIn(c)
    // No quota reading is deliberately grey rather than green: "we did not
    // measure this" and "you have room here" must not look the same.
    if (free === null) return { '--h': 0, '--s': '0%', '--l': '62%' }
    if (free <= 0) return { '--h': 2, '--s': '70%' }
    return { '--h': 142, '--s': '58%' }
  }
  return { '--h': HUES[c.idx % HUES.length], '--s': '62%' }
}
function fmt(n) {
  if (n === null || n === undefined) return 'not published'
  return n.toLocaleString('en-US')
}
function pct(n, d) {
  return d ? Math.round((100 * n) / d) : 0
}

const stats = computed(() => {
  const all = data.value?.models ?? []
  const cloud = all.filter((m) => m.regionCount > 0)
  return {
    models: all.length,
    cloud: cloud.length,
    onpremOnly: all.filter((m) => m.regionCount === 0).length,
    both: all.filter((m) => m.regionCount > 0 && Object.keys(m.onprem).length > 0).length,
    varies: cloud.filter((m) => m.varies.length).length,
    pairs: cloud.reduce((s, m) => s + m.regionCount, 0),
    cloudRegions: regions.value.filter((r) => r.kind === 'cloud').length,
  }
})
</script>

<template>
  <div class="mm" :class="{ 'mm-fs': fullscreen }">
    <div
      v-if="fullscreen"
      class="mm-fs-bar"
      role="dialog"
      aria-modal="true"
      aria-label="Model availability matrix, full screen"
    >
      <strong>Model availability matrix</strong>
      <span class="mm-fs-note">{{ rows.length }} of {{ data ? data.models.length : 0 }} models, {{ shownRegions.length }} regions</span>
      <button type="button" class="mm-reset mm-fs-close" @click="toggleFullscreen">
        Close (Esc)
      </button>
    </div>

    <p v-if="loading" class="mm-msg">Loading the matrix…</p>
    <p v-else-if="error" class="mm-msg mm-err">
      Could not load the dataset ({{ error }}). It is served from
      <code>/data/model-matrix.json</code>.
    </p>

    <template v-else-if="data">
      <div class="mm-stats">
        <div><b>{{ stats.models }}</b><span>models</span></div>
        <div><b>{{ stats.cloudRegions }}</b><span>cloud regions</span></div>
        <div><b>{{ stats.pairs.toLocaleString() }}</b><span>model / region pairs</span></div>
        <div><b>{{ stats.varies }}</b><span>differ by region</span></div>
        <div><b>{{ stats.both }}</b><span>on more than one target</span></div>
      </div>

      <div class="mm-controls">
        <input v-model="q" type="search" placeholder="Search model, publisher, modality…" aria-label="Search models" />
        <select v-model="publisher" aria-label="Publisher">
          <option value="">All publishers</option>
          <option v-for="p in publishers" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-model="modality" aria-label="Modality">
          <option value="">All modalities</option>
          <option v-for="p in modalities" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-model="target" aria-label="Deployment target">
          <option value="">All targets</option>
          <option value="cloud">Azure AI Foundry (cloud)</option>
          <option value="foundry-local">Foundry Local</option>
          <option value="azure-local-foundry">Azure Local Foundry</option>
          <option value="onprem">Either on-premises target</option>
          <option value="both">Cloud and on-premises</option>
        </select>
        <select v-model="sku" aria-label="Deployment type">
          <option value="">Any deployment type</option>
          <option v-for="s in skus" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="geoFilter" aria-label="Geography">
          <option value="">All geographies</option>
          <option v-for="g in geos" :key="g" :value="g">{{ g }}</option>
        </select>
        <select v-if="data && data.hasQuota" v-model="quotaFilter" aria-label="Quota state">
          <option value="">Any quota state</option>
          <option value="exhausted">No free capacity anywhere</option>
          <option value="headroom">Has free capacity somewhere</option>
          <option value="partial">Exhausted in some regions, free in others</option>
        </select>
        <select v-if="data && data.hasQuota" v-model="colourMode" aria-label="Colour cells by">
          <option value="profile">Colour by configuration</option>
          <option value="quota">Colour by remaining quota</option>
        </select>
        <label class="mm-check"><input type="checkbox" v-model="onlyVaries" /> Only models that differ by region</label>
        <label class="mm-check"><input type="checkbox" v-model="onlyProvOnly" /> Only models with a provisioned-only region</label>
        <button type="button" class="mm-reset" @click="reset">Reset</button>
        <button type="button" class="mm-reset mm-fs-btn" @click="toggleFullscreen">
          {{ fullscreen ? 'Exit full screen' : 'Full screen' }}
        </button>
      </div>

      <p class="mm-count">
        Showing <b>{{ rows.length }}</b> of {{ data.models.length }} models across
        <b>{{ shownRegions.length }}</b> regions. Click any row for the per-region detail.
      </p>

      <div class="mm-scroll">
        <table class="mm-table">
          <thead>
            <tr>
              <th class="mm-sticky mm-th-model" @click="sortBy('name')">Model {{ arrow('name') }}</th>
              <th @click="sortBy('modality')">Modality {{ arrow('modality') }}</th>
              <th @click="sortBy('regionCount')" title="Cloud regions this model is offered in">Regions {{ arrow('regionCount') }}</th>
              <th @click="sortBy('profileCount')" title="Distinct per-region configurations">Profiles {{ arrow('profileCount') }}</th>
              <th
                v-if="data && data.hasQuota"
                @click="sortBy('freeRegions')"
                title="Regions where this subscription still has unused quota"
              >
                Free in {{ arrow('freeRegions') }}
              </th>
              <th
                v-for="r in shownRegions"
                :key="r.id"
                class="mm-th-region"
                :class="{ 'mm-th-onprem': r.kind === 'onprem', 'mm-divider': r.id === firstIntl }"
                :title="`${r.label} (${r.geo}), ${r.count} models`"
              >
                <span>{{ r.label }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="m in rows" :key="m.key">
              <tr class="mm-row" :class="{ 'mm-open': expanded.has(m.key) }" @click="toggle(m.key)">
                <th class="mm-sticky mm-td-model">
                  <span class="mm-name">{{ m.name }}</span>
                  <span class="mm-pub">{{ m.publisher }}</span>
                </th>
                <td class="mm-mod"><span :class="`mm-chip mm-chip-${m.modality}`">{{ m.modality }}</span></td>
                <td class="mm-num">{{ m.regionCount }}</td>
                <td class="mm-num">
                  <span v-if="m.profileCount > 1" class="mm-varies" :title="m.varies.join(', ')">{{ m.profileCount }}</span>
                  <span v-else>{{ m.profileCount }}</span>
                </td>
                <td v-if="data && data.hasQuota" class="mm-num">
                  <span
                    v-if="m.quota && m.freeRegions === 0 && m.exhaustedRegions > 0"
                    class="mm-exhausted"
                    title="No unused quota in any region this model is offered in"
                  >none</span>
                  <span v-else-if="m.freeRegions > 0" class="mm-free" :title="m.bestFree ? `Most headroom: ${m.bestFree.free} units in ${m.bestFree.region} on ${m.bestFree.sku}` : ''">
                    {{ m.freeRegions }}
                  </span>
                  <span v-else class="mm-unpub">no data</span>
                </td>
                <td
                  v-for="r in shownRegions"
                  :key="r.id"
                  class="mm-cell"
                  :class="[cell(m, r) ? 'mm-yes' : 'mm-no', { 'mm-divider': r.id === firstIntl }]"
                  :style="cellStyle(cell(m, r))"
                  :title="cell(m, r)
                    ? `${m.name} in ${r.label}: ${cell(m, r).kind === 'onprem'
                        ? cell(m, r).op.runtimes.join(', ')
                        : (cell(m, r).quota
                            ? cell(m, r).quota.map(qq => `${qq.sku} ${qq.used}/${qq.limit} used, ${qq.free} free`).join('  |  ')
                            : 'profile ' + (cell(m, r).idx + 1) + ': ' + (cell(m, r).profile.skus.map(s => s.name).join(', ') || 'no deployment SKU published'))}`
                    : `${m.name} is NOT AVAILABLE in ${r.label}`"
                >
                  <span v-if="!cell(m, r)" class="mm-dash">·</span>
                </td>
              </tr>

              <tr v-if="expanded.has(m.key)" class="mm-detail">
                <td :colspan="(data && data.hasQuota ? 5 : 4) + shownRegions.length">
                  <div class="mm-detail-inner">
                    <div class="mm-detail-head">
                      <h4>{{ m.name }}</h4>
                      <span class="mm-meta">{{ m.publisher }}</span>
                      <span class="mm-meta">{{ m.modality }}</span>
                      <span v-if="m.kinds.length" class="mm-meta">account kind: {{ m.kinds.join(', ') }}</span>
                      <span v-if="m.lifecycle.length" class="mm-meta">{{ m.lifecycle.join(', ') }}</span>
                      <span v-if="m.deprecation" class="mm-meta mm-warn">retires {{ m.deprecation }}</span>
                      <span v-if="m.replacedBy" class="mm-meta mm-warn">replaced by {{ m.replacedBy }}</span>
                    </div>

                    <p v-if="m.varies.length" class="mm-finding">
                      Differs by region in: <b>{{ m.varies.join(', ') }}</b>.
                      {{ m.profileCount }} distinct configurations across {{ m.regionCount }} regions.
                    </p>
                    <p v-else-if="m.regionCount" class="mm-finding mm-same">
                      Identical in all {{ m.regionCount }} regions it is offered in.
                    </p>

                    <p v-if="m.provisionedOnly?.length" class="mm-finding mm-warnbox">
                      <b>No pay-as-you-go capacity</b> in
                      {{ m.provisionedOnly.join(', ') }}. Only provisioned or batch
                      capacity is offered there, which needs a reservation.
                    </p>

                    <div v-if="m.quota" class="mm-quotablock">
                      <h5>Your quota, per region and deployment type</h5>
                      <p v-if="m.freeRegions === 0 && m.exhaustedRegions > 0" class="mm-finding mm-warnbox">
                        <b>No unused capacity in any region.</b> Every deployment
                        type this subscription can reach is at its limit. Moving
                        region will not help; this needs a quota increase request.
                      </p>
                      <p v-else-if="m.bestFree" class="mm-finding mm-okbox">
                        <b>Most headroom: {{ fmt(m.bestFree.free) }} units in {{ m.bestFree.region }}</b>
                        on <code>{{ m.bestFree.sku }}</code>. Free capacity in
                        {{ m.freeRegions }} region<template v-if="m.freeRegions !== 1">s</template><template
                          v-if="m.exhaustedRegions"
                        >, exhausted in {{ m.exhaustedRegions }}</template>.
                      </p>
                      <table class="mm-ptable">
                        <thead>
                          <tr><th>Region</th><th>Deployment type</th><th>Used</th><th>Limit</th><th>Free</th></tr>
                        </thead>
                        <tbody>
                          <template v-for="(entries, region) in m.quota" :key="region">
                            <tr v-for="e in entries" :key="region + e.sku" :class="{ 'mm-row-free': e.free > 0 }">
                              <td>{{ region }}</td>
                              <td>{{ e.sku }}</td>
                              <td class="mm-num">{{ fmt(e.used) }}</td>
                              <td class="mm-num">{{ fmt(e.limit) }}</td>
                              <td class="mm-num">
                                <b v-if="e.free > 0" class="mm-free">{{ fmt(e.free) }}</b>
                                <span v-else class="mm-exhausted">0</span>
                              </td>
                            </tr>
                          </template>
                        </tbody>
                      </table>
                      <p class="mm-note">
                        Measured against one subscription on {{ data.snapshot }}. Yours will differ:
                        <code>az cognitiveservices usage list -l &lt;region&gt; -o table</code>.
                        <b>GlobalStandard quota behaves as a single subscription-wide pool</b>, so it
                        reads as consumed in every region once spent anywhere. A different
                        deployment type carries a separate allocation.
                      </p>
                    </div>

                    <div v-if="Object.keys(m.onprem).length" class="mm-onprem">
                      <h5>On-premises</h5>
                      <ul>
                        <li v-for="(v, t) in m.onprem" :key="t">
                          <b>{{ t === 'foundry-local' ? 'Foundry Local' : 'Azure Local Foundry' }}</b>
                          &mdash; alias <code>{{ v.aliases.join('</code>, <code>') }}</code>,
                          runtime {{ v.runtimes.join(', ') }}<template v-if="v.notes.length">. {{ v.notes.join('. ') }}</template>
                        </li>
                      </ul>
                    </div>

                    <div v-if="m.profiles.length" class="mm-profiles">
                      <h5>Per-region profiles</h5>
                      <table class="mm-ptable">
                        <thead>
                          <tr>
                            <th>#</th><th>Regions</th><th>Deployment types (product maximum, NOT your quota)</th>
                            <th>Context</th><th>Max output</th><th>Versions</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(p, i) in m.profiles" :key="i">
                            <td>
                              <span class="mm-swatch" :style="{ '--h': HUES[i % HUES.length] }"></span>{{ i + 1 }}
                            </td>
                            <td class="mm-regionlist">
                              {{ Object.entries(m.byRegion).filter(([, v]) => v === i).map(([k]) => k).join(', ') }}
                            </td>
                            <td>
                              <span v-if="!p.skus.length" class="mm-none">none published</span>
                              <span v-for="s in p.skus" :key="s.name" class="mm-sku">
                                {{ s.name }}<template v-if="s.allMax && s.allMax.length"> ({{ s.allMax.map(fmt).join(' / ') }})</template>
                              </span>
                            </td>
                            <td class="mm-num"><span v-if="p.ctx == null" class="mm-unpub">not published</span><template v-else>{{ fmt(p.ctx) }}</template></td>
                            <td class="mm-num"><span v-if="p.out == null" class="mm-unpub">not published</span><template v-else>{{ fmt(p.out) }}</template></td>
                            <td>{{ p.versions.join(', ') }}</td>
                            <td>{{ p.lifecycle.join(', ') || 'not published' }}</td>
                          </tr>
                        </tbody>
                      </table>
                      <p v-if="m.profiles.some(p => p.skus.some(s => s.allMax && s.allMax.length > 1))" class="mm-note">
                        Where a deployment type shows two ceilings, the API returned
                        two entries under that one name in the same region. That is
                        the source data, not a rounding of it.
                      </p>
                      <p v-if="m.profiles.some(p => p.skus.some(s => s.usageName))" class="mm-quota">
                        <b>The number above is not what you can deploy.</b> It is the
                        largest capacity the deployment type accepts. What you can
                        actually allocate is your subscription's quota in that
                        region, which is a separate and usually far smaller number.
                        Ask for it by quota bucket:
                        <span class="mm-buckets">
                          <code v-for="s in m.profiles[0].skus.filter(s => s.usageName)" :key="s.name">{{ s.usageName }}</code>
                        </span>
                        <br />
                        <code class="mm-cmd">az cognitiveservices usage list -l &lt;region&gt; --query "[?contains(name.value,'{{ m.name }}')].{{ '{' }}quota:name.value, used:currentValue, limit:limit{{ '}' }}" -o table</code>
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="!rows.length">
              <td :colspan="(data && data.hasQuota ? 5 : 4) + shownRegions.length" class="mm-empty">
                No model matches those filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mm-legend">
        <template v-if="colourMode === 'quota'">
          <b>Coloured by remaining quota:</b> green means this subscription still
          has unused capacity there, red means every deployment type is at its
          limit, grey means no quota reading. A faint dot means
          <b>not available</b>.
        </template>
        <template v-else>
          A coloured cell means the model is offered there; the colour is its
          configuration profile, so a row of one colour is identical everywhere and a
          row of many differs by region. A faint dot means <b>not available</b>.
        </template>
        Columns run the two on-premises targets, then the US regions, then
        everything else alphabetically; the rule marks where the international
        block starts. Snapshot {{ data.snapshot }}.
      </p>
    </template>
  </div>
</template>

<style scoped>
/* Everything is expressed in VitePress theme variables so the component follows
   the site's light and dark themes rather than carrying its own palette. */
.mm { margin: 1.5rem 0; font-size: 14px; }
.mm-msg { color: var(--vp-c-text-2); }
.mm-err { color: var(--vp-c-danger-1); }

/* Full screen. A fixed overlay rather than the Fullscreen API, so the page's
   own theme variables still apply. z-index clears the VitePress nav, which
   sits at 60. */
.mm-fs {
  position: fixed;
  inset: 0;
  z-index: 200;
  margin: 0;
  padding: 0.75rem 1rem 1rem;
  background: var(--vp-c-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mm-fs-bar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding-bottom: 0.6rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
  flex: 0 0 auto;
}
.mm-fs-bar strong { font-size: 0.95rem; }
.mm-fs-note { color: var(--vp-c-text-2); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.mm-fs-close { margin-left: auto; }
/* In full screen the summary band and the legend are noise: the reader opened
   this to work the table, and every row of chrome is a row the table loses. */
.mm-fs .mm-stats,
.mm-fs .mm-legend { display: none; }
.mm-fs .mm-controls { flex: 0 0 auto; }
.mm-fs .mm-count { flex: 0 0 auto; }
/* The scroll box takes whatever height is left rather than a fixed fraction of
   the viewport, so the table fills the screen exactly once. */
.mm-fs .mm-scroll { flex: 1 1 auto; max-height: none; min-height: 0; }

.mm-stats {
  display: flex; flex-wrap: wrap; gap: 0.5rem 2rem;
  padding: 0.9rem 1.1rem; margin-bottom: 1rem;
  background: var(--vp-c-bg-soft); border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}
.mm-stats div { display: flex; flex-direction: column; }
.mm-stats b {
  font-size: 1.45rem; line-height: 1.1; color: var(--vp-c-brand-1);
  font-variant-numeric: tabular-nums;
}
.mm-stats span { font-size: 0.76rem; color: var(--vp-c-text-2); text-transform: uppercase; letter-spacing: 0.04em; }

.mm-controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; }
.mm-controls input[type='search'] { flex: 1 1 15rem; min-width: 12rem; }
.mm-controls input[type='search'], .mm-controls select {
  padding: 0.4rem 0.6rem; border: 1px solid var(--vp-c-divider);
  border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 13px;
}
/* flex: 0 0 auto so a label that will not fit wraps to the next line instead of
   being squeezed against the container edge and clipped. Its text cannot
   compress, so without this the last control is cut off at some widths. */
.mm-check {
  display: flex; align-items: center; gap: 0.35rem; flex: 0 0 auto;
  white-space: nowrap; font-size: 13px; color: var(--vp-c-text-2); cursor: pointer;
}
.mm-reset {
  padding: 0.4rem 0.8rem; border: 1px solid var(--vp-c-divider); border-radius: 6px;
  background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); cursor: pointer; font-size: 13px;
}
.mm-reset:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.mm-count { color: var(--vp-c-text-2); font-size: 13px; margin: 0 0 0.5rem; }

/* The grid is 40-plus columns wide, so it scrolls inside its own box and the
   page body never scrolls sideways. */
.mm-scroll {
  overflow: auto; max-height: 78vh;
  border: 1px solid var(--vp-c-divider); border-radius: 8px;
  background: var(--vp-c-bg);
}
.mm-table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; font-size: 12.5px; }
.mm-table thead th {
  position: sticky; top: 0; z-index: 3;
  background: var(--vp-c-bg-soft); border-bottom: 2px solid var(--vp-c-divider);
  padding: 0.4rem 0.5rem; text-align: left; white-space: nowrap;
  cursor: pointer; font-weight: 600; user-select: none;
}
.mm-th-region {
  writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg);
  height: 9.5rem; padding: 0.5rem 0.2rem; font-weight: 500; font-size: 11.5px;
  cursor: default; color: var(--vp-c-text-2);
}
.mm-th-onprem { color: var(--vp-c-brand-1); font-weight: 700; }
.mm-sticky { position: sticky; left: 0; z-index: 4; background: var(--vp-c-bg-soft); }
.mm-table thead .mm-th-model { z-index: 5; }
.mm-td-model {
  text-align: left; padding: 0.3rem 0.6rem; border-bottom: 1px solid var(--vp-c-divider);
  min-width: 15rem; max-width: 20rem; font-weight: 400;
  border-right: 1px solid var(--vp-c-divider);
}
.mm-name { display: block; font-weight: 600; color: var(--vp-c-text-1); }
.mm-pub { display: block; font-size: 11px; color: var(--vp-c-text-3); }

.mm-row { cursor: pointer; }
.mm-row:hover .mm-sticky, .mm-row:hover td { background: var(--vp-c-bg-elv); }
.mm-open .mm-sticky { box-shadow: inset 3px 0 0 var(--vp-c-brand-1); }
.mm-table tbody td { border-bottom: 1px solid var(--vp-c-divider); padding: 0.3rem 0.5rem; }
.mm-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.mm-varies {
  display: inline-block; min-width: 1.4rem; padding: 0 0.3rem; border-radius: 4px;
  background: var(--vp-c-warning-soft); color: var(--vp-c-warning-1); font-weight: 700;
}

.mm-cell { width: 1.35rem; min-width: 1.35rem; padding: 0 !important; text-align: center; }
/* The boundary between the home block (on-premises and US) and everything
   international. Ordering alone does not show it at this column count. */
.mm-divider { border-left: 2px solid var(--vp-c-brand-1) !important; }
.mm-yes { background: hsl(var(--h) var(--s) var(--l, 46%) / 0.85); }
:root.dark .mm-yes { background: hsl(var(--h) var(--s) var(--l, 55%) / 0.8); }
.mm-no { background: transparent; }
.mm-dash { color: var(--vp-c-text-3); opacity: 0.45; font-size: 15px; line-height: 1; }

.mm-chip {
  display: inline-block; padding: 0.05rem 0.45rem; border-radius: 999px;
  font-size: 11px; background: var(--vp-c-default-soft); color: var(--vp-c-text-2); white-space: nowrap;
}
.mm-chip-image, .mm-chip-video { background: var(--vp-c-purple-soft); color: var(--vp-c-purple-1); }
.mm-chip-reasoning { background: var(--vp-c-warning-soft); color: var(--vp-c-warning-1); }
.mm-chip-vision { background: var(--vp-c-green-soft); color: var(--vp-c-green-1); }

.mm-detail td { background: var(--vp-c-bg-soft); padding: 0 !important; }
.mm-detail-inner { padding: 1rem 1.2rem; position: sticky; left: 0; width: min(100vw, 60rem); }
.mm-detail-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem 0.8rem; margin-bottom: 0.6rem; }
.mm-detail-head h4 { margin: 0; font-size: 1.05rem; }
.mm-meta { font-size: 11.5px; color: var(--vp-c-text-2); background: var(--vp-c-default-soft); padding: 0.1rem 0.5rem; border-radius: 999px; }
.mm-warn { background: var(--vp-c-warning-soft); color: var(--vp-c-warning-1); }
.mm-finding { margin: 0.4rem 0; font-size: 13px; }
.mm-same { color: var(--vp-c-text-2); }
.mm-warnbox {
  padding: 0.5rem 0.75rem; border-radius: 6px;
  background: var(--vp-c-warning-soft); color: var(--vp-c-warning-1);
}
.mm-onprem { margin: 0.7rem 0; }
.mm-onprem h5, .mm-profiles h5 { margin: 0.6rem 0 0.35rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--vp-c-text-2); }
.mm-onprem ul { margin: 0; padding-left: 1.1rem; font-size: 13px; }

.mm-ptable { border-collapse: collapse; font-size: 12px; width: 100%; }
.mm-ptable th, .mm-ptable td { border: 1px solid var(--vp-c-divider); padding: 0.3rem 0.5rem; text-align: left; vertical-align: top; }
.mm-ptable th { background: var(--vp-c-bg); font-weight: 600; }
.mm-regionlist { max-width: 22rem; font-size: 11.5px; color: var(--vp-c-text-2); word-break: break-word; }
.mm-sku { display: inline-block; margin: 0 0.3rem 0.15rem 0; padding: 0.05rem 0.35rem; border-radius: 4px; background: var(--vp-c-default-soft); white-space: nowrap; font-size: 11px; }
.mm-none { color: var(--vp-c-text-3); font-style: italic; }
/* An absent value must not read as a small number. It recedes, and it keeps its
   own column width so two of them side by side do not run together. */
.mm-unpub { color: var(--vp-c-text-3); font-style: italic; font-size: 11px; white-space: nowrap; }
/* Quota state. Semantic colour, kept separate from the accent so it reads as a
   status rather than as decoration. */
.mm-free { color: var(--vp-c-green-1); font-weight: 700; }
.mm-exhausted { color: var(--vp-c-danger-1); font-weight: 700; }
.mm-okbox {
  padding: 0.5rem 0.75rem; border-radius: 6px;
  background: var(--vp-c-green-soft); color: var(--vp-c-green-1);
}
.mm-quotablock { margin: 0.8rem 0; }
.mm-row-free td { background: var(--vp-c-green-soft); }
.mm-ptable td.mm-num { min-width: 7.5rem; }
.mm-swatch { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 2px; margin-right: 0.35rem; background: hsl(var(--h) 62% 46%); vertical-align: -1px; }
.mm-note { font-size: 11.5px; color: var(--vp-c-text-3); margin: 0.35rem 0 0; }
/* The single most misreadable number on this page gets the loudest treatment.
   A product maximum of 1,000,000 sitting next to a subscription quota of 1,000
   is a thousandfold difference, and readers will assume the big number is
   theirs unless told otherwise in the same place they read it. */
.mm-quota {
  font-size: 12px; margin: 0.5rem 0 0; padding: 0.55rem 0.75rem;
  border-radius: 6px; background: var(--vp-c-warning-soft); color: var(--vp-c-warning-1);
}
.mm-buckets code { margin-right: 0.35rem; }
.mm-cmd { display: inline-block; margin-top: 0.35rem; font-size: 11px; word-break: break-all; }
.mm-empty { text-align: center; padding: 2rem; color: var(--vp-c-text-2); }
.mm-legend { font-size: 12px; color: var(--vp-c-text-3); margin-top: 0.6rem; }

@media (max-width: 640px) {
  .mm-stats { gap: 0.5rem 1.2rem; }
  .mm-stats b { font-size: 1.15rem; }
  .mm-td-model { min-width: 11rem; }
}
</style>
