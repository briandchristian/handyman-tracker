import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import ProjectDetails from './components/ProjectDetails';
import UserManagement from './components/UserManagement';
import Suppliers from './components/Suppliers';
import PurchaseOrders from './components/PurchaseOrders';
import Inventory from './components/Inventory';
import MobileNav from './components/MobileNav';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const location = useLocation();
  const showMobileNav = token && location.pathname !== '/login';

  return (
    <div className="min-h-screen bg-gray-100">
      {showMobileNav && <MobileNav />}
      <Routes>
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/customers" element={token ? <Customers /> : <Navigate to="/login" />} />
        <Route path="/projects/:customerId/:projectId" element={token ? <ProjectDetails /> : <Navigate to="/login" />} />
        <Route path="/admin/users" element={token ? <UserManagement /> : <Navigate to="/login" />} />
        <Route path="/suppliers" element={token ? <Suppliers /> : <Navigate to="/login" />} />
        <Route path="/purchase-orders" element={token ? <PurchaseOrders /> : <Navigate to="/login" />} />
        <Route path="/inventory" element={token ? <Inventory /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;
