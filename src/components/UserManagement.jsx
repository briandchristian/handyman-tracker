import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import { format } from 'date-fns';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'all'

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();
    fetchPendingUsers();
  }, []);

  const fetchCurrentUser = () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        setCurrentUser(payload);
      } catch (err) {
        console.error('Error decoding token:', err);
      }
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error('Error fetching users:', err);
      if (err.response?.status === 403) {
        setError('You do not have permission to view users.');
      } else {
        setError('Failed to load users');
      }
    }
  };

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/users/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingUsers(res.data);
    } catch (err) {
      console.error('Error fetching pending users:', err);
      if (err.response?.status === 403) {
        setError('You do not have permission to manage users.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId, username) => {
    if (!confirm(`Approve ${username} as an admin?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/admin/users/${userId}/approve`,
        { role: 'admin' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`✅ ${username} has been approved!`);
      fetchUsers();
      fetchPendingUsers();
    } catch (err) {
      alert(`❌ Failed to approve user: ${err.response?.data?.msg || err.message}`);
    }
  };

  const handleReject = async (userId, username) => {
    if (!confirm(`Reject ${username}'s admin request?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/admin/users/${userId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`❌ ${username} has been rejected`);
      fetchUsers();
      fetchPendingUsers();
    } catch (err) {
      alert(`❌ Failed to reject user: ${err.response?.data?.msg || err.message}`);
    }
  };

  const handlePromote = async (userId, username) => {
    if (!confirm(`Promote ${username} to Super Admin? This gives them full system access.`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/admin/users/${userId}/promote`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`⬆️ ${username} has been promoted to Super Admin!`);
      fetchUsers();
    } catch (err) {
      alert(`❌ Failed to promote user: ${err.response?.data?.msg || err.message}`);
    }
  };

  const handleDelete = async (userId, username) => {
    if (!confirm(`Delete user ${username}? This action cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_BASE_URL}/api/admin/users/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`🗑️ ${username} has been deleted`);
      fetchUsers();
      fetchPendingUsers();
    } catch (err) {
      alert(`❌ Failed to delete user: ${err.response?.data?.msg || err.message}`);
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      'super-admin': 'bg-purple-600 text-white',
      'admin': 'bg-blue-600 text-white',
      'pending': 'bg-gray-400 text-white'
    };
    return badges[role] || 'bg-gray-400 text-white';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'approved': 'bg-green-600 text-white',
      'pending': 'bg-yellow-600 text-white',
      'rejected': 'bg-red-600 text-white'
    };
    return badges[status] || 'bg-gray-400 text-white';
  };

  if (loading) {
    return <div className="p-8 text-center">Loading users...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <Link to="/" className="text-blue-600 hover:underline mt-4 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to="/" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
        <h1 className="text-3xl font-bold mt-4">User Management</h1>
        <p className="text-gray-600 mt-2">Manage admin users and approve pending requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2 px-4 ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}
        >
          Pending Requests ({pendingUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2 px-4 ${activeTab === 'all' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}
        >
          All Users ({users.length})
        </button>
      </div>

      {/* Pending Users Tab */}
      {activeTab === 'pending' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Pending Admin Requests</h2>
          {pendingUsers.length === 0 ? (
            <p className="text-gray-600">No pending admin requests.</p>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map(user => (
                <div key={user._id} className="bg-white p-6 rounded shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold">{user.username}</h3>
                      <p className="text-gray-600">{user.email}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Requested: {format(new Date(user.createdAt), 'PPpp')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(user._id, user.username)}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(user._id, user.username)}
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Users Tab */}
      {activeTab === 'all' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">All Users</h2>
          <div className="bg-white rounded shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-4">Username</th>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Role</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Created</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id} className="border-t">
                    <td className="p-4 font-semibold">{user.username}</td>
                    <td className="p-4">{user.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {format(new Date(user.createdAt), 'PP')}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {user.role !== 'super-admin' && user.status === 'approved' && (
                          <button
                            onClick={() => handlePromote(user._id, user.username)}
                            className="text-purple-600 hover:text-purple-800 text-sm"
                            title="Promote to Super Admin"
                          >
                            ⬆️ Promote
                          </button>
                        )}
                        {user._id !== currentUser?.id && (
                          <button
                            onClick={() => handleDelete(user._id, user.username)}
                            className="text-red-600 hover:text-red-800 text-sm"
                            title="Delete User"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

