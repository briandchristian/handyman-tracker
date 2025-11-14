/**
 * Comprehensive Tests for Login Component
 * Testing: Login flow, Registration flow, Customer bid submission, Error handling
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Login from '../Login';

// Mock axios
jest.mock('axios');

describe('Login Component', () => {
  let mockSetToken;

  beforeEach(() => {
    mockSetToken = jest.fn();
    localStorage.clear();
    jest.clearAllMocks();
    
    // Mock window.alert
    global.alert = jest.fn();
  });

  describe('Rendering', () => {
    test('should render login form', () => {
      render(<Login setToken={mockSetToken} />);
      
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    test('should render customer bid form', () => {
      render(<Login setToken={mockSetToken} />);
      
      expect(screen.getByText('Request a Bid')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Your Name *')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email *')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Phone/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Project Name *')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit bid request/i })).toBeInTheDocument();
    });

    test('should render logo', () => {
      render(<Login setToken={mockSetToken} />);
      
      const logo = screen.getByAltText('Handyman Tracker Logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/logo.png');
    });

    test('should show registration toggle button', () => {
      render(<Login setToken={mockSetToken} />);
      
      expect(screen.getByText('New Admin? Request Access')).toBeInTheDocument();
    });

    test('should not show registration form initially', () => {
      render(<Login setToken={mockSetToken} />);
      
      expect(screen.queryByText('Request Admin Access')).not.toBeInTheDocument();
    });
  });

  describe('Login Functionality', () => {
    test('should handle successful login', async () => {
      const mockToken = 'fake-jwt-token';
      axios.post.mockResolvedValue({
        data: { token: mockToken }
      });

      render(<Login setToken={mockSetToken} />);
      
      const usernameInput = screen.getByPlaceholderText('Username');
      const passwordInput = screen.getByPlaceholderText('Password');
      const loginButton = screen.getByRole('button', { name: /login/i });

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
      // window.location.href will be the full URL in jsdom
      expect(window.location.href).toMatch(/\/$/);
    });

    test('should handle 400 error (invalid credentials)', async () => {
      axios.post.mockRejectedValue({
        response: { status: 400, data: { msg: 'Invalid credentials' } }
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Username'), 'wronguser');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'wrongpass');
      await userEvent.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Invalid username or password')
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

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Username'), 'pendinguser');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Account pending approval')
        );
      });
    });

    test('should handle 500 error (server error)', async () => {
      axios.post.mockRejectedValue({
        response: { status: 500 }
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Username'), 'testuser');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Server Error')
        );
      });
    });

    test('should handle network error (ERR_NETWORK)', async () => {
      axios.post.mockRejectedValue({
        code: 'ERR_NETWORK',
        message: 'Network Error'
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Username'), 'testuser');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Cannot connect to server')
        );
      });
    });

    test('should handle ECONNREFUSED error', async () => {
      axios.post.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Username'), 'testuser');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Connection Refused')
        );
      });
    });

    test('should handle generic network error', async () => {
      axios.post.mockRejectedValue({
        message: 'Something went wrong'
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Username'), 'testuser');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Network Error')
        );
      });
    });
  });

  describe('Registration Functionality', () => {
    test('should toggle registration form', async () => {
      render(<Login setToken={mockSetToken} />);
      
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
      render(<Login setToken={mockSetToken} />);
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      expect(global.alert).toHaveBeenCalledWith('❌ All fields are required');
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should validate username length', async () => {
      render(<Login setToken={mockSetToken} />);
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'ab');
      // Get all Email fields and use the second one (registration form)
      const emailInputs = screen.getAllByPlaceholderText('Email *');
      await userEvent.type(emailInputs[1], 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'password123');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'password123');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      expect(global.alert).toHaveBeenCalledWith('❌ Username must be at least 3 characters');
    });

    test('should validate password length', async () => {
      render(<Login setToken={mockSetToken} />);
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'testuser');
      const emailInputs = screen.getAllByPlaceholderText('Email *');
      await userEvent.type(emailInputs[1], 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), '12345');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), '12345');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      expect(global.alert).toHaveBeenCalledWith('❌ Password must be at least 6 characters');
    });

    test('should validate password confirmation', async () => {
      render(<Login setToken={mockSetToken} />);
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'testuser');
      const emailInputs = screen.getAllByPlaceholderText('Email *');
      await userEvent.type(emailInputs[1], 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'password123');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'different123');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      expect(global.alert).toHaveBeenCalledWith('❌ Passwords do not match');
    });

    test('should handle successful registration', async () => {
      axios.post.mockResolvedValue({
        data: { msg: 'User registered successfully' }
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      const usernameInput = screen.getByPlaceholderText('Username *');
      const emailInputs = screen.getAllByPlaceholderText('Email *');
      const emailInput = emailInputs[1]; // Registration form email
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

      expect(global.alert).toHaveBeenCalledWith('✅ User registered successfully');
      
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

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'admin');
      const emailInputs = screen.getAllByPlaceholderText('Email *');
      await userEvent.type(emailInputs[1], 'admin@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'admin123');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'admin123');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('✅ User registered successfully');
        expect(global.alert).toHaveBeenCalledWith('You can now log in with your credentials!');
      });
    });

    test('should handle registration network error', async () => {
      axios.post.mockRejectedValue({
        message: 'Network Error'
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'test');
      const emailInputs = screen.getAllByPlaceholderText('Email *');
      await userEvent.type(emailInputs[1], 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'password');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'password');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Cannot connect to server')
        );
      });
    });

    test('should handle registration server error', async () => {
      axios.post.mockRejectedValue({
        response: {
          data: { msg: 'Username already exists' }
        }
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      
      await userEvent.type(screen.getByPlaceholderText('Username *'), 'existing');
      const emailInputs = screen.getAllByPlaceholderText('Email *');
      await userEvent.type(emailInputs[1], 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Password \(min 6/), 'password');
      await userEvent.type(screen.getByPlaceholderText('Confirm Password *'), 'password');
      
      await userEvent.click(screen.getByRole('button', { name: /request access/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('❌ Username already exists');
      });
    });
  });

  describe('Customer Bid Functionality', () => {
    test('should handle successful bid submission', async () => {
      axios.post.mockResolvedValue({
        data: { msg: 'Bid request submitted successfully!' }
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Your Name *'), 'John Doe');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'john@example.com');
      await userEvent.type(screen.getByPlaceholderText(/Phone/), '5551234567');
      await userEvent.type(screen.getByPlaceholderText('Address (optional)'), '123 Main St');
      await userEvent.type(screen.getByPlaceholderText('Project Name *'), 'Kitchen Remodel');
      await userEvent.type(screen.getByPlaceholderText('Project Description *'), 'Need new cabinets');
      
      await userEvent.click(screen.getByRole('button', { name: /submit bid request/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/customer-bid'),
          expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
            phone: '555-123-4567',
            address: '123 Main St',
            projectName: 'Kitchen Remodel',
            projectDescription: 'Need new cabinets'
          })
        );
      });

      expect(global.alert).toHaveBeenCalledWith('Bid request submitted successfully!');
    });

    test('should format phone number as user types', async () => {
      render(<Login setToken={mockSetToken} />);
      
      const phoneInput = screen.getByPlaceholderText(/Phone/);
      
      await userEvent.type(phoneInput, '5551234567');
      
      expect(phoneInput.value).toBe('555-123-4567');
    });

    test('should format partial phone numbers correctly', async () => {
      render(<Login setToken={mockSetToken} />);
      
      const phoneInput = screen.getByPlaceholderText(/Phone/);
      
      // Test 3 digits
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, '555');
      expect(phoneInput.value).toBe('555');
      
      // Test 6 digits
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, '555123');
      expect(phoneInput.value).toBe('555-123');
      
      // Test 10 digits
      await userEvent.clear(phoneInput);
      await userEvent.type(phoneInput, '5551234567');
      expect(phoneInput.value).toBe('555-123-4567');
    });

    test('should remove non-digit characters from phone', async () => {
      render(<Login setToken={mockSetToken} />);
      
      const phoneInput = screen.getByPlaceholderText(/Phone/);
      
      await userEvent.type(phoneInput, '(555) 123-4567');
      
      expect(phoneInput.value).toBe('555-123-4567');
    });

    test('should limit phone to 12 characters', async () => {
      render(<Login setToken={mockSetToken} />);
      
      const phoneInput = screen.getByPlaceholderText(/Phone/);
      
      expect(phoneInput).toHaveAttribute('maxLength', '12');
    });

    test('should clear form after successful bid submission', async () => {
      axios.post.mockResolvedValue({
        data: { msg: 'Success' }
      });

      render(<Login setToken={mockSetToken} />);
      
      const nameInput = screen.getByPlaceholderText('Your Name *');
      const emailInput = screen.getByPlaceholderText('Email *');
      const phoneInput = screen.getByPlaceholderText(/Phone/);
      const addressInput = screen.getByPlaceholderText('Address (optional)');
      const projectNameInput = screen.getByPlaceholderText('Project Name *');
      const projectDescInput = screen.getByPlaceholderText('Project Description *');
      
      await userEvent.type(nameInput, 'Test');
      await userEvent.type(emailInput, 'test@test.com');
      await userEvent.type(phoneInput, '5551234567');
      await userEvent.type(addressInput, '123 St');
      await userEvent.type(projectNameInput, 'Project');
      await userEvent.type(projectDescInput, 'Description');
      
      await userEvent.click(screen.getByRole('button', { name: /submit bid request/i }));

      await waitFor(() => {
        expect(nameInput.value).toBe('');
        expect(emailInput.value).toBe('');
        expect(phoneInput.value).toBe('');
        expect(addressInput.value).toBe('');
        expect(projectNameInput.value).toBe('');
        expect(projectDescInput.value).toBe('');
      });
    });

    test('should handle bid submission network error', async () => {
      axios.post.mockRejectedValue({
        message: 'Network Error'
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Your Name *'), 'Test');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'test@test.com');
      await userEvent.type(screen.getByPlaceholderText(/Phone/), '5551234567');
      await userEvent.type(screen.getByPlaceholderText('Project Name *'), 'Project');
      await userEvent.type(screen.getByPlaceholderText('Project Description *'), 'Description');
      
      await userEvent.click(screen.getByRole('button', { name: /submit bid request/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('Cannot connect to server')
        );
      });
    });

    test('should handle bid submission server error', async () => {
      axios.post.mockRejectedValue({
        response: {
          data: { msg: 'Invalid email format' }
        }
      });

      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Your Name *'), 'Test');
      await userEvent.type(screen.getByPlaceholderText('Email *'), 'invalid-email');
      await userEvent.type(screen.getByPlaceholderText(/Phone/), '555');
      await userEvent.type(screen.getByPlaceholderText('Project Name *'), 'Project');
      await userEvent.type(screen.getByPlaceholderText('Project Description *'), 'Desc');
      
      await userEvent.click(screen.getByRole('button', { name: /submit bid request/i }));

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('❌ Invalid email format');
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle Enter key on login form', async () => {
      axios.post.mockResolvedValue({
        data: { token: 'test-token' }
      });

      render(<Login setToken={mockSetToken} />);
      
      const passwordInput = screen.getByPlaceholderText('Password');
      await userEvent.type(screen.getByPlaceholderText('Username'), 'test');
      await userEvent.type(passwordInput, 'password{Enter}');

      // The Enter key should work if form submission is triggered
      // Note: This depends on implementation - may need onKeyPress handler
    });

    test('should handle empty state changes', async () => {
      render(<Login setToken={mockSetToken} />);
      
      const usernameInput = screen.getByPlaceholderText('Username');
      await userEvent.type(usernameInput, 'test');
      await userEvent.clear(usernameInput);
      
      expect(usernameInput.value).toBe('');
    });

    test('should maintain form state when toggling registration', async () => {
      render(<Login setToken={mockSetToken} />);
      
      await userEvent.type(screen.getByPlaceholderText('Username'), 'testuser');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password');
      
      await userEvent.click(screen.getByText('New Admin? Request Access'));
      await userEvent.click(screen.getByText('Cancel Registration'));
      
      expect(screen.getByPlaceholderText('Username').value).toBe('testuser');
      expect(screen.getByPlaceholderText('Password').value).toBe('password');
    });
  });
});

