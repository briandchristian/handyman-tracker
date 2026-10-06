/**
 * Route changes should open at the top of the page.
 * A phone visitor taps a homepage card after scrolling down. Without this,
 * the next page keeps that scroll distance and lands on the bid buttons.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import ScrollToTop from '../ScrollToTop';

function GoToService() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/services/burglar-alarms')}>
      Open burglar alarms
    </button>
  );
}

describe('ScrollToTop', () => {
  test('scrolls to the top when the path changes', async () => {
    const scrollTo = jest.fn();
    window.scrollTo = scrollTo;
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<GoToService />} />
          <Route path="/services/burglar-alarms" element={<h1>Burglar alarm installation</h1>} />
        </Routes>
      </MemoryRouter>
    );

    scrollTo.mockClear();
    await user.click(screen.getByRole('button', { name: /open burglar alarms/i }));

    expect(screen.getByRole('heading', { name: /burglar alarm installation/i })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
