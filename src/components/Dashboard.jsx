import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllProjects();
  }, []);

  const fetchAllProjects = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers`, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
      });
      
      // Flatten all projects from all customers
      const allProjects = [];
      res.data.forEach(customer => {
        if (customer.projects && customer.projects.length > 0) {
          customer.projects.forEach(project => {
            allProjects.push({
              ...project,
              customerName: customer.name,
              customerId: customer._id
            });
          });
        }
      });
      
      // Sort by creation date (oldest to newest)
      allProjects.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateA - dateB;
      });
      
      setProjects(allProjects);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-black">
        <h1 className="text-2xl mb-4 text-black">Handyman Tracker Dashboard</h1>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 text-black">
      {/* Desktop buttons - hidden on mobile (mobile nav handles this) */}
      <div className="hidden lg:flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-black">Dashboard</h1>
        <div className="flex gap-3 flex-wrap">
          <Link to="/inventory" className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600">
            📦 Inventory
          </Link>
          <Link to="/purchase-orders" className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">
            📋 Orders
          </Link>
          <Link to="/suppliers" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            🏪 Suppliers
          </Link>
          <Link to="/admin/users" className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
            👥 Users
          </Link>
          <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Customers
          </Link>
        </div>
      </div>
      
      {/* Mobile heading only */}
      <div className="lg:hidden mb-6">
        <h1 className="text-2xl font-bold text-black">Dashboard</h1>
      </div>

      {/* Project Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4">
          <p className="text-gray-600 text-base md:text-sm">Total Projects</p>
          <p className="text-3xl font-bold text-black">{projects.length}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4">
          <p className="text-gray-600 text-base md:text-sm">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">
            {projects.filter(p => p.status === 'Pending').length}
          </p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4">
          <p className="text-gray-600 text-base md:text-sm">Scheduled</p>
          <p className="text-3xl font-bold text-blue-600">
            {projects.filter(p => p.status === 'Scheduled').length}
          </p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4">
          <p className="text-gray-600 text-base md:text-sm">Completed</p>
          <p className="text-3xl font-bold text-green-600">
            {projects.filter(p => p.status === 'Completed' || p.status === 'Billed').length}
          </p>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-semibold mb-4 text-black">All Projects (Oldest to Newest)</h2>
        
        {projects.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-base md:text-sm">No projects found. Create a customer and add projects to get started.</p>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-4">
              {projects.map((project, index) => (
                <div key={project._id || index} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-black flex-1">{project.name}</h3>
                    <span className={`px-3 py-1 rounded text-sm ml-2 ${
                      project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      project.status === 'Billed' ? 'bg-blue-100 text-blue-800' :
                      project.status === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' :
                      project.status === 'Bidded' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status || 'Pending'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-base">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer:</span>
                      <span className="text-black font-medium">{project.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bid Amount:</span>
                      <span className="text-black">{project.bidAmount ? `$${project.bidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bill Amount:</span>
                      <span className="text-black">{project.billAmount ? `$${project.billAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Schedule Date:</span>
                      <span className="text-black">{project.scheduleDate ? format(new Date(project.scheduleDate), 'MMM d, yyyy') : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span className="text-gray-600">{project.createdAt ? format(new Date(project.createdAt), 'MMM d, yyyy') : 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Link 
                      to={`/projects/${project.customerId}/${project._id}`}
                      className="block w-full bg-blue-500 text-white text-center py-3 rounded hover:bg-blue-600 font-medium"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-3 text-black text-sm font-semibold">Project Name</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Customer</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Status</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Bid Amount</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Bill Amount</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Schedule Date</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Created</th>
                    <th className="text-left p-3 text-black text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project, index) => (
                    <tr key={project._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-black font-medium text-sm">{project.name}</td>
                      <td className="p-3 text-black text-sm">{project.customerName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-sm ${
                          project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          project.status === 'Billed' ? 'bg-blue-100 text-blue-800' :
                          project.status === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' :
                          project.status === 'Bidded' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {project.status || 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 text-black text-sm">
                        {project.bidAmount ? `$${project.bidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="p-3 text-black text-sm">
                        {project.billAmount ? `$${project.billAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="p-3 text-black text-sm">
                        {project.scheduleDate ? format(new Date(project.scheduleDate), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="p-3 text-gray-600 text-sm">
                        {project.createdAt ? format(new Date(project.createdAt), 'MMM d, yyyy') : 'N/A'}
                      </td>
                      <td className="p-3">
                        <Link 
                          to={`/projects/${project.customerId}/${project._id}`}
                          className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}