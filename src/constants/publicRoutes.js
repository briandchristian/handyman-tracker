/** Paths that do not require auth and should not show the staff mobile nav. */
export const PUBLIC_PATHS = ['/', '/bid', '/login', '/service-area'];

export function isPublicPath(pathname) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/services/');
}
