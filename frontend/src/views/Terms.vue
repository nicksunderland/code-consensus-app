<script setup>
</script>

<template>
  <div class="legal-page">
    <div class="hero">
      <p class="eyebrow">Terms of Service</p>
      <h1>Code Consensus</h1>
      <p class="lede">
        This app helps teams build and review EHR phenotype code sets. By using it, you agree to these terms.
      </p>
    </div>

    <section class="card">
      <h2>Use at your own risk</h2>
      <p>
        The service is provided “as is” without warranties of any kind. You are responsible for validating all
        outputs (including code lists, metrics, and downloads) before using them in any clinical, research, or operational
        contexts. We are not liable for errors, omissions, or any loss resulting from use of the app.
      </p>
    </section>

    <section class="card">
      <h2>Data you should not upload</h2>
      <p>
        Do not store protected health information (PHI) or other sensitive personal data in free text fields or
        uploads. Code selections should reference vocabularies only, not individual-level identifiers.
      </p>
    </section>

    <section class="card">
      <h2>Your account and content</h2>
      <p>
        Authentication is provided by Supabase. Your email is used for login and account-related notices. You retain
        ownership of phenotype definitions and code selections you create. We may ask if your phenotypes can be hosted on
        the examples page, however we will not do this without your consent.
      </p>
    </section>

    <section class="card">
      <h2>Service changes</h2>
      <p>
        Features may change or be discontinued without notice. We strive to avoid data loss, but you should export
        important definitions regularly.
      </p>
    </section>

    <section class="card">
      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, we are not liable for indirect, incidental, special, or consequential
        damages, or for loss of data or profits, arising from use of the app.
      </p>
    </section>

    <section class="card">
      <h2>Contact</h2>
      <p>
        Questions or requests (including account or data deletion): <a href="mailto:nicholas.sunderland@bristol.ac.uk">Code Consensus Support</a>.
      </p>
    </section>
  </div>
</template>

<style scoped>
.legal-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
  color: #0f172a;
}

.hero h1 {
  margin: 0.2rem 0 0.4rem;
}

.lede {
  color: #475569;
  line-height: 1.6;
  margin: 0;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #0ea5e9;
  margin: 0;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  margin-top: 1rem;
  box-shadow: 0 10px 30px -20px rgba(15, 23, 42, 0.25);
}

.card h2 {
  margin: 0 0 0.35rem;
  font-size: 1.1rem;
}

.card p {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

a {
  color: #0ea5e9;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
