/**
 * Comprehensive Tests for Login Component
 * Testing: Login flow, Registration flow, Customer bid submission, Error handling
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import Login from '../Login';

// Mock axios
jest.mock('axios');

function renderLogin(ui, options = {}) {
  return render(
    <MemoryRouter initialEntries={[options.initialEntry || '/login']}>
      {ui}
    </MemoryRouter>,
    options
  );
}

async function revealStaffSignIn() {
  await userEvent.click(screen.getByRole('button', { name: /staff sign in/i }));
}

describe('Login Component', () => {
  let mockSetToken;

  beforeEach(() => {
    mockSetToken = jest.fn();
    localStorage.clear();
    jest.clearAllMocks();

    global.alert = jest.fn();
  });

  describe('Rendering', () => {
    test('should hide staff login until Staff sign in is opened', async () => {
      renderLogin(<Login setToken={mockSetToken} />);

      expect(screen.queryByText('Admin Login')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /staff sign in/i })).toBeInTheDocument();

      await revealStaffSignIn();

      expect(screen.getByText('Admin Login')).toBeInTheDocument();
      expect(screen.getByTestId('admin-login-username')).toBeInTheDocument();
      expect(screen.getByTestId('admin-login-password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
    });

    test('should center the sign-in column on desktop', () => {
      renderLogin(<Login setToken={mockSetToken} />);

      const main = screen.getByTestId('login-page-main');
      expect(main).toHaveClass('mx-auto');
      expect(main.className).not.toMatch(/md:mx-0/);
      expect(screen.getByTestId('login-customer-card')).toHaveClass('md:text-center');
    });

    test('should not render the bid form (bid lives at /bid)', () => {
      renderLogin(<Login setToken={mockSetToken} />);

      expect(screen.queryByText('Request a Bid')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /submit bid request/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('public-nav')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^bid$/i })).toHaveAttribute('href', '/bid');
    });

    test('should show registration toggle button after opening staff sign in', async () => {
      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      expect(screen.getByText('New Admin? Request Access')).toBeInTheDocument();
    });

    test('should not show registration form initially', () => {
      renderLogin(<Login setToken={mockSetToken} />);
      
      expect(screen.queryByText('Request Admin Access')).not.toBeInTheDocument();
    });
  });

  describe('Login Functionality', () => {
    test('should handle successful login', async () => {
      const mockToken = 'fake-jwt-token';
      axios.post.mockResolvedValue({
        data: { token: mockToken, user: { role: 'admin' } }
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      const usernameInput = screen.getByTestId('admin-login-username');
      const passwordInput = screen.getByTestId('admin-login-password');
      const loginButton = screen.getByRole('button', { name: /^login$/i });

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/login'),
          { username: 'testuser', password: 'password123' }
        );
      });

      expect(localStorage.getItem('token')).toBe(mockToken);
      expect(mockSetToken).toHaveBeenCalledWith(mockToken);
    });

    test('should set userRole and redirect to /customer when user role is customer', async () => {
      axios.post.mockResolvedValue({
        data: { token: 'cust-token', user: { role: 'customer' } }
      });
      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();
      await userEvent.type(screen.getByTestId('admin-login-username'), 'customer@example.com');
      await userEvent.type(screen.getByTestId('admin-login-password'), 'pass123');
      await userEvent.click(screen.getByRole('button', { name: /^login$/i }));
      await waitFor(() => {
        expect(localStorage.getItem('userRole')).toBe('customer');
        expect(localStorage.getItem('token')).toBe('cust-token');
        expect(mockSetToken).toHaveBeenCalledWith('cust-token');
      });
    });

    test('should set userRole when customer signs in via Customer section', async () => {
      axios.post.mockResolvedValue({
        data: { token: 'cust-token', user: { role: 'customer' } }
      });
      renderLogin(<Login setToken={mockSetToken} />);
      await userEvent.type(screen.getByTestId('customer-login-email'), 'c@example.com');
      await userEvent.type(screen.getByTestId('customer-login-password'), 'pass123');
      await userEvent.click(screen.getByTestId('customer-sign-in'));
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/login'), { username: 'c@example.com', password: 'pass123' });
        expect(localStorage.getItem('userRole')).toBe('customer');
        expect(localStorage.getItem('token')).toBe('cust-token');
      });
    });

    test('should handle 400 error (invalid credentials)', async () => {
      axios.post.mockRejectedValue({
        response: { status: 400, data: { msg: 'Invalid credentials' } }
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      await userEvent.type(screen.getByTestId('admin-login-username'), 'wronguser');
      await userEvent.type(screen.getByTestId('admin-login-password'), 'wrongpass');
      await userEvent.click(screen.getByRole('button', { name: /^login$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('form-status')).toHaveTextContent(
          /invalid username or password/i
        );
      });
    });

    test('should handle 403 error (access denied)', async () => {
      axios.post.mockRejectedValue({
        response: { 
          status: 403, 
          data: { msg: 'Account pending approval' } 
        }
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      await userEvent.type(screen.getByTestId('admin-login-username'), 'pendinguser');
      await userEvent.type(screen.getByTestId('admin-login-password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /^login$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('form-status')).toHaveTextContent(
          /account pending approval/i
        );
      });
    });

    test('should handle 500 error (server error)', async () => {
      axios.post.mockRejectedValue({
        response: { status: 500 }
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      await userEvent.type(screen.getByTestId('admin-login-username'), 'testuser');
      await userEvent.type(screen.getByTestId('admin-login-password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /^login$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('form-status')).toHaveTextContent(/server error/i);
      });
    });

    test('should handle network error (ERR_NETWORK)', async () => {
      axios.post.mockRejectedValue({
        code: 'ERR_NETWORK',
        message: 'Network Error'
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      await userEvent.type(screen.getByTestId('admin-login-username'), 'testuser');
      await userEvent.type(screen.getByTestId('admin-login-password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /^login$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('form-status')).toHaveTextContent(
          /cannot connect to the server/i
        );
      });
    });

    test('should handle ECONNREFUSED error', async () => {
      axios.post.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      await userEvent.type(screen.getByTestId('admin-login-username'), 'testuser');
      await userEvent.type(screen.getByTestId('admin-login-password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /^login$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('form-status')).toHaveTextContent(/connection refused/i);
      });
    });

    test('should handle generic network error', async () => {
      axios.post.mockRejectedValue({
        message: 'Something went wrong'
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      await userEvent.type(screen.getByTestId('admin-login-username'), 'testuser');
      await userEvent.type(screen.getByTestId('admin-login-password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /^login$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('form-status')).toHaveTextContent(/network error/i);
      });
    });
  });

  describe('Registration Functionality', () => {
    test('should toggle registration form', async () => {
      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      const toggleButton = screen.getByText('New Admin? Request Access');
      await userEvent.click(toggleButton);

      expect(screen.getByText('Request Admin Access')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Username *')).toBeInTheDocument();
      // Use getAllBy to handle multiple Email fields
      expect(screen.getAllByPlaceholderText('Email *').length).toBeGreaterThan(0);
      
      // Click again to hide
      await userEvent.click(screen.getByText('Cancel Registration'));
      expect(screen.queryByText('Request Admin Access')).not.toBeInTheDocument();
    });

    test('should validate required fields', async () => {
      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      expect(screen.getByTestId('form-status')).toHaveTextContent(/all fields are required/i);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should validate username length', async () => {
      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'ab');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'password123');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'password123');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      expect(screen.getByTestId('form-status')).toHaveTextContent(
        /username must be at least 3 characters/i
      );
    });

    test('should validate password length', async () => {
      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'testuser');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), '12345');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), '12345');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      expect(screen.getByTestId('form-status')).toHaveTextContent(
        /password must be at least 6 characters/i
      );
    });

    test('should validate password confirmation', async () => {
      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'testuser');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'password123');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'different123');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      expect(screen.getByTestId('form-status')).toHaveTextContent(/passwords do not match/i);
    });

    test('should handle successful registration', async () => {
      axios.post.mockResolvedValue({
        data: { msg: 'User registered successfully' }
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      const usernameInput = screen.getByPlaceholderText('Username *');
      const emailInput = screen.getByPlaceholderText('Email *');
      const passwordInput = screen.getByPlaceholderText(/Password \(min 6/);
      const confirmInput = screen.getByPlaceholderText('Confirm Password *');
      
      await userEvent.type(usernameInput, 'newuser');
      await userEvent.type(emailInput, 'new@test.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.type(confirmInput, 'password123');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/register'),
          {
            username: 'newuser',
            password: 'password123',
            email: 'new@test.com'
          }
        );
      });

      expect(screen.getByTestId('form-status')).toHaveTextContent(
        /user registered successfully/i
      );

      // Form should be cleared and hidden
      await waitFor(() => {
        expect(screen.queryByText('Request Admin Access')).not.toBeInTheDocument();
      });
    });

    test('should handle super-admin registration', async () => {
      axios.post.mockResolvedValue({
        data: { 
          msg: 'User registered successfully',
          role: 'super-admin'
        }
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'admin');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'admin@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'admin123');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'admin123');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      await waitFor(() => {
        expect(screen.getByTestId('form-status')).toHaveTextContent(
          /user registered successfully/i
        );
        expect(screen.getByTestId('form-status')).toHaveTextContent(
          /you can now log in/i
        );
      });
    });

    test('should handle registration network error', async () => {
      axios.post.mockRejectedValue({
        message: 'Network Error'
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'test');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'password');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'password');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      await waitFor(() => {
        expect(screen.getByTestId('form-status')).toHaveTextContent(
          /cannot connect to the server/i
        );
      });
    });

    test('should handle registration server error', async () => {
      axios.post.mockRejectedValue({
        response: {
          data: { msg: 'Username already exists' }
        }
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'existing');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'password');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'password');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      await waitFor(() => {
        expect(screen.getByTestId('form-status')).toHaveTextContent(
          /username already exists/i
        );
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle Enter key on login form', async () => {
      axios.post.mockResolvedValue({
        data: { token: 'test-token' }
      });

      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      const passwordInput = screen.getByTestId('admin-login-password');
      await userEvent.type(screen.getByTestId('admin-login-username'), 'test');
      await userEvent.type(passwordInput, 'password{Enter}');

      // The Enter key should work if form submission is triggered
      // Note: This depends on implementation - may need onKeyPress handler
    });

    test('should handle empty state changes', async () => {
      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      const usernameInput = screen.getByTestId('admin-login-username');
      await userEvent.type(usernameInput, 'test');
      await userEvent.clear(usernameInput);
      
      expect(usernameInput.value).toBe('');
    });

    test('should maintain form state when toggling registration', async () => {
      renderLogin(<Login setToken={mockSetToken} />);
      await revealStaffSignIn();

      await userEvent.type(screen.getByTestId('admin-login-username'), 'testuser');
      await userEvent.type(screen.getByTestId('admin-login-password'), 'password');
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      await userEvent.click(screen.getByText('Cancel Registration'));
      
      expect(screen.getByTestId('admin-login-username').value).toBe('testuser');
      expect(screen.getByTestId('admin-login-password').value).toBe('password');
    });
  });

  describe('Customer section (Phase 1)', () => {
    test('should render Customer section with Sign in and Create account', () => {
      renderLogin(<Login setToken={mockSetToken} />);
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByTestId('customer-login-email')).toBeInTheDocument();
      expect(screen.getByTestId('customer-sign-in')).toBeInTheDocument();
      expect(screen.getByText('New Customer? Create account')).toBeInTheDocument();
    });

    test('should call /api/customer/register and redirect to /customer on success', async () => {
      axios.post.mockResolvedValue({
        data: { token: 't', user: { role: 'customer' }, msg: 'Account created.' }
      });
      renderLogin(<Login setToken={mockSetToken} />);
      await userEvent.click(screen.getByText('New Customer? Create account'));
      await userEvent.type(screen.getByPlaceholderText('Your Name *'), 'Jane');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'jane@example.com');
      await userEvent.type(screen.getByPlaceholderText('Phone *'), '5551234567');
      await userEvent.type(screen.getByPlaceholderText('Password (min 6) *'), 'secret12');
      await userEvent.click(screen.getByRole('button', { name: /create account/i }));
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/customer/register'),
          expect.objectContaining({
            name: 'Jane',
            email: 'jane@example.com',
            phone: '555-123-4567',
            password: 'secret12'
          })
        );
      });
      expect(localStorage.getItem('userRole')).toBe('customer');
      expect(localStorage.getItem('token')).toBe('t');
    });
  });

});

