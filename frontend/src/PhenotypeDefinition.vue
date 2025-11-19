<script setup>
import {reactive, ref, watch} from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import FloatLabel from 'primevue/floatlabel'
import {usePhenotypes} from "@/composables/usePhenotypes.js";
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
    savePhenotype,
    loadPhenotype,
    deletePhenotype,
    nameError,
    phenotypeExists
} = usePhenotypes()


const confirm = useConfirm();
const isVisibleSaveCheck = ref(false);
const isVisibleRevertCheck = ref(false);
const saveCheck = (event) => {
  console.log('Save check triggered, id:', currentPhenotype.value.id);
  if (!currentPhenotype.value?.id || !phenotypeExists(currentPhenotype.value.id)) {
      // Either no ID (new phenotype) or not found in existing list
      savePhenotype();
      return;
  }

  confirm.require({
    target: event.currentTarget,
    message: 'Are you sure you want to overwrite the existing phenotype? This action cannot be undone.',
    header: 'Overwriting Existing Phenotype!',
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
    accept: () => {
      savePhenotype();
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
    message: 'Are you sure you want to overwrite the current data with the saved phenotype? This action cannot be undone.',
    header: 'Overwriting Current Phenotype!',
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

</script>

<template>
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
                label="Save"
                icon="pi pi-save"
                severity="contrast"
                fluid
                @click="saveCheck"
              />
            <Button
                label="Revert"
                severity="secondary"
                icon ="pi pi-refresh"
                fluid
                @click="revertCheck"
              />
              <ConfirmPopup></ConfirmPopup>
              <Button
                @click="deletePhenotype"
                fluid
                icon="pi pi-trash"
                label="Delete"
                severity="danger"
                :disabled="!currentPhenotype?.id"
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

</style>