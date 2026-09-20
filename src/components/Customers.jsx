import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import API_BASE_URL from '../config/api';
import {
  EQUIPMENT_CATEGORY_OPTIONS,
  emptyEquipmentCategories
} from '../constants/equipmentCategories';
import { PROJECT_WORK_TYPES, DEFAULT_PROJECT_WORK_TYPE } from '../constants/projectWorkTypes';
import { formatCustomerLabel, formatJobLabel } from '../constants/jobIdentity';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', address: '', accountNumber: '' });
  const [newProject, setNewProject] = useState({
    customerId: '',
    name: '',
    description: '',
    jobNumber: '',
    equipmentCategories: emptyEquipmentCategories(),
    workType: DEFAULT_PROJECT_WORK_TYPE,
  });
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [editCustomer, setEditCustomer] = useState({ name: '', email: '', phone: '', address: '', accountNumber: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  // Mobile UX: collapsible sections reduce scrolling fatigue on small screens.
  const [mobileSections, setMobileSections] = useState({
    customerManagement: true,
    addCustomer: false,
    customerList: true,
    addProject: false
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/customers`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const customersData = res.data;
    // Debug: Log customer IDs
    console.log('Fetched customers:', customersData.map(c => ({ id: c._id, name: c.name, projects: c.projects?.length || 0 })));
    setCustomers(customersData);
  };

  const addCustomer = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/customers`, newCustomer, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      // Clear the form fields after successful addition
      setNewCustomer({ name: '', email: '', phone: '', address: '', accountNumber: '' });
      fetchCustomers();
    } catch (err) {
      console.error('Error adding customer:', err);
      alert('Failed to add customer: ' + (err.response?.data?.msg || err.message));
    }
  };

  const deleteCustomer = async (id) => {
    await axios.delete(`${API_BASE_URL}/api/customers/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchCustomers();
  };

  const addProject = async () => {
    try {
      if (!newProject.customerId || !newProject.name) {
        alert('Please provide customer and job name');
        return;
      }
      
      await axios.post(`${API_BASE_URL}/api/customers/${newProject.customerId}/projects`, 
        {
          name: newProject.name,
          description: newProject.description,
          jobNumber: newProject.jobNumber,
          status: 'Pending',
          equipmentCategories: {
            burglarAlarm: !!newProject.equipmentCategories.burglarAlarm,
            fireAlarm: !!newProject.equipmentCategories.fireAlarm,
            accessControl: !!newProject.equipmentCategories.accessControl,
            cctv: !!newProject.equipmentCategories.cctv,
            monitoring: !!newProject.equipmentCategories.monitoring
          },
          workType: newProject.workType || DEFAULT_PROJECT_WORK_TYPE,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      // Clear the form fields after successful addition
      setNewProject({
        customerId: '',
        name: '',
        description: '',
        jobNumber: '',
        equipmentCategories: emptyEquipmentCategories(),
        workType: DEFAULT_PROJECT_WORK_TYPE,
      });
      
      // Refresh customers and update the selected customer
      await fetchCustomers();
      
      // Refresh the selected customer to show new project
      if (selectedCustomer) {
        const res = await axios.get(`${API_BASE_URL}/api/customers`, { 
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
        });
        const updatedCustomer = res.data.find(c => c._id === selectedCustomer._id);
        if (updatedCustomer) {
          setSelectedCustomer(updatedCustomer);
          setNewProject({
            ...newProject,
            customerId: updatedCustomer._id,
            name: '',
            description: '',
            jobNumber: '',
            equipmentCategories: emptyEquipmentCategories(),
            workType: DEFAULT_PROJECT_WORK_TYPE,
          });
        }
      }
    } catch (err) {
      console.error('Error adding project:', err);
      alert('Failed to add job: ' + (err.response?.data?.msg || err.message));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
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
    setNewCustomer({ ...newCustomer, phone: formatted });
  };

  const handleEditPhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setEditCustomer({ ...editCustomer, phone: formatted });
  };

  const startEditing = (customer) => {
    setEditingCustomerId(customer._id);
    setEditCustomer({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      accountNumber: customer.accountNumber || '',
    });
  };

  const cancelEditing = () => {
    setEditingCustomerId(null);
    setEditCustomer({ name: '', email: '', phone: '', address: '', accountNumber: '' });
  };

  const saveCustomer = async (customerId) => {
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${customerId}`, editCustomer, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
      });
      setEditingCustomerId(null);
      setEditCustomer({ name: '', email: '', phone: '', address: '', accountNumber: '' });
      fetchCustomers();
    } catch (err) {
      console.error('Error updating customer:', err);
      alert('Failed to update customer: ' + (err.response?.data?.msg || err.message));
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setSelectedCustomer(null);
      return;
    }
    
    // Search for customer by name (case-insensitive)
    const found = customers.find(c =>
      c.name.toLowerCase().includes(query.toLowerCase())
      || String(c.accountNumber || '').toLowerCase().includes(query.toLowerCase())
    );
    
    if (found) {
      setSelectedCustomer(found);
      setNewProject({
        ...newProject,
        customerId: found._id,
        equipmentCategories: newProject.customerId === found._id ? newProject.equipmentCategories : emptyEquipmentCategories()
      });
    } else {
      setSelectedCustomer(null);
    }
  };

  const toggleMobileSection = (sectionKey) => {
    setMobileSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  return (
    <div className="p-4 md:p-6 text-black h-screen flex flex-col max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <h1 className="text-2xl md:text-2xl text-black">Customers</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            to="/dashboard"
            className="btn-staff flex-1 sm:flex-none"
          >
            Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="btn-danger flex-1 sm:flex-none"
          >
            Logout
          </button>
        </div>
      </div>
      
      {/* TOP HALF - Customer Data */}
      <div className="flex-1 overflow-auto mb-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 text-black hidden md:block">Customer Management</h2>
          <button
            type="button"
            aria-expanded={mobileSections.customerManagement}
            onClick={() => toggleMobileSection('customerManagement')}
            className="md:hidden w-full text-left bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 mb-3 font-semibold text-black"
          >
            Customer Management
          </button>

          <div className={`${mobileSections.customerManagement ? 'block' : 'hidden'} md:block`}>
            {/* Add Customer Form */}
            <div className="mb-6 pb-4 border-b border-gray-200">
              <h3 className="text-lg md:text-lg font-medium mb-3 text-black hidden md:block">Add New Customer</h3>
              <button
                type="button"
                aria-expanded={mobileSections.addCustomer}
                onClick={() => toggleMobileSection('addCustomer')}
                className="md:hidden w-full text-left bg-gray-50 border border-gray-300 rounded px-4 py-3 mb-3 font-medium text-black"
              >
                Add New Customer
              </button>
              <div className={`${mobileSections.addCustomer ? 'block' : 'hidden'} md:block`}>
                <AlignedFormGrid testId="add-customer-grid">
                  <AlignedFormField label="Name" htmlFor="new-customer-name" className="col-span-12 md:col-span-3">
                    <input
                      id="new-customer-name"
                      placeholder="Name"
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <AlignedFormField label="Email" htmlFor="new-customer-email" className="col-span-12 md:col-span-3">
                    <input
                      id="new-customer-email"
                      placeholder="Email"
                      value={newCustomer.email}
                      onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <AlignedFormField label="Phone" htmlFor="new-customer-phone" className="col-span-12 sm:col-span-6 md:col-span-2">
                    <input
                      id="new-customer-phone"
                      placeholder="Phone (XXX-XXX-XXXX)"
                      value={newCustomer.phone}
                      onChange={handlePhoneChange}
                      maxLength="12"
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <AlignedFormField label="Address" htmlFor="new-customer-address" className="col-span-12 sm:col-span-6 md:col-span-2">
                    <input
                      id="new-customer-address"
                      placeholder="Address"
                      value={newCustomer.address}
                      onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <AlignedFormField label="Account number" htmlFor="new-customer-account" className="col-span-12 sm:col-span-6 md:col-span-2">
                    <input
                      id="new-customer-account"
                      placeholder="Auto or CS number"
                      value={newCustomer.accountNumber}
                      onChange={e => setNewCustomer({ ...newCustomer, accountNumber: e.target.value })}
                      className="w-full p-3 md:p-2 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
                    />
                  </AlignedFormField>
                  <div className="col-span-12 md:col-span-2">
                    <button onClick={addCustomer} className="w-full bg-green-500 text-white px-4 py-3 md:py-2 rounded hover:bg-green-600 text-base md:text-sm font-medium">
                      Add Customer
                    </button>
                  </div>
                </AlignedFormGrid>
              </div>
            </div>

            {/* Customers List */}
            <div className="mb-3 md:hidden">
              <button
                type="button"
                aria-expanded={mobileSections.customerList}
                onClick={() => toggleMobileSection('customerList')}
                className="w-full text-left bg-gray-50 border border-gray-300 rounded px-4 py-3 font-medium text-black"
              >
                Customer List
              </button>
            </div>
            <div className={`${mobileSections.customerList ? 'block' : 'hidden'} md:block`}>
              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-4">
                {customers.map(cust => (
                  <div key={cust._id} className="border border-gray-200 rounded-lg p-4 bg-white">
                    {editingCustomerId === cust._id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                          <input 
                            value={editCustomer.name} 
                            onChange={e => setEditCustomer({ ...editCustomer, name: e.target.value })} 
                            className="w-full p-3 border border-gray-300 rounded bg-gray-100 text-black text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input 
                            value={editCustomer.email} 
                            onChange={e => setEditCustomer({ ...editCustomer, email: e.target.value })} 
                            className="w-full p-3 border border-gray-300 rounded bg-gray-100 text-black text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                          <input 
                            value={editCustomer.phone} 
                            onChange={handleEditPhoneChange} 
                            maxLength="12"
                            className="w-full p-3 border border-gray-300 rounded bg-gray-100 text-black text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                          <input 
                            value={editCustomer.address} 
                            onChange={e => setEditCustomer({ ...editCustomer, address: e.target.value })} 
                            className="w-full p-3 border border-gray-300 rounded bg-gray-100 text-black text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`edit-account-${cust._id}`}>Account number</label>
                          <input
                            id={`edit-account-${cust._id}`}
                            value={editCustomer.accountNumber}
                            onChange={e => setEditCustomer({ ...editCustomer, accountNumber: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded bg-gray-100 text-black text-base"
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => saveCustomer(cust._id)} className="flex-1 bg-green-500 text-white px-4 py-3 rounded text-base hover:bg-green-600 font-medium">
                            Save
                          </button>
                          <button onClick={cancelEditing} className="flex-1 bg-gray-500 text-white px-4 py-3 rounded text-base hover:bg-gray-600 font-medium">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-3">
                          <h3 className="text-lg font-semibold text-black">{formatCustomerLabel(cust)}</h3>
                        </div>
                        <div className="space-y-2 text-base">
                          <div>
                            <span className="text-gray-600">Email: </span>
                            <span className="text-black">{cust.email}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Phone: </span>
                            <span className="text-black">{cust.phone}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Address: </span>
                            <span className="text-black">{cust.address || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Jobs: </span>
                            {cust.projects && cust.projects.length > 0 ? (
                              <div className="mt-1 space-y-1">
                                {cust.projects.map(proj => (
                                  <div key={proj._id}>
                                    <Link to={`/projects/${cust._id}/${proj._id}`} className="text-blue-500 hover:underline">{formatJobLabel(proj)}</Link>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500">No jobs</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                          <button onClick={() => startEditing(cust)} className="flex-1 bg-blue-500 text-white px-4 py-3 rounded text-base hover:bg-blue-600 font-medium">
                            Edit
                          </button>
                          <button onClick={() => deleteCustomer(cust._id)} className="flex-1 bg-red-500 text-white px-4 py-3 rounded text-base hover:bg-red-600 font-medium">
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse border min-w-[900px]">
                  <thead>
                    <tr className="text-black bg-gray-50">
                      <th className="text-black text-left p-3 border-b text-sm font-semibold">Name</th>
                      <th className="text-black text-left p-3 border-b text-sm font-semibold">Account #</th>
                      <th className="text-black text-left p-3 border-b text-sm font-semibold">Email</th>
                      <th className="text-black text-left p-3 border-b text-sm font-semibold">Phone</th>
                      <th className="text-black text-left p-3 border-b text-sm font-semibold">Address</th>
                      <th className="text-black text-left p-3 border-b text-sm font-semibold">Jobs</th>
                      <th className="text-black text-left p-3 border-b text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(cust => (
                      <tr key={cust._id} className="text-black">
                        {editingCustomerId === cust._id ? (
                          <>
                            <td className="p-2">
                              <input 
                                value={editCustomer.name} 
                                onChange={e => setEditCustomer({ ...editCustomer, name: e.target.value })} 
                                className="w-full p-1 border border-gray-300 rounded bg-gray-100 text-black text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                aria-label="Account number"
                                value={editCustomer.accountNumber}
                                onChange={e => setEditCustomer({ ...editCustomer, accountNumber: e.target.value })}
                                className="w-full p-1 border border-gray-300 rounded bg-gray-100 text-black text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                value={editCustomer.email} 
                                onChange={e => setEditCustomer({ ...editCustomer, email: e.target.value })} 
                                className="w-full p-1 border border-gray-300 rounded bg-gray-100 text-black text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                value={editCustomer.phone} 
                                onChange={handleEditPhoneChange} 
                                maxLength="12"
                                className="w-full p-1 border border-gray-300 rounded bg-gray-100 text-black text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                value={editCustomer.address} 
                                onChange={e => setEditCustomer({ ...editCustomer, address: e.target.value })} 
                                className="w-full p-1 border border-gray-300 rounded bg-gray-100 text-black text-sm"
                              />
                            </td>
                            <td className="p-2 text-gray-500 text-sm">
                              (Editing...)
                            </td>
                            <td className="p-2">
                              <div className="flex gap-1">
                                <button onClick={() => saveCustomer(cust._id)} className="bg-green-500 text-white px-2 py-1 rounded text-sm hover:bg-green-600">
                                  Save
                                </button>
                                <button onClick={cancelEditing} className="bg-gray-500 text-white px-2 py-1 rounded text-sm hover:bg-gray-600">
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="text-black p-2 text-sm">{cust.name}</td>
                            <td className="text-black p-2 text-sm">{cust.accountNumber || '—'}</td>
                            <td className="text-black p-2 text-sm">{cust.email}</td>
                            <td className="text-black p-2 text-sm">{cust.phone}</td>
                            <td className="text-black p-2 text-sm">{cust.address}</td>
                            <td className="p-2">
                              {cust.projects && cust.projects.length > 0 ? (
                                cust.projects.map(proj => (
                                  <div key={proj._id} className="mb-1">
                                    <Link to={`/projects/${cust._id}/${proj._id}`} className="text-blue-500 text-sm hover:underline">{formatJobLabel(proj)}</Link>
                                  </div>
                                ))
                              ) : (
                                <span className="text-gray-500 text-sm">No jobs</span>
                              )}
                            </td>
                            <td className="p-2">
                              <div className="flex gap-1">
                                <button onClick={() => startEditing(cust)} className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600">
                                  Edit
                                </button>
                                <button onClick={() => deleteCustomer(cust._id)} className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* BOTTOM HALF - Add Projects with Search */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 text-black hidden md:block">Add Job to Customer</h2>
          <button
            type="button"
            aria-expanded={mobileSections.addProject}
            onClick={() => toggleMobileSection('addProject')}
            className="md:hidden w-full text-left bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 mb-3 font-semibold text-black"
          >
            Add Job to Customer
          </button>

          <div className={`${mobileSections.addProject ? 'block' : 'hidden'} md:block`}>
            {/* Search Customer */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2 font-medium text-base md:text-sm">Search Customer</label>
              <input 
                type="text"
                placeholder="Type customer name to search..." 
                value={searchQuery} 
                onChange={handleSearch}
                className="w-full p-4 md:p-3 border border-gray-300 rounded bg-gray-100 text-black text-base md:text-sm"
              />
            </div>
            
            {/* Display Selected Customer */}
            {selectedCustomer ? (
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Selected Customer</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <span className="ml-2 text-black font-medium">{selectedCustomer.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2 text-black">{selectedCustomer.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <span className="ml-2 text-black">{selectedCustomer.phone}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Address:</span>
                      <span className="ml-2 text-black">{selectedCustomer.address}</span>
                    </div>
                  </div>
                  
                  {/* Existing Projects for this Customer */}
                  {selectedCustomer.projects && selectedCustomer.projects.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-gray-700 font-medium mb-2">Existing jobs:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedCustomer.projects.map(proj => (
                          <Link 
                            key={proj._id}
                            to={`/projects/${selectedCustomer._id}/${proj._id}`}
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm hover:bg-blue-200"
                          >
                            {formatJobLabel(proj)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Add New Project Form */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg md:text-lg font-semibold text-black mb-3">Add New Job</h3>
                  <AlignedFormGrid testId="add-project-grid">
                    <AlignedFormField label="Job name" htmlFor="new-project-name" className="col-span-12 md:col-span-4">
                      <input
                        id="new-project-name"
                        placeholder="Job name"
                        value={newProject.name}
                        onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                        className="w-full p-4 md:p-2 border border-gray-300 rounded bg-white text-black text-base md:text-sm"
                      />
                    </AlignedFormField>
                    <AlignedFormField label="Job number" htmlFor="new-project-job-number" className="col-span-12 md:col-span-3">
                      <input
                        id="new-project-job-number"
                        placeholder="Auto"
                        value={newProject.jobNumber}
                        onChange={e => setNewProject({ ...newProject, jobNumber: e.target.value })}
                        className="w-full p-4 md:p-2 border border-gray-300 rounded bg-white text-black text-base md:text-sm"
                      />
                    </AlignedFormField>
                    <AlignedFormField label="Description" htmlFor="new-project-description" className="col-span-12 md:col-span-5">
                      <input
                        id="new-project-description"
                        placeholder="Description"
                        value={newProject.description}
                        onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                        className="w-full p-4 md:p-2 border border-gray-300 rounded bg-white text-black text-base md:text-sm"
                      />
                    </AlignedFormField>
                    <AlignedFormField label="Work type" htmlFor="new-project-work-type" className="col-span-12 md:col-span-4">
                      <select
                        id="new-project-work-type"
                        value={newProject.workType || DEFAULT_PROJECT_WORK_TYPE}
                        onChange={(e) => setNewProject({ ...newProject, workType: e.target.value })}
                        className="w-full p-4 md:p-2 border border-gray-300 rounded bg-white text-black text-base md:text-sm"
                      >
                        {PROJECT_WORK_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </AlignedFormField>
                    <div className="col-span-12">
                      <p className="block text-sm font-medium text-gray-700 mb-2">Equipment categories</p>
                      <div className="flex flex-wrap gap-4" data-testid="new-project-equipment-categories">
                        {EQUIPMENT_CATEGORY_OPTIONS.map(({ key, label }) => (
                          <label
                            key={key}
                            htmlFor={`new-project-equip-${key}`}
                            className="flex items-center gap-2 cursor-pointer text-black text-sm"
                          >
                            <input
                              id={`new-project-equip-${key}`}
                              type="checkbox"
                              checked={!!newProject.equipmentCategories[key]}
                              onChange={(e) =>
                                setNewProject({
                                  ...newProject,
                                  equipmentCategories: {
                                    ...newProject.equipmentCategories,
                                    [key]: e.target.checked
                                  }
                                })
                              }
                              className="rounded border-gray-300"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-2">
                      <button
                        onClick={addProject}
                        className="w-full bg-green-500 text-white px-6 py-4 md:py-2 rounded hover:bg-green-600 font-medium text-base md:text-sm"
                      >
                        Add Job
                      </button>
                    </div>
                  </AlignedFormGrid>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {searchQuery ? 'No customer found matching your search' : 'Search for a customer to add a job'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}