<script setup>
import { onMounted, ref, computed, reactive } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import { apiClient } from '@/composables/shared/apiClient.js';

const loading = ref(true);
const error = ref('');
const projects = ref([]);
const expandedPhenotypes = ref(new Set());
const phenotypeState = reactive({});

const fetchExamples = async () => {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await apiClient.get('/api/example-phenotypes');
    projects.value = data?.projects || [];
  } catch (err) {
    console.error('Failed to load examples', err);
    error.value = err.response?.data?.detail || err.message || 'Unable to load examples right now.';
  } finally {
    loading.value = false;
  }
};

const hasExamples = computed(() =>
  projects.value.length > 0 && projects.value.some(p => p.phenotypes && p.phenotypes.length)
);

const ensureState = (phenotypeId) => {
  if (!phenotypeState[phenotypeId]) {
    phenotypeState[phenotypeId] = { loading: false, error: '', data: null };
  }
  return phenotypeState[phenotypeId];
};

const loadPhenotype = async (phenotypeId, force = false) => {
  const state = ensureState(phenotypeId);
  if (state.loading) return;
  if (state.data && !force) return;

  state.loading = true;
  state.error = '';
  try {
    const { data } = await apiClient.get(`/api/example-phenotypes/${phenotypeId}`);
    state.data = data;
  } catch (err) {
    console.error('Failed to load phenotype', err);
    state.error = err.response?.data?.detail || err.message || 'Unable to load phenotype right now.';
  } finally {
    state.loading = false;
  }
};

const togglePhenotype = async (phenotypeId) => {
  const next = new Set(expandedPhenotypes.value);
  if (next.has(phenotypeId)) {
    next.delete(phenotypeId);
    expandedPhenotypes.value = next;
    return;
  }

  next.add(phenotypeId);
  expandedPhenotypes.value = next;
  await loadPhenotype(phenotypeId);
};

const isExpanded = (phenotypeId) => expandedPhenotypes.value.has(phenotypeId);
const phenoState = (phenotypeId) => phenotypeState[phenotypeId] || { loading: false, error: '', data: null };

const sourceLabel = (link) => {
  if (!link) return '';
  try {
    return new URL(link).hostname;
  } catch (e) {
    return 'Source';
  }
};

const formatDate = (value) => {
  if (!value) return 'Recently updated';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
};

const agreementPercent = (metrics) => Math.round(((metrics?.agreement?.agreement ?? 0) || 0) * 100);
const agreementKappa = (metrics) => {
  const val = metrics?.agreement?.kappa ?? 0;
  return Number.isFinite(val) ? val.toFixed(2) : '0.00';
};
const agreementSeverity = (pct) => {
  if (pct >= 80) return 'success';
  if (pct >= 60) return 'info';
  if (pct >= 40) return 'warning';
  return 'danger';
};

const metricVal = (pheno, key, fallback = 0) => {
  return phenoState(pheno.id).data?.metrics?.[key] ?? pheno[key] ?? fallback;
};

const metricsReady = (pheno) => !!phenoState(pheno.id).data?.metrics;

const regexCount = (pheno) => {
  const terms = phenoState(pheno.id).data?.search_terms || [];
  return terms.filter(t => t.is_regex).length;
};

const buildExportPayload = (pheno) => {
  const state = phenoState(pheno.id).data;
  if (!state) return null;
  const metrics = state.metrics || {};
  const codes = state.consensus_codes || [];
  return {
    metadata: {
      id: pheno.id,
      name: pheno.name,
      description: pheno.description || 'No description provided.',
      project: pheno.project_name || 'Published example',
      source: pheno.source || 'N/A',
      generated_at: new Date().toISOString(),
      consensus_codes: metrics.consensus_total || codes.length,
      agreement_percent: agreementPercent(metrics),
      kappa: metrics.agreement?.kappa ?? null
    },
    codes: codes.map(c => ({
      code: c.code,
      description: c.description,
      system: c.system,
      consensus_comments: c.consensus_comments || ''
    }))
  };
};

const downloadExample = async (pheno, format = 'text') => {
  const state = phenoState(pheno.id);
  if (!state.data) {
    await loadPhenotype(pheno.id, true);
  }
  const payload = buildExportPayload(phenoState(pheno.id).data?.phenotype || pheno);
  if (!payload) return;

  let content = '';
  let ext = 'txt';
  if (format === 'json') {
    content = JSON.stringify(payload, null, 2);
    ext = 'json';
  } else if (format === 'yaml') {
    const m = payload.metadata;
    content += `metadata:\n`;
    Object.entries(m).forEach(([k, v]) => {
      content += `  ${k}: "${v ?? ''}"\n`;
    });
    content += `codes:\n`;
    payload.codes.forEach(c => {
      content += `  - code: "${c.code || ''}"\n`;
      content += `    system: "${c.system || ''}"\n`;
      content += `    description: "${c.description || ''}"\n`;
      if (c.consensus_comments) content += `    consensus_comments: "${c.consensus_comments}"\n`;
    });
    ext = 'yaml';
  } else {
    const m = payload.metadata;
    content += `# Phenotype: ${m.name}\n# Project: ${m.project}\n# Generated: ${m.generated_at}\n`;
    content += `# Consensus codes: ${m.consensus_codes}\n# Agreement: ${m.agreement_percent}% (kappa ${m.kappa ?? 'n/a'})\n\n`;
    content += `CODE\tSYSTEM\tDESCRIPTION\tCOMMENTS\n`;
    payload.codes.forEach(c => {
      content += `${c.code || ''}\t${c.system || ''}\t${c.description || ''}\t${c.consensus_comments || ''}\n`;
    });
  }

  const mime =
    format === 'json'
      ? 'application/json'
      : format === 'yaml'
        ? 'text/yaml'
        : 'text/plain';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pheno.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

onMounted(fetchExamples);
</script>

<template>
  <div class="examples-page">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">EXAMPLES LIBRARY</p>
        <h1>Published phenotypes</h1>
        <p class="lede">
          Browse exemplar projects and phenotypes without needing membership. Expand a phenotype to see its
          search heuristics, system breakdown, consensus codes, and reviewer agreement.
        </p>
        <div class="hero-actions">
          <router-link to="/accordion" custom v-slot="{ navigate }">
            <Button label="Go to consensus tool" icon="pi pi-arrow-right" iconPos="right" severity="secondary" text @click="navigate" />
          </router-link>
        </div>
      </div>
      <div class="hero-card">
        <Card class="pulse-card">
          <template #title>Ready-to-use references</template>
          <template #content>
            <p class="card-copy">
              Explore phenotypes compiled by the HERMES consortium team. Review code lists, search terms, and consensus notes
              in one place.
            </p>
            <div class="pill-row">
              <Tag value="Published" severity="success" />
              <Tag value="Read-only" severity="info" />
            </div>
          </template>
        </Card>
      </div>
    </section>

    <section class="content">
      <div v-if="error" class="error-box">
        <i class="pi pi-times-circle"></i>
        <span>{{ error }}</span>
      </div>

      <div v-else-if="loading" class="grid">
        <Card v-for="n in 2" :key="n" class="project-card loading-card">
          <template #title><Skeleton width="60%" height="1.5rem" /></template>
          <template #content>
            <Skeleton width="90%" class="mb-3" />
            <Skeleton width="50%" class="mb-4" />
            <div class="pheno-list">
              <div class="pheno-pill" v-for="i in 3" :key="i">
                <Skeleton width="70%" />
                <div class="pill-meta">
                  <Skeleton width="4rem" height="1.2rem" />
                  <Skeleton width="4rem" height="1.2rem" />
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <div v-else-if="!hasExamples" class="empty-state">
        <div class="empty-icon">
          <i class="pi pi-search"></i>
        </div>
        <h3>No examples yet</h3>
        <p>Populate <code>EXAMPLE_PROJECT_IDS</code> on the API to publish curated phenotypes.</p>
      </div>

      <div v-else class="grid">
        <Card v-for="project in projects" :key="project.id" class="project-card">
          <template #title>
            <div class="card-header">
              <div>
                <p class="eyebrow">Project</p>
                <h2>{{ project.name }}</h2>
              </div>
              <Tag :value="`${project.phenotypes?.length || 0} phenotypes`" severity="info" />
            </div>
          </template>
          <template #content>
            <p class="project-desc">{{ project.description || 'No description provided.' }}</p>
            <div v-if="project.phenotypes?.length" class="pheno-accordion-list">
              <div v-for="pheno in project.phenotypes" :key="pheno.id" class="pheno-accordion">
                <button class="accordion-toggle" type="button" @click="togglePhenotype(pheno.id)">
                  <div class="toggle-left">
                    <p class="eyebrow">Phenotype</p>
                    <h3>{{ pheno.name }}</h3>
                    <p class="muted">{{ pheno.description || 'Pending description' }}</p>
                    <div class="pill-meta">
                      <Tag severity="info" class="meta-tag">
                        <span class="meta-line">
                          <i class="pi pi-filter"></i>
                          {{ metricVal(pheno, 'search_terms') }} terms
                          <span class="divider"> / </span>
                          <i class="pi pi-search"></i>
                          {{ metricVal(pheno, 'search_codes') }} codes
                          <span class="divider"> / </span>
                          <i class="pi pi-download"></i>
                          {{ metricVal(pheno, 'imported_codes') }} imported
                        </span>
                      </Tag>
                      <Tag
                        icon="pi pi-check-circle"
                        severity="success"
                        :value="`${pheno.consensus_codes || 0} consensus codes`"
                      />
                      <Tag
                        v-if="pheno.source"
                        icon="pi pi-link"
                        severity="secondary"
                        :value="sourceLabel(pheno.source)"
                      />
                    </div>
                  </div>
                  <div class="toggle-right">
                    <span class="timestamp">
                      <i class="pi pi-clock"></i>
                      {{ formatDate(pheno.updated_at) }}
                    </span>
                    <i class="pi" :class="isExpanded(pheno.id) ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                  </div>
                </button>

                <div v-if="isExpanded(pheno.id)" class="accordion-body">
                  <div v-if="phenoState(pheno.id).error" class="inline-error">
                    <i class="pi pi-times-circle"></i>
                    <span>{{ phenoState(pheno.id).error }}</span>
                  </div>
                  <div v-else-if="phenoState(pheno.id).loading" class="detail-loading">
                    <Skeleton width="60%" height="1.6rem" class="mb-2" />
                    <Skeleton width="90%" class="mb-2" />
                    <Skeleton width="80%" />
                    <div class="table-skeleton">
                      <Skeleton width="100%" height="2.5rem" />
                      <Skeleton width="100%" height="2.5rem" />
                      <Skeleton width="100%" height="2.5rem" />
                    </div>
                  </div>
                  <div v-else class="detail-content">
                    <div class="metrics-grid">
                      <div class="stat-card">
                        <p class="eyebrow">Search terms</p>
                        <p class="muted">{{ regexCount(pheno) }} regex · {{ metricVal(pheno, 'search_terms') - regexCount(pheno) }} plain</p>
                        <div v-if="phenoState(pheno.id).data?.search_terms?.length" class="term-chips">
                          <Tag
                            v-for="term in phenoState(pheno.id).data?.search_terms"
                            :key="term.term"
                            :value="term.term"
                            :severity="term.is_regex ? 'warning' : 'secondary'"
                          />
                        </div>
                        <div class="muted" v-else>No search heuristics published.</div>
                      </div>
                      <div class="stat-card">
                        <p class="eyebrow">Codes</p>
                        <h4>{{ metricVal(pheno, 'search_codes') }} total</h4>
                        <p class="muted">Breakdown by system</p>
                        <div class="pill-row" v-if="phenoState(pheno.id).data?.metrics?.system_breakdown?.length">
                          <Tag
                            v-for="system in phenoState(pheno.id).data?.metrics?.system_breakdown"
                            :key="system.name"
                            :value="`${system.name} (${system.count})`"
                            severity="info"
                          />
                        </div>
                        <div class="muted" v-else>No systems recorded yet.</div>
                      </div>
                      <div class="stat-card">
                        <p class="eyebrow">Consensus codes</p>
                        <h4>{{ phenoState(pheno.id).data?.metrics?.consensus_total || 0 }}</h4>
                        <p class="muted">Finalized by reviewers</p>
                      </div>
                      <div class="stat-card agreement-card">
                        <p class="eyebrow">Agreement</p>
                        <div class="agreement-header">
                          <div class="kappa-line">
                            <span class="kappa-value">κ {{ agreementKappa(phenoState(pheno.id).data?.metrics) }}</span>
                            <span class="muted">({{ phenoState(pheno.id).data?.metrics?.agreement?.items || 0 }} items)</span>
                          </div>
                        </div>
                        <div class="agreement-percent">
                          {{ agreementPercent(phenoState(pheno.id).data?.metrics) }}% agreement
                        </div>
                        <div class="battery-shell">
                          <div
                            class="battery-fill"
                            :style="{
                              width: `${agreementPercent(phenoState(pheno.id).data?.metrics)}%`,
                              background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)'
                            }"
                          ></div>
                          <div class="battery-cap"></div>
                        </div>
                      </div>
                    </div>

                    <div class="codes-block">
                      <div class="codes-head">
                        <div>
                          <p class="eyebrow">Consensus codes</p>
                          <h4>Finalized code list and notes</h4>
                        </div>
                        <div class="download-actions">
                          <Button label="TXT" size="small" text icon="pi pi-download" @click.stop="downloadExample(pheno, 'text')" />
                          <Button label="YAML" size="small" text icon="pi pi-file" @click.stop="downloadExample(pheno, 'yaml')" />
                          <Button label="JSON" size="small" text icon="pi pi-code" @click.stop="downloadExample(pheno, 'json')" />
                        </div>
                      </div>

                      <div v-if="phenoState(pheno.id).data?.consensus_codes?.length" class="codes-table-wrapper">
                        <table class="codes-table">
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Description</th>
                              <th>System</th>
                              <th>Consensus notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="code in phenoState(pheno.id).data?.consensus_codes" :key="`${code.code_type}-${code.code_id || code.orphan_id}`">
                              <td>
                                <span class="code-chip">{{ code.code || 'N/A' }}</span>
                                <span v-if="code.code_type === 'orphan'" class="code-pill">Custom</span>
                              </td>
                              <td>{{ code.description || 'No description available' }}</td>
                              <td>{{ code.system || '—' }}</td>
                              <td>{{ code.consensus_comments || '—' }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div v-else class="empty-phenos">
                        <i class="pi pi-info-circle"></i>
                        <span>No consensus codes published for this phenotype.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="empty-phenos">
              <i class="pi pi-info-circle"></i>
              <span>No phenotypes published for this project yet.</span>
            </div>
          </template>
        </Card>
      </div>
    </section>
  </div>
</template>

<style scoped>
.examples-page {
  background: radial-gradient(circle at 20% 20%, rgba(14, 165, 233, 0.08), transparent 35%),
              radial-gradient(circle at 80% 0%, rgba(16, 185, 129, 0.08), transparent 25%),
              #f8fafc;
  min-height: 100vh;
  padding: 3rem 1.5rem 4rem;
}

.hero {
  max-width: 1200px;
  margin: 0 auto 2.5rem auto;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 2rem;
  align-items: center;
}

.hero-copy h1 {
  font-size: 2.6rem;
  margin: 0.2rem 0 0.5rem;
  color: #0f172a;
}

.hero-card {
  width: 100%;
}

.pulse-card {
  border: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 10px 30px -12px rgba(15, 23, 42, 0.25);
}

.card-copy {
  color: #475569;
  line-height: 1.6;
}

.pill-row {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #0ea5e9;
  margin: 0;
}

.lede {
  color: #475569;
  max-width: 640px;
  line-height: 1.6;
  margin-bottom: 1.2rem;
}

.hero-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
}

.project-card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.card-header h2 {
  margin: 0.2rem 0 0;
  color: #0f172a;
}

.project-desc {
  color: #475569;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.pheno-accordion-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pheno-accordion {
  border: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 70%);
  border-radius: 12px;
  box-shadow: 0 10px 25px -16px rgba(15, 23, 42, 0.25);
}

.accordion-toggle {
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.05rem 1.25rem;
  cursor: pointer;
  text-align: left;
}

.toggle-left h3 {
  margin: 0.05rem 0;
  color: #0f172a;
  font-size: 1.1rem;
}

.toggle-left .muted {
  margin: 0.15rem 0 0.35rem;
}

.toggle-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #64748b;
}

.toggle-right .pi {
  font-size: 1.1rem;
}

.muted {
  color: #475569;
}

.pill-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.timestamp {
  color: #64748b;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.accordion-body {
  border-top: 1px dashed #e2e8f0;
  padding: 1rem;
  background: #fff;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}

.inline-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px dashed #fecdd3;
  padding: 0.75rem 1rem;
  border-radius: 10px;
}

.detail-loading {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.table-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.stat-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.stat-card p {
  margin: 0.1rem 0;
}

.stat-card h4 {
  margin: 0.05rem 0 0.1rem;
}

.agreement-card {
  gap: 0.5rem;
}

.agreement-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.kappa-line {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.kappa-value {
  font-weight: 700;
  color: #0f172a;
}

.agreement-percent {
  font-weight: 700;
  color: #0ea5e9;
}

.meta-tag :deep(.pi) {
  font-size: 0.85rem;
}

.battery-shell {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.battery-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.25s ease;
}

.battery-cap {
  position: absolute;
  right: -6px;
  top: 2px;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #cbd5e1;
}

.term-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.source-card {
  background: linear-gradient(135deg, #ecfeff 0%, #f8fafc 100%);
}

.codes-block {
  margin-top: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.codes-head {
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.codes-table td:first-child,
.codes-table th:first-child {
  width: 18%;
}

.codes-table-wrapper {
  overflow-x: auto;
}

.codes-table {
  width: 100%;
  border-collapse: collapse;
}

.codes-table th,
.codes-table td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  vertical-align: middle;
  font-size: 0.9rem;
}

.codes-table th {
  background: #f8fafc;
  color: #0f172a;
  font-weight: 600;
}

.code-chip {
  display: inline-block;
  background: #0ea5e910;
  color: #0f172a;
  padding: 0.15rem 0.4rem;
  border-radius: 6px;
  font-weight: 500;
  border: 1px solid #bae6fd;
  margin-right: 0.25rem;
  font-size: 0.85rem;
}

.code-pill {
  display: inline-block;
  background: #ecfeff;
  color: #0ea5e9;
  border: 1px solid #bae6fd;
  padding: 0.15rem 0.5rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
}

.source-link {
  color: #0ea5e9;
  text-decoration: none;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.source-link:hover {
  text-decoration: underline;
}

.empty-state, .error-box, .empty-phenos {
  border: 1px dashed #cbd5e1;
  background: rgba(14, 165, 233, 0.04);
  color: #0f172a;
  padding: 1.25rem;
  border-radius: 12px;
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #0ea5e910;
  display: grid;
  place-items: center;
  color: #0ea5e9;
  margin: 0 auto 0.5rem;
  font-size: 1.25rem;
}

.error-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  color: #b91c1c;
  background: #fef2f2;
  border-color: #fecdd3;
}

.empty-phenos {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-start;
  background: #f8fafc;
}

.loading-card :deep(.p-card-content) {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

@media (max-width: 960px) {
  .hero {
    grid-template-columns: 1fr;
  }
  .hero-copy h1 {
    font-size: 2.2rem;
  }
  .accordion-toggle {
    flex-direction: column;
    align-items: flex-start;
  }
  .toggle-right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
