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
    <div className="flex justify-center items-center min-h-screen gap-12 py-8">
      {/* Admin Login Section */}
      <div className="p-6 bg-white rounded shadow text-black">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Admin Login</h2>
        <input 
          type="text" 
          placeholder="Username" 
          value={username} 
          onChange={e => setUsername(e.target.value)} 
          className="block mb-2 p-2 border bg-white text-black w-full" 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          className="block mb-2 p-2 border bg-white text-black w-full" 
        />
        <button 
          onClick={handleLogin} 
          className="bg-blue-500 text-white p-2 rounded w-full hover:bg-blue-600"
        >
          Login
        </button>
        <p className="text-gray-700 mt-4 text-sm">For admin access only.</p>
      </div>

      {/* Logo */}
      <img 
        src="/logo.png" 
        alt="Handyman Tracker Logo" 
        className="w-96 h-96 object-contain"
      />

      {/* Customer Bid Request Section */}
      <div className="p-6 bg-white rounded shadow text-black max-w-md">
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
            placeholder="Phone *" 
            value={customerPhone} 
            onChange={e => setCustomerPhone(e.target.value)} 
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
  );
}