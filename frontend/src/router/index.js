import { createRouter, createWebHistory } from 'vue-router';

// Import your views (we will create these next)
import HomeView from '../views/HomeView.vue';
import AccordionView from '../views/AccordionView.vue';
import DocumentationView from "@/views/DocumentationView.vue";
import PhenoFlowView from "@/views/PhenoFlowView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/accordion',
      name: 'accordion',
      component: AccordionView
    },
    {
      path: '/flow',
      name: 'flow',
      component: PhenoFlowView
    },
    {
      path: '/docs',
      name: 'documentation',
      component: DocumentationView
    }
  ]
});

export default router;