/**
 * Shared public footer. "Your Privacy Choices" sits beside the privacy
 * policy link and opens a dialog. Opting out of targeted data sharing calls
 * updateUserPrivacyPreferences(true), the consent handler in index.html.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicFooter from '../PublicFooter';

function renderFooter() {
  return render(
    <MemoryRouter>
      <PublicFooter />
    </MemoryRouter>
  );
}

describe('PublicFooter', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.updateUserPrivacyPreferences;
  });

  test('places Your Privacy Choices beside the privacy policy link', () => {
    renderFooter();

    const policy = screen.getByRole('link', { name: /privacy policy/i });
    const choices = screen.getByRole('button', { name: /your privacy choices/i });

    expect(policy).toHaveAttribute('href', '/privacy-policy');
    expect(policy.compareDocumentPosition(choices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('opting out of targeted data sharing calls updateUserPrivacyPreferences(true)', () => {
    window.updateUserPrivacyPreferences = jest.fn();
    renderFooter();

    fireEvent.click(screen.getByRole('button', { name: /your privacy choices/i }));

    const dialog = screen.getByRole('dialog', { name: /your privacy choices/i });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /opt out of targeted data sharing/i }));

    expect(window.updateUserPrivacyPreferences).toHaveBeenCalledTimes(1);
    expect(window.updateUserPrivacyPreferences).toHaveBeenCalledWith(true);
    expect(screen.getByText(/opted out of targeted data sharing/i)).toBeInTheDocument();
  });

  test('closes the dialog without changing consent', () => {
    window.updateUserPrivacyPreferences = jest.fn();
    renderFooter();

    fireEvent.click(screen.getByRole('button', { name: /your privacy choices/i }));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.updateUserPrivacyPreferences).not.toHaveBeenCalled();
  });
});
