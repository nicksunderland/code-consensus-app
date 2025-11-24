import { createRouter, createWebHistory } from 'vue-router';

// Import your views (we will create these next)
import HomeView from '../views/HomeView.vue';
import AccordionView from '../views/AccordionView.vue';
import DocumentationView from "@/views/DocumentationView.vue";
import PhenoFlowView from "@/views/PhenoFlowView.vue";
import { useHead } from '@unhead/vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { title: 'Home' }
    },
    {
      path: '/accordion',
      name: 'accordion',
      component: AccordionView,
      meta: { title: 'Consensus Tool' }
    },
    {
      path: '/flow',
      name: 'flow',
      component: PhenoFlowView,
      meta: { title: 'PhenoFlow' }
    },
    {
      path: '/docs',
      name: 'documentation',
      component: DocumentationView,
      meta: { title: 'Documentation' }
    }
  ]
});

const SITE_NAME = 'Code Consensus | Collaborative Development & Code Review';

router.beforeEach((to, from, next) => {
  const pageTitle = to.meta.title;

  const fullTitle = pageTitle
    ? `${pageTitle} - ${SITE_NAME}`
    : SITE_NAME;

  useHead({
    title: fullTitle,
  });
  next();
});

export default router;