<script setup>
import {reactive, ref, watch} from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import FloatLabel from 'primevue/floatlabel'
import {usePhenotypes} from "@/composables/project/usePhenotypes.js";
import Button from "primevue/button";
import SplitButton from "primevue/splitbutton";
import ConfirmPopup from "primevue/confirmpopup";
import Divider from "primevue/divider";
import Panel from "primevue/panel";
import Slider from "primevue/slider";
import Select from "primevue/select";
import Card from "primevue/card";
import {useConfirm} from "primevue/useconfirm";

// composables
const {
    currentPhenotype,
    clearPhenotype,
    savePhenotype,
    loadPhenotype,
    deletePhenotype,
    nameError,
    isEditingExisting,
    phenotypeExists,
} = usePhenotypes()


const confirm = useConfirm();
const isVisibleNewCheck = ref(false);
const isVisibleSaveCheck = ref(false);
const isVisibleRevertCheck = ref(false);
const isVisibleDeleteCheck = ref(false);

const newCheck = async (event) => {

  const id = currentPhenotype.value?.id?.trim() || null;
  const exists = await phenotypeExists(id);
  console.log("Phenotype exists:", exists);
  if (!exists) {
      clearPhenotype();
      return;
  }

  confirm.require({
    target: event.currentTarget,
    message: `Have you saved everything for the phenotype ${currentPhenotype.value.name}? Potential data loss if not.`,
    header: `Clearing Phenotype!`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Close current phenotype',
    acceptIcon: 'pi pi-times',
    acceptClass: 'p-button-danger',
    onShow: () => {
      isVisibleNewCheck.value = true;
    },
    onHide: () => {
      isVisibleNewCheck.value = false;
    },
    accept: () => {
      clearPhenotype( );
    },
    reject: () => {}
  });

}

const saveCheck = async (event) => {

  const id = currentPhenotype.value?.id?.trim() || null;
  const exists = await phenotypeExists(id);
  console.log("Phenotype exists:", exists);
  if (!exists) {
      await savePhenotype();
      return;
  }

  confirm.require({
    target: event.currentTarget,
    message: `Are you sure you want to overwrite the phenotype ${currentPhenotype.value.name}? This action cannot be undone.`,
    header: `Overwriting Phenotype!`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Overwrite',
    acceptIcon: 'pi pi-save',
    acceptClass: 'p-button-danger',
    onShow: () => {
      isVisibleSaveCheck.value = true;
    },
    onHide: () => {
      isVisibleSaveCheck.value = false;
    },
    accept: async () => {
      await savePhenotype( true);
    },
    reject: () => {}
  });

}

const revertCheck = (event) => {
  if (!currentPhenotype.value?.id || !phenotypeExists(currentPhenotype.value.id)) {
    // nothing to revert to
      return;
  }

  confirm.require({
    target: event.currentTarget,
    message: `Are you sure you want to overwrite the ${currentPhenotype.value.name} phenotype? This action cannot be undone.`,
    header: `Overwriting Phenotype!`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Overwrite',
    acceptIcon: 'pi pi-save',
    acceptClass: 'p-button-danger',
    onShow: () => {
      isVisibleRevertCheck.value = true;
    },
    onHide: () => {
      isVisibleRevertCheck.value = false;
    },
    accept: () => {
      loadPhenotype(currentPhenotype.value.id);
    },
    reject: () => {}
  });

}

const deleteCheck = (event) => {
  if (!currentPhenotype.value?.id || !phenotypeExists(currentPhenotype.value.id)) {
    // nothing to revert to
      return;
  }

  confirm.require({
    target: event.currentTarget,
    message: `Are you sure you want to delete the phenotype ${currentPhenotype.value.name}? This action cannot be undone.`,
    header: `Deleting Phenotype!`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    acceptIcon: 'pi pi-trash',
    acceptClass: 'p-button-danger',
    onShow: () => {
      isVisibleDeleteCheck.value = true;
    },
    onHide: () => {
      isVisibleDeleteCheck.value = false;
    },
    accept: () => {
      deletePhenotype();
    },
    reject: () => {}
  });

}

</script>

<template>
  <ConfirmPopup></ConfirmPopup>
  <Card class="diagnostic-card-wrapper">
    <template #content>

      <div class="diagnostic-card-panel">

        <div class="diagnostic-card-panel-left">
            <FloatLabel variant="on" class="label-input-div">
                  <InputText
                      v-model="currentPhenotype.name"
                      id="phenotype_name"
                      v-tooltip.top="{value: 'Phenotype name', showDelay: 300}"
                      type="text"
                      :invalid="nameError"
                      :disabled="isEditingExisting"
                  />
                  <label for="phenotype_name">Phenotype Name</label>
                </FloatLabel>

                <!-- Definition -->
                <FloatLabel variant="on" class="label-input-div">
                  <Textarea
                      v-model="currentPhenotype.description"
                      rows="5"
                      id="phenotype_definition"
                      v-tooltip.top="{value: 'Phenotype definition', showDelay: 300}"
                  />
                  <label for="phenotype_definition">Definition</label>
                </FloatLabel>

                <!-- Source URL -->
                <FloatLabel variant="on" class="label-input-div">
                  <InputText
                      v-model="currentPhenotype.source"
                      id="phenotype_source"
                      v-tooltip.top="{value: 'Source URL', showDelay: 300}"
                  />
                  <label for="phenotype_source">Source URL</label>
                </FloatLabel>
        </div>



          <div class="pheno-controls">
            <Button
                label="New"
                icon="pi pi-plus"
                severity="info"
                fluid
                @click="newCheck"
                style="font-size: 0.9rem; padding: 0.4rem 0.6rem; "
            />
            <Button
                label="Save"
                icon="pi pi-save"
                severity="info"
                fluid
                @click="saveCheck"
                style="font-size: 0.9rem; padding: 0.4rem 0.6rem; "
              />
            <Button
                label="Revert"
                severity="secondary"
                icon ="pi pi-refresh"
                fluid
                @click="revertCheck"
                style="font-size: 0.9rem; padding: 0.4rem 0.6rem; "
              />
              <ConfirmPopup></ConfirmPopup>
              <Button
                @click="deleteCheck"
                fluid
                icon="pi pi-trash"
                label="Delete"
                severity="secondary"
                :disabled="!currentPhenotype?.name"
                style="font-size: 0.9rem; padding: 0.4rem 0.6rem; "
              />
          </div>


      </div>
    </template>
  </Card>

</template>



<style scoped>

  .label-input-div {
    flex-direction: column;
    display: flex;
    margin-bottom: 1rem;
    margin-top: 0rem;
  }

  .pheno-controls {
    display: flex;
    flex-direction: column; /* stack label and slider */
    gap: 0.8rem;

  }

  /* 1. THE BOX (Background & Border when checked) */
:deep(.toggleswitch-info.p-checkbox-checked .p-checkbox-box) {
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