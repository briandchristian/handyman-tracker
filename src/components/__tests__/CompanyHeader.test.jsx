import { render, screen } from '@testing-library/react';
import CompanyHeader from '../CompanyHeader';
import { COMPANY_PHONE_TEL } from '../../constants/companyContact';

describe('CompanyHeader', () => {
  test('uses a compact mobile logo and a tappable phone number', () => {
    render(<CompanyHeader />);

    const logo = screen.getByAltText('Christian Security Services Logo');
    expect(logo.className).toMatch(/w-14|h-14/);
    expect(logo.className).toMatch(/md:w-80/);
    expect(screen.getByRole('link', { name: /\(931\) 279-7879/ })).toHaveAttribute(
      'href',
      COMPANY_PHONE_TEL
    );
  });
});
