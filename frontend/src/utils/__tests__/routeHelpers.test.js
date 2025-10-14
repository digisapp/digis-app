import { defaultPathFor, isRole, isRoleReady } from '../routeHelpers';

describe('routeHelpers', () => {
  describe('isRole', () => {
    it('should return true for valid roles', () => {
      expect(isRole('admin')).toBe(true);
      expect(isRole('creator')).toBe(true);
      expect(isRole('fan')).toBe(true);
    });

    it('should return false for invalid roles', () => {
      expect(isRole('superuser')).toBe(false);
      expect(isRole('guest')).toBe(false);
      expect(isRole(null)).toBe(false);
      expect(isRole(undefined)).toBe(false);
      expect(isRole(123)).toBe(false);
      expect(isRole({})).toBe(false);
    });
  });

  describe('defaultPathFor', () => {
    // Mock window.location for redirect throttle tests
    const mockLocation = (pathname) => {
      delete window.location;
      window.location = { pathname };
    };

    beforeEach(() => {
      // Reset window.location before each test
      delete window.location;
      window.location = { pathname: '/' };
    });

    it('should return /admin for admin role', () => {
      mockLocation('/somewhere');
      expect(defaultPathFor('admin')).toBe('/admin');
    });

    it('should return /dashboard for creator role', () => {
      mockLocation('/somewhere');
      expect(defaultPathFor('creator')).toBe('/dashboard');
    });

    it('should return /explore for fan role', () => {
      mockLocation('/somewhere');
      expect(defaultPathFor('fan')).toBe('/explore');
    });

    it('should return /explore for null/undefined role (fallback)', () => {
      mockLocation('/somewhere');
      expect(defaultPathFor(null)).toBe('/explore');
      expect(defaultPathFor(undefined)).toBe('/explore');
    });

    it('should return /explore for invalid role (fallback with warning)', () => {
      mockLocation('/somewhere');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(defaultPathFor('invalid_role')).toBe('/explore');

      // In production, warning should not be logged
      // In dev/test, it should be logged
      consoleSpy.mockRestore();
    });

    it('should not redirect if already on target path (throttle)', () => {
      mockLocation('/dashboard');
      expect(defaultPathFor('creator')).toBe('/dashboard');

      mockLocation('/explore');
      expect(defaultPathFor('fan')).toBe('/explore');

      mockLocation('/admin');
      expect(defaultPathFor('admin')).toBe('/admin');
    });
  });

  describe('isRoleReady', () => {
    it('should return true when role is resolved and valid', () => {
      expect(isRoleReady(true, 'creator')).toBe(true);
      expect(isRoleReady(true, 'admin')).toBe(true);
      expect(isRoleReady(true, 'fan')).toBe(true);
    });

    it('should return false when roleResolved is false', () => {
      expect(isRoleReady(false, 'creator')).toBe(false);
    });

    it('should return false when role is null/undefined', () => {
      expect(isRoleReady(true, null)).toBe(false);
      expect(isRoleReady(true, undefined)).toBe(false);
    });

    it('should return false when role is not a string', () => {
      expect(isRoleReady(true, 123)).toBe(false);
      expect(isRoleReady(true, {})).toBe(false);
      expect(isRoleReady(true, [])).toBe(false);
    });
  });
});
