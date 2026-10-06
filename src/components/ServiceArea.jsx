import { Link } from 'react-router-dom';
import PublicNav from './PublicNav';
import Seo from './Seo';
import {
  COMPANY_NAME,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
} from '../constants/companyContact';
import {
  LICENSE_ID,
  SERVICE_REGIONS,
  SERVICES,
  buildLocalBusinessJsonLd,
} from '../seo/siteMetadata';

/**
 * Single service-area page for the cities Christian Security Services covers.
 * Cities are grouped by region so the page is not a copy of one town swapped
 * into eighteen URLs.
 */
export default function ServiceArea() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Seo
        title="Middle Tennessee Service Area | Christian Security Services"
        description="Alarm installation from Selmer, Savannah, and Waynesboro through Columbia and Shelbyville to Franklin and Nashville, including Tullahoma and Winchester."
        path="/service-area"
        jsonLd={buildLocalBusinessJsonLd()}
      />
      <PublicNav />
      <main className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Where we install
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
          Middle Tennessee service area
        </h1>
        <p className="mt-4 text-lg text-slate-700 leading-relaxed">
          {COMPANY_NAME} is Tennessee alarm contracting company ID {LICENSE_ID}. We install
          burglar alarms, fire alarms, cameras, and access control for homes, churches, offices,
          and shops across a wide stretch of Middle Tennessee. One crew covers this territory.
          Call {COMPANY_PHONE_DISPLAY} or request a bid with the town and the type of system.
        </p>

        <div className="mt-10 space-y-8">
          {SERVICE_REGIONS.map((region) => (
            <section key={region.id}>
              <h2 className="text-xl font-bold text-slate-900">{region.title}</h2>
              <p className="mt-2 text-slate-700 leading-relaxed">{region.summary}</p>
              <p className="mt-2 text-slate-800 font-medium">{region.cities.join(', ')}</p>
            </section>
          ))}
        </div>

        <h2 className="mt-12 text-xl font-bold">Systems we install in these towns</h2>
        <ul className="mt-4 space-y-2">
          {SERVICES.map((service) => (
            <li key={service.slug}>
              <Link to={service.path} className="font-semibold text-emerald-700 hover:text-emerald-800">
                {service.cardTitle}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
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
