import { useState } from 'react';
import axios from 'axios';

export default function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

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

  return (
    <div className="flex justify-center items-center h-screen gap-12">
      <div className="p-6 bg-white rounded shadow text-black">
        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="block mb-2 p-2 border bg-white text-black" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="block mb-2 p-2 border bg-white text-black" />
        <button onClick={handleLogin} className="bg-blue-500 text-white p-2 rounded">Login</button>
        <p className="text-gray-700 mt-4">Don't have an account? Register with username/password via POST to /api/register (use Postman for initial setup).</p>
      </div>
      
      {/* Your 1024x1024 graphic in the dark area to the right */}
      <img 
        src="/logo.png" 
        alt="Handyman Tracker Logo" 
        className="w-96 h-96 object-contain"
      />
    </div>
  );
}