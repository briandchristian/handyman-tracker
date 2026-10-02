/**
 * Staff page for who receives an email when Request a Bid is submitted.
 * The list can hold several addresses. Each address can be edited or removed,
 * and new ones can be added. SMTP credentials are not shown or saved here.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import BidAlertSettings from '../BidAlertSettings';

jest.mock('axios');

const renderPage = () =>
  render(
    <MemoryRouter>
      <BidAlertSettings />
    </MemoryRouter>
  );

describe('BidAlertSettings', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
  });

  test('loads the saved addresses and warns when SMTP is not configured', async () => {
    axios.get.mockResolvedValue({
      data: { recipients: ['office@example.com', 'boss@example.com'], smtpConfigured: false },
    });

    renderPage();

    expect(await screen.findByDisplayValue('office@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('boss@example.com')).toBeInTheDocument();
    expect(screen.getByText(/smtp is not configured/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/bid-alerts'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
      })
    );
  });

  test('says email sending is configured when the server has SMTP', async () => {
    axios.get.mockResolvedValue({
      data: { recipients: ['office@example.com'], smtpConfigured: true },
    });

    renderPage();

    expect(await screen.findByText(/email sending is configured/i)).toBeInTheDocument();
  });

  test('saves an added address and a changed address', async () => {
    axios.get.mockResolvedValue({
      data: { recipients: ['old@example.com'], smtpConfigured: true },
    });
    axios.put.mockResolvedValue({
      data: {
        recipients: ['new@example.com', 'second@example.com'],
        smtpConfigured: true,
        msg: 'Bid alert emails saved.',
      },
    });

    const user = userEvent.setup();
    renderPage();

    const first = await screen.findByLabelText('Notification email 1');
    await user.clear(first);
    await user.type(first, 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Add email' }));
    await user.type(screen.getByLabelText('Notification email 2'), 'second@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings/bid-alerts'),
        { recipients: ['new@example.com', 'second@example.com'] },
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });
    expect(await screen.findByText('Bid alert emails saved.')).toBeInTheDocument();
  });

  test('removes an address and saves the rest', async () => {
    axios.get.mockResolvedValue({
      data: {
        recipients: ['keep@example.com', 'drop@example.com'],
        smtpConfigured: true,
      },
    });
    axios.put.mockResolvedValue({
      data: { recipients: ['keep@example.com'], smtpConfigured: true, msg: 'Bid alert emails saved.' },
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('drop@example.com');
    await user.click(screen.getByRole('button', { name: 'Remove notification email 2' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings/bid-alerts'),
        { recipients: ['keep@example.com'] },
        expect.any(Object)
      );
    });
  });

  test('does not save an invalid address', async () => {
    axios.get.mockResolvedValue({
      data: { recipients: [], smtpConfigured: false },
    });

    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByLabelText('Notification email 1');
    await user.type(input, 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(axios.put).not.toHaveBeenCalled();
  });

  test('shows the server error when saving fails', async () => {
    axios.get.mockResolvedValue({
      data: { recipients: ['office@example.com'], smtpConfigured: true },
    });
    axios.put.mockRejectedValue({
      response: { data: { msg: 'You can save at most 25 notification emails.' } },
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('office@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('You can save at most 25 notification emails.')
    ).toBeInTheDocument();
  });

  test('lists each sent email under the address form', async () => {
    axios.get.mockResolvedValue({
      data: {
        recipients: ['office@example.com'],
        smtpConfigured: true,
        sent: [
          {
            id: 'sent-1',
            sentAt: '2026-10-02T19:00:00.000Z',
            recipients: ['office@example.com', 'boss@example.com'],
            subject: 'New bid request: Camera install — Jane Doe',
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '555-0100',
            address: '10 Main St',
            projectName: 'Camera install',
            projectDescription: 'Four outdoor cameras',
          },
        ],
      },
    });

    renderPage();

    const configure = await screen.findByRole('heading', { name: 'Notification addresses' });
    const sent = screen.getByRole('list', { name: 'Sent emails' });
    expect(configure.compareDocumentPosition(sent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sent).toHaveTextContent('Jane Doe');
    expect(sent).toHaveTextContent('Camera install');
    expect(sent).toHaveTextContent('jane@example.com');
    expect(sent).toHaveTextContent('555-0100');
    expect(sent).toHaveTextContent('10 Main St');
    expect(sent).toHaveTextContent('Four outdoor cameras');
    expect(sent).toHaveTextContent('office@example.com');
    expect(sent).toHaveTextContent('boss@example.com');
  });

  test('says when no alert email has been sent', async () => {
    axios.get.mockResolvedValue({
      data: { recipients: ['office@example.com'], smtpConfigured: true, sent: [] },
    });

    renderPage();

    expect(await screen.findByText(/no bid alert emails have been sent/i)).toBeInTheDocument();
  });

  test('deletes only the selected sent emails with one Delete button', async () => {
    axios.get.mockResolvedValue({
      data: {
        recipients: ['office@example.com'],
        smtpConfigured: true,
        sent: [
          {
            id: 'sent-1',
            sentAt: '2026-10-02T19:00:00.000Z',
            recipients: ['office@example.com'],
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '555-0100',
            address: '10 Main St',
            projectName: 'Camera install',
            projectDescription: 'Four outdoor cameras',
          },
          {
            id: 'sent-2',
            sentAt: '2026-10-02T18:00:00.000Z',
            recipients: ['office@example.com'],
            name: 'Sam Lee',
            email: 'sam@example.com',
            phone: '555-0199',
            address: '2 Oak Ave',
            projectName: 'Gate repair',
            projectDescription: 'Replace the latch',
          },
        ],
      },
    });
    axios.delete.mockResolvedValue({
      data: {
        sent: [
          {
            id: 'sent-2',
            sentAt: '2026-10-02T18:00:00.000Z',
            recipients: ['office@example.com'],
            name: 'Sam Lee',
            email: 'sam@example.com',
            phone: '555-0199',
            address: '2 Oak Ave',
            projectName: 'Gate repair',
            projectDescription: 'Replace the latch',
          },
        ],
        msg: 'Sent email deleted.',
      },
    });

    const user = userEvent.setup();
    renderPage();

    const deleteButton = await screen.findByRole('button', { name: 'Delete' });
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
    expect(deleteButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Select Jane Doe, Camera install' }));
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings/bid-alerts/sent'),
        expect.objectContaining({
          data: { ids: ['sent-1'] },
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sam Lee/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('office@example.com')).toBeInTheDocument();
    expect(await screen.findByText('Sent email deleted.')).toBeInTheDocument();
  });

  test('exports the sent emails as a csv file', async () => {
    axios.get.mockResolvedValue({
      data: {
        recipients: ['office@example.com'],
        smtpConfigured: true,
        sent: [
          {
            id: 'sent-1',
            sentAt: '2026-10-02T19:00:00.000Z',
            recipients: ['office@example.com'],
            subject: 'New bid request: Camera install — Jane Doe',
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '555-0100',
            address: '10 Main St',
            projectName: 'Camera install',
            projectDescription: 'Four outdoor cameras',
          },
        ],
      },
    });

    const createObjectURL = jest.fn(() => 'blob:bid-alerts');
    const revokeObjectURL = jest.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;
    const sources = [];
    const RealBlob = window.Blob;
    window.Blob = function BlobSpy(parts, options) {
      sources.push(parts);
      return new RealBlob(parts, options);
    };
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toContain('text/csv');
    const text = sources[0][0];
    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@example.com');
    expect(text).toContain('Four outdoor cameras');
    expect(click).toHaveBeenCalled();
    const link = click.mock.instances[0];
    expect(link.download).toBe('bid-alert-emails.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:bid-alerts');

    click.mockRestore();
    window.Blob = RealBlob;
  });

  test('shows an error when the list cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('network'));

    renderPage();

    expect(await screen.findByText(/failed to load bid alert emails/i)).toBeInTheDocument();
  });
});
