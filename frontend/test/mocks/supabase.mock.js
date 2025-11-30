import { vi } from 'vitest'

const makeQueryMock = (result = { data: [], error: null }) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
  }

  const resolve = vi.fn().mockResolvedValue(result)
  Object.keys(chain).forEach(key => chain[key].mockReturnValue(chain))
  chain.then = resolve.then
  chain.catch = resolve.catch
  chain.finally = resolve.finally

  chain.select.mockResolvedValue(result)
  chain.insert.mockResolvedValue(result)
  chain.update.mockResolvedValue(result)
  chain.delete.mockResolvedValue(result)
  chain.upsert.mockResolvedValue(result)
  chain.single.mockResolvedValue(result)
  chain.maybeSingle.mockResolvedValue(result)
  chain.eq.mockResolvedValue(result)
  chain.in.mockResolvedValue(result)
  chain.order.mockResolvedValue(result)
  chain.contains.mockResolvedValue(result)

  return chain
}

export const createSupabaseMock = (overrides = {}) => {
  const defaultQuery = makeQueryMock()
  return {
    from: vi.fn().mockReturnValue(defaultQuery),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      onAuthStateChange: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      signInWithOtp: vi.fn()
    },
    ...overrides
  }
}
