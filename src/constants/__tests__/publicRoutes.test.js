import { isPublicPath, PUBLIC_PATHS } from '../publicRoutes';

describe('publicRoutes', () => {
  test('marks marketing, bid, and login as public', () => {
    expect(PUBLIC_PATHS).toEqual(['/', '/bid', '/login', '/service-area', '/privacy-policy']);
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/bid')).toBe(true);
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/privacy-policy')).toBe(true);
    expect(isPublicPath('/dashboard')).toBe(false);
  });
});
