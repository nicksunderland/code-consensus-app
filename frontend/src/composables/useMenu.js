import { computed } from 'vue'
import { useAuth } from "@/composables/useAuth.js";
import { useProjects } from "@/composables/useProjects.js";
import { usePhenotypes } from "@/composables/usePhenotypes.js";

export function useMenu() {
    // Get dependencies inside the composable function
    const auth = useAuth()
    const projects = useProjects()
    const phenotypes = usePhenotypes()

    // Menu items
    const menuItems = computed(() => {
        const user = auth.user.value;
        const currentProject = projects.currentProject.value;

        // --- Projects section ---
        const projectItems = !user
        ? [{ label: 'Please login', icon: 'pi pi-exclamation-triangle' }]
        : projects.projects.value.length === 0
          ? [ { label: 'Create Project', icon: 'pi pi-plus', command: () => projects.openCreateDialog() },
              { label: 'No projects found', icon: 'pi pi-info-circle', disabled: true        }]
          : [
              { label: 'Create Project', icon: 'pi pi-plus', command: () => projects.openCreateDialog() },
              { label: 'Edit Project', icon: 'pi pi-pencil', command: () => projects.openEditDialog() },
              ...projects.projects.value.map(p => ({
                label: p.name,
                icon: projects.currentProject.value?.id === p.id ? 'pi pi-folder-open' : 'pi pi-folder',
                command: () => {
                    console.log(p)
                    projects.selectProject(p)
                    phenotypes.fetchPhenotypes()
                }
              }))
            ]

        // --- Phenotypes section ---
        const phenotypeItems = !user
            ? [{ label: 'Please login', icon: 'pi pi-exclamation-triangle' }]
            : phenotypes.phenotypes.value.length === 0
            ? [{ label: 'No saved phenotypes', icon: 'pi pi-info-circle', disabled: true }]
            : phenotypes.phenotypes.value.map(ph => ({
                label: ph.name,
                icon: 'pi pi-file',
                command: () => phenotypes.loadPhenotype(ph.id)
            }))

        // --- Examples section ---
        const exampleItems = [
            { label: 'Heart failure', icon: 'pi pi-fw pi-heart' },
            { label: 'Coronary artery disease', icon: 'pi pi-fw pi-heart-fill' }
        ]

        // --- Account/Login section ---
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
                { label: 'Logout', icon: 'pi pi-sign-out', command: auth.logout }
            ]
        }

        return [
            { label: currentProject ? `Projects (${currentProject.name})` : 'Projects', icon: 'pi pi-briefcase', items: projectItems },
            { label: 'Phenotypes', icon: 'pi pi-save', items: phenotypeItems },
            { label: 'Examples', icon: 'pi pi-book', items: exampleItems },
            accountItems
        ]
  })

  return {
      menuItems
  }
}
