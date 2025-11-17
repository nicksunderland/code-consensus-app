import axios from 'axios';

const BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8000'
  : 'https://code-consensus.fly.dev';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  // optionally, set common headers:
  // headers: { 'Content-Type': 'application/json' }
});