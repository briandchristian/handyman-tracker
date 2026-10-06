import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Login from './components/Login';
import MarketingHome from './components/MarketingHome';
import RequestBid from './components/RequestBid';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import CustomerDetail from './components/CustomerDetail';
import ProjectDetails from './components/ProjectDetails';
import UserManagement from './components/UserManagement';
import BidAlertSettings from './components/BidAlertSettings';
import Suppliers from './components/Suppliers';
import PurchaseOrders from './components/PurchaseOrders';
import Inventory from './components/Inventory';
import Accounting from './components/Accounting';
import SubcontractorJobs from './components/SubcontractorJobs';
import MobileNav from './components/MobileNav';
import StaffNav from './components/StaffNav';
import CustomerMyInfo from './components/CustomerMyInfo';
import InstallationHistory from './components/InstallationHistory';
import ServiceArea from './components/ServiceArea';
import ServiceDetail from './components/ServiceDetail';
import ScrollToTop from './components/ScrollToTop';
import { isPublicPath } from './constants/publicRoutes';

function readStored(key) {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}

function App() {
  const [token, setToken] = useState(readStored('token'));
  const location = useLocation();
  const userRole = readStored('userRole');
  const isCustomer = userRole === 'customer';
  const showMobileNav = token && !isPublicPath(location.pathname) && !isCustomer;

  return (
    <div className="min-h-screen bg-slate-50">
      <ScrollToTop />
      {showMobileNav && (
        <>
          <StaffNav />
          <MobileNav />
        </>
      )}
      <Routes>
        <Route path="/" element={<MarketingHome />} />
        <Route path="/bid" element={<RequestBid />} />
        <Route path="/service-area" element={<ServiceArea />} />
        <Route path="/services/:slug" element={<ServiceDetail />} />
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route
          path="/dashboard"
          element={
            token ? (
              isCustomer ? (
                <Navigate to="/customer" />
              ) : (
                <Dashboard />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/customer"
          element={
            token ? (
              isCustomer ? (
                <CustomerMyInfo />
              ) : (
                <Navigate to="/dashboard" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/customers"
          element={
            token ? (
              !isCustomer ? (
                <Customers />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/customers/:customerId"
          element={
            token ? (
              !isCustomer ? (
                <CustomerDetail />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/installation-history"
          element={
            token ? (
              !isCustomer ? (
                <InstallationHistory />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/projects/:customerId/:projectId"
          element={
            token ? (
              !isCustomer ? (
                <ProjectDetails />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/users"
          element={
            token ? (
              !isCustomer ? (
                <UserManagement />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/bid-alerts"
          element={
            token ? (
              !isCustomer ? (
                <BidAlertSettings />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/suppliers"
          element={
            token ? (
              !isCustomer ? (
                <Suppliers />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/purchase-orders"
          element={
            token ? (
              !isCustomer ? (
                <PurchaseOrders />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/inventory"
          element={
            token ? (
              !isCustomer ? (
                <Inventory />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/accounting"
          element={
            token ? (
              !isCustomer ? (
                <Accounting />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/subcontractor"
          element={
            token ? (
              !isCustomer ? (
                <SubcontractorJobs />
              ) : (
                <Navigate to="/customer" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </div>
  );
}

export default App;
