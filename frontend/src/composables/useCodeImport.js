// composables/useCodeImport.js
import { ref } from 'vue'
import { useNotifications } from './useNotifications' // assuming these are still needed
import { useTreeSearch } from './useTreeSearch'
import { useCodeSelection } from './useCodeSelection'

// Define the state variable OUTSIDE the function so it's only created once
const showImportDialog = ref(false)

export function useCodeImport() {
    // const { emitError, emitSuccess } = useNotifications() // Uncomment if needed
    // const { fetchSpecificNodes, selectedNodeKeys } = useTreeSearch() // Uncomment if needed
    // const { updateSelection } = useCodeSelection() // Uncomment if needed

    // Functions to modify the shared state
    const openImportDialog = () => {
        showImportDialog.value = true
        console.log("Opening import dialog: ", showImportDialog.value)
    }

    const closeImportDialog = () => {
        showImportDialog.value = false
        console.log("Opening import dialog: ", showImportDialog.value)
    }

    return {
        // Return the one and only shared state variable
        showImportDialog,
        openImportDialog,
        closeImportDialog,
        // ... other state/methods ...
    }
}