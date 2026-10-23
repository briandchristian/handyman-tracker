/**
 * Headings start closed. Opening one lasts for this login on that page.
 * A new login, or a different page, starts that heading closed again.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import SectionToggle from '../SectionToggle';
import { clearSectionToggles } from '../../constants/sectionToggles';

function renderToggle(ui, path = '/customers/c1') {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

function ControlledJob() {
  const [open, setOpen] = useState(false);
  return (
    <SectionToggle title="New job" open={open} onOpenChange={setOpen}>
      <label htmlFor="job-name">Job name</label>
      <input id="job-name" />
    </SectionToggle>
  );
}

describe('SectionToggle', () => {
  beforeEach(() => {
    clearSectionToggles();
  });

  test('starts closed and hides the body until the heading is pressed', async () => {
    const user = userEvent.setup();
    renderToggle(
      <SectionToggle title="Contact">
        <p>john@example.com</p>
      </SectionToggle>
    );

    expect(screen.getByRole('button', { name: 'Contact' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('john@example.com')).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Contact' }));

    expect(screen.getByRole('button', { name: 'Contact' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('john@example.com')).toBeVisible();
  });

  test('keeps an opened heading open when the page is opened again in this login', async () => {
    const user = userEvent.setup();
    const { unmount } = renderToggle(
      <SectionToggle title="Contact">
        <p>john@example.com</p>
      </SectionToggle>
    );

    await user.click(screen.getByRole('button', { name: 'Contact' }));
    unmount();

    renderToggle(
      <SectionToggle title="Contact">
        <p>john@example.com</p>
      </SectionToggle>
    );

    expect(screen.getByRole('button', { name: 'Contact' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('john@example.com')).toBeVisible();
  });

  test('an opened heading on one page stays closed on another page', async () => {
    const user = userEvent.setup();
    const { unmount } = renderToggle(
      <SectionToggle title="Contact">
        <p>john@example.com</p>
      </SectionToggle>,
      '/customers/c1'
    );

    await user.click(screen.getByRole('button', { name: 'Contact' }));
    unmount();

    renderToggle(
      <SectionToggle title="Contact">
        <p>other@example.com</p>
      </SectionToggle>,
      '/accounting'
    );

    expect(screen.getByRole('button', { name: 'Contact' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('other@example.com')).not.toBeVisible();
  });

  test('a new login closes headings that were open', async () => {
    const user = userEvent.setup();
    const { unmount } = renderToggle(
      <SectionToggle title="Contact">
        <p>john@example.com</p>
      </SectionToggle>
    );

    await user.click(screen.getByRole('button', { name: 'Contact' }));
    unmount();
    clearSectionToggles();

    renderToggle(
      <SectionToggle title="Contact">
        <p>john@example.com</p>
      </SectionToggle>
    );

    expect(screen.getByRole('button', { name: 'Contact' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('a closed form opens from its heading and leaves the side action alone', async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    renderToggle(
      <SectionToggle title="New job" actions={<button type="button" onClick={onAction}>Filter</button>}>
        <label htmlFor="job-name">Job name</label>
        <input id="job-name" />
      </SectionToggle>
    );

    expect(screen.queryByLabelText('Job name')).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    expect(onAction).toHaveBeenCalled();
    expect(screen.queryByLabelText('Job name')).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: 'New job' }));
    expect(screen.getByLabelText('Job name')).toBeVisible();
  });

  test('restores a controlled form that was open earlier in this login', async () => {
    const user = userEvent.setup();
    const { unmount } = renderToggle(<ControlledJob />);

    await user.click(screen.getByRole('button', { name: 'New job' }));
    expect(screen.getByLabelText('Job name')).toBeVisible();
    unmount();

    renderToggle(<ControlledJob />);

    expect(screen.getByLabelText('Job name')).toBeVisible();
  });
});
