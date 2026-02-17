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
import CustomerMyInfo from './components/CustomerMyInfo';
import InstallationHistory from './components/InstallationHistory';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const location = useLocation();
  const userRole = localStorage.getItem('userRole');
  const isCustomer = userRole === 'customer';
  const showMobileNav = token && location.pathname !== '/login' && !isCustomer;

  return (
    <div className="min-h-screen bg-gray-100">
      {showMobileNav && <MobileNav />}
      <Routes>
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/" element={token ? (isCustomer ? <Navigate to="/customer" /> : <Dashboard />) : <Navigate to="/login" />} />
        <Route path="/customer" element={token ? (isCustomer ? <CustomerMyInfo /> : <Navigate to="/" />) : <Navigate to="/login" />} />
        <Route path="/customers" element={token ? (!isCustomer ? <Customers /> : <Navigate to="/customer" />) : <Navigate to="/login" />} />
        <Route path="/installation-history" element={token ? (!isCustomer ? <InstallationHistory /> : <Navigate to="/customer" />) : <Navigate to="/login" />} />
        <Route path="/projects/:customerId/:projectId" element={token ? (!isCustomer ? <ProjectDetails /> : <Navigate to="/customer" />) : <Navigate to="/login" />} />
        <Route path="/admin/users" element={token ? (!isCustomer ? <UserManagement /> : <Navigate to="/customer" />) : <Navigate to="/login" />} />
        <Route path="/suppliers" element={token ? (!isCustomer ? <Suppliers /> : <Navigate to="/customer" />) : <Navigate to="/login" />} />
        <Route path="/purchase-orders" element={token ? (!isCustomer ? <PurchaseOrders /> : <Navigate to="/customer" />) : <Navigate to="/login" />} />
        <Route path="/inventory" element={token ? (!isCustomer ? <Inventory /> : <Navigate to="/customer" />) : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;
