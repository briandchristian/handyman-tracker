/**
 * Shared company badge.
 * The header size matches the white top bar: a full badge and the uppercase name.
 * The hero size is the large card on the home page. Phone headers do not use this.
 */
import { Link } from 'react-router-dom';
import { COMPANY_NAME } from '../constants/companyContact';

export default function BrandMark({ to = '/', variant = 'header' }) {
  const hero = variant === 'hero';
  return (
    <Link
      to={to}
      data-testid={hero ? undefined : 'brand-lockup'}
      className={
        hero
          ? 'relative block rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm'
          : 'flex shrink-0 items-center gap-2 min-w-0 min-h-[44px]'
      }
    >
      <img
        src="/logo.png"
        alt=""
        className={
          hero
            ? 'mx-auto w-full max-w-sm object-contain drop-shadow-lg'
            : 'h-12 w-12 object-contain flex-shrink-0'
        }
      />
      <span
        className={
          hero
            ? 'mt-6 block text-center text-base font-semibold uppercase tracking-wide text-slate-200'
            : 'whitespace-nowrap text-xs sm:text-sm md:text-base font-bold uppercase leading-tight text-gray-900'
        }
      >
        {COMPANY_NAME}
      </span>
    </Link>
  );
}
