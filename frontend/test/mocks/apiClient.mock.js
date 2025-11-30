import { vi } from 'vitest'

export const createApiClientMock = () => {
  return {
    get: vi.fn(),
    post: vi.fn()
  }
}
