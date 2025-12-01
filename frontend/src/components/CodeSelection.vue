<script setup>
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import Textarea from "primevue/textarea";
import Button from "primevue/button";
import Tooltip from 'primevue/tooltip'
import Tag from 'primevue/tag';
import ToggleButton from 'primevue/togglebutton';
import ConfirmPopup from 'primevue/confirmpopup';
import 'primeicons/primeicons.css';
import {useCodeSelection} from "@/composables/selection/useCodeSelection.js";
import {useConfirm} from "primevue/useconfirm";
import Avatar from 'primevue/avatar';
import OverlayBadge from 'primevue/overlaybadge';
import {ref, computed} from "vue";
import {useAuth} from "@/composables/auth/useAuth.js";
import {useProjects} from "@/composables/project/useProjects.js";
import CodeImport from "@/components/CodeImport.vue";
import {useCodeImport} from "@/composables/selection/useCodeImport.js";
import {usePhenotypes} from "@/composables/project/usePhenotypes.js";

// --- use composable ---
const {
  tableRows,
  updateSelection,
  updateComment,
  toggleSelectAll,
  isAllSelected,
  isIndeterminate,
  saveSelections,
  hasUnsavedChanges,
  hasUnsavedConsensusChanges,
  isReviewMode,
  isFinalized,
  projectMembers,
  getTeamMemberStatus,
  updateConsensusSelection,
  updateConsensusComment,
  saveConsensus,
  unlockConsensus,
  clearImportedCodes,
  agreementStats
} = useCodeSelection()


const {
  openImportDialog,
} = useCodeImport()


// composables
const confirm = useConfirm();
const { user } = useAuth();
const { currentProject } = useProjects();
const { currentPhenotype } = usePhenotypes();
const hasRows = computed(() => tableRows.value.length > 0);

const agreementPercent = computed(() => Math.round((agreementStats.value?.agreement || 0) * 100));
const agreementKappa = computed(() => agreementStats.value?.kappa || 0);
const agreementItems = computed(() => agreementStats.value?.items || 0);

const agreementSeverity = computed(() => {
    const pct = agreementPercent.value;
    if (pct >= 80) return 'success';
    if (pct >= 60) return 'info';
    if (pct >= 40) return 'warning';
    return 'danger';
});

const agreementFillColor = computed(() => {
    const severity = agreementSeverity.value;
    if (severity === 'success') return 'linear-gradient(90deg, #22c55e, #16a34a)';
    if (severity === 'info') return 'linear-gradient(90deg, #38bdf8, #0ea5e9)';
    if (severity === 'warning') return 'linear-gradient(90deg, #f59e0b, #d97706)';
    return 'linear-gradient(90deg, #fca5a5, #ef4444)';
});

const agreementFillWidth = computed(() => `${Math.min(100, Math.max(0, agreementPercent.value))}%`);

const formatKappa = computed(() => {
    const val = agreementKappa.value;
    if (Number.isNaN(val)) return '0.00';
    return val.toFixed(2);
});

// --- methods ---
const isVisibleDeselectAllCheck = ref(false);
const handleSelectAll = (event) => {
  if (!isAllSelected.value) {
    toggleSelectAll();
    return;
  }

  confirm.require({
    target: event.currentTarget,
    message: `Deselecting all items will clear your selection data. Continue?`,
    header: `Clear Selection?`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Clear All',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Cancel',
    onShow: () => {
      isVisibleDeselectAllCheck.value = true;
    },
    onHide: () => {
      isVisibleDeselectAllCheck.value = false;
    },
    accept: () => {
      toggleSelectAll();
    },
    reject: () => {
    }
  });
}
const confirmClearImported = (event) => {
  confirm.require({
    target: event.currentTarget,
    message: 'This will permanently delete all your imported codes for this phenotype. Continue?',
    header: 'Clear Imported Codes?',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Clear All',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Cancel',
    accept: () => {
      clearImportedCodes();
    }
  });
};
const isProjectOwner = computed(() => {
    if (!user.value || !currentProject.value) return false;
    return user.value.id === currentProject.value.owner;
});

</script>

<template>
  <ConfirmPopup />
  <CodeImport />
  <Card>
    <template #content>
      <div v-if="isReviewMode && !hasRows" class="empty-review">
        <i class="pi pi-list-check"></i>
        <p>No codes to review yet. Add selections in the Search tab to see them here.</p>
      </div>
      <DataTable
        v-if="!isReviewMode || hasRows"
        :value="tableRows"
        dataKey="key"
        lazy
        loading-icon="pi pi-spinner pi-spin"
        :emptyMessage="'No nodes selected.'"
        responsiveLayout="scroll"
        scrollable
        scrollHeight="600px"
        size="small"
        class="compact-text"
      >
        <template #header>
            <div class="header-row">
              <div class="header-actions">

              <ToggleButton
                  v-model="isReviewMode"
                  onLabel="Exit Review"
                  offLabel="Review Mode"
                  onIcon="pi pi-eye-slash"
                  offIcon="pi pi-users"
                  style="font-size: 0.75rem; padding: 0.3rem 0.5rem;"
              />

              <!-- Import Button -->
              <Button
                v-if="!isReviewMode"
                label="Import"
                icon="pi pi-upload"
                severity="secondary"
                :disabled="isFinalized || !currentPhenotype?.id"
                v-tooltip.top="{ value: !currentPhenotype?.id ? 'Select a phenotype first' : 'Import codes', showDelay: 300 }"
                @click="openImportDialog"
                style="font-size: 0.75rem; padding: 0.5rem 0.5rem;"
              />

              <!-- Delete imported Button -->
              <Button
                v-if="!isReviewMode"
                label="Remove Imported"
                icon="pi pi-trash"
                severity="danger"
                outlined
                :disabled="isFinalized"
                @click="confirmClearImported"
                style="font-size: 0.75rem; padding: 0.5rem 0.5rem;"
              />

              <Button
                v-if="!isReviewMode"
                label="Save"
                icon="pi pi-save"
                severity="info"
                :disabled="isFinalized"
                @click="saveSelections"
                style="font-size: 0.75rem; padding: 0.5rem 0.5rem;"
                class="p-button-info"
                :class="{ 'dirty-glow': hasUnsavedChanges }"
              />

              <div v-if="!isReviewMode" style="display: flex; align-items: center; gap: 0.5rem;">
                <label for="header-checkbox" class="cursor-pointer font-bold white-space-nowrap" style="font-size: 0.85rem;">Select All</label>
                <Checkbox
                    inputId="header-checkbox"
                    class="checkbox-info"
                    :binary="true"
                    :disabled="isFinalized"
                    :modelValue="isAllSelected"
                    :indeterminate="isIndeterminate"
                    @click.prevent.stop="handleSelectAll"
                    v-tooltip.top="isAllSelected ? 'Deselect All' : 'Select All'"
                />
              </div>

              <div v-if="isFinalized & !isReviewMode" class="status-indicator">
                  <i class="pi pi-exclamation-triangle text-orange-500"></i>
                  <span class="status-text">Finalized - unlock in review mode</span>
              </div>

              <template v-if="isReviewMode">

                  <template v-if="isFinalized">
                      <Button
                        label="Unlock Consensus"
                        icon="pi pi-lock-open"
                        severity="danger"
                        outlined
                        :disabled="!isProjectOwner"
                        v-tooltip.top="!isProjectOwner ? 'Only the Project Owner can unlock' : 'Unlock to make changes'"
                        @click="unlockConsensus()"
                        style="font-size: 0.75rem; padding: 0.5rem 0.5rem;"
                      />
                      <Tag severity="success" value="Finalized" icon="pi pi-check-circle"></Tag>
                  </template>

                  <template v-else>
                      <Button
                        label="Save Draft"
                        icon="pi pi-save"
                        severity="secondary"
                        @click="saveConsensus(false)"
                        class="p-button-primary"
                        :class="{ 'dirty-glow': hasUnsavedConsensusChanges }"
                        style="font-size: 0.75rem; padding: 0.5rem 0.5rem;"
                      />

                      <Button
                        label="Finalize Consensus"
                        icon="pi pi-check-square"
                        severity="help"
                        :disabled="!isProjectOwner"
                        v-tooltip.top="!isProjectOwner ? 'Only the Project Owner can finalize' : 'Finalize consensus codes'"
                        @click="saveConsensus(true)"
                        style="font-size: 0.75rem; padding: 0.5rem 0.5rem;"
                      />
                  </template>
              </template>

              </div>

              <div v-if="isReviewMode" class="agreement-inline">
                <div class="kappa-row">
                  <span class="kappa-value">κ {{ formatKappa }}</span>
                  <span class="muted small-text">· {{ agreementItems }} items</span>
                  <Tag :severity="agreementSeverity" :value="`${agreementPercent}%`" />
                </div>
                <div class="battery-shell">
                  <div class="battery-fill" :style="{ width: agreementFillWidth, background: agreementFillColor }"></div>
                  <div class="battery-cap"></div>
                </div>
              </div>

            </div>
        </template>

        <Column v-if="!isReviewMode" header="Include" style="width: 4rem; text-align: center">
            <template #body="{ data }">
                <Checkbox
                    class="checkbox-info"
                    :binary="true"
                    :disabled="isFinalized"
                    :modelValue="data.selected"
                    @update:modelValue="(val) => updateSelection(data.key, val)"
                />
            </template>
        </Column>

        <Column v-if="!isReviewMode" field="found" header="Source">
          <template #body="{ data }">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <Tag
                v-if="data.imported"
                severity="warn"
                value="Import"
                style="font-size: 0.7rem; padding: 2px 4px;"
              />
              <Tag
                v-if="data.found"
                severity="info"
                value="Search"
                style="font-size: 0.7rem; padding: 2px 4px;"
              />
              <Tag
                v-if="!data.imported && !data.found"
                severity="secondary"
                value="Manual"
                style="font-size: 0.7rem; padding: 2px 4px;"
              />
            </div>
          </template>
        </Column>

        <Column field="system" header="System" />
        <Column field="code" header="Code" />
        <Column field="description" header="Description" style="min-width: 200px; max-width: 400px; white-space: normal; word-break: break-word;" />

        <Column v-if="!isReviewMode" header="Comment" style="min-width: 300px">
            <template #body="{ data }">
            <Textarea
                autoResize
                rows="1"
                class="w-full compact-input"
                placeholder="Comments"
                :modelValue="data.comment"
                :disabled="isFinalized"
                @update:modelValue="(val) => updateComment(data.key, val)"
            />
            </template>
        </Column>

        <Column
            v-if="isReviewMode"
            v-for="(member, index) in projectMembers"
            :key="member.id"
            headerClass="team-col-header"
            bodyClass="team-col-body"
            style="width: 4rem; text-align: center"
        >
            <template #header>
                <div
                    v-tooltip.top="member.name"
                    class="flex align-items-center justify-content-center"
                    style="width: 2rem;
                    min-height: 3.5rem;
                    align-content: center"
                >
                     <OverlayBadge :value="index + 1" severity="danger" size="small">
                        <Avatar icon="pi pi-user" shape="circle" style="background-color: #e9ecef; color: #495057" />
                    </OverlayBadge>
                </div>
            </template>
            <template #body="{ data }">
                <div class="flex align-items-center justify-content-center w-full h-full">
                    <div
                        class="relative flex align-items-center justify-content-center"
                        style="width: 2rem; height: 1rem;"
                        v-tooltip.top="getTeamMemberStatus(data.key, member.id).tooltip"
                    >
                        <i
                            :class="[
                                getTeamMemberStatus(data.key, member.id).icon,
                                getTeamMemberStatus(data.key, member.id).color
                            ]"
                            :style="{
                                color: getTeamMemberStatus(data.key, member.id).color,
                                fontSize: '1.2rem',
                                fontWeight: 'bold'
                            }"
                        ></i>
                    </div>
                </div>
            </template>
        </Column>

        <Column
            v-if="isReviewMode"
            header="Final consensus" style="width: 8rem; text-align: center"
        >
            <template #body="{ data }">
                <Checkbox
                    :binary="true"
                    :disabled="isFinalized"
                    :modelValue="data.consensus_selected"
                    @update:modelValue="(val) => updateConsensusSelection(data.key, val)"
                />
            </template>
        </Column>

        <Column v-if="isReviewMode" header="Consensus Comments" style="min-width: 300px">
            <template #body="{ data }">
            <Textarea
                autoResize
                rows="1"
                class="w-full compact-input"
                placeholder="Comments"
                :disabled="isFinalized"
                :modelValue="data.consensus_comment"
                @update:modelValue="(val) => updateConsensusComment(data.key, val)"
            />
            </template>
        </Column>

      </DataTable>
    </template>
  </Card>
</template>

<style scoped>
/* 1. Compact Table Header and Cells */
:deep(.compact-text .p-datatable-thead > tr > th),
:deep(.compact-text .p-datatable-tbody > tr > td) {
    font-size: 0.85rem;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    vertical-align: middle;
}

/* 2. The Textarea Input Itself */
:deep(.compact-input) {
    font-size: 0.85rem !important;
    line-height: 1.2;
    padding: 0.4rem 0.5rem;
    min-height: 2rem;
    resize: none;
}

/* 3. The Placeholder (Standard) */
:deep(.compact-input::placeholder) {
    font-size: 0.85rem !important;
    color: #999;
    opacity: 1;
}

/* 4. The Placeholder (Webkit/Chrome/Safari) */
:deep(.compact-input::-webkit-input-placeholder) {
    font-size: 0.85rem !important;
    color: #999;
}

.w-full {
    width: 100%;
}

/* 5. Custom Checkbox Styling (Cyan) */
/* The Box Background & Border when checked */
:deep(.checkbox-info.p-checkbox-checked .p-checkbox-box) {
    background-color: #0EA5E9 !important; /* Cyan Background */
    border-color: #0EA5E9 !important;     /* Cyan Border */
}

/* The Checkmark Icon */
:deep(.checkbox-info.p-checkbox-checked .p-checkbox-icon) {
    color: #ffffff !important;            /* Force Checkmark to be White */
}

/* Hover State */
:deep(.checkbox-info:not(.p-disabled):hover .p-checkbox-box) {
    border-color: #0EA5E9 !important;
}

/* 6. Disabled State Logic */
/* Makes things look properly disabled when finalized */
:deep(.p-disabled) {
    opacity: 0.6;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 0.5rem;
    font-size: 0.875rem;
    color: #f59e0b; /* Orange-500 */
    font-weight: 500;
}

.status-text {
    /* Hide text on very small screens if needed */
    white-space: nowrap;
}

.dirty-glow {
    /* 1. Solid Green Base (Green-500) */
    background-color: #22c55e !important;
    border-color: #22c55e !important;
    color: white !important;

    /* 2. Subtle Green Glow */
    /* Reduced blur (8px) and spread (2px) for a tighter, softer effect */
    box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.6) !important;

    transition: all 0.3s ease-in-out;
}

/* On hover, slightly increase brightness/glow to show interactivity */
.dirty-glow:hover {
     background-color: #16a34a !important; /* Green-600 */
     box-shadow: 0 0 12px 3px rgba(34, 197, 94, 0.7) !important;
}

.header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-bottom: 0.75rem;
    flex-wrap: wrap;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.kappa-row {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    flex-wrap: wrap;
}

.kappa-value {
    font-weight: 700;
    color: #0f172a;
    font-size: 1rem;
}

.muted {
    color: #64748b;
}

.small-text {
    font-size: 0.85rem;
}

.agreement-inline {
    min-width: 240px;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
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

.empty-review {
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    color: #475569;
    padding: 1rem;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
}

.empty-review i {
    color: #0ea5e9;
    font-size: 1.2rem;
}

</style>
