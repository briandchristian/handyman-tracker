import { Link } from 'react-router-dom';
import PublicNav from './PublicNav';
import Seo from './Seo';
import { COMPANY_NAME } from '../constants/companyContact';

/**
 * URLs that are not a marketing page and not an app route.
 * The build also writes this heading into dist/404.html with noindex, so
 * Google sees the tag in the first response. No canonical is set: these
 * URLs are not the homepage.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Seo
        title={`Page not found | ${COMPANY_NAME}`}
        description="That page is not on this site."
        noindex
        canonical={false}
      />
      <PublicNav />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="mt-4 text-slate-600">That page is not on this site.</p>
        <p className="mt-4">
          <Link to="/" className="font-semibold text-emerald-700">
            Back to the homepage
          </Link>
        </p>
      </main>
    </div>
  );
}
