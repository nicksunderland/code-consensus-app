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
  projectMembers,
  getTeamMemberStatus,
  updateConsensusSelection,
  updateConsensusComment,
  saveConsensus,
  handleFinalise
} = useCodeSelection()

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
        <!--CONTROLS-->
        <template #header>
            <div
                class="flex align-items-center w-full"
                style="display: flex; gap: 0.5rem; padding-bottom: 0.75rem; justify-content: left; align-items: center;"
            >
              <!--review mode button-->
              <ToggleButton
                  v-model="isReviewMode"
                  onLabel="Exit Review"
                  offLabel="Review Mode"
                  onIcon="pi pi-eye-slash"
                  offIcon="pi pi-users"
                  style="font-size: 0.75rem; padding: 0.3rem 0.5rem; "
              />

              <!--save button-->
              <Button
                v-if="!isReviewMode"
                label="Save"
                icon="pi pi-save"
                severity="info"
                @click="saveSelections"
                style="font-size: 0.75rem; padding: 0.5rem 0.5rem; "
              />

              <Button
                v-if="isReviewMode"
                label="Save Consensus Selections"
                icon="pi pi-save"
                @click="saveSelections"
                style="font-size: 0.75rem; padding: 0.5rem 0.5rem; "
              />

              <Button
                v-if="isReviewMode"
                label="Finalize Consensus"
                icon="pi pi-check-square"
                severity="help"
                :disabled="!isProjectOwner"
                v-tooltip.top="!isProjectOwner ? 'Only the Project Owner can finalise' : 'Finalise consensus codes'"
                @click="handleFinalise"
                style="font-size: 0.75rem; padding: 0.5rem 0.5rem; "
              />

              <!--check box for normal mode-->
              <div v-if="!isReviewMode" style="display: flex; align-items: center; gap: 0.5rem;">
                <label for="header-checkbox" class="cursor-pointer font-bold white-space-nowrap" style="font-size: 0.85rem;">Select All</label>
                <Checkbox
                    inputId="header-checkbox"
                    class="checkbox-info"
                    :binary="true"
                    :modelValue="isAllSelected"
                    :indeterminate="isIndeterminate"
                    @click.prevent.stop="handleSelectAll"
                    v-tooltip.top="isAllSelected ? 'Deselect All' : 'Select All'"
                />
              </div>
              <!--end checkbox normal mode-->

            </div>
        </template>

        <!--CHECK-BOX-->
        <Column
            v-if="!isReviewMode"
            header="Include" style="width: 4rem; text-align: center"
        >
            <template #body="{ data }">
                <Checkbox
                    class="checkbox-info"
                    :binary="true"
                    :modelValue="data.selected"
                    @update:modelValue="(val) => updateSelection(data.key, val)"
                />
            </template>
        </Column>

        <!--Normal mode found in search status-->
        <Column v-if="!isReviewMode" field="found" header="Search">
             <template #body="{ data }">
                <Tag :severity="data.found ? 'info' : 'secondary'" :value="data.found ? 'Yes' : 'No'" />
             </template>
        </Column>

        <!--CODING SYSTEM-->
        <Column field="system" header="System" />
        <!--CODE-->
        <Column field="code" header="Code" />
        <!--DESCRIPTION-->
        <Column
            field="description"
            header="Description"
            style="min-width: 200px; max-width: 400px; white-space: normal; word-break: break-word;"
        />

        <!--Normal mode COMMENTS-->
        <Column v-if="!isReviewMode" header="Comment" style="min-width: 300px">
            <template #body="{ data }">
            <Textarea
                autoResize
                rows="1"
                class="w-full compact-input"
                placeholder="Comments"
                :modelValue="data.comment"
                @update:modelValue="(val) => updateComment(data.key, val)"
            />
            </template>
        </Column>

        <!--TEAM MEMBER SELECT STATUSES-->
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

        <!--Review mode final select-->
        <Column
            v-if="isReviewMode"
            header="Final consensus" style="width: 8rem; text-align: center"
        >
            <template #body="{ data }">
                <Checkbox
                    :binary="true"
                    :modelValue="data.consensus_selected"
                    @update:modelValue="(val) => updateConsensusSelection(data.key, val)"
                />
            </template>
        </Column>

        <!--Review mode COMMENTS-->
        <Column v-if="isReviewMode" header="Consensus Comments" style="min-width: 300px">
            <template #body="{ data }">
            <Textarea
                autoResize
                rows="1"
                class="w-full compact-input"
                placeholder="Comments"
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
/* 1. Table Header and Cells */
:deep(.compact-text .p-datatable-thead > tr > th),
:deep(.compact-text .p-datatable-tbody > tr > td) {
    font-size: 0.85rem;
    padding-top: 0.25rem;     /* Increased slightly to prevent text cutting off */
    padding-bottom: 0.25rem;
    vertical-align: middle;      /* 'center' is invalid for vertical-align. Use 'middle' or 'top' */
}

/* 2. The Textarea Input Itself */
:deep(.compact-input) {
    font-size: 0.85rem !important;
    line-height: 1.2;
    padding: 0.4rem 0.5rem;  /* relaxed slightly for readability */
    min-height: 2rem;
    resize: none;
}

/* 3. The Placeholder (Standard) */
:deep(.compact-input::placeholder) {
    font-size: 0.85rem !important; /* Set to your desired size */
    color: #999;                   /* Lighter color helps distinguish it */
    opacity: 1;                    /* Firefox defaults to lower opacity, this fixes it */
}

/* 4. The Placeholder (Webkit/Chrome/Safari fallback) - Often needed */
:deep(.compact-input::-webkit-input-placeholder) {
    font-size: 0.85rem !important;
    color: #999;
}

.w-full {
    width: 100%;
}

/* 1. THE BOX (Background & Border when checked) */
:deep(.checkbox-info.p-checkbox-checked .p-checkbox-box) {
    background-color: #0EA5E9 !important; /* Cyan Background */
    border-color: #0EA5E9 !important;     /* Cyan Border */
}

/* 2. THE ICON (The Checkmark itself) */
:deep(.checkbox-info.p-checkbox-checked .p-checkbox-icon) {
    color: #ffffff !important;            /* Force Checkmark to be White */
}

/* 3. HOVER STATE (Optional: Make it slightly darker when hovering) */
:deep(.checkbox-info:not(.p-disabled):hover .p-checkbox-box) {
    border-color: #0EA5E9 !important;
}



</style>