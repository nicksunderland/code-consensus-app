import { ref, computed } from 'vue';
import { usePhenotypes } from '@/composables/project/usePhenotypes.js';
import { applyNodeChanges, applyEdgeChanges } from '@vue-flow/core';

export const OPERATORS = ['AND', 'OR', 'AFTER', 'BEFORE', 'NOT', 'NOT-BEFORE', 'NOT-AFTER', 'TARGET'];

export function usePhenoFlow() {
    const { phenotypes, fetchPhenotypes } = usePhenotypes();
    const flowNodes = ref([]);
    const flowEdges = ref([]);
    const currentDragPayload = ref(null);
    const customPhenotypes = ref([]);

    let nextId = 1;

    // Ensure phenotypes loaded for palette only
    if (!phenotypes.value.length) {
        fetchPhenotypes?.();
    }

    const operatorClass = (operator) => {
        if (!operator) return 'operator-node';
        const slug = operator.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `operator-node operator-${slug}`;
    };

    const addOperatorNode = (op, position) => {
        const newId = `op-${nextId++}`;
        flowNodes.value = [
            ...flowNodes.value,
            {
                id: newId,
                type: 'operator',
                label: op,
                data: { type: 'operator', operator: op },
                position,
                class: operatorClass(op),
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
                type: 'phenotype',
                label: phenotype.name,
                data: {
                    type: 'phenotype',
                    name: phenotype.name,
                    description: phenotype.description,
                    sourceId: phenotype.id
                },
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
            type: 'default'
        };
        flowEdges.value = [...flowEdges.value, newEdge];
    };

    const updateEdgeOperator = (edgeId, operator) => {
        flowEdges.value = flowEdges.value.map((edge) => {
            if (edge.id !== edgeId) return edge;
            return {
                ...edge,
                data: { ...(edge.data || {}), operator }
            };
        });
    };

    const graphJson = computed(() => ({
        nodes: flowNodes.value.map(n => ({
            id: n.id,
            label: n.label,
            type: n.data?.type || n.type,
            data: n.data,
            position: n.position,
            class: n.class
        })),
        edges: flowEdges.value.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            type: e.type
        }))
    }));

    const palettePhenotypes = computed(() => [...(phenotypes.value || []), ...customPhenotypes.value]);

    const addCustomPhenotype = ({ name, description }) => {
        if (!name) return;
        const newId = `custom-${Date.now()}`;
        customPhenotypes.value = [
            ...customPhenotypes.value,
            { id: newId, name, description, isCustom: true }
        ];
        return newId;
    };

    const removeCustomPhenotype = (id) => {
        customPhenotypes.value = customPhenotypes.value.filter((ph) => ph.id !== id);
    };

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
        updateEdgeOperator,
        addCustomPhenotype,
        // helpers for external drop handling
        addPhenotypeNode,
        addOperatorNode,
        currentDragPayload,
        graphJson,
        palettePhenotypes,
        OPERATORS,
        removeCustomPhenotype
    };
}
