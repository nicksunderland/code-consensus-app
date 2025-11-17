// /src/composables/useMenu.js
import { computed } from 'vue'

export function useMenu({ auth, projects, phenotypes }) {

  // Label for the current project
  const currentProjectLabel = computed(() => {
    if (!auth.isLoggedIn.value) return 'Projects'
    if (!projects.currentProject.value) return 'Projects'
    return `Projects (${projects.currentProject.value.name})`
  })

  // Menu items
  const menuItems = computed(() => {
    // --- Projects section ---
    const projectItems = !auth.isLoggedIn.value
      ? [{ label: 'Please login', icon: 'pi pi-exclamation-triangle' }]
      : [
          { label: 'Create Project', icon: 'pi pi-plus', command: () => projects.openCreateDialog() },
          { label: 'Edit Project', icon: 'pi pi-pencil', command: () => projects.openEditDialog() },
          ...(projects.projects.value.length === 0
            ? [{ label: 'No projects found', icon: 'pi pi-info-circle', disabled: true }]
            : projects.projects.value.map(p => ({
                label: p.name,
                icon: projects.currentProject.value?.id === p.id ? 'pi pi-folder-open' : 'pi pi-folder',
                command: () => {
                  projects.selectProject(p)
                  // load phenotypes for this project
                  phenotypes.fetchPhenotypes()
                }
              }))
          )
        ]

    // --- Phenotypes section ---
    const phenotypeItems = !auth.isLoggedIn.value
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
    const accountItems = !auth.isLoggedIn.value
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
        }
      : {
          label: auth.user.value.user_metadata?.full_name || auth.user.value.email,
          icon: 'pi pi-user',
          items: [
            { label: 'Logout', icon: 'pi pi-sign-out', command: auth.logout }
          ]
        }

    return [
      { label: currentProjectLabel.value, icon: 'pi pi-briefcase', items: projectItems },
      { label: 'Phenotypes', icon: 'pi pi-save', items: phenotypeItems },
      { label: 'Examples', icon: 'pi pi-book', items: exampleItems },
      accountItems
    ]
  })

  return { menuItems }
}
