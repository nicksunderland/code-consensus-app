<script setup>
import { onMounted, ref, computed } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import { apiClient } from '@/composables/shared/apiClient.js';

const loading = ref(true);
const error = ref('');
const projects = ref([]);

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

onMounted(fetchExamples);
</script>

<template>
  <div class="examples-page">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Open Gallery</p>
        <h1>Curated phenotype playbook</h1>
        <p class="lede">
          Browse exemplar projects and phenotypes without needing project membership.
          Each card pulls live data directly from the database using a service role path,
          so teams can share vetted definitions publicly.
        </p>
        <div class="hero-actions">
          <Button label="Refresh" icon="pi pi-refresh" :loading="loading" @click="fetchExamples" />
          <router-link to="/accordion" custom v-slot="{ navigate }">
            <Button label="Go to consensus tool" icon="pi pi-arrow-right" iconPos="right" severity="secondary" text @click="navigate" />
          </router-link>
        </div>
      </div>
      <div class="hero-card">
        <Card class="pulse-card">
          <template #title>Always-on access</template>
          <template #content>
            <p class="card-copy">
              The gallery uses a backend endpoint that bypasses RLS for a curated list of projects
              (set via <code>EXAMPLE_PROJECT_IDS</code>), so anyone can explore without logging in.
            </p>
            <div class="pill-row">
              <Tag value="Public" severity="success" />
              <Tag value="Read-only" severity="info" />
              <Tag value="Live data" severity="warning" />
            </div>
          </template>
        </Card>
      </div>
    </section>

    <section class="content">
      <div v-if="error" class="error-box">
        <i class="pi pi-times-circle"></i>
        <span>{{ error }}</span>
        <Button label="Retry" icon="pi pi-refresh" text @click="fetchExamples" />
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
            <div class="pheno-list" v-if="project.phenotypes?.length">
              <div v-for="pheno in project.phenotypes" :key="pheno.id" class="pheno-pill">
                <div class="pill-main">
                  <h3>{{ pheno.name }}</h3>
                  <p>{{ pheno.description || 'Pending description' }}</p>
                  <div class="pill-meta">
                    <Tag v-if="pheno.source" icon="pi pi-link" severity="secondary" :value="sourceLabel(pheno.source)" />
                    <Tag icon="pi pi-check-circle" severity="success" :value="`${pheno.consensus_codes} consensus codes`" />
                    <Tag icon="pi pi-filter" severity="info" :value="`${pheno.search_terms} search terms`" />
                  </div>
                </div>
                <div class="pill-footer">
                  <span class="timestamp">
                    <i class="pi pi-clock"></i>
                    Updated {{ formatDate(pheno.updated_at) }}
                  </span>
                  <a v-if="pheno.source" :href="pheno.source" target="_blank" rel="noreferrer" class="source-link">
                    View source
                    <i class="pi pi-external-link"></i>
                  </a>
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
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
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

.pheno-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pheno-pill {
  border: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 60%);
  border-radius: 12px;
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  box-shadow: 0 10px 25px -16px rgba(15, 23, 42, 0.25);
}

.pill-main h3 {
  margin: 0;
  color: #0f172a;
  font-size: 1.05rem;
}

.pill-main p {
  margin: 0.2rem 0 0.5rem;
  color: #475569;
}

.pill-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.pill-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.timestamp {
  color: #64748b;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
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
}
</style>
