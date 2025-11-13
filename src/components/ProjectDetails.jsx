import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';

export default function ProjectDetails() {
  const { customerId, projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [newMaterial, setNewMaterial] = useState({ item: '', quantity: 0, cost: 0 });

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated. Please login again.');
        return;
      }
      
      // Debug: Log the customerId being used
      console.log('Fetching customer with ID:', customerId);
      console.log('Customer ID type:', typeof customerId);
      
      const res = await axios.get(`${API_BASE_URL}/api/customers/${customerId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      const cust = res.data;
      
      // Ensure projects array exists
      if (!cust.projects || !Array.isArray(cust.projects)) {
        setError('Customer has no projects');
        return;
      }
      
      // Debug: log project IDs for troubleshooting
      console.log('Looking for projectId:', projectId);
      console.log('Available project IDs:', cust.projects.map(p => p._id));
      
      const proj = cust.projects.find(p => {
        // Try both string and ObjectId comparison
        return p._id === projectId || String(p._id) === String(projectId);
      });
      
      if (!proj) {
        const projectNames = cust.projects.map(p => `${p.name} (${p._id})`).join(', ');
        setError(`Project not found. Looking for: ${projectId}. Available projects: ${projectNames}`);
      } else {
        setProject(proj);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      if (err.response?.status === 401) {
        setError('Authentication failed. Please login again.');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else if (err.response?.status === 404) {
        const errorData = err.response?.data;
        if (errorData?.availableCustomers) {
          const customerList = errorData.availableCustomers.map(c => `${c.name} (${c.id})`).join(', ');
          setError(`Customer not found (ID: ${customerId}). Available customers: ${customerList}`);
        } else {
          setError(`Customer not found (ID: ${customerId})`);
        }
      } else if (err.response?.status === 400) {
        setError(`Invalid customer ID format: ${customerId}`);
      } else {
        setError(err.response?.data?.msg || err.response?.data?.error || 'Failed to load project. Please check the console for details.');
      }
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const submitBid = async () => {
    if (!bidAmount || bidAmount <= 0) {
      alert('Please enter a valid bid amount');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/bid`, 
        { bidAmount: parseFloat(bidAmount) }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setBidAmount('');
      fetchProject();
    } catch (err) {
      console.error('Error submitting bid:', err);
      alert('Failed to submit bid: ' + (err.response?.data?.msg || err.message));
    }
  };

  const submitBill = async () => {
    if (!billAmount || billAmount <= 0) {
      alert('Please enter a valid bill amount');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/bill`, 
        { billAmount: parseFloat(billAmount) }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setBillAmount('');
      fetchProject();
    } catch (err) {
      console.error('Error submitting bill:', err);
      alert('Failed to submit bill: ' + (err.response?.data?.msg || err.message));
    }
  };

  const submitSchedule = async () => {
    if (!scheduleDate) {
      alert('Please select a date');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/schedule`, 
        { scheduleDate }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setScheduleDate('');
      fetchProject();
    } catch (err) {
      console.error('Error submitting schedule:', err);
      alert('Failed to schedule job: ' + (err.response?.data?.msg || err.message));
    }
  };

  const markCompleted = async () => {
    if (window.confirm('Mark this project as completed?')) {
      try {
        await axios.put(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/complete`, 
          {}, 
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        fetchProject();
      } catch (err) {
        console.error('Error marking project as completed:', err);
        alert('Failed to mark project as completed: ' + (err.response?.data?.msg || err.message));
      }
    }
  };

  const addMaterial = async () => {
    if (!newMaterial.item || !newMaterial.quantity || !newMaterial.cost) {
      alert('Please fill in all material fields');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/materials`, 
        { 
          item: newMaterial.item, 
          quantity: parseFloat(newMaterial.quantity), 
          cost: parseFloat(newMaterial.cost) 
        }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setNewMaterial({ item: '', quantity: 0, cost: 0 });
      fetchProject();
    } catch (err) {
      console.error('Error adding material:', err);
      alert('Failed to add material: ' + (err.response?.data?.msg || err.message));
    }
  };

  const deleteMaterial = async (materialId) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/materials/${materialId}`, { 
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
        });
        fetchProject();
      } catch (err) {
        console.error('Error deleting material:', err);
        alert('Failed to delete material: ' + (err.response?.data?.msg || err.message));
      }
    }
  };

  const deleteProject = async () => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        navigate('/customers');
      } catch (err) {
        console.error('Error deleting project:', err);
        alert('Failed to delete project');
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-black">
        <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block mb-4">Back to Customers</Link>
        <div className="text-xl">Loading project details...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 text-black">
        <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block mb-4">Back to Customers</Link>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <h2 className="text-xl font-bold mb-2">Error Loading Project</h2>
          <p>{error}</p>
        </div>
        <button 
          onClick={() => navigate('/customers')} 
          className="bg-blue-500 text-white p-2 rounded"
        >
          Return to Customers
        </button>
      </div>
    );
  }
  
  if (!project) {
    return (
      <div className="p-6 text-black">
        <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block mb-4">Back to Customers</Link>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <h2 className="text-xl font-bold mb-2">Project Not Found</h2>
          <p>Unable to find the requested project.</p>
        </div>
        <button 
          onClick={() => navigate('/customers')} 
          className="bg-blue-500 text-white p-2 rounded"
        >
          Return to Customers
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 text-black">
      <div className="flex justify-between items-center mb-4">
        <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Back to Customers</Link>
        <Link to="/" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Dashboard
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-6 text-black">{project.name}</h1>
      
      {/* Project Information */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-4">Project Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600 mb-1">Description:</p>
            <p className="text-black font-medium">{project.description || 'No description'}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Status:</p>
            <p className="text-black font-medium">
              <span className={`px-2 py-1 rounded ${
                project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                project.status === 'Billed' ? 'bg-blue-100 text-blue-800' :
                project.status === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' :
                project.status === 'Bidded' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.status || 'Pending'}
              </span>
            </p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Bid Amount:</p>
            <p className="text-black font-medium text-lg">${project.bidAmount ? project.bidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Not set'}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Bill Amount:</p>
            <p className="text-black font-medium text-lg">${project.billAmount ? project.billAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Not set'}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Schedule Date:</p>
            <p className="text-black font-medium">
              {project.scheduleDate ? format(new Date(project.scheduleDate), 'PPP') : 'Not scheduled'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Actions Section */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-4">Update Project</h2>
        
        {/* Bid Form */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Bid Amount ($)</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              step="0.01"
              placeholder="Enter bid amount" 
              value={bidAmount} 
              onChange={e => setBidAmount(e.target.value)} 
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1" 
            />
            <button onClick={submitBid} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Submit Bid</button>
          </div>
        </div>
        
        {/* Bill Form */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Bill Amount ($)</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              step="0.01"
              placeholder="Enter bill amount" 
              value={billAmount} 
              onChange={e => setBillAmount(e.target.value)} 
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1" 
            />
            <button onClick={submitBill} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Submit Bill</button>
          </div>
        </div>
        
        {/* Schedule Form */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Schedule Date</label>
          <div className="flex gap-2">
            <input 
              type="date" 
              value={scheduleDate} 
              onChange={e => setScheduleDate(e.target.value)} 
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1" 
            />
            <button onClick={submitSchedule} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Schedule Job</button>
          </div>
        </div>

        {/* Mark as Completed */}
        <div className="pt-4 border-t border-gray-200">
          <button 
            onClick={markCompleted} 
            className="w-full bg-green-500 text-white p-3 rounded font-semibold hover:bg-green-600"
            disabled={project.status === 'Completed'}
          >
            {project.status === 'Completed' ? '✓ Project Completed' : 'Mark as Completed'}
          </button>
        </div>
      </div>
      
      {/* Materials List */}
      <h2 className="text-xl mt-6 text-black">Materials</h2>
      <table className="w-full border-collapse border mt-2">
        <thead>
          <tr className="text-black bg-gray-50">
            <th className="text-black text-left p-3 border-b">Item</th>
            <th className="text-black text-left p-3 border-b">Quantity</th>
            <th className="text-black text-left p-3 border-b">Cost</th>
            <th className="text-black text-left p-3 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {project.materials && project.materials.length > 0 ? (
            project.materials.map(mat => (
              <tr key={mat._id} className="text-black border-b">
                <td className="text-black p-2">{mat.item}</td>
                <td className="text-black p-2">{mat.quantity}</td>
                <td className="text-black p-2">${parseFloat(mat.cost).toFixed(2)}</td>
                <td className="p-2">
                  <button onClick={() => deleteMaterial(mat._id)} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
                    Delete
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="4" className="text-black text-center p-4">No materials added yet</td></tr>
          )}
        </tbody>
        {project.materials && project.materials.length > 0 && (
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="text-black p-3 border-t-2" colSpan="2">Total Material Cost:</td>
              <td className="text-black p-3 border-t-2 text-lg">
                ${project.materials.reduce((sum, mat) => sum + parseFloat(mat.cost || 0), 0).toFixed(2)}
              </td>
              <td className="border-t-2"></td>
            </tr>
          </tfoot>
        )}
      </table>
      
      {/* Add Material Form */}
      <div className="mt-4 bg-white border border-gray-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 text-black">Add New Material</h3>
        <div className="flex gap-2 flex-wrap">
          <input 
            placeholder="Item" 
            value={newMaterial.item} 
            onChange={e => setNewMaterial({ ...newMaterial, item: e.target.value })} 
            className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1 min-w-[150px]" 
          />
          <input 
            type="number" 
            step="1"
            placeholder="Quantity" 
            value={newMaterial.quantity} 
            onChange={e => setNewMaterial({ ...newMaterial, quantity: e.target.value })} 
            className="p-2 border border-gray-300 rounded bg-gray-100 text-black w-32" 
          />
          <input 
            type="number" 
            step="0.01"
            placeholder="Cost ($)" 
            value={newMaterial.cost} 
            onChange={e => setNewMaterial({ ...newMaterial, cost: e.target.value })} 
            className="p-2 border border-gray-300 rounded bg-gray-100 text-black w-32" 
          />
          <button 
            onClick={addMaterial} 
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium"
          >
            Add Material
          </button>
        </div>
      </div>
      
      <button onClick={deleteProject} className="mt-6 bg-red-500 text-white p-2 rounded">Delete Project</button>
    </div>
  );
}