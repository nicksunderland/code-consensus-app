<script setup>
import { ref } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Divider from 'primevue/divider';
import Tag from 'primevue/tag';
import Footer from "@/components/Footer.vue";
import 'primeicons/primeicons.css';

// Smooth scroll handler
const scrollToSection = (id) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const steps = ref([
    {
        id: 'step-1',
        title: 'Project Setup',
        subtitle: 'Initialize your workspace',
        icon: 'pi pi-folder-open',
        content: `Before analyzing codes, you must create or select a Project. A project acts as a container for your phenotype definitions, ensuring that your work is isolated and version-controlled.`,
        bullets: [
            'Click "Create Project" in the top menu.',
            'Give your project a descriptive name (e.g., "HF_GWAS_2024").',
            'Invite collaborators to the project - they must have signed up with a valid email, although can can be added later through the Edit Project button.',
            'All subsequent phenotypes will be saved under this project ID.'
        ]
    },
    {
        id: 'step-2',
        title: 'Define Phenotype',
        subtitle: 'Regex & Inclusion Criteria',
        icon: 'pi pi-pencil',
        content: `Start by defining the broad search parameters that will help capture your phenotype definition. You don't need to know every code yet, as the search strategy can be iteratively refined through inspection of the results and the code tree.`,
        bullets: [
            'Navigate to the <strong>Define</strong> tab.',
            'Enter a Phenotype Name (e.g., "Dilated Cardiomyopathy").',
            'Input your Regex strings. The system supports multi-dictionary search (ICD-10, ICD-9, OPCS).',
            'Run the search to initialize the code tree.'
        ]
    },
    {
        id: 'step-3',
        title: 'Tree Search',
        subtitle: 'Explore the Ontology',
        icon: 'pi pi-sitemap',
        content: `The Tree Search is the core discovery engine. It traverses the medical coding hierarchy to find codes matching your regex, plus their children and parents.`,
        bullets: [
            'Go to the <strong>Search</strong> tab.',
            'The system displays a hierarchical tree of potential code matches.',
            '<strong>Yellow Nodes:</strong> Direct Regex / search matches.',
            'Select nodes to add them to your candidate list.',
            '<strong>Green Nodes:</strong> User selected codes.',
        ]
    },
    {
        id: 'step-4',
        title: 'Code Selection',
        subtitle: 'Expert Review',
        icon: 'pi pi-user',
        content: `Multiple experts affiliated with the project can log in, refine the search, add other codes, and vote on the candidate codes.`,
        bullets: [
            'Navigate to the <strong>Review</strong> tab.',
            'Review the candidate list generated from the Tree Search.',
            'Vote <strong>Include</strong>, or leave blank to <strong>Exclude</strong>.' +
            'Add <strong>Comments</strong> for each code as required.'
        ]
    },
  {
        id: 'step-5',
        title: 'Code Upload',
        subtitle: 'Additional Codes',
        icon: 'pi pi-code',
        content: `You can upload additional codes from external sources to supplement the candidate list. The only requirement is that the file contains columns with 1) codes, 2) the coding system, and 3) a code description.`,
        bullets: [
            'Navigate to the <strong>Review</strong> tab.',
            'Click the <strong>Import</strong> button.',
            'Chose a TSV, CSV, TXT, or Excel file with the required columns.',
            'Map the columns to the required fields in the upload dialog.',
            'Map the coding systems to those present in the database, or click <strong>Use file value</strong> to keep your original system coding.',
            'Click <strong>Import</strong> for each code as required.'
        ]
    },
    {
        id: 'step-6',
        title: 'Diagnostics',
        subtitle: 'Data Validation',
        icon: 'pi pi-chart-bar',
        content: `Before finalizing, validate your definition against real data metrics.`,
        bullets: [
            'Check the <strong>Diagnostics</strong> tab.',
            'View Code Counts: How many patients have these codes?',
            'Co-occurrence: Do these codes overlap with other unrecognised codes?'
        ]
    },
  {
        id: 'step-7',
        title: 'Consensus',
        subtitle: 'Expert consensus',
        icon: 'pi pi-users',
        content: `Convene a consensus meeting to discuss user selections and finalize the code list.`,
        bullets: [
            'Check the <strong>Review Mode</strong> button in the <strong>Review</strong> panel.',
            'Agree on the included codes based on votes and comments.',
            'Document key discussion points in the <strong>Consensus Notes</strong> section.'
        ]
    },
    {
        id: 'step-8',
        title: 'Download & Export',
        subtitle: 'Reproducible Science',
        icon: 'pi pi-download',
        content: `Export your finalized definition for use in GWAS or clinical analysis pipelines.`,
        bullets: [
            'Go to the <strong>Download</strong> tab.',
            'Select your format: TSV, JSON, or YAML.',
            'If exporting to a flat TSV file, choose whether to include meta-data headers.',
            'The export includes a finalization time-stamp for reproducibility.'
        ]
    }
]);
</script>

<template>
  <div class="page-wrapper">

    <!-- HEADER -->
    <div class="doc-header">
        <div class="content-limit">
            <h1>User Documentation</h1>
            <p class="subtitle">A step-by-step guide to the Code Consensus Workflow.</p>
        </div>
    </div>

    <div class="doc-container">

        <!-- LEFT: STICKY NAVIGATION -->
        <aside class="sidebar">
            <nav class="sticky-nav">
                <h3>Contents</h3>
                <ul>
                    <li v-for="step in steps" :key="step.id">
                        <a @click.prevent="scrollToSection(step.id)" href="#">
                            <i :class="step.icon"></i>
                            {{ step.title }}
                        </a>
                    </li>
                </ul>

                <Divider />

            <div class="help-box">
                <i class="pi pi-question-circle text-3xl mb-2 text-primary"></i>
                <h4>Need Help?</h4>
                <p class="text-sm text-600 mb-3">Contact the team for access issues or to report bugs.</p>

                <!-- INLINE BUTTONS CONTAINER -->
                <div class="flex gap-2 justify-content-center w-full">

                    <a href="https://github.com/nicksunderland/code-consensus-app/issues" target="_blank" class="no-underline">
                        <Button icon="pi pi-github" label="Issues" size="small" severity="secondary" outlined />
                    </a>

                </div>
            </div>
            </nav>
        </aside>

        <!-- RIGHT: MAIN CONTENT -->
        <main class="main-content">

            <section class="intro mb-6">
                <Card class="intro-card">
                    <template #title>Getting Started</template>
                    <template #content>
                        <p>
                            Welcome to the Code Consensus Platform. This tool is designed to standardize the way we define
                            phenotypes from Electronic Health Records (EHR). By combining automated regex search with
                            human expert consensus, we create transparent, reproducible definitions.
                        </p>
                    </template>
                </Card>
            </section>

            <div class="timeline-wrapper">
                <div v-for="(step, index) in steps" :key="step.id" :id="step.id" class="doc-step">

                    <!-- Visual Connector Line -->
                    <div class="step-connector" v-if="index !== steps.length - 1"></div>

                    <!-- Step Number Bubble -->
                    <div class="step-marker">
                        {{ index + 1 }}
                    </div>

                    <!-- The Content Card -->
                    <Card class="step-card shadow-1">
                        <template #title>
                            <div class="step-card-header">
                                <i :class="step.icon" class="step-icon"></i>
                                <span class="step-title-text">{{ step.title }}</span>
                                <Tag :value="step.subtitle" severity="info" class="step-tag"></Tag>
                            </div>
                        </template>
                        <template #content>
                            <p class="step-description">{{ step.content }}</p>

                            <div class="action-box">
                                <ul>
                                    <li v-for="(bullet, bIndex) in step.bullets" :key="bIndex">
                                        <i class="pi pi-check text-primary mr-2"></i>
                                        <span v-html="bullet"></span>
                                    </li>
                                </ul>
                            </div>
                        </template>
                    </Card>
                </div>
            </div>

            <!-- Conclusion -->
             <div class="conclusion-area">
                <router-link to="/accordion" custom v-slot="{ navigate }">
                    <Button label="Launch Consensus Tool" size="large" icon="pi pi-play-circle" @click="navigate" />
                </router-link>
             </div>

        </main>
    </div>

    <Footer />
  </div>
</template>

<style scoped>
/* LAYOUT UTILS */
.page-wrapper {
  background-color: #f8f9fa;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.doc-header {
    background: white;
    border-bottom: 1px solid #eaeaea;
    padding: 4rem 2rem;
    text-align: center;
}

.doc-header h1 {
    font-size: 2.5rem;
    margin: 0 0 1rem 0;
    color: #1e293b;
}

.subtitle {
    font-size: 1.1rem;
    color: #64748b;
}

.content-limit {
    max-width: 1280px;
    margin: 0 auto;
}

.doc-container {
    max-width: 1280px;
    width: 100%;
    margin: 0 auto;
    padding: 3rem 1.5rem;
    display: grid;
    grid-template-columns: 280px 1fr; /* Sidebar width vs Content */
    gap: 4rem;
    flex: 1;
}

/* SIDEBAR STYLES */
.sidebar {
    position: relative;
}

.sticky-nav {
    position: sticky;
    top: 100px; /* How far from top when scrolling */
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid #eaeaea;
}

.sticky-nav h3 {
    margin-top: 0;
    font-size: 1.1rem;
    color: #0f172a;
    margin-bottom: 1rem;
}

.sticky-nav ul {
    list-style: none;
    padding: 0;
}

.sticky-nav li {
    margin-bottom: 0.5rem;
}

.sticky-nav a {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #64748b;
    text-decoration: none;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.2s;
    font-size: 0.95rem;
}

.sticky-nav a:hover {
    background-color: #f1f5f9;
    color: var(--primary-color);
}

.help-box {
    text-align: center;         /* Centers text */
    display: flex;
    flex-direction: column;     /* Stacks items vertically */
    align-items: center;        /* Centers items horizontally (icon, h4, p, div) */
    padding-top: 1rem;
}

/* 2. Center the button row */
.help-box div {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    width: 100%;                /* Ensure container spans full width so centering works */
    margin-top: 0.5rem;
}

/* 3. Reset link styles */
.help-box a {
    text-decoration: none;
    display: flex;              /* Fixes vertical alignment of button inside anchor */
}

/* MAIN CONTENT STYLES */
.intro-card {
    border: none;
    background: linear-gradient(to right, #ffffff, #f8fafc);
    border-left: 4px solid var(--primary-color);
    margin-bottom: 3rem;
}

/* CUSTOM TIMELINE STYLES */
.timeline-wrapper {
    position: relative;
    padding-left: 20px;
}

.doc-step {
    position: relative;
    padding-left: 40px; /* Space for the marker */
    margin-bottom: 3rem;
}

.step-connector {
    position: absolute;
    left: 19px; /* Aligns with center of marker */
    top: 40px;
    bottom: -50px; /* Extends to next item */
    width: 2px;
    background-color: #e2e8f0;
}

.step-marker {
    position: absolute;
    left: 0;
    top: 0;
    width: 40px;
    height: 40px;
    background-color: white;
    border: 2px solid var(--primary-color);
    color: var(--primary-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.1rem;
    z-index: 2;
}

.step-card {
    border: 1px solid #eaeaea;
    border-radius: 12px;
    transition: transform 0.2s;
}

.step-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.step-description {
    color: #334155;
    line-height: 1.6;
    margin-bottom: 1.5rem;
}

/* Container: Forces children to sit side-by-side */
.step-card-header {
    display: flex;        /* This creates the row */
    align-items: center;  /* Centers them vertically */
}

/* Icon: Adds space to its right */
.step-icon {
    font-size: 1.5rem;
    color: var(--primary-color);
    margin-right: 1rem;   /* GAP HERE */
}

/* Title: Adds space to its right */
.step-title-text {
    font-weight: 600;
    font-size: 1.2rem;
    margin-right: 1rem;   /* GAP HERE */
    white-space: nowrap;  /* Prevents title from wrapping weirdly */
}

/* Tag: Pushes itself to the far right (optional) */
/* If you want the tag right next to the title, change 'auto' to '0' */
.step-tag {
    font-weight: normal;
    margin-left: auto;
}

.action-box {
    background-color: #f8fafc;
    border-radius: 8px;
    padding: 1.5rem;
    border: 1px dashed #cbd5e1;
}

.action-box ul {
    list-style: none;
    padding: 0;
    margin: 0;
}

.action-box li {
    margin-bottom: 0.8rem;
    display: flex;
    align-items: flex-start;
    font-size: 0.95rem;
    color: #475569;
}

.action-box li:last-child {
    margin-bottom: 0;
}

.conclusion-area {
    margin-top: 5rem;

    /* Flexbox Centering Magic */
    display: flex;
    flex-direction: column; /* Stack text on top of button */
    align-items: center;    /* Center horizontally */
    text-align: center;     /* Ensure text itself is centered */
    gap: 1.5rem;            /* specific space between Text and Button */
}

/* MOBILE RESPONSIVE */
@media (max-width: 960px) {
    .doc-container {
        grid-template-columns: 1fr; /* Stack sidebar on top */
        gap: 2rem;
    }

    .sticky-nav {
        position: static; /* No sticky on mobile */
    }

    .timeline-wrapper {
        padding-left: 0;
    }
}
</style>
```