import { describe, it, expect, vi } from 'vitest';

// Example test showing Vitest usage
describe('Example Test Suite', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should use vi instead of jest for mocking', () => {
    const mockFn = vi.fn();
    mockFn('hello');
    expect(mockFn).toHaveBeenCalledWith('hello');
  });
});

// Example of how to mock modules in Vitest
vi.mock('../utils/supabase-auth', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));