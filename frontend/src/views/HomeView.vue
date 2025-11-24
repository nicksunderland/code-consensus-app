<script setup>
import Button from 'primevue/button';
import Card from 'primevue/card';
import 'primeicons/primeicons.css';
import Footer from "@/components/Footer.vue";
</script>

<template>
  <div class="home-container">

    <section class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">Code Consensus <span class="text-primary">Platform</span></h1>
        <p class="hero-subtitle">
          A workspace for defining clinical phenotypes from Electronic Health Records through expert collaboration.
        </p>
        <div class="hero-actions">
          <router-link to="/accordion" custom v-slot="{ navigate }">
            <Button label="Start Phenotyping" icon="pi pi-search" iconPos="right" size="large" rounded @click="navigate" />
          </router-link>
          <router-link to="/docs" custom v-slot="{ navigate }">
            <Button label="Documentation" severity="secondary" text size="large" @click="navigate" />
          </router-link>
        </div>
      </div>
    </section>

    <section class="feature-section">
      <div class="feature-grid">
        <div class="figure-container">
          <div class="minimalist-box">
            <div class="box-header">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
              <div class="fake-url-bar">code-consensus.com/co-occurrence</div>
            </div>
            <div class="box-content p-0"> <img
                  src="@/assets/heat-map.png"
                  alt="Consensus Heatmap"
                  class="browser-image"
              />

            </div>
          </div>
        </div>

        <div class="text-container">
          <h2>Transparent Logic</h2>
          <p>
            Defining robust phenotypes for GWAS and clinical research requires more than just code lists.
            Our platform enables experts to review regex-derived hits across <strong>ICD-10, ICD-9, CTV, and OPCS</strong>
            standards, visualizing co-occurrence and agreement metrics to ensure high-fidelity definitions.
          </p>
          <ul class="feature-list">
            <li><i class="pi pi-check-circle text-primary"></i> <strong>Multi-source Search:</strong> Unified Regex across diverse coding systems.</li>
            <li><i class="pi pi-check-circle text-primary"></i> <strong>Expert Consensus:</strong> Real-time voting and disagreement resolution.</li>
            <li><i class="pi pi-check-circle text-primary"></i> <strong>Reproducible Output:</strong> Version-controlled exports for analysis.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="info-section">
      <div class="grid-container">

        <Card class="sleek-card">
          <template #header>
            <div class="logo-wrapper">
                <img src="@/assets/hermes-logo-full.png" alt="HERMES Logo" style="height: 65px; width: auto;" />
            </div>
          </template>

          <template #title>HERMES Consortium</template>

          <template #content>
            <p>
              Built to support the
              <a href="https://www.hermesconsortium.org/" target="_blank" class="text-primary no-underline hover:underline">HERMES</a>
              Heart Failure GWAS efforts. We aim to replace opaque inclusion criteria with transparent,
              community-validated phenotype definitions.
            </p>
          </template>
        </Card>

        <Card class="sleek-card">
          <template #header>
            <div class="card-icon-wrapper">
              <i class="pi pi-database"></i>
            </div>
          </template>
          <template #title>Coding Standards</template>
          <template #content>
            <p>
              Query across legacy and modern EHR standards including <strong>ICD-9, ICD-10, CTV (Read), and OPCS-4</strong>.
              Future roadmap includes full integration for <strong>SNOMED-CT</strong> and AI-assisted semantic search capabilities.
            </p>
          </template>
        </Card>

        <Card class="sleek-card">
          <template #header>
            <div class="card-icon-wrapper">
              <i class="pi pi-download"></i>
            </div>
          </template>
          <template #title>Open & Reproducible</template>
          <template #content>
            <p>
              Download your definitions in multiple standard formats (TSV, JSON, YAML)
              ready for immediate integration into your analysis pipelines, ensuring full reproducibility of your cohort selection.
            </p>
          </template>
        </Card>

      </div>
    </section>

    <Footer />
  </div>
</template>

<style scoped>
/* GENERAL UTILS */
.home-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #333;
  background-color: #f8f9fa;
}

.text-primary {
  color: var(--primary-color, #0EA5E9);
}

/* HERO SECTION */
.hero-section {
  padding: 6rem 2rem;
  text-align: center;
  background: white;
  border-bottom: 1px solid #eaeaea;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 800;
  margin-top: 0;
  margin-bottom: 1.5rem;
  letter-spacing: -1px;
}

.hero-subtitle {
  /* Reduced from 1.25rem to 1.15rem */
  font-size: 1.15rem;
  color: #666;
  max-width: 700px;
  margin: 0 auto 2.5rem auto;
  line-height: 1.6;
  /* Hero text usually looks better centered, but you can change to justify if preferred */
  text-align: center;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

/* FEATURE SECTION */
.feature-section {
  padding-top: 5rem;
  padding-bottom: 5rem;
  padding-left: 2rem;
  padding-right: 2rem;
  background-color: #fff;
}

.feature-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: start; /* Align to top so text doesn't float in middle if image is short */
}

@media (max-width: 768px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}

.text-container h2 {
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
}

.text-container p {
  /* Reduced size and justified */
  font-size: 1rem;
  color: #4b5563; /* Softened black */
  line-height: 1.7; /* Increased line-height for readability */
  margin-bottom: 2rem;
  text-align: justify; /* Justify text */
}

/* IMPROVED LIST STYLING */
.feature-list {
  list-style: none;
  padding: 0;
  margin-top: 1.5rem;
}

.feature-list li {
  margin-bottom: 1.2rem;
  font-size: 1rem;
  display: flex;
  align-items: flex-start; /* KEY FIX: Aligns icon to top of text block */
  gap: 12px;
  color: #374151;
  text-align: left; /* Keep bullets left-aligned even if main text is justified */
}

.feature-list li i {
  /* Prevent icon squishing */
  flex-shrink: 0;
  margin-top: 4px; /* Optically align icon with first line of text */
}

/* MINIMALIST FIGURE BOX */
.figure-container {
  display: flex;
  justify-content: center;
}

.minimalist-box {
  width: 100%;
  max-width: 500px;
  height: 350px;
  background: #fdfdfd;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.3s ease;
}

.minimalist-box:hover {
  transform: translateY(-5px);
}

.box-header {
  height: 40px;
  background: #f1f1f1;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  gap: 8px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.red { background: #ff5f56; }
.yellow { background: #ffbd2e; }
.green { background: #27c93f; }

.box-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
}

.placeholder-chart {
  text-align: center;
  color: #888;
}

/* INFO CARDS SECTION */
.info-section {
  padding: 5rem 2rem;
  background-color: #f8f9fa;
}

.grid-container {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.sleek-card {
  border: none;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
  overflow: hidden;
  height: 100%;
}

.sleek-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Card Content Styling */
:deep(.p-card-content) {
  padding-top: 0;
}

.sleek-card p {
  font-size: 0.95rem; /* Slightly smaller for cards */
  line-height: 1.6;
  color: #666;
  text-align: justify; /* Justify text inside cards */
  margin: 0;
}

.card-icon-wrapper {
  background: #EFF6FF;
  width: 50px;
  height: 50px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.card-icon-wrapper i {
  font-size: 1.5rem;
  color: var(--primary-color, #0EA5E9);
}

/* 1. Add a fake URL bar for that extra "App" feel */
.fake-url-bar {
  background: #fff;
  border-radius: 4px;
  height: 24px;
  width: 60%;
  margin-left: 1rem;
  font-size: 0.7rem;
  color: #aaa;
  display: flex;
  align-items: center;
  padding-left: 10px;
}

/* 2. Ensure the box content has no padding so image touches edges */
.p-0 {
  padding: 0 !important;
}

/* 3. Style the heatmap image */
.browser-image {
  width: 100%;
  height: 100%;
  object-fit: cover; /* Change to 'contain' if you want to see the whole image without cropping */
  object-position: top; /* Anchors image to top of scroll */
  display: block;
}

/* --- CARD LOGO UPDATES --- */

/* 4. A wrapper specifically for the Logo (No Blue Background) */
.logo-wrapper {
  height: 50px; /* Exact same height as .card-icon-wrapper */
  display: flex;
  align-items: center; /* Vertically center the logo */
  justify-content: flex-start; /* Align left to match title */
  margin-bottom: 1rem;
  /* Note: We do NOT add the blue background here, keeping it clean */
}

/* Ensure the titles of all cards line up */
:deep(.p-card-title) {
  margin-top: 0;
  font-size: 1.25rem;
  font-weight: 700;
}
</style>