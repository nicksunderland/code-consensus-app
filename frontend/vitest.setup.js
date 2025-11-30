// Vitest global setup for Vue/happy-dom
import { config } from '@vue/test-utils'

// Silence Vue warnings during tests unless they are errors we assert on
config.global.warnHandler = () => {}

// Provide minimal window globals used by composables if needed
if (typeof window !== 'undefined' && !window.__API_URL__) {
  window.__API_URL__ = 'http://localhost:8000'
}
