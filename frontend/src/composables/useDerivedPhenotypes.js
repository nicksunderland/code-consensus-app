import { ref, computed } from 'vue';
import { useVueFlow } from '@vue-flow/core';

export const OPERATORS = ['AND', 'OR', 'BEFORE', 'AFTER'];

// Global state
const phenotypes2 = ref([
    { id: 'p1', name: 'Hypertension' },
    { id: 'p2', name: 'Diabetes Mellitus' },
    { id: 'p3', name: 'Kidney Disease' },
]);

let nextNodeId = phenotypes2.value.length + 1;

// Initialize VueFlow
const {
    nodes: flowNodes,
    edges: flowEdges,
    addNodes,
    addEdges
} = useVueFlow();

export function useDerivedPhenotypes() {

    // --- Initialize Nodes (Same as before) ---
    if (flowNodes.value.length === 0) {
        flowNodes.value = phenotypes2.value.map((p, index) => ({
            id: p.id,
            type: 'default',
            label: p.name,
            position: { x: 50, y: 50 + index * 100 },
            sourcePosition: 'right', // IMPORTANT: Ensures drag start point exists
            targetPosition: 'left',  // IMPORTANT: Ensures drop point exists
        }));
    }

    // --- FIX: Explicit Connection Handler ---
    // We export this function to use in the @connect prop in the template
    const onConnectHandler = (params) => {
        const newEdge = {
            ...params, // source, target, sourceHandle, targetHandle
            id: `e${params.source}-${params.target}-${Date.now()}`,
            // THIS LINE IS CRITICAL: It tells Vue Flow to render your dropdown component
            type: 'operator-edge',
            data: { operator: 'AND' }
        };
        addEdges([newEdge]);
    };

    // --- Actions (Same as before) ---
    const addPhenotypeNode = (name) => {
        const newId = `p${nextNodeId++}`;
        const newPhenotype = { id: newId, name };
        phenotypes2.value.push(newPhenotype);

        const newNode = {
            id: newId,
            type: 'default',
            label: name,
            position: { x: 300, y: 50 + (phenotypes2.value.length - 1) * 100 },
            sourcePosition: 'right',
            targetPosition: 'left',
        };
        addNodes([newNode]);
    };

    const updateEdgeOperator = (edgeId, operator) => {
        const edgeIndex = flowEdges.value.findIndex(e => e.id === edgeId);
        if (edgeIndex > -1) {
            flowEdges.value[edgeIndex].data = {
                ...flowEdges.value[edgeIndex].data,
                operator: operator
            };
        }
    };

    return {
        phenotypes: computed(() => phenotypes2.value),
        nodes: flowNodes,
        edges: flowEdges,
        onConnectHandler, // <--- Return this!
        addPhenotypeNode,
        updateEdgeOperator,
        OPERATORS
    };
}