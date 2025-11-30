import { ref, computed } from 'vue';
import { usePhenotypes } from '@/composables/project/usePhenotypes.js';
import { applyNodeChanges, applyEdgeChanges } from '@vue-flow/core';

export const OPERATORS = ['AND', 'OR', 'NOT', 'NOT-BEFORE', 'NOT-AFTER'];

export function usePhenoFlow() {
    const { phenotypes, fetchPhenotypes } = usePhenotypes();
    const flowNodes = ref([]);
    const flowEdges = ref([]);
    const currentDragPayload = ref(null);

    let nextId = 1;

    // Ensure phenotypes loaded for palette only
    if (!phenotypes.value.length) {
        fetchPhenotypes?.();
    }

    const addOperatorNode = (op, position) => {
        const newId = `op-${nextId++}`;
        flowNodes.value = [
            ...flowNodes.value,
            {
                id: newId,
                type: 'default',
                label: op,
                data: { type: 'operator', operator: op },
                position,
                sourcePosition: 'right',
                targetPosition: 'left'
            }
        ];
    };

    const addPhenotypeNode = (phenotype, position) => {
        const id = phenotype.id || `ph-${nextId++}`;
        console.log('[PhenoFlow] addPhenotypeNode', { id, position, phenotype });
        flowNodes.value = [
            ...flowNodes.value,
            {
                id,
                type: 'default',
                label: phenotype.name,
                data: { type: 'phenotype', name: phenotype.name, sourceId: phenotype.id },
                position,
                sourcePosition: 'right',
                targetPosition: 'left'
            }
        ];
    };

    const onConnectHandler = (params) => {
        console.log('[PhenoFlow] onConnect', params);
        const newEdge = {
            ...params,
            id: `e${params.source}-${params.target}-${Date.now()}`,
            type: 'default',
            data: { operator: 'AND' }
        };
        flowEdges.value = [...flowEdges.value, newEdge];
    };

    const graphJson = computed(() => ({
        nodes: flowNodes.value.map(n => ({
            id: n.id,
            label: n.label,
            type: n.data?.type || n.type,
            data: n.data
        })),
        edges: flowEdges.value.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            operator: e.data?.operator || 'AND'
        }))
    }));

    const palettePhenotypes = computed(() => phenotypes.value || []);

    const onNodesChange = (changes) => {
        flowNodes.value = applyNodeChanges(changes, flowNodes.value);
    };

    const onEdgesChange = (changes) => {
        flowEdges.value = applyEdgeChanges(changes, flowEdges.value);
    };

    return {
        nodes: flowNodes,
        edges: flowEdges,
        onNodesChange,
        onEdgesChange,
        onConnectHandler,
        // helpers for external drop handling
        addPhenotypeNode,
        addOperatorNode,
        currentDragPayload,
        graphJson,
        palettePhenotypes,
        OPERATORS
    };
}
