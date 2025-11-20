<script setup>
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import Textarea from "primevue/textarea";
import Button from "primevue/button";
import Tag from 'primevue/tag';
import 'primeicons/primeicons.css';
import {useCodeSelection} from "@/composables/useCodeSelection.js";
import {usePhenotypes} from "@/composables/usePhenotypes.js";
import {useConfirm} from "primevue/useconfirm";
import {ref} from "vue";

// --- use composable ---
const { savePhenotype } = usePhenotypes();
const {
  tableRows,
  updateSelection,
  updateComment,
  toggleSelectAll,
  isAllSelected,
  isIndeterminate,
} = useCodeSelection()

const confirm = useConfirm();
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

</script>

<template>
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
              <label
                  for="header-checkbox"
                  class="cursor-pointer font-bold white-space-nowrap"
                  style="font-size: 0.85rem;"
              >
                Select All
              </label>
              <Checkbox
                  inputId="header-checkbox"
                  :binary="true"
                  :modelValue="isAllSelected"
                  :indeterminate="isIndeterminate"
                  @click.prevent.stop="handleSelectAll"
                  v-tooltip.top="isAllSelected ? 'Deselect All' : 'Select All'"
              />
              <Button
                label="Save"
                icon="pi pi-save"
                severity="contrast"
                @click="savePhenotype"
                style="font-size: 0.75rem; padding: 0.3rem 0.5rem; "
              />
            </div>
        </template>

        <!--CHECK-BOX-->
        <Column header="Include" style="width: 4rem; text-align: center">
            <template #body="{ data }">
                <Checkbox
                    :binary="true"
                    :modelValue="data.selected"
                    @update:modelValue="(val) => updateSelection(data.key, val)"
                />
            </template>
        </Column>

        <Column field="found" header="Search">
             <template #body="{ data }">
                <Tag :severity="data.found ? 'success' : 'secondary'" :value="data.found ? 'Yes' : 'No'" />
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

        <!--COMMENTS-->
        <Column header="Comment" style="min-width: 300px">
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
</style>