import {
  COMPANY_NAME,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
} from '../constants/companyContact';

/**
 * Shared branding block for public pages that still need the full company card.
 * Phone: compact 56px logo. Desktop: large mark.
 */
export default function CompanyHeader() {
  return (
    <div className="flex flex-col justify-center items-center gap-3 md:gap-4 mb-4 md:mb-8 md:flex-col">
      <div className="flex-shrink-0">
        <img
          src="/logo.png"
          alt="Christian Security Services Logo"
          className="w-14 h-14 md:w-80 md:h-80 object-contain"
        />
      </div>
      <div className="flex flex-col justify-center text-center">
        <h1 className="text-lg md:text-2xl font-bold text-gray-900 tracking-tight uppercase">
          {COMPANY_NAME}
        </h1>
        <p className="text-sm md:text-base text-gray-700 mt-1">
          Phone:{' '}
          <a href={COMPANY_PHONE_TEL} className="text-green-700 font-semibold underline">
            {COMPANY_PHONE_DISPLAY}
          </a>
        </p>
        <p className="text-sm md:text-base text-gray-700">ID Number: 2622 Alarm Contracting Company</p>
        <p className="text-sm md:text-base text-gray-700">Residential and Commercial</p>
        <p className="text-sm md:text-base text-gray-700">Burglar Alarms · Fire Alarms · CCTV</p>
      </div>
    </div>
  );
}
