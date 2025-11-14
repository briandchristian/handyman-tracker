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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Total Projects</p>
          <p className="text-3xl font-bold text-black">{projects.length}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">
            {projects.filter(p => p.status === 'Pending').length}
          </p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Scheduled</p>
          <p className="text-3xl font-bold text-blue-600">
            {projects.filter(p => p.status === 'Scheduled').length}
          </p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Completed</p>
          <p className="text-3xl font-bold text-green-600">
            {projects.filter(p => p.status === 'Completed' || p.status === 'Billed').length}
          </p>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white border border-gray-300 rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4 text-black">All Projects (Oldest to Newest)</h2>
        
        {projects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No projects found. Create a customer and add projects to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-3 text-black">Project Name</th>
                  <th className="text-left p-3 text-black">Customer</th>
                  <th className="text-left p-3 text-black">Status</th>
                  <th className="text-left p-3 text-black">Bid Amount</th>
                  <th className="text-left p-3 text-black">Bill Amount</th>
                  <th className="text-left p-3 text-black">Schedule Date</th>
                  <th className="text-left p-3 text-black">Created</th>
                  <th className="text-left p-3 text-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project, index) => (
                  <tr key={project._id || index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 text-black font-medium">{project.name}</td>
                    <td className="p-3 text-black">{project.customerName}</td>
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
                    <td className="p-3 text-black">
                      {project.bidAmount ? `$${project.bidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="p-3 text-black">
                      {project.billAmount ? `$${project.billAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="p-3 text-black">
                      {project.scheduleDate ? format(new Date(project.scheduleDate), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="p-3 text-gray-600 text-sm">
                      {project.createdAt ? format(new Date(project.createdAt), 'MMM d, yyyy') : 'N/A'}
                    </td>
                    <td className="p-3">
                      <Link 
                        to={`/projects/${project.customerId}/${project._id}`}
                        className="text-blue-500 hover:text-blue-700 text-sm"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}