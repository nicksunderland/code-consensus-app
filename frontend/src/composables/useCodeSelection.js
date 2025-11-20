import { ref, computed } from 'vue'
import { useNotifications } from './useNotifications'
import { useTreeSearch } from "@/composables/useTreeSearch.js";

// composables
const {
    nodes,
    selectedNodeKeys,
    searchNodeKeys
} = useTreeSearch()

// ---------------------------------------------
// GLOBAL STATE
// ---------------------------------------------
const userComments = ref({});
const tableRows = computed(() => {
    const rows = [];

    function walk(nodeArray) {
        if (!Array.isArray(nodeArray)) return;

        nodeArray.forEach(node => {
            const selected = !!selectedNodeKeys.value[node.key];
            const found = !!searchNodeKeys.value[node.key];
            if (selected || found) {
                rows.push({
                    key: node.key,
                    selected: selected,
                    found: found,
                    code: node.data?.code || '',
                    description: node.data?.description || '',
                    system: node.data?.system || '',
                    comment: userComments.value[node.key] || ''
                });
            }
            if (node.children?.length) walk(node.children);
        });
    }

    walk(nodes.value);
    return rows;
});

// ---------------------------------------------
// COMPOSABLE
// ---------------------------------------------
export function useCodeSelection() {
    // Get dependencies inside the composable function
    const { emitError, emitSuccess } = useNotifications()

    // ------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------
    const updateComment = (key, text) => {
        userComments.value[key] = text;
    };

    const updateSelection = (key, isSelected) => {
        const newKeys = { ...selectedNodeKeys.value };
        if (isSelected) {
            newKeys[key] = true;
        } else {
            delete newKeys[key];
        }
        selectedNodeKeys.value = newKeys;
    };

    const selectionState = computed(() => {
        if (tableRows.value.length === 0) return 'none';

        let selectedCount = 0;
        tableRows.value.forEach(row => {
            if (row.selected) selectedCount++;
        });

        if (selectedCount === 0) return 'none';
        if (selectedCount === tableRows.value.length) return 'all';
        return 'partial'; // Some are selected (from here or elsewhere)
    });

    const isIndeterminate = computed(() => selectionState.value === 'partial');

    const isAllSelected = computed(() => selectionState.value === 'all');

    const toggleSelectAll = () => {
        // If we are currently 'all' -> Deselect All
        // If we are 'none' or 'partial' -> Select All
        const shouldSelectAll = selectionState.value !== 'all';

        const newKeys = { ...selectedNodeKeys.value };

        tableRows.value.forEach(row => {
            if (shouldSelectAll) {
                newKeys[row.key] = true;
            } else {
                delete newKeys[row.key];
            }
        });

        selectedNodeKeys.value = newKeys;
    };

    // ------------------------------------------------------------
    // EXPORT
    // ------------------------------------------------------------
    return {
        // data
        tableRows,
        // methods
        updateSelection,
        updateComment,
        toggleSelectAll,
        isAllSelected,
        isIndeterminate,
        selectionState
    }
}