import { isPublicPath, PUBLIC_PATHS } from '../publicRoutes';

describe('publicRoutes', () => {
  test('marks marketing, bid, and login as public', () => {
    expect(PUBLIC_PATHS).toEqual(['/', '/bid', '/login']);
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/bid')).toBe(true);
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/dashboard')).toBe(false);
  });
});
