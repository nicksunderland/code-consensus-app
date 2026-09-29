<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';

// composables
import { useAuth } from '@/composables/auth/useAuth.js';
import { useProjects } from '@/composables/project/useProjects.js';
import { usePhenotypes } from '@/composables/project/usePhenotypes.js';
import { useProjectOverview } from '@/composables/project/useProjectOverview.js';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const projects = useProjects();
const phenotypes = usePhenotypes();
const { rows, loading, stats, fetchSummary } = useProjectOverview();

const filter = ref('');

const projectId = computed(() => route.params.id);
const project = computed(() => projects.projects.value.find(p => p.id === projectId.value) || null);
const isOwner = computed(() => !!user.value && project.value?.owner === user.value.id);
const members = computed(() => {
    const list = project.value?.member_data || [];
    // owner first, then by email
    return [...list].sort((a, b) =>
        (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0) || (a.email || '').localeCompare(b.email || ''));
});
const ownerEmail = computed(() => members.value.find(m => m.role === 'owner')?.email || '');

const filteredRows = computed(() => {
    const q = filter.value.trim().toLowerCase();
    if (!q) return rows.value;
    return rows.value.filter(r =>
        r.name?.toLowerCase().includes(q) || r.source?.toLowerCase().includes(q) || r.status.toLowerCase().includes(q));
});

// projects load after login, so wait for the list before selecting
watch([projectId, project], async ([id, p]) => {
    if (!id || !p) return;
    if (projects.currentProject.value?.id !== id) {
        phenotypes.emptyPhenotypes();
        await projects.selectProject(p);
        phenotypes.fetchPhenotypes();
    }
    fetchSummary(id);
}, { immediate: true });

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function openPhenotype(row) {
    await phenotypes.loadPhenotype(row.phenotype_id);
    router.push('/accordion');
}

function newPhenotype() {
    phenotypes.clearPhenotype();
    router.push('/accordion');
}
</script>

<template>
  <div class="project-page">

    <div v-if="!user" class="empty-state">
      <i class="pi pi-lock"></i>
      <p>Log in to view this project.</p>
    </div>

    <div v-else-if="!project" class="empty-state">
      <template v-if="projects.projects.value.length">
        <i class="pi pi-question-circle"></i>
        <p>Project not found, or you're not a member of it.</p>
      </template>
      <template v-else>
        <i class="pi pi-spin pi-spinner"></i>
        <p>Loading project...</p>
      </template>
    </div>

    <template v-else>
      <section class="header">
        <div>
          <p class="eyebrow">Project</p>
          <h1>{{ project.name }}</h1>
          <p v-if="project.description" class="lede">{{ project.description }}</p>
          <p class="meta">
            <span v-if="ownerEmail"><i class="pi pi-user"></i> {{ ownerEmail }}</span>
            <span><i class="pi pi-calendar"></i> Created {{ formatDate(project.created_at) }}</span>
          </p>
        </div>
        <div class="header-actions">
          <Button
            v-if="isOwner"
            label="Edit project"
            icon="pi pi-pencil"
            severity="secondary"
            outlined
            @click="projects.openEditDialog()"
          />
          <Button
            label="Export project"
            icon="pi pi-download"
            severity="secondary"
            outlined
            disabled
            v-tooltip.bottom="'Coming soon'"
          />
          <Button label="New phenotype" icon="pi pi-plus" @click="newPhenotype" />
        </div>
      </section>

      <section class="stats">
        <div class="stat">
          <span class="stat-value">{{ stats.phenotypes }}</span>
          <span class="stat-label">phenotypes</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ stats.finalized }}</span>
          <span class="stat-label">finalised</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ stats.consensusCodes }}</span>
          <span class="stat-label">consensus codes</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ members.length }}</span>
          <span class="stat-label">members</span>
        </div>
      </section>

      <section class="body">
        <Card class="members-card">
          <template #title>Members</template>
          <template #content>
            <ul class="member-list">
              <li v-for="m in members" :key="m.user_id">
                <div>
                  <div class="member-email">{{ m.email || m.user_id }}</div>
                  <div v-if="m.added_at" class="member-added">added {{ formatDate(m.added_at) }}</div>
                </div>
                <Tag :value="m.role" :severity="m.role === 'owner' ? 'info' : 'secondary'" />
              </li>
            </ul>
          </template>
        </Card>

        <Card class="phenotypes-card">
          <template #title>
            <div class="table-title">
              <span>Phenotypes</span>
              <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="filter" placeholder="Filter" size="small" />
              </IconField>
            </div>
          </template>
          <template #content>
            <DataTable
              :value="filteredRows"
              :loading="loading"
              dataKey="phenotype_id"
              sortField="name"
              :sortOrder="1"
              size="small"
              stripedRows
              selectionMode="single"
              @row-click="e => openPhenotype(e.data)"
              class="phenotype-table"
            >
              <template #empty>No phenotypes yet.</template>

              <Column field="name" header="Phenotype" sortable>
                <template #body="{ data }">
                  <div class="pheno-name">{{ data.name }}</div>
                  <div v-if="data.source" class="pheno-source">{{ data.source }}</div>
                </template>
              </Column>
              <Column field="consensus_codes" header="Consensus codes" sortable class="num" />
              <Column field="raters" sortable class="num">
                <template #header>
                  <span v-tooltip.top="'Members who have selected codes'">Raters</span>
                </template>
              </Column>
              <Column field="status" header="Status" sortable>
                <template #body="{ data }">
                  <Tag
                    :value="data.status"
                    :severity="data.finalized_at ? 'success' : 'warn'"
                    :icon="data.finalized_at ? 'pi pi-check-circle' : 'pi pi-pencil'"
                  />
                  <div v-if="data.finalized_at" class="pheno-source">{{ formatDate(data.finalized_at) }}</div>
                </template>
              </Column>
              <Column field="last_activity" header="Last activity" sortable>
                <template #body="{ data }">{{ formatDate(data.last_activity) }}</template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </section>
    </template>
  </div>
</template>

<style scoped>
.project-page {
  background: #f8fafc;
  min-height: 100vh;
  padding: 2.5rem 1.5rem 4rem;
}

.header,
.stats,
.body {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.header h1 {
  font-size: 2.2rem;
  margin: 0.2rem 0 0.4rem;
  color: #0f172a;
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
  max-width: 720px;
  line-height: 1.6;
  margin: 0 0 0.6rem;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
  color: #64748b;
  font-size: 0.9rem;
  margin: 0;
}

.meta i {
  margin-right: 0.3rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 700;
  color: #0f172a;
}

.stat-label {
  color: #64748b;
  font-size: 0.85rem;
}

.body {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  align-items: start;
}

.members-card,
.phenotypes-card {
  border: 1px solid #e2e8f0;
  box-shadow: none;
}

.member-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.member-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.member-list li:last-child {
  border-bottom: none;
}

.member-email {
  font-size: 0.9rem;
  word-break: break-all;
}

.member-added,
.pheno-source {
  font-size: 0.75rem;
  color: #94a3b8;
}

.table-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.pheno-name {
  font-weight: 600;
}

.phenotype-table :deep(tbody tr) {
  cursor: pointer;
}

.phenotype-table :deep(td.num),
.phenotype-table :deep(th.num) {
  text-align: right;
}

.empty-state {
  max-width: 480px;
  margin: 4rem auto;
  text-align: center;
  color: #64748b;
}

.empty-state i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

/* mobile */
@media (max-width: 900px) {
  .header {
    flex-direction: column;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .body {
    grid-template-columns: 1fr;
  }
}
</style>
