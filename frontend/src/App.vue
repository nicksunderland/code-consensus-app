<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

// This variable will hold our message from the backend
const message = ref('Connecting to backend...')

// This function runs when the component is first loaded
onMounted(async () => {
  try {
    // Define the API URL. It cleverly uses an environment variable
    // for production, or defaults to localhost for development.
    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

    // Make the API call
    const response = await axios.get(`${API_URL}/api/hello`);

    // Update the message with the data from the API
    message.value = response.data.message;

  } catch (error) {
    console.error('Error fetching data:', error);
    message.value = 'Failed to connect to backend.';
  }
})
</script>

<template>
  <main>
    <h1>{{ message }}</h1>
  </main>
</template>

<style scoped>
main {
  display: grid;
  place-items: center;
  min-height: 100vh;
  font-family: system-ui, sans-serif;
  color: #333;
}
h1 {
  font-weight: 300;
  font-size: 2.5rem;
}
</style>