<script setup>
import { watch } from 'vue';
import Menubar from 'primevue/menubar';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import AuthDialogs from '@/components/AuthDialogs.vue';
import CreateProjectDialog from "@/components/CreateProjectDialog.vue";

// Composables
import { useAuth } from '@/composables/auth/useAuth.js'
import { useProjects } from "@/composables/project/useProjects.js";
import { usePhenotypes } from "@/composables/project/usePhenotypes.js";
import { useMenu } from '@/composables/shared/useMenu.js';
import { useNotifications } from "@/composables/shared/useNotifications.js";
import { useTreeSearch } from "@/composables/tree/useTreeSearch.js";
import { useCodeSelection } from "@/composables/selection/useCodeSelection.js";

// --- 1. SETUP GLOBAL TOASTS & NOTIFICATIONS ---
const toast = useToast()
const notifications = useNotifications()
notifications.setErrorHandler((summary, error) => {
    toast.add({ severity: 'error', summary, detail: error?.message || String(error), life: 20000 })
})
notifications.setSuccessHandler((summary, detail) => {
    toast.add({ severity: 'success', summary, detail, life: 20000 })
})

// --- 2. SETUP GLOBAL AUTH WATCHER ---
const { user } = useAuth()
const { fetchProjects, emptyProjects } = useProjects()
const { fetchPhenotypes, emptyPhenotypes } = usePhenotypes()
const { clearTreeState } = useTreeSearch();
const { clearSelectionState } = useCodeSelection();

watch(user, async (newUser) => {
    if (newUser) {
      await fetchProjects()
      await fetchPhenotypes()
    } else {
      emptyProjects()
      emptyPhenotypes()
      clearTreeState()
      clearSelectionState()
    }
  },
  { immediate: true }
)

// --- 3. GET MENU BAR ITEMS ---
const { menuItems } = useMenu()
</script>

<template>
  <Toast position="bottom-right"/>
  <AuthDialogs/>
  <CreateProjectDialog/>

  <div class="card relative z-2">
    <Menubar :model="menuItems" appendTo="body" breakpoint="1200px">

      <!--menu title-->
      <template #start>
        <div class="menubar-title flex align-items-center mr-3">
          <span class="font-bold">
              <span style="color: black;">Code</span><span style="color: #0EA5E9;">Consensus</span>
          </span>
        </div>
      </template>

      <!--the router pointing to the specific pages/views-->
      <template #item="{ item, props, hasSubmenu }">
        <router-link
            v-if="item.route"
            v-slot="{ href, navigate }"
            :to="item.route"
            custom
        >
          <a :href="href" v-bind="props.action" @click="navigate" class="flex align-items-center">
            <span :class="item.icon" />
            <span class="ml-2 menu-label">{{ item.label }}</span>
          </a>
        </router-link>

        <a v-else :href="item.url" :target="item.target" v-bind="props.action">
          <span :class="item.icon" />
          <span class="ml-2 menu-label">{{ item.label }}</span>
          <span v-if="hasSubmenu" class="pi pi-fw pi-angle-down ml-2" />
        </a>
      </template>

    </Menubar>
  </div>

  <div>
    <router-view />
  </div>
</template>

<style scoped>
  .menubar-title {
      flex-shrink: 0;
      white-space: nowrap;
  }
  .menu-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
      display: inline-block;
      vertical-align: middle;
  }
  :deep(.p-submenu-list) {
      padding: 0 !important;
  }

  :deep(.p-submenu-list .p-menuitem-link) {
      padding-top: 0.5rem !important;
      padding-bottom: 0.5rem !important;
      font-size: 0.95rem;
  }
  @media (min-width: 1201px) {
      :deep(.p-menubar) {
          flex-wrap: nowrap !important;
          overflow: hidden;
      }
      :deep(.p-menubar-root-list) {
          flex-wrap: nowrap !important;
          width: 100%;
          display: flex;
          flex-direction: row; /* Force horizontal row on desktop */
      }
  }
</style>
