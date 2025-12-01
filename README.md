## Code Consensus

[![CI](https://img.shields.io/badge/tests-vitest-green)](./frontend/package.json) [![API](https://img.shields.io/badge/backend-fastapi-blue)](./backend/main.py) ![License](https://img.shields.io/badge/license-%C2%A9%20HERMES-lightgrey)  
Author: Nicholas Sunderland (nicholas.sunderland@bristol.ac.uk)

Collaborative phenotype coding toolkit: Vue + PrimeVue frontend (Netlify) and FastAPI backend (Fly.io) with Supabase auth/DB.

### Structure
- `frontend/`: Vue 3 + Vite app (PrimeVue UI). Routes: `/` home, `/accordion` consensus tool, `/examples` gallery, `/terms` legal, `/flow` flow view.
- `backend/`: FastAPI API, Supabase DB access, seed/utility scripts (`db/`). Example endpoint `/api/example-phenotypes`.
- `backend/db/schema.sql`: Supabase schema (phenotypes, selections, consensus, codes).
- `backend/db/ukb_cooccurrence.py`: Generates co-occurrence metrics (jaccard/lift/counts) CSV for import.

### Quickstart
Backend (FastAPI):
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend (Vue):
```bash
cd frontend
npm install
npm run dev
```

### Environment
Create `.env` files:
- `backend/.env`: `DATABASE_URL=...`, `EXAMPLE_PROJECT_IDS=uuid1,uuid2`, `ORIGIN=http://localhost:5173`, etc.
- `frontend/.env`: `VITE_API_URL=http://localhost:8000`, `VITE_SUPABASE_URL=...`, `VITE_SUPABASE_ANON_KEY=...`.

### Supabase auth setup (short)
1) In Supabase: enable GitHub/Google providers; set Site URL `http://localhost:5173` (and production URL), redirect URLs include both local and production.  
2) Copy `project.supabase.co` URL and anon key into `frontend/.env`.  
3) Backend uses `DATABASE_URL` (service role) and `EXAMPLE_PROJECT_IDS` for public examples.  
4) RLS: ensure read-only policies for vocab tables; project/phenotype/selection policies already in `schema.sql`.

### Seeding data
From `backend/db`:
- Seed test data: `python seed_db_testing.py`
- Seed production sample: `python seed_db.py`
- Generate co-occurrence CSV: `python ukb_cooccurrence.py` (reads `backend/.env`, outputs `~/Downloads/cooccurrence_web_summary.csv`)
Import CSV into `code_cooccurrence` (ordered pairs enforced).

### Deploy
- **Frontend (Netlify)**: set env vars (`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); build command `npm run build`, publish `frontend/dist`.
- **Backend (Fly.io)**: set `VITE_DATABASE_URL`, `EXAMPLE_PROJECT_IDS`, CORS `ORIGIN`; run `fly deploy` from `backend/`.

### Tests
- Frontend: `cd frontend && npm test` (Vitest).
- Backend: `cd backend && python -m unittest discover -s tests`.

### Notes
- Do not store PHI/PII in free-text fields; code selections should reference vocab only.
- Counts metric suppresses low numbers (<100). Service role bypasses RLS; public exposure should use curated endpoints only.
