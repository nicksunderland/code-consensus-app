<script setup>
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import Textarea from "primevue/textarea";
import Button from "primevue/button";
import Tag from 'primevue/tag';
import ToggleButton from 'primevue/togglebutton';
import ConfirmPopup from 'primevue/confirmpopup';
import 'primeicons/primeicons.css';
import {useCodeSelection} from "@/composables/useCodeSelection.js";
import {useConfirm} from "primevue/useconfirm";
import Avatar from 'primevue/avatar';
import OverlayBadge from 'primevue/overlaybadge';
import {ref, computed} from "vue";
import {useAuth} from "@/composables/useAuth.js";
import {useProjects} from "@/composables/useProjects.js";
import CodeImport from "@/components/CodeImport.vue";
import {useCodeImport} from "@/composables/useCodeImport.js";

// --- use composable ---
const {
  tableRows,
  updateSelection,
  updateComment,
  toggleSelectAll,
  isAllSelected,
  isIndeterminate,
  saveSelections,
  isReviewMode,
  isFinalized,
  projectMembers,
  getTeamMemberStatus,
  updateConsensusSelection,
  updateConsensusComment,
  saveConsensus,
  unlockConsensus
} = useCodeSelection()


const {
  showImportDialog,
  openImportDialog,
  closeImportDialog
} = useCodeImport()


// composables
const confirm = useConfirm();
const { user } = useAuth();
const { currentProject } = useProjects();

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
      <DataTable
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
            <div class="flex align-items-center w-full" style="display: flex; gap: 0.5rem; padding-bottom: 0.75rem; align-items: center;">

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
                :disabled="isFinalized"
                @click="openImportDialog"
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

        <Column v-if="!isReviewMode" field="found" header="Search">
             <template #body="{ data }">
                <Tag :severity="data.found ? 'info' : 'secondary'" :value="data.found ? 'Yes' : 'No'" />
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
</style>