## Code Consensus

Tool for building EHR code lists for phenotypes as a team. Each member of a project searches the code hierarchies (ICD-9/10, OPCS, CPT, SNOMED CT) and picks codes independently, then the group agrees a consensus list and exports it. UK Biobank co-occurrence and counts are shown alongside to help spot missing or noisy codes.

Nicholas Sunderland (nicholas.sunderland@bristol.ac.uk), HERMES. © HERMES.

[![Made with Supabase](https://supabase.com/badge-made-with-supabase.svg)](https://supabase.com)

### Structure
- `frontend/` Vue 3 + Vite + PrimeVue, on Netlify. Routes: `/` home, `/project/:id` project overview, `/accordion` consensus tool, `/flow` PhenoFlow, `/examples`, `/docs`, `/terms`.
- `backend/main.py` FastAPI, on Fly.io. Tree browsing, code search, co-occurrence/count metrics and the public examples endpoints.
- `backend/db/schema.sql` Supabase schema (codes, projects, phenotypes, selections, consensus, RLS).
- `backend/db/` data loading and project seeding scripts (below).
- `backend/db/migrations/` SQL changes to run in the Supabase SQL editor, in date order.

Most CRUD goes straight from the frontend to Supabase under RLS. The backend uses the service-role connection for the heavy read-only queries.

### Running locally
Backend:
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

### Environment
- `backend/.env`: `VITE_DATABASE_URL` (service-role Postgres URL), `ORIGIN` (CORS, comma separated), `EXAMPLE_PROJECT_IDS=uuid1,uuid2`, `HES` (path to the UKB HES extract, only for the co-occurrence script).
- `frontend/.env`: `VITE_API_URL=http://localhost:8000`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### Supabase auth
1. Enable the GitHub/Google providers. Set the Site URL to `http://localhost:5173` (and the production URL) and add both as redirect URLs.
2. Put the project URL and anon key in `frontend/.env`.
3. The backend connects with the service role, so anything it exposes publicly is limited to `EXAMPLE_PROJECT_IDS`.
4. Vocab tables need read-only RLS policies; project/phenotype/selection policies are in `schema.sql`.

New users get a `user_profiles` row on signup. People have to sign up before they can be added to a project.

### Data
Raw vocab files live in `backend/db/data/` (gitignored). From `backend/`:
- `python db/seed_db.py` builds `codes.csv` / `code_systems.csv` from the UKB codings, WHO and CM ICD-10, CMS ICD-9, CPT and the SNOMED RF2 snapshot.
- `python db/ukb_cooccurrence.py` writes `cooccurrence_web_summary.csv` and `code_counts_web.csv` to `db/data/` for import into `code_cooccurrence` / `code_counts` (pairs are stored ordered, `code_i < code_j`).

Project seeding (writes to the live DB):
- `python db/seed_esc_project.py` ESC data elements, then `python db/seed_esc_selections.py` to pre-fill selections from the search terms.
- `python db/seed_biccs_project.py` BICCS inherited cardiac conditions list. Dry run by default, `--commit` to write.

### Deploy
- Frontend (Netlify): set `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; build `npm run build`, publish `frontend/dist`.
- Backend (Fly.io): set `VITE_DATABASE_URL`, `EXAMPLE_PROJECT_IDS`, `ORIGIN`; `fly deploy` from `backend/`.

### Tests
- Frontend: `cd frontend && npm test`
- Backend: `cd backend && python -m unittest discover -s tests`

### Notes
- No PHI/PII in free-text fields. Selections reference vocab codes only.
- Counts under 100 are suppressed, per UKB guidance on small numbers.
