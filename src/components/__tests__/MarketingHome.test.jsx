import { render, screen } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';

import MarketingHome from '../MarketingHome';

import { COMPANY_PHONE_TEL } from '../../constants/companyContact';



describe('MarketingHome', () => {

  test('renders a short phone-first landing with public nav and primary CTAs', () => {

    render(

      <MemoryRouter>

        <MarketingHome />

      </MemoryRouter>

    );



    expect(screen.getByTestId('public-nav')).toBeInTheDocument();

    expect(

      screen.getByRole('heading', { name: /security you can trust in tennessee/i })

    ).toBeInTheDocument();



    const bidCtas = screen.getAllByRole('link', { name: /request a bid/i });

    expect(bidCtas.some((el) => el.getAttribute('href') === '/bid')).toBe(true);



    expect(screen.getAllByRole('link', { name: /^sign in$/i }).length).toBeGreaterThan(0);

    const callLinks = screen.getAllByRole('link', { name: /call/i });

    expect(callLinks.some((el) => el.getAttribute('href') === COMPANY_PHONE_TEL)).toBe(

      true

    );

    expect(screen.getAllByText(/2622 Alarm Contracting Company/i).length).toBeGreaterThan(0);

    expect(screen.getAllByText('Burglar alarms').length).toBeGreaterThan(0);

    expect(screen.getAllByText('Fire alarms').length).toBeGreaterThan(0);

    expect(screen.getAllByText('CCTV & monitoring').length).toBeGreaterThan(0);

  });



  test('uses a two-column hero on desktop with a large logo', () => {

    render(

      <MemoryRouter>

        <MarketingHome />

      </MemoryRouter>

    );



    expect(screen.getByTestId('marketing-hero')).toHaveClass('md:grid-cols-2');

    const desktopLogo = screen.getByTestId('desktop-hero-logo');

    expect(desktopLogo).toHaveClass('hidden');

    expect(desktopLogo).toHaveClass('md:block');

  });



  test('highlights all four core service lines with a dedicated services section', () => {

    render(

      <MemoryRouter>

        <MarketingHome />

      </MemoryRouter>

    );



    expect(screen.getByTestId('marketing-services')).toBeInTheDocument();

    expect(

      screen.getByRole('heading', { name: /complete security for homes & businesses/i })

    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: /^access control$/i })
    ).toBeInTheDocument();

  });



  test('centers page content from md breakpoint up while hero copy stays left on phone', () => {
    render(
      <MemoryRouter>
        <MarketingHome />
      </MemoryRouter>
    );

    const heroCopy = screen.getByTestId('marketing-hero-copy');
    expect(heroCopy).toHaveClass('text-left');
    expect(heroCopy).toHaveClass('md:text-center');

    expect(screen.getByTestId('marketing-page')).toHaveClass('w-full');
  });

  test('includes trust signals and a closing call-to-action band', () => {

    render(

      <MemoryRouter>

        <MarketingHome />

      </MemoryRouter>

    );



    expect(screen.getByTestId('marketing-trust')).toBeInTheDocument();

    expect(screen.getByTestId('marketing-cta-band')).toBeInTheDocument();

    expect(screen.getAllByText(/licensed alarm contracting/i).length).toBeGreaterThan(0);

  });

});



