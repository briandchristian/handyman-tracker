import { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';

export default function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  
  // Admin registration form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  
  // Customer bid form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/login`, { username, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      window.location.href = '/';
    } catch (err) {
      // Detect different types of errors
      if (!err.response) {
        // Network error - no response received (connection refused, timeout, etc.)
        if (err.code === 'ERR_NETWORK' || err.message.includes('Network Error')) {
          alert(`❌ Cannot connect to server at ${API_BASE_URL}\n\n` +
                `Possible issues:\n` +
                `• Server is not running\n` +
                `• Wrong IP address (check if you're using ${API_BASE_URL})\n` +
                `• Network connectivity problem\n` +
                `• Firewall blocking connection\n\n` +
                `Make sure you're accessing from: http://192.168.50.87:5173`);
        } else if (err.code === 'ECONNREFUSED') {
          alert(`❌ Connection Refused!\n\n` +
                `The server at ${API_BASE_URL} refused the connection.\n\n` +
                `• Check if the backend server is running\n` +
                `• Verify you're using the correct URL`);
        } else {
          alert(`❌ Network Error\n\n${err.message}\n\nPlease check your connection.`);
        }
      } else if (err.response.status === 400) {
        // Authentication error - invalid credentials
        alert('❌ Login Failed\n\nInvalid username or password.');
      } else if (err.response.status === 403) {
        // Account pending approval or rejected
        const msg = err.response?.data?.msg || 'Your account requires approval.';
        alert(`❌ Access Denied\n\n${msg}`);
      } else if (err.response.status === 500) {
        // Server error
        alert('❌ Server Error\n\nThe server encountered an error. Please try again later.');
      } else {
        // Other errors
        alert(`❌ Login Failed\n\n${err.response?.data?.msg || err.message}`);
      }
      console.error('Login error details:', {
        code: err.code,
        message: err.message,
        response: err.response,
        config: { url: err.config?.url, method: err.config?.method }
      });
    }
  };

  const handleRegister = async () => {
    // Validation
    if (!regUsername || !regPassword || !regEmail) {
      alert('❌ All fields are required');
      return;
    }

    if (regUsername.length < 3) {
      alert('❌ Username must be at least 3 characters');
      return;
    }

    if (regPassword.length < 6) {
      alert('❌ Password must be at least 6 characters');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      alert('❌ Passwords do not match');
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/register`, {
        username: regUsername,
        password: regPassword,
        email: regEmail
      });
      
      alert(`✅ ${res.data.msg}`);
      
      // Clear form
      setRegUsername('');
      setRegPassword('');
      setRegEmail('');
      setRegConfirmPassword('');
      setShowRegister(false);
      
      // If it's the first user (super-admin), they can login immediately
      if (res.data.role === 'super-admin') {
        alert('You can now log in with your credentials!');
      }
    } catch (err) {
      if (!err.response) {
        alert(`❌ Cannot connect to server\n\nPlease check your internet connection.`);
      } else {
        const errorMsg = err.response?.data?.msg || 'Failed to register';
        alert(`❌ ${errorMsg}`);
      }
      console.error('Registration error:', err);
    }
  };

  const formatPhoneNumber = (value) => {
    // Remove all non-digit characters
    const phoneNumber = value.replace(/\D/g, '');
    
    // Format as XXX-XXX-XXXX
    if (phoneNumber.length <= 3) {
      return phoneNumber;
    } else if (phoneNumber.length <= 6) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    } else {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setCustomerPhone(formatted);
  };

  const handleCustomerBid = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/customer-bid`, {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        address: customerAddress,
        projectName,
        projectDescription
      });
      alert(res.data.msg);
      // Clear form
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerAddress('');
      setProjectName('');
      setProjectDescription('');
    } catch (err) {
      if (!err.response) {
        // Network error
        alert(`❌ Cannot connect to server\n\n` +
              `The server at ${API_BASE_URL} is not reachable.\n` +
              `Please check your internet connection or contact support.`);
        console.error('Network error submitting bid:', err);
      } else {
        const errorMsg = err.response?.data?.msg || 'Failed to submit bid request';
        alert(`❌ ${errorMsg}`);
      }
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Top Row: Logo - Upper Left */}
      <div className="flex justify-center md:justify-start items-start mb-6 md:mb-8">
        <div className="flex-shrink-0">
          <img 
            src="/logo.png" 
            alt="Handyman Tracker Logo" 
            className="w-48 h-48 md:w-80 md:h-80 object-contain"
          />
        </div>
      </div>

      {/* Middle Row: Request a Bid (left, under logo) */}
      <div className="flex justify-center md:justify-start mb-6">
        <div className="p-4 md:p-6 bg-white rounded shadow text-black w-full max-w-[500px]">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Request a Bid</h2>
          <p className="text-gray-600 mb-4 text-base md:text-sm">New customer? Submit your project details and we'll get back to you!</p>
          
          <div className="space-y-3">
            <input 
              type="text" 
              placeholder="Your Name *" 
              value={customerName} 
              onChange={e => setCustomerName(e.target.value)} 
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
            />
            <input 
              type="email" 
              placeholder="Email *" 
              value={customerEmail} 
              onChange={e => setCustomerEmail(e.target.value)} 
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
            />
            <input 
              type="tel" 
              placeholder="Phone (XXX-XXX-XXXX) *" 
              value={customerPhone} 
              onChange={handlePhoneChange} 
              maxLength="12"
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
            />
            <input 
              type="text" 
              placeholder="Address (optional)" 
              value={customerAddress} 
              onChange={e => setCustomerAddress(e.target.value)} 
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
            />
            <input 
              type="text" 
              placeholder="Project Name *" 
              value={projectName} 
              onChange={e => setProjectName(e.target.value)} 
              className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
            />
            <textarea 
              placeholder="Project Description *" 
              value={projectDescription} 
              onChange={e => setProjectDescription(e.target.value)} 
              className="block p-4 md:p-2 border bg-white text-black w-full rounded h-24 resize-none text-base md:text-sm" 
            />
            <button 
              onClick={handleCustomerBid} 
              className="bg-green-500 text-white p-4 md:p-2 rounded w-full hover:bg-green-600 font-medium text-base md:text-sm"
            >
              Submit Bid Request
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Admin Login (left, below Request a Bid) */}
      <div className="flex justify-center md:justify-start">
        <div className="p-4 md:p-6 bg-white rounded shadow text-black w-full max-w-[500px]">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Admin Login</h2>
          <input 
            type="text" 
            placeholder="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            className="block mb-3 md:mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="block mb-3 md:mb-2 p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
          />
          <button 
            onClick={handleLogin} 
            className="bg-blue-500 text-white p-4 md:p-2 rounded w-full hover:bg-blue-600 font-medium text-base md:text-sm"
          >
            Login
          </button>
          <p className="text-gray-700 mt-4 text-base md:text-sm">For admin access only.</p>
          <button 
            onClick={() => setShowRegister(!showRegister)} 
            className="text-blue-600 hover:text-blue-800 mt-2 text-base md:text-sm underline py-2"
          >
            {showRegister ? 'Cancel Registration' : 'New Admin? Request Access'}
          </button>
        </div>
      </div>

      {/* Admin Registration Form (conditional) */}
      {showRegister && (
        <div className="flex justify-center md:justify-start mt-6">
          <div className="p-4 md:p-6 bg-white rounded shadow text-black w-full max-w-[500px]">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Request Admin Access</h2>
            <p className="text-gray-600 mb-4 text-base md:text-sm">Your account will need to be approved by an existing administrator.</p>
            
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Username *" 
                value={regUsername} 
                onChange={e => setRegUsername(e.target.value)} 
                className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
              />
              <input 
                type="email" 
                placeholder="Email *" 
                value={regEmail} 
                onChange={e => setRegEmail(e.target.value)} 
                className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
              />
              <input 
                type="password" 
                placeholder="Password (min 6 characters) *" 
                value={regPassword} 
                onChange={e => setRegPassword(e.target.value)} 
                className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
              />
              <input 
                type="password" 
                placeholder="Confirm Password *" 
                value={regConfirmPassword} 
                onChange={e => setRegConfirmPassword(e.target.value)} 
                className="block p-4 md:p-2 border bg-white text-black w-full rounded text-base md:text-sm" 
              />
              <button 
                onClick={handleRegister} 
                className="bg-purple-500 text-white p-4 md:p-2 rounded w-full hover:bg-purple-600 font-medium text-base md:text-sm"
              >
                Request Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
