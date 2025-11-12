<script setup>
import { ref } from 'vue';
import axios from 'axios';

// 1. State Management
const backendMessage = ref("Click the button to connect to the FastAPI backend.");
const loading = ref(false);
const error = ref(null);

// 2. The API URL (Dynamically set based on environment)
// Vite's 'import.meta.env.DEV' is true when running 'npm run dev'.
const BASE_URL = import.meta.env.DEV
    ? 'http://localhost:8000' // Local FastAPI URL for local testing
    : 'https://code-consensus.netlify.app'; // Live Render URL for production

const API_URL = `${BASE_URL}/api/hello`;

/**
 * Fetches the "Hello" message from the FastAPI backend.
 */
const fetchHello = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await axios.get(API_URL);
        // Assuming the response is in the format: { "message": "..." }
        backendMessage.value = `SUCCESS: ${response.data.message}`;
    } catch (err) {
        console.error("Connection Error:", err);
        // Show a friendly error message and log the attempted URL
        error.value = `Failed to connect to backend at ${API_URL}. Ensure the server is running.`;
        backendMessage.value = "Error";
    } finally {
        loading.value = false;
    }
};
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="w-full max-w-lg p-8 bg-white shadow-xl rounded-xl text-center border-t-4 border-indigo-600">
      <h1 class="text-3xl font-extrabold text-gray-900 mb-6">
        EHR Dictionary App
      </h1>
      <p class="text-gray-600 mb-8">
        This demonstrates the connection between your Vue frontend and your FastAPI backend.
      </p>

      <!-- Connection Status Card -->
      <div class="p-6 bg-indigo-50 border border-indigo-200 rounded-lg mb-8">
        <p class="text-sm font-medium text-indigo-700 mb-3">Backend Status:</p>
        <p class="text-xl font-semibold text-indigo-900 break-words">
          {{ backendMessage }}
        </p>
      </div>

      <!-- Button -->
      <button
        @click="fetchHello"
        :disabled="loading"
        class="w-full px-6 py-3 text-lg font-semibold rounded-lg text-white transition duration-300 ease-in-out transform hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-indigo-300"
        :class="loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md'"
      >
        <span v-if="loading">Connecting...</span>
        <span v-else>Get Hello Message from Backend</span>
      </button>

      <!-- Error Display -->
      <div v-if="error" class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
        {{ error }}
      </div>

    </div>
  </div>
</template>

<style scoped>
#app {
  font-family: 'Inter', sans-serif;
}
</style>