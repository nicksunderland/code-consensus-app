<script setup>

</script>

<template>
    <footer class="app-footer">
      <div class="footer-content">
        <div class="footer-left">
          <h3>Code Consensus</h3>
          <p class="copyright">© 2024 Research Group. All rights reserved.</p>
        </div>

        <div class="footer-links">
          <div class="link-column">
            <h4>Legal</h4>
            <a href="#">Terms of Service</a>
          </div>
          <div class="link-column social">
            <h4>Connect</h4>
            <a href="https://github.com" target="_blank"><i class="pi pi-github"></i> GitHub</a>
          </div>
        </div>
      </div>
    </footer>
</template>

<style scoped>
/* FOOTER */
.app-footer {
  background-color: #1e293b; /* Slate 800 */
  color: #fff;
  padding: 2rem 2rem;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 3rem;
}

.footer-left h3 {
  margin-top: 0;
  font-size: 1.5rem;
}

.copyright {
  color: #94a3b8;
  font-size: 0.9rem;
  margin-top: 1rem;
}

.footer-links {
  display: flex;
  gap: 4rem;
  flex-wrap: wrap;
}

.link-column {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.link-column h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #e2e8f0;
}

.link-column a {
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.2s;
}

.link-column a:hover {
  color: #fff;
}

.link-column.social a {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>