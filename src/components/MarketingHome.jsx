import { Link } from 'react-router-dom';

import PublicNav from './PublicNav';

import {

  COMPANY_NAME,

  COMPANY_PHONE_DISPLAY,

  COMPANY_PHONE_TEL,

} from '../constants/companyContact';



const SERVICE_LINES = [

  {

    id: 'burglar',

    title: 'Burglar alarms',

    summary:

      'Intrusion detection, smart sensors, and loud or silent alerts tailored to your property.',

    icon: (

      <svg aria-hidden className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>

        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />

      </svg>

    ),

  },

  {

    id: 'fire',

    title: 'Fire alarms',

    summary:

      'Code-aware fire detection and notification systems for commercial and residential sites.',

    icon: (

      <svg aria-hidden className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>

        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />

        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />

      </svg>

    ),

  },

  {

    id: 'cctv',

    title: 'CCTV & monitoring',

    summary:

      'High-definition cameras, remote viewing, and professional monitoring when you need eyes on site.',

    icon: (

      <svg aria-hidden className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>

        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />

        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />

      </svg>

    ),

  },

  {

    id: 'access',

    title: 'Access control',

    summary:

      'Keycards, fobs, and controlled entry so the right people get in — and everyone else stays out.',

    icon: (

      <svg aria-hidden className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>

        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />

      </svg>

    ),

  },

];



const TRUST_ITEMS = [

  { label: 'Licensed contractor', detail: 'Tennessee alarm company ID 2622' },

  { label: 'Design through install', detail: 'One team for bid, install, and support' },

  { label: 'Homes & businesses', detail: 'Retail, offices, churches, and residences' },

];



/**

 * Public marketing landing at /.

 * Dark hero with service cards, trust signals, and repeated CTAs for phone and desktop.

 */

export default function MarketingHome() {

  return (

    <div data-testid="marketing-page" className="w-full min-h-screen bg-slate-50 text-slate-900">

      <PublicNav />



      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">

        <div

          aria-hidden

          className="pointer-events-none absolute inset-0 opacity-40"

          style={{

            backgroundImage:

              'radial-gradient(circle at 20% 20%, rgba(16,185,129,0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(56,189,248,0.12), transparent 40%)',

          }}

        />

        <div

          aria-hidden

          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"

        />



        <main className="relative px-4 py-10 md:px-8 md:py-20 max-w-6xl mx-auto">

          <div

            data-testid="marketing-hero"

            className="grid gap-10 md:grid-cols-2 md:items-center"

          >

            <div
              data-testid="marketing-hero-copy"
              className="text-left md:text-center md:flex md:flex-col md:items-center"
            >

              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">

                Licensed alarm contracting · Tennessee

              </p>

              <h1 className="mt-4 text-3xl md:text-5xl font-bold leading-tight tracking-tight">

                Security you can trust in Tennessee

              </h1>

              <p className="mt-3 md:mt-5 text-lg md:text-xl text-slate-200 max-w-xl md:mx-auto">

                Licensed alarm contracting for homes and businesses.

              </p>

              <p className="mt-3 text-slate-300 leading-relaxed max-w-xl md:mx-auto hidden md:block">

                Burglar alarms, fire alarms, access control, CCTV, and monitoring.

                Tell us about your project and we will follow up with a professional bid.

              </p>



              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap md:justify-center">

                <Link

                  to="/bid"

                  className="inline-flex justify-center items-center min-h-[48px] rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400 w-full sm:w-auto"

                >

                  Request a bid

                </Link>

                <Link

                  to="/login"

                  className="inline-flex justify-center items-center min-h-[44px] rounded-lg border border-white/25 bg-white/5 px-6 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/10 w-full sm:w-auto"

                >

                  Sign in

                </Link>

                <a

                  href={COMPANY_PHONE_TEL}

                  className="inline-flex justify-center items-center min-h-[44px] rounded-lg border border-emerald-400/40 px-6 py-3 font-semibold text-emerald-200 transition hover:bg-emerald-500/10 w-full sm:w-auto md:hidden"

                >

                  Call {COMPANY_PHONE_DISPLAY}

                </a>

              </div>



              <p className="mt-6 text-base text-slate-200 hidden md:block">

                <a

                  href={COMPANY_PHONE_TEL}

                  className="font-semibold text-emerald-300 underline decoration-emerald-500/50 underline-offset-4 hover:text-emerald-200"

                >

                  Call {COMPANY_PHONE_DISPLAY}

                </a>

              </p>

              <p className="text-sm text-slate-400 mt-2">

                ID Number: 2622 Alarm Contracting Company

              </p>



              <ul className="mt-6 flex flex-wrap gap-2 justify-start md:justify-center" aria-label="Services">

                {['Burglar alarms', 'Fire alarms', 'CCTV & monitoring', 'Access control'].map(

                  (title) => (

                    <li

                      key={title}

                      className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 backdrop-blur"

                    >

                      {title}

                    </li>

                  )

                )}

              </ul>

            </div>



            <div data-testid="desktop-hero-logo" className="hidden md:block relative">

              <div className="absolute -inset-4 rounded-3xl bg-emerald-500/20 blur-3xl" aria-hidden />

              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm shadow-2xl">

                <img

                  src="/logo.png"

                  alt=""

                  className="w-full max-w-sm mx-auto object-contain drop-shadow-lg"

                />

                <p className="mt-6 text-center text-sm font-medium text-slate-300">

                  {COMPANY_NAME}

                </p>

              </div>

            </div>

          </div>

        </main>

      </section>



      <section

        data-testid="marketing-trust"

        className="border-b border-slate-200 bg-white"

      >

        <div className="max-w-6xl mx-auto px-4 py-8 md:px-8 md:py-10">

          <ul className="grid gap-6 md:grid-cols-3">

            {TRUST_ITEMS.map((item) => (

              <li key={item.label} className="flex gap-4 md:flex-col md:items-center md:text-center">

                <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">

                  <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>

                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />

                  </svg>

                </span>

                <div>

                  <p className="font-semibold text-slate-900">{item.label}</p>

                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>

                </div>

              </li>

            ))}

          </ul>

        </div>

      </section>



      <section data-testid="marketing-services" className="px-4 py-14 md:px-8 md:py-20">

        <div className="max-w-6xl mx-auto">

          <div className="max-w-2xl md:mx-auto md:text-center">

            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">

              What we install

            </p>

            <h2 className="mt-2 text-2xl md:text-3xl font-bold text-slate-900">

              Complete security for homes &amp; businesses

            </h2>

            <p className="mt-3 text-slate-600 leading-relaxed">

              From a single door contact to full-building fire and access systems — we design,

              install, and support solutions that fit your site and budget.

            </p>

          </div>



          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            {SERVICE_LINES.map((service) => (

              <li

                key={service.id}

                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-200 hover:shadow-md text-left md:text-center md:items-center"

              >

                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 transition group-hover:bg-emerald-600 group-hover:text-white">

                  {service.icon}

                </span>

                <h3 className="mt-4 text-lg font-semibold text-slate-900">{service.title}</h3>

                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">

                  {service.summary}

                </p>

              </li>

            ))}

          </ul>

        </div>

      </section>



      <section className="px-4 pb-8 md:px-8">

        <div className="max-w-6xl mx-auto rounded-2xl border border-slate-200 bg-white p-8 md:p-10 shadow-sm md:text-center">

          <h2 className="text-xl md:text-2xl font-bold text-slate-900">

            Ready for a professional bid?

          </h2>

          <p className="mt-2 text-slate-600 max-w-2xl md:mx-auto">

            Share your floor plan, photos, or a short description of the job. We will review your

            project and respond with clear next steps — no pressure, no spam.

          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row md:justify-center">

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

        </div>

      </section>



      <section

        data-testid="marketing-cta-band"

        className="mt-4 bg-slate-900 px-4 py-12 md:px-8 text-white"

      >

        <div className="max-w-6xl mx-auto flex flex-col gap-6 md:items-center md:text-center">

          <div>

            <p className="text-emerald-400 text-sm font-semibold uppercase tracking-wide">

              {COMPANY_NAME}

            </p>

            <p className="mt-2 text-lg font-medium text-slate-100">

              Licensed alarm contracting across Tennessee

            </p>

            <p className="mt-1 text-sm text-slate-400">

              Burglar · Fire · CCTV · Access control

            </p>

          </div>

          <Link

            to="/bid"

            className="inline-flex justify-center items-center min-h-[48px] rounded-lg bg-emerald-500 px-8 py-3 font-semibold text-slate-950 hover:bg-emerald-400 shrink-0"

          >

            Get started

          </Link>

        </div>

      </section>



      <footer className="border-t border-slate-200 bg-slate-100 px-4 py-8 md:px-8 text-sm text-slate-600">

        <div className="max-w-6xl mx-auto flex flex-col gap-2 md:items-center md:text-center">

          <p>

            © {new Date().getFullYear()} {COMPANY_NAME}. ID 2622 Alarm Contracting Company.

          </p>

          <p className="text-slate-500">

            <Link to="/login" className="font-medium text-slate-700 hover:text-emerald-700">

              Customer &amp; staff sign in

            </Link>

          </p>

        </div>

      </footer>

    </div>

  );

}


