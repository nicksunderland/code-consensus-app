# code-consensus-app

Frontend: netlify.com

Backend: fly.io

Launch the backend locally: 
```bash
cd backend
uvicorn main:app --reload
```

Launch the frontend locally: 
```bash
cd frontend
npm run dev
```



Setting up useSupabase auth: 
1. Go to authentication tab 
2. Configuration -> Sign-IN/providers
3. Chose the providers
4. Copy the callback URL 
5. Go to GitHub (or google) / settings / developer / AuthO
6. Create a new entry, add callback URL, copy ID and client secret
7. Add the ID and secret back in the Supabase config
8. Add useSupabase client setup script to project
```javascript
// in useSupabase.js
import { createClient } from '@useSupabase/useSupabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const useSupabase = createClient(supabaseUrl, supabaseAnonKey)
```
9. Set the VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY variables in:
   - find these in useSupabase -> project settings -> General (project ID) / API anon key 
   - VITE_SUPABASE_URL is of format: https://[project ID].useSupabase.co
   - a local .env file for local dev
   - the front end service (e.g. Netlify) via the project dashboard (projects -> project configuration -> environment variables)
10. import the client you just created into App.vue
```javascript
import {useSupabase} from "@/useSupabase.js";
```
11. Add login button and code: e.g.

```javascript
// in App.vue
const loginGitHub = async () => {
    await useSupabase.auth.signInWithOAuth({
        provider: 'github',
        options: {redirectTo: window.location.origin}
    })
}
```
12. Change useSupabase -> authentication -> configuration -> URL configuration: 
    - site URL: https://code-consensus.netlify.app (or whatever the actual URL is)
    - redirect URLS: http://localhost:5173 & https://code-consensus.netlify.app
13. This setup allows you to do simple DB queries without setting up an API:

```javascript
const {data, error} = await useSupabase
    .from('phenotypes')
    .select('id, name')
    .order('created_at', {ascending: false})
```
14. for more complicated DB queries (joins etc) we need an API and python backend
15. to do this 