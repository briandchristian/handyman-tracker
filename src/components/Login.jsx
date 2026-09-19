import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import { formatPhoneNumber } from '../utils/phoneFormat';
import PublicNav from './PublicNav';
import FormStatus from './FormStatus';

/**
 * Sign-in hub at /login — customer first; staff login is collapsed.
 * Errors and registration results render inline (no window.alert).
 */
export default function Login({ setToken }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [status, setStatus] = useState({ message: '', tone: 'error' });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (searchParams.get('session_expired') === '1') {
      setShowSessionExpired(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [showCustomerRegister, setShowCustomerRegister] = useState(false);
  const [customerLoginEmail, setCustomerLoginEmail] = useState('');
  const [customerLoginPassword, setCustomerLoginPassword] = useState('');
  const [custRegName, setCustRegName] = useState('');
  const [custRegEmail, setCustRegEmail] = useState('');
  const [custRegPhone, setCustRegPhone] = useState('');
  const [custRegAddress, setCustRegAddress] = useState('');
  const [custRegProjectName, setCustRegProjectName] = useState('');
  const [custRegProjectDesc, setCustRegProjectDesc] = useState('');
  const [custRegPassword, setCustRegPassword] = useState('');

  const showError = (message) => setStatus({ message, tone: 'error' });
  const showSuccess = (message) => setStatus({ message, tone: 'success' });

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/login`, { username, password });
      localStorage.setItem('token', res.data.token);
      if (res.data.user?.role) localStorage.setItem('userRole', res.data.user.role);
      setToken(res.data.token);
      window.location.href =
        res.data.user?.role === 'customer' ? '/customer' : '/dashboard';
    } catch (err) {
      if (!err.response) {
        if (err.code === 'ERR_NETWORK' || err.message.includes('Network Error')) {
          showError(
            'Cannot connect to the server. Check that the API is running, or use http://localhost:5174 when the backend is on this machine.'
          );
        } else if (err.code === 'ECONNREFUSED') {
          showError('Connection refused. Check if the backend server is running.');
        } else {
          showError(`Network error. ${err.message}`);
        }
      } else if (err.response.status === 400) {
        showError('Invalid username or password.');
      } else if (err.response.status === 403) {
        showError(err.response?.data?.msg || 'Your account requires approval.');
      } else if (err.response.status === 500) {
        showError('Server error. Please try again later.');
      } else {
        showError(err.response?.data?.msg || err.message);
      }
      console.error('Login error details:', {
        code: err.code,
        message: err.message,
        response: err.response,
        config: { url: err.config?.url, method: err.config?.method },
      });
    }
  };

  const handleRegister = async () => {
    if (!regUsername || !regPassword || !regEmail) {
      showError('All fields are required');
      return;
    }
    if (regUsername.length < 3) {
      showError('Username must be at least 3 characters');
      return;
    }
    if (regPassword.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      showError('Passwords do not match');
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/register`, {
        username: regUsername,
        password: regPassword,
        email: regEmail,
      });

      setRegUsername('');
      setRegPassword('');
      setRegEmail('');
      setRegConfirmPassword('');
      setShowRegister(false);

      if (res.data.role === 'super-admin') {
        showSuccess(`${res.data.msg} You can now log in with your credentials!`);
      } else {
        showSuccess(res.data.msg);
      }
    } catch (err) {
      if (!err.response) {
        showError('Cannot connect to the server. Please check your internet connection.');
      } else {
        showError(err.response?.data?.msg || 'Failed to register');
      }
      console.error('Registration error:', err);
    }
  };

  const handleCustomerLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/login`, {
        username: customerLoginEmail,
        password: customerLoginPassword,
      });
      localStorage.setItem('token', res.data.token);
      if (res.data.user?.role) localStorage.setItem('userRole', res.data.user.role);
      setToken(res.data.token);
      window.location.href = '/customer';
    } catch (err) {
      if (!err.response) {
        showError('Cannot connect to the server. Check your connection or try again.');
        return;
      }
      if (err.response.status === 400) showError('Invalid email or password.');
      else if (err.response.status === 403) {
        showError(err.response?.data?.msg || 'Access denied.');
      } else showError(err.response?.data?.msg || 'Login failed.');
    }
  };

  const handleCustomerRegister = async () => {
    if (!custRegName || !custRegEmail || !custRegPhone || !custRegPassword) {
      showError('Name, email, phone, and password are required');
      return;
    }
    if (custRegPassword.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE_URL}/api/customer/register`, {
        name: custRegName,
        email: custRegEmail,
        phone: custRegPhone,
        address: custRegAddress,
        projectName: custRegProjectName || undefined,
        projectDescription: custRegProjectDesc || undefined,
        password: custRegPassword,
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userRole', 'customer');
      setToken(res.data.token);
      window.location.href = '/customer';
    } catch (err) {
      showError(err.response?.data?.msg || 'Registration failed.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <PublicNav />
      <div
        data-testid="login-page-main"
        className="p-4 md:p-8 max-w-[500px] mx-auto w-full"
      >
        <FormStatus message={status.message} tone={status.tone} />

        {!showStaff && (
          <div
            data-testid="login-customer-card"
            className="p-4 md:p-6 bg-white rounded-lg shadow text-black text-left md:text-center"
          >
            <h2 className="text-xl md:text-2xl font-bold mb-2 text-gray-800">Customer</h2>
            <p className="text-gray-600 mb-4 text-base md:text-sm">
              Have an account? Sign in. New? Create an account.
            </p>
            {!showCustomerRegister ? (
              <div className="text-left">
                <input
                  type="email"
                  placeholder="Your email"
                  value={customerLoginEmail}
                  onChange={(e) => setCustomerLoginEmail(e.target.value)}
                  className="block mb-3 md:mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                  data-testid="customer-login-email"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={customerLoginPassword}
                  onChange={(e) => setCustomerLoginPassword(e.target.value)}
                  className="block mb-3 md:mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                  data-testid="customer-login-password"
                />
                <button
                  type="button"
                  onClick={handleCustomerLogin}
                  data-testid="customer-sign-in"
                  className="bg-teal-500 text-white p-4 md:p-2 rounded w-full hover:bg-teal-600 font-medium text-base md:text-sm min-h-[48px]"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomerRegister(true)}
                  className="text-teal-600 hover:text-teal-800 mt-2 text-base md:text-sm underline py-2"
                >
                  New Customer? Create account
                </button>
              </div>
            ) : (
              <div className="text-left">
                <input
                  placeholder="Your Name *"
                  value={custRegName}
                  onChange={(e) => setCustRegName(e.target.value)}
                  className="block mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={custRegEmail}
                  onChange={(e) => setCustRegEmail(e.target.value)}
                  className="block mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone *"
                  value={custRegPhone}
                  onChange={(e) => setCustRegPhone(formatPhoneNumber(e.target.value))}
                  maxLength={12}
                  className="block mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                />
                <input
                  placeholder="Address (optional)"
                  value={custRegAddress}
                  onChange={(e) => setCustRegAddress(e.target.value)}
                  className="block mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                />
                <input
                  placeholder="Project Name (optional)"
                  value={custRegProjectName}
                  onChange={(e) => setCustRegProjectName(e.target.value)}
                  className="block mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                />
                <textarea
                  placeholder="Project Description (optional)"
                  value={custRegProjectDesc}
                  onChange={(e) => setCustRegProjectDesc(e.target.value)}
                  className="block mb-2 p-4 md:p-2 border bg-white text-black w-full rounded h-20 resize-none text-base md:text-sm"
                />
                <input
                  type="password"
                  placeholder="Password (min 6) *"
                  value={custRegPassword}
                  onChange={(e) => setCustRegPassword(e.target.value)}
                  className="block mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                />
                <button
                  type="button"
                  onClick={handleCustomerRegister}
                  className="bg-teal-500 text-white p-4 md:p-2 rounded w-full hover:bg-teal-600 font-medium text-base md:text-sm min-h-[48px]"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomerRegister(false)}
                  className="text-teal-600 hover:text-teal-800 mt-2 text-sm underline py-2"
                >
                  Back to Sign in
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setShowStaff(true);
                setStatus({ message: '', tone: 'error' });
              }}
              className="mt-6 text-gray-600 hover:text-gray-900 text-sm underline py-2"
            >
              Staff sign in
            </button>
          </div>
        )}

        {showStaff && (
          <div className="p-4 md:p-6 bg-white rounded-lg shadow text-black text-left md:text-center">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Admin Login</h2>
            {showSessionExpired && (
              <div
                className="mb-4 p-3 bg-amber-100 border border-amber-400 text-amber-800 rounded text-sm"
                role="alert"
              >
                Your session expired or you were signed out. Please log in again.
              </div>
            )}
            <div className="text-left">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block mb-3 md:mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                data-testid="admin-login-username"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block mb-3 md:mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
                data-testid="admin-login-password"
              />
              <button
                type="button"
                onClick={handleLogin}
                className="bg-blue-500 text-white p-4 md:p-2 rounded w-full hover:bg-blue-600 font-medium text-base md:text-sm min-h-[48px]"
              >
                Login
              </button>
            </div>
            <p className="text-gray-700 mt-4 text-base md:text-sm">For admin access only.</p>
            <button
              type="button"
              onClick={() => setShowRegister(!showRegister)}
              className="text-blue-600 hover:text-blue-800 mt-2 text-base md:text-sm underline py-2"
            >
              {showRegister ? 'Cancel Registration' : 'New Admin? Request Access'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowStaff(false);
                setShowRegister(false);
                setStatus({ message: '', tone: 'error' });
              }}
              className="block mt-3 text-gray-600 hover:text-gray-900 text-sm underline py-2 md:mx-auto"
            >
              Back to customer sign in
            </button>
          </div>
        )}

        {showStaff && showRegister && (
          <div className="mt-6 p-4 md:p-6 bg-white rounded-lg shadow text-black text-left md:text-center">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Request Admin Access</h2>
            <p className="text-gray-600 mb-4 text-base md:text-sm">
              Your account will need to be approved by an existing administrator.
            </p>

            <div className="space-y-3 text-left">
              <input
                type="text"
                placeholder="Username *"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
              />
              <input
                type="email"
                placeholder="Email *"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
              />
              <input
                type="password"
                placeholder="Password (min 6 characters) *"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
              />
              <input
                type="password"
                placeholder="Confirm Password *"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm"
              />
              <button
                type="button"
                onClick={handleRegister}
                className="bg-purple-500 text-white p-4 md:p-2 rounded w-full hover:bg-purple-600 font-medium text-base md:text-sm min-h-[48px]"
              >
                Request Access
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
