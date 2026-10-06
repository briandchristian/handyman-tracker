import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Starts each new path at the top of the window.
 * Client-side navigation otherwise keeps the previous scroll offset, so a
 * phone tap on a lower homepage card opens the next page at the bottom.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
