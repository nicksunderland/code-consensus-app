import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL

export const apiClient = axios.create({
  baseURL: BASE_URL
});

apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            console.warn("Unauthorized! Redirecting to login...")
        }
        return Promise.reject(error)
    }
)
