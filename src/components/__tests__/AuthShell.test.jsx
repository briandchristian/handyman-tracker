import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthShell from '../AuthShell';

describe('AuthShell', () => {
  test('uses the home-page dark slate/emerald hero and a centered column', () => {
    render(
      <MemoryRouter>
        <AuthShell
          eyebrow="Customer portal"
          title="Sign in"
          subtitle="Use the email for your account."
          contentTestId="login-page-main"
        >
          <div data-testid="auth-child">form</div>
        </AuthShell>
      </MemoryRouter>
    );

    expect(screen.getByTestId('auth-shell')).toHaveClass('bg-slate-50');
    expect(screen.getByTestId('auth-hero')).toHaveClass('from-slate-950');
    expect(screen.getByTestId('auth-hero')).toHaveClass('to-emerald-950');
    expect(screen.getByTestId('public-nav')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Customer portal')).toBeInTheDocument();
    expect(screen.getByTestId('login-page-main')).toHaveClass('mx-auto');
    expect(screen.getByTestId('auth-child')).toBeInTheDocument();
  });
});
