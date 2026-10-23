import { useEffect } from 'react';
import { canonicalUrl } from '../seo/siteMetadata';

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Keeps the document title, description, and canonical URL in sync when a
 * visitor moves between public pages without a full reload. The build also
 * writes these tags into the prerendered HTML for the first response.
 * Not-found pages pass canonical={false} so a previous page's canonical
 * is removed instead of pointing Google at the homepage.
 */
export default function Seo({ title, description, path, jsonLd, noindex = false, canonical = true }) {
  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);

    const existingCanonical = document.head.querySelector('link[rel="canonical"]');
    const ogUrl = document.head.querySelector('meta[property="og:url"]');
    if (canonical) {
      upsertMeta('property', 'og:url', canonicalUrl(path));
      let link = existingCanonical;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonicalUrl(path));
    } else {
      existingCanonical?.remove();
      ogUrl?.remove();
    }
  }, [title, description, path, noindex, canonical]);

  if (!jsonLd) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
