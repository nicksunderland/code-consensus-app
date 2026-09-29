# frontend

Vue 3 + Vite + PrimeVue. Talks to Supabase directly for projects, phenotypes and selections, and to the FastAPI backend (`VITE_API_URL`) for tree browsing, code search and the analysis metrics.

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build    # -> dist/, deployed on Netlify
```

Needs a `.env` with `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Layout:
- `src/views/` pages (the consensus tool is `AccordionView.vue`)
- `src/components/` the accordion panels and PhenoFlow nodes
- `src/composables/<area>/` state and data access, one test file per composable
- `test/mocks/` Supabase / API client mocks for the tests
