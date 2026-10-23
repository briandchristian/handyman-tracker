import { Link } from 'react-router-dom';
import PublicNav from './PublicNav';
import Seo from './Seo';
import {
  COMPANY_NAME,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
} from '../constants/companyContact';
import { LICENSE_ID } from '../seo/siteMetadata';

/**
 * Public privacy notice at /privacy-policy.
 *
 * Written for visitors and customers of Christian Security Services. It
 * describes what this site and the customer portal actually collect, including
 * Google Analytics 4 with Google Signals turned on, and the rights Tennessee
 * residents have under the Tennessee Information Protection Act (Tenn. Code
 * Ann. § 47-18-3301 et seq.).
 */
export default function PrivacyPolicy() {
  return (
    <div data-testid="privacy-policy" className="min-h-screen bg-slate-50 text-slate-900">
      <Seo
        title="Privacy Policy | Christian Security Services"
        description="How Christian Security Services collects and uses personal information, including Google Analytics 4 with Google Signals, and how to exercise Tennessee Information Protection Act rights."
        path="/privacy-policy"
      />
      <PublicNav />
      <main className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          {COMPANY_NAME}
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Privacy policy</h1>
        <p className="mt-4 text-slate-600">Effective date: October 23, 2026</p>
        <p className="mt-4 text-lg text-slate-700 leading-relaxed">
          This policy describes how {COMPANY_NAME}, Tennessee alarm contracting company ID{' '}
          {LICENSE_ID}, collects, uses, and shares personal information on{' '}
          christian-security-services.com and in the customer and staff portals on that site. We
          wrote it to meet the notice requirements of the Tennessee Information Protection Act
          (TIPA), Tenn. Code Ann. § 47-18-3301 et seq., and to explain the same practices to
          visitors outside Tennessee.
        </p>

        <h2 className="mt-10 text-xl font-bold">Information we collect</h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          We collect only what we need to quote, install, and support alarm, fire, camera, and
          access-control work, and to understand how this website is used.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700 leading-relaxed">
          <li>
            <span className="font-semibold text-slate-900">Identifiers and contact details.</span>{' '}
            Name, email address, phone number, and account sign-in information when you request a
            bid, call us, or use a customer account.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Property and project details.</span>{' '}
            Service address, project name, and the description you give us of the job.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Customer and job records.</span> Bids,
            installation notes, and amounts billed for work you ask us to do.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Internet and device data.</span> IP
            address, browser and device type, pages viewed, referring address, and cookie or
            similar identifiers collected by the tools described below.
          </li>
        </ul>
        <p className="mt-4 text-slate-700 leading-relaxed">
          We do not ask for sensitive data as TIPA defines it, such as a health diagnosis, biometric
          identifiers, precise geolocation from your device, or information about a known child. A
          street address for an installation is a job location, not device geolocation. If you
          include sensitive details in a project description, we use them only to quote and perform
          that work.
        </p>

        <h2 className="mt-10 text-xl font-bold">Why we process personal information</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700 leading-relaxed">
          <li>To answer a bid request and to design, install, and service a system you asked for.</li>
          <li>To create and maintain customer accounts and job records.</li>
          <li>To operate, secure, and fix this website.</li>
          <li>
            To measure visits and advertising, including the Google Analytics and Meta tools below.
          </li>
          <li>To keep accounting, license, and other records the law requires.</li>
          <li>To contact you about a project you started with us.</li>
        </ul>
        <p className="mt-4 text-slate-700 leading-relaxed">
          We do not process personal information for a new purpose that is incompatible with this
          list unless we ask you first.
        </p>

        <h2 className="mt-10 text-xl font-bold">Google Analytics &amp; Data Association</h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          We use Google Analytics 4 (GA4). The Google tag on this site is measurement ID{' '}
          <span className="font-semibold text-slate-900">G-24HYB6KRJX</span>. It loads on every
          page, including the public pages this site serves as HTML. Before that tag loads, Google
          Consent Mode sets analytics storage, ad storage, and ad user data to granted. Ad
          personalization starts as denied, so this visit is not used for personalized advertising
          or Google Signals profiling unless that consent is later granted. The footer control can
          deny all four of those settings.
        </p>
        <p className="mt-4 text-slate-700 leading-relaxed">
          We have enabled Google Signals in that GA4 property. Google Signals is Google&apos;s
          feature that can link site visitation data with signed-in Google accounts. When a visitor
          is signed in to Google and has Ads Personalization turned on, Google may associate
          activity on this website with that Google account and with other sessions and devices
          where the same person is signed in.
        </p>
        <p className="mt-4 text-slate-700 leading-relaxed">
          Visitation data that can be part of that association includes the pages viewed, events
          the tag records, the referring address, the date and time, the browser, device, and
          operating system, an approximate location derived from the IP address, and advertising
          identifiers Google already holds for that account. Google uses the associated data for
          cross-device reporting in GA4, for demographics and interests reports, and for remarketing
          and advertising audiences when the property is linked to Google advertising products.
        </p>
        <p className="mt-4 text-slate-700 leading-relaxed">
          We do not receive your Google account name, email address, or password from this
          association. Google does the matching for people who are signed in and eligible. A visit
          is not linked through Google Signals when you are signed out, when Ads Personalization is
          off, or when you have opted out of this kind of association in your Google account.
        </p>
        <p className="mt-4 text-slate-700 leading-relaxed">
          Google receives this data under its own terms. For Analytics reporting we configure,
          Google acts on our instructions. For advertising and signed-in account features, Google
          also uses the data under its policies. Google&apos;s description of Signals is at{' '}
          <a
            href="https://support.google.com/analytics/answer/7532985"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Google&apos;s Google Signals help page
          </a>
          .
        </p>

        <h2 className="mt-10 text-xl font-bold">Other cookies and advertising tools</h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          We also use the Meta (Facebook) Pixel, ID 1987889385503166. It records a page view on
          each page and a lead event when a bid form is submitted. Meta can use that activity to
          measure ads and to show ads to people who visited this site. You can limit that in{' '}
          <a
            href="https://www.facebook.com/settings?tab=ads"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Meta ad settings
          </a>
          .
        </p>

        <h2 className="mt-10 text-xl font-bold">Who receives personal information</h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          Categories of personal information we share, and the categories of third parties who
          receive them:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700 leading-relaxed">
          <li>
            <span className="font-semibold text-slate-900">Analytics and advertising providers.</span>{' '}
            Internet and device data, and the visitation data described above, go to Google (GA4
            and Google Signals) and Meta (Pixel).
          </li>
          <li>
            <span className="font-semibold text-slate-900">Hosting, database, and email vendors.</span>{' '}
            Identifiers, project details, and job records are processed by the vendors that host
            this site, store its database, and deliver email so we can answer a bid.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Job partners.</span> Contact and project
            details may go to a subcontractor or monitoring company when that is part of the work
            you requested.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Professional and legal recipients.</span>{' '}
            Information may be disclosed to accountants, insurers, or a government agency when we
            must keep a record or respond to a lawful request.
          </li>
        </ul>
        <p className="mt-4 text-slate-700 leading-relaxed">
          Under TIPA, a sale is an exchange of personal information for money. We do not sell
          personal information. Disclosing information to a vendor who processes it for us, or to a
          partner performing a job you asked for, is not a sale. Google Signals and the Meta Pixel
          can still be targeted advertising, and you can opt out of that below.
        </p>

        <h2 className="mt-10 text-xl font-bold">Your rights</h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          If you are a Tennessee resident, TIPA gives you the following rights. We offer the same
          request process to other customers of this business. We will not deny service, change the
          price, or reduce the quality of a job because you exercise these rights. You do not need
          to create an account to submit a request.
        </p>

        <h3 className="mt-6 text-lg font-bold">Access</h3>
        <p className="mt-2 text-slate-700 leading-relaxed">
          You may ask us to confirm whether we process personal information about you and to
          provide access to that information, including the categories described in this policy.
        </p>

        <h3 className="mt-6 text-lg font-bold">Correct</h3>
        <p className="mt-2 text-slate-700 leading-relaxed">
          You may ask us to correct inaccurate personal information, taking into account the nature
          of the information and why we keep it.
        </p>

        <h3 className="mt-6 text-lg font-bold">Delete</h3>
        <p className="mt-2 text-slate-700 leading-relaxed">
          You may ask us to delete personal information you provided or that we obtained about you.
          We may keep information we are required to retain for accounting, warranty, security, or
          legal reasons, and we do not delete aggregate or de-identified data that is not linked to
          you. If we obtained information about you from someone else, we may honor a deletion
          request by keeping only the minimum record needed to honor the deletion and by not using
          that record for any other purpose.
        </p>

        <h3 className="mt-6 text-lg font-bold">Portability</h3>
        <p className="mt-2 text-slate-700 leading-relaxed">
          You may ask for a copy of the personal information you previously provided to us, in a
          portable and, where it is technically feasible, readily usable format, when we process
          that information by automated means.
        </p>

        <h3 className="mt-6 text-lg font-bold">Opt-Out</h3>
        <p className="mt-2 text-slate-700 leading-relaxed">
          You may opt out of processing of your personal information for sale, for targeted
          advertising, and for profiling in furtherance of decisions that produce legal or similarly
          significant effects. We do not sell personal information, and we do not use profiling to
          make decisions about credit, housing, insurance, employment, or similar matters. Targeted
          advertising through Google Signals and the Meta Pixel is the processing this opt-out
          changes. Opting out in the footer tells Google, through Consent Mode, to deny analytics
          storage, ad storage, ad user data, and ad personalization in this browser. Calling us
          also stops us from using your customer information to build advertising audiences. Use
          the Google and Meta controls in Your Privacy Choices for the settings in your own accounts.
        </p>

        <h2 id="your-privacy-choices" className="mt-10 text-xl font-bold">
          Your Privacy Choices
        </h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          To opt out of sale, targeted advertising, or profiling, or to submit an access, correction,
          deletion, or portability request, call us and say it is a privacy request. Tell us your
          name, a phone number or email we would have on file, the right you want to use, and, if
          you are opting out, whether that opt-out covers targeted advertising. We may ask for
          additional details when we cannot authenticate the request with reasonable effort.
        </p>
        <p className="mt-4">
          <a
            href={COMPANY_PHONE_TEL}
            className="inline-flex min-h-[48px] items-center font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Call {COMPANY_PHONE_DISPLAY} to make a privacy request
          </a>
        </p>
        <p className="mt-4 text-slate-700 leading-relaxed">
          You can also limit Google&apos;s association of visits with your Google account without
          calling us:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700 leading-relaxed">
          <li>
            Turn off Ads Personalization in{' '}
            <a
              href="https://adssettings.google.com"
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Google Ads Settings
            </a>
            .
          </li>
          <li>
            Install Google&apos;s{' '}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Analytics opt-out add-on
            </a>{' '}
            for your browser.
          </li>
          <li>Sign out of Google, or use a browser that blocks third-party cookies.</li>
        </ul>
        <p className="mt-4 text-slate-700 leading-relaxed">
          We respond to an authenticated request within 45 days. If a request is complex or one of
          several, we may take one additional 45 days, and we will tell you why inside the first 45
          days. The response is free up to twice a year. If a request is manifestly unfounded,
          technically infeasible, excessive, or repetitive, we may charge a reasonable fee or
          decline it, and we carry the burden of showing that. If we decline, we will explain why
          and how to appeal.
        </p>

        <h2 className="mt-10 text-xl font-bold">Appeals</h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          If we refuse a request, you may appeal by calling {COMPANY_PHONE_DISPLAY} and stating
          that you are appealing a privacy decision. The appeal is free and uses the same phone
          process as the original request. Submit it within a reasonable time after you receive the
          refusal. We will tell you in writing, within 60 days of receiving the appeal, what we did
          and why. If we deny the appeal, we will tell you how to contact the Tennessee Attorney
          General and Reporter. Complaints can be submitted through the Attorney General&apos;s
          office at{' '}
          <a
            href="https://www.tn.gov/attorneygeneral.html"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            tn.gov/attorneygeneral
          </a>
          .
        </p>

        <h2 className="mt-10 text-xl font-bold">Children</h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          This site is not directed to children under 13, and we do not knowingly process personal
          information of a known child except as the Children&apos;s Online Privacy Protection Act
          allows. A parent or guardian may submit a TIPA request for a known child by calling the
          number above.
        </p>

        <h2 className="mt-10 text-xl font-bold">Security and retention</h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          We keep administrative, technical, and physical safeguards appropriate to the volume and
          kind of personal information we hold. We keep bid and job records for as long as the
          project, warranty, accounting, and legal duties require, then delete or de-identify them.
          Google keeps Analytics data for the retention period set in our GA4 property and under
          Google&apos;s own rules.
        </p>

        <h2 className="mt-10 text-xl font-bold">Changes</h2>
        <p className="mt-3 text-slate-700 leading-relaxed">
          If we change this policy, we will post the new version on this page and change the
          effective date. Continued use of the site after that date means the new notice applies
          going forward.
        </p>

        <p className="mt-10 text-sm text-slate-500">
          <Link to="/" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Back to the homepage
          </Link>
        </p>
      </main>
    </div>
  );
}
