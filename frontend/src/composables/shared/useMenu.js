import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from "@/composables/auth/useAuth.js";
import { useProjects } from "@/composables/project/useProjects.js";
import { usePhenotypes } from "@/composables/project/usePhenotypes.js";

export function useMenu() {
    const router = useRouter()
    const route = useRoute()
    const auth = useAuth()
    const projects = useProjects()
    const phenotypes = usePhenotypes()

    const menuItems = computed(() => {
        const user = auth.user.value;
        const currentProject = projects.currentProject.value;

        // projects
        const projectItems = !user
        ? [{ label: 'Please login', icon: 'pi pi-exclamation-triangle' }]
        : projects.projects.value.length === 0
          ? [ { label: 'Create Project', icon: 'pi pi-plus', command: () => projects.openCreateDialog() },
              { label: 'No projects found', icon: 'pi pi-info-circle', disabled: true }]
          : [
              { label: 'Create Project', icon: 'pi pi-plus', command: () => projects.openCreateDialog() },
              { label: 'Edit Project', icon: 'pi pi-pencil', command: () => projects.openEditDialog() },
              ...projects.projects.value.map(p => ({
                label: p.name,
                icon: projects.currentProject.value?.id === p.id ? 'pi pi-folder-open' : 'pi pi-folder',
                command: () => router.push(`/project/${p.id}`)
              }))
            ]

        // phenotypes
        const phenotypeItems = !user
            ? [{ label: 'Please login', icon: 'pi pi-exclamation-triangle' }]
            : phenotypes.phenotypes.value.length === 0
            ? [{ label: 'No saved phenotypes', icon: 'pi pi-info-circle', disabled: true }]
            : phenotypes.phenotypes.value.map(ph => ({
                label: ph.name,
                icon: 'pi pi-file',
                command: () => {
                    phenotypes.loadPhenotype(ph.id)
                    router.push('/accordion')
                }
            }))

        // account
        const accountItems = !user
        ? {
            label: 'Login',
            icon: 'pi pi-sign-in',
            items: [
                { label: 'Email / Password Login', icon: 'pi pi-envelope', command: auth.openLogin },
                { label: 'Magic Link Login', icon: 'pi pi-link', command: auth.openMagic },
                { label: 'Sign Up', icon: 'pi pi-user-plus', command: auth.openSignup },
                { separator: true },
                { label: 'Google', icon: 'pi pi-google', command: auth.loginGoogle },
                { label: 'GitHub', icon: 'pi pi-github', command: auth.loginGitHub }
            ]
        } :
        {
            label: user.user_metadata?.full_name || user.email,
            icon: 'pi pi-user',
            items: [
                { label: 'Logout', icon: 'pi pi-sign-out', command: () => {
                    auth.logout();
                    router.push('/');
                }}
            ]
        }


        const baseNav = [
            { label: 'Home', icon: 'pi pi-home', route: '/' },
            { label: 'Consensus Tool', icon: 'pi pi-server', route: '/accordion' }
        ];

        // consensus-mode only
        const toolItems = [
            { label: currentProject ? `Projects (${currentProject.name})` : 'Projects', icon: 'pi pi-briefcase', items: projectItems },
            ...(currentProject ? [{ label: 'Overview', icon: 'pi pi-table', route: `/project/${currentProject.id}` }] : []),
            { label: 'Phenotypes', icon: 'pi pi-save', items: phenotypeItems },
            // PhenoFlow
            { label: 'Pheno Flow', icon: 'pi pi-sitemap', route: '/flow' }
        ];

        const endNav = [
            { label: 'Examples', icon: 'pi pi-book', route: '/examples' },
            accountItems
        ];

        // tool items show on /accordion, /flow and the project pages
        const consensusRoutes = ['/accordion', '/flow'];
        const isConsensusMode = consensusRoutes.includes(route.path) || route.path.startsWith('/project/');

        return isConsensusMode
            ? [...baseNav, ...toolItems, accountItems]
            : [...baseNav, ...endNav];
  })

  return {
      menuItems
  }
}
