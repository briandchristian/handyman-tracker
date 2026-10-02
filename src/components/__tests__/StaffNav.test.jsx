/**
 * Desktop staff bar. Daily sections stay visible. Occasional tools sit under More
 * so the bar stays one row on a PC. Every destination uses the same outlined
 * button as the Dashboard link on Bid alert emails.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StaffNav from '../StaffNav';

function renderBar(path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StaffNav />
    </MemoryRouter>
  );
}

describe('StaffNav', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('userRole', 'admin');
  });

  test('shows daily sections and hides occasional tools until More is opened', async () => {
    const user = userEvent.setup();
    renderBar();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute('href', '/customers');
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute('href', '/inventory');
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/purchase-orders');
    expect(screen.getByRole('link', { name: 'Accounting' })).toHaveAttribute('href', '/accounting');
    expect(screen.queryByRole('link', { name: 'Bid alerts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Part price' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByRole('link', { name: 'Bid alerts' })).toHaveAttribute('href', '/admin/bid-alerts');
    expect(screen.getByRole('link', { name: 'Part price' })).toHaveAttribute('href', '/inventory#adi-price');
    expect(screen.getByRole('link', { name: 'Suppliers' })).toHaveAttribute('href', '/suppliers');
    expect(screen.getByRole('link', { name: 'Subcontractor' })).toHaveAttribute('href', '/subcontractor');
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/installation-history');
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
  });

  test('uses the outlined Dashboard button style for every destination', async () => {
    const user = userEvent.setup();
    renderBar('/customers');

    const customers = screen.getByRole('link', { name: 'Customers' });
    expect(customers.className).toContain('btn-secondary');
    expect(customers).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('link', { name: 'Bid alerts' }).className).toContain('btn-secondary');
  });

  test('marks More when the current page lives in that menu', () => {
    renderBar('/admin/bid-alerts');
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page');
  });

  test('logout clears the session', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userRole')).toBeNull();
  });

  test('closes More when a destination is chosen', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('link', { name: 'Users' }));

    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  test('closes More when the click is outside the menu', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('link', { name: 'Suppliers' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('link', { name: 'Suppliers' })).not.toBeInTheDocument();
  });
});
