import { Link, useParams } from 'react-router-dom';
import PublicNav from './PublicNav';
import Seo from './Seo';
import {
  COMPANY_NAME,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
} from '../constants/companyContact';
import { SERVICES, SITE_ORIGIN, canonicalUrl } from '../seo/siteMetadata';

/**
 * One indexable page per service. Copy is specific to the trade.
 * Unknown slugs are noindex and are not listed in the sitemap.
 */
export default function ServiceDetail() {
  const { slug } = useParams();
  const service = SERVICES.find((item) => item.slug === slug);

  if (!service) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Seo
          title={`Page not found | ${COMPANY_NAME}`}
          description="That service page is not on this site."
          path="/services/not-found"
          noindex
        />
        <PublicNav />
        <main className="max-w-3xl mx-auto px-4 py-16">
          <h1 className="text-3xl font-bold">Page not found</h1>
          <p className="mt-4 text-slate-600">
            <Link to="/" className="font-semibold text-emerald-700">
              Back to the homepage
            </Link>
          </p>
        </main>
      </div>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.h1,
    serviceType: service.cardTitle,
    description: service.description,
    url: canonicalUrl(service.path),
    provider: {
      '@type': 'LocalBusiness',
      name: COMPANY_NAME,
      url: `${SITE_ORIGIN}/`,
      telephone: '+1-931-279-7879',
    },
    areaServed: 'Middle Tennessee',
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Seo
        title={service.title}
        description={service.description}
        path={service.path}
        jsonLd={jsonLd}
      />
      <PublicNav />
      <main className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          {COMPANY_NAME}
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{service.h1}</h1>
        <p className="mt-4 text-lg text-slate-700 leading-relaxed">{service.lead}</p>
        <div className="mt-8 space-y-4 text-slate-700 leading-relaxed">
          {service.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <p className="mt-8">
          <Link to="/service-area" className="font-semibold text-emerald-700 hover:text-emerald-800">
            See the Middle Tennessee service area
          </Link>
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/bid"
            className="inline-flex justify-center items-center min-h-[48px] rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
          >
            Request a bid
          </Link>
          <a
            href={COMPANY_PHONE_TEL}
            className="inline-flex justify-center items-center min-h-[48px] rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50"
          >
            Call {COMPANY_PHONE_DISPLAY}
          </a>
        </div>
      </main>
    </div>
  );
}
