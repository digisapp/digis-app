import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-auth';
import { 
  UserGroupIcon, 
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  VideoCameraIcon,
  UserCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, admins, creators, fans
  const [updating, setUpdating] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/admin/users`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId, updates) => {
    setUpdating(prev => ({ ...prev, [userId]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/admin/users/${userId}/role`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(updates)
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'User updated successfully');
        
        // Update local state
        setUsers(prev => prev.map(user => 
          user.supabase_id === userId 
            ? { ...user, ...updates }
            : user
        ));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    } finally {
      setUpdating(prev => ({ ...prev, [userId]: false }));
    }
  };

  const toggleAdmin = (user) => {
    updateUserRole(user.supabase_id, {
      is_super_admin: !user.is_super_admin,
      role: !user.is_super_admin ? 'admin' : 'user'
    });
  };

  const toggleCreator = (user) => {
    updateUserRole(user.supabase_id, {
      is_creator: !user.is_creator,
      creator_type: !user.is_creator ? 'Creator' : null
    });
  };

  const filteredUsers = users.filter(user => {
    // Apply search filter
    const matchesSearch = searchTerm === '' || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase());

    // Apply role filter
    let matchesFilter = true;
    if (filter === 'admins') matchesFilter = user.is_super_admin;
    else if (filter === 'creators') matchesFilter = user.is_creator;
    else if (filter === 'fans') matchesFilter = !user.is_creator && !user.is_super_admin;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UserGroupIcon className="w-7 h-7 text-purple-600" />
          User Management
        </h2>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email, username, or display name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'admins', 'creators', 'fans'].map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                filter === filterType
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {filterType}
            </button>
          ))}
        </div>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Users</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {users.filter(u => u.is_super_admin).length}
          </div>
          <div className="text-sm text-red-600 dark:text-red-400">Admins</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {users.filter(u => u.is_creator).length}
          </div>
          <div className="text-sm text-purple-600 dark:text-purple-400">Creators</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {users.filter(u => !u.is_creator && !u.is_super_admin).length}
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400">Fans</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">User</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Username</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Admin</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Creator</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Joined</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-8">
                  <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-500">Loading users...</p>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-500">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.supabase_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user.display_name || user.email}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-700 dark:text-gray-300">
                      {user.username || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {user.is_super_admin ? (
                      <ShieldCheckIcon className="w-5 h-5 text-red-600 mx-auto" />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {user.is_creator ? (
                      <VideoCameraIcon className="w-5 h-5 text-purple-600 mx-auto" />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => toggleAdmin(user)}
                        disabled={updating[user.supabase_id]}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          user.is_super_admin
                            ? 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
                        } ${updating[user.supabase_id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={user.is_super_admin ? 'Remove Admin' : 'Make Admin'}
                      >
                        {updating[user.supabase_id] ? (
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        ) : user.is_super_admin ? (
                          'Remove Admin'
                        ) : (
                          'Make Admin'
                        )}
                      </button>
                      <button
                        onClick={() => toggleCreator(user)}
                        disabled={updating[user.supabase_id]}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          user.is_creator
                            ? 'bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
                        } ${updating[user.supabase_id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={user.is_creator ? 'Remove Creator' : 'Make Creator'}
                      >
                        {updating[user.supabase_id] ? (
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        ) : user.is_creator ? (
                          'Remove Creator'
                        ) : (
                          'Make Creator'
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Special Note for nathan@digis.cc */}
      {filteredUsers.some(u => u.email === 'nathan@digis.cc') && (
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Note:</strong> nathan@digis.cc is {
              filteredUsers.find(u => u.email === 'nathan@digis.cc')?.is_super_admin 
                ? 'currently an admin' 
                : 'not currently an admin'
            }. Use the buttons above to change their role.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;