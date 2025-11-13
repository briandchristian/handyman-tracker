import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import ProjectDetails from './components/ProjectDetails';
import UserManagement from './components/UserManagement';
import Suppliers from './components/Suppliers';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/customers" element={token ? <Customers /> : <Navigate to="/login" />} />
        <Route path="/projects/:customerId/:projectId" element={token ? <ProjectDetails /> : <Navigate to="/login" />} />
        <Route path="/admin/users" element={token ? <UserManagement /> : <Navigate to="/login" />} />
        <Route path="/suppliers" element={token ? <Suppliers /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;
