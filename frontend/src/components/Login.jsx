import { useState } from 'react';
import axios from 'axios';

export default function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Customer bid form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const handleLogin = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/login', { username, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      window.location.href = '/';
    } catch (err) {
      alert('Login failed');
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
      const res = await axios.post('http://localhost:5000/api/customer-bid', {
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
      const errorMsg = err.response?.data?.msg || 'Failed to submit bid request';
      alert(errorMsg);
    }
  };

  return (
    <div className="min-h-screen p-8">
      {/* Top Row: Logo - Upper Left */}
      <div className="flex justify-start items-start mb-8">
        <div className="flex-shrink-0">
          <img 
            src="/logo.png" 
            alt="Handyman Tracker Logo" 
            className="w-80 h-80 object-contain"
          />
        </div>
      </div>

      {/* Middle Row: Request a Bid (left, under logo) */}
      <div className="flex justify-start mb-6">
        <div className="p-6 bg-white rounded shadow text-black w-[500px]">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Request a Bid</h2>
          <p className="text-gray-600 mb-4 text-sm">New customer? Submit your project details and we'll get back to you!</p>
          
          <div className="space-y-3">
            <input 
              type="text" 
              placeholder="Your Name *" 
              value={customerName} 
              onChange={e => setCustomerName(e.target.value)} 
              className="block p-2 border bg-white text-black w-full rounded" 
            />
            <input 
              type="email" 
              placeholder="Email *" 
              value={customerEmail} 
              onChange={e => setCustomerEmail(e.target.value)} 
              className="block p-2 border bg-white text-black w-full rounded" 
            />
            <input 
              type="tel" 
              placeholder="Phone (XXX-XXX-XXXX) *" 
              value={customerPhone} 
              onChange={handlePhoneChange} 
              maxLength="12"
              className="block p-2 border bg-white text-black w-full rounded" 
            />
            <input 
              type="text" 
              placeholder="Address (optional)" 
              value={customerAddress} 
              onChange={e => setCustomerAddress(e.target.value)} 
              className="block p-2 border bg-white text-black w-full rounded" 
            />
            <input 
              type="text" 
              placeholder="Project Name *" 
              value={projectName} 
              onChange={e => setProjectName(e.target.value)} 
              className="block p-2 border bg-white text-black w-full rounded" 
            />
            <textarea 
              placeholder="Project Description *" 
              value={projectDescription} 
              onChange={e => setProjectDescription(e.target.value)} 
              className="block p-2 border bg-white text-black w-full rounded h-24 resize-none" 
            />
            <button 
              onClick={handleCustomerBid} 
              className="bg-green-500 text-white p-2 rounded w-full hover:bg-green-600 font-medium"
            >
              Submit Bid Request
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Admin Login (left, below Request a Bid) */}
      <div className="flex justify-start">
        <div className="p-6 bg-white rounded shadow text-black w-[500px]">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Admin Login</h2>
          <input 
            type="text" 
            placeholder="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            className="block mb-2 p-2 border bg-white text-black w-full rounded" 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="block mb-2 p-2 border bg-white text-black w-full rounded" 
          />
          <button 
            onClick={handleLogin} 
            className="bg-blue-500 text-white p-2 rounded w-full hover:bg-blue-600"
          >
            Login
          </button>
          <p className="text-gray-700 mt-4 text-sm">For admin access only.</p>
        </div>
      </div>
    </div>
  );
}