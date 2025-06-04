import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [activities, setActivities] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(false);

  // License creation form state
  const [licenseForm, setLicenseForm] = useState({
    days: '',
    hours: '',
    minutes: '',
    quantity: 1,
    maxExecutions: -1
  });

  // Fetch data functions
  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchLicenses = async () => {
    try {
      const response = await axios.get(`${API}/licenses`);
      setLicenses(response.data);
    } catch (error) {
      console.error('Error fetching licenses:', error);
    }
  };

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/tickets`);
      setTickets(response.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await axios.get(`${API}/activities`);
      setActivities(response.data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchExecutions = async () => {
    try {
      const response = await axios.get(`${API}/script-executions`);
      setExecutions(response.data);
    } catch (error) {
      console.error('Error fetching executions:', error);
    }
  };

  const deleteUser = async (userId) => {
    if (window.confirm('Benutzer wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) {
      try {
        await axios.delete(`${API}/admin/user/${userId}`);
        fetchUsers();
        alert('Benutzer gelöscht!');
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Fehler beim Löschen des Benutzers');
      }
    }
  };

  const clearLogs = async (type) => {
    if (window.confirm(`Alle ${type} wirklich löschen?`)) {
      try {
        await axios.delete(`${API}/admin/clear-logs/${type}`);
        if (type === 'activities') fetchActivities();
        if (type === 'executions') fetchExecutions();
        alert(`${type} gelöscht!`);
      } catch (error) {
        console.error('Error clearing logs:', error);
        alert('Fehler beim Löschen der Logs');
      }
    }
  };

  const calculateDurationDays = () => {
    const days = parseInt(licenseForm.days) || 0;
    const hours = parseInt(licenseForm.hours) || 0;
    const minutes = parseInt(licenseForm.minutes) || 0;
    
    return days + (hours / 24) + (minutes / 1440);
  };

  const createLicenses = async (duration, quantity = 1, maxExecutions = -1) => {
    try {
      const response = await axios.post(`${API}/admin/create-licenses`, {
        duration_days: duration,
        quantity: quantity,
        max_executions: maxExecutions
      });
      fetchLicenses();
      alert(`${quantity} Lizenz(en) erstellt!`);
      return response.data;
    } catch (error) {
      console.error('Error creating licenses:', error);
      alert('Fehler beim Erstellen der Lizenzen');
    }
  };

  const createCustomLicenses = () => {
    const duration = calculateDurationDays();
    if (duration <= 0) {
      alert('Bitte geben Sie eine gültige Dauer ein.');
      return;
    }
    createLicenses(duration, licenseForm.quantity, licenseForm.maxExecutions);
    setLicenseForm({ days: '', hours: '', minutes: '', quantity: 1, maxExecutions: -1 });
  };

  const performUserAction = async (userId, action, value = null) => {
    try {
      await axios.post(`${API}/admin/user-action`, {
        user_id: userId,
        action: action,
        value: value
      });
      fetchUsers();
      alert(`Aktion '${action}' erfolgreich ausgeführt!`);
    } catch (error) {
      console.error('Error performing user action:', error);
      alert('Fehler bei der Benutzeraktion');
    }
  };

  const deleteTicket = async (ticketId) => {
    if (window.confirm('Ticket wirklich löschen?')) {
      try {
        await axios.delete(`${API}/admin/ticket/${ticketId}`);
        fetchTickets();
        alert('Ticket gelöscht!');
      } catch (error) {
        console.error('Error deleting ticket:', error);
        alert('Fehler beim Löschen');
      }
    }
  };

  const respondToTicket = async (ticketId, response) => {
    try {
      await axios.post(`${API}/admin/respond-ticket/${ticketId}`, null, {
        params: { response }
      });
      fetchTickets();
      alert('Antwort erfolgreich gesendet!');
    } catch (error) {
      console.error('Error responding to ticket:', error);
      alert('Fehler beim Senden der Antwort');
    }
  };

  // Auto-refresh data every 3 seconds
  useEffect(() => {
    const fetchAllData = () => {
      fetchUsers();
      fetchLicenses();
      fetchTickets();
      fetchActivities();
      fetchExecutions();
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Helper functions
  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  const isLicenseExpired = (expiry) => {
    return new Date(expiry) < new Date();
  };

  const getTimeRemaining = (expiry) => {
    const now = new Date();
    const expiryDate = new Date(expiry);
    const diff = expiryDate - now;
    
    if (diff <= 0) return "Abgelaufen";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Help Component
  const Help = () => (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">System Documentation</h3>
        
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-medium text-white mb-2">User Status Types</h4>
            <div className="space-y-2">
              <div className="bg-gray-700 p-3 rounded">
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-green-100">Aktiv</span>
                  <span className="text-gray-300">User has valid license and can use the system</span>
                </div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-red-100">Banned</span>
                  <span className="text-gray-300">User is permanently blocked from using the system</span>
                </div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-orange-600 text-orange-100">Locked</span>
                  <span className="text-gray-300">User is temporarily locked and can request unlock</span>
                </div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-600 text-gray-100">Inaktiv</span>
                  <span className="text-gray-300">User has no valid license</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium text-white mb-2">Admin Actions</h4>
            <div className="space-y-2">
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">Ban/Unban</div>
                <div className="text-gray-300 text-sm">Permanently block or unblock a user from the system</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">Lock/Unlock</div>
                <div className="text-gray-300 text-sm">Temporarily restrict user access. User can request unlock via ticket</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">Reset License</div>
                <div className="text-gray-300 text-sm">Remove user's current license and reset execution counter</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">Extend License</div>
                <div className="text-gray-300 text-sm">Add additional time to existing license</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">Delete User</div>
                <div className="text-gray-300 text-sm">Permanently remove user and all associated data</div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium text-white mb-2">License System</h4>
            <div className="space-y-2">
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">Duration</div>
                <div className="text-gray-300 text-sm">Set license validity in days, hours, and minutes</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">Max Executions</div>
                <div className="text-gray-300 text-sm">Limit how many times user can run the program (-1 = unlimited)</div>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">License States</div>
                <div className="text-gray-300 text-sm">Available, Used, Reset - tracks license lifecycle</div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium text-white mb-2">Bot Commands</h4>
            <div className="bg-gray-700 p-3 rounded">
              <div className="font-mono text-sm space-y-1">
                <div><span className="text-blue-400">/start</span> - Smart start (license check → program or purchase options)</div>
                <div><span className="text-blue-400">/buy</span> - Request license purchase</div>
                <div><span className="text-blue-400">/license activate [KEY]</span> - Activate license with key</div>
                <div><span className="text-blue-400">/status</span> - Check license status and remaining time</div>
                <div><span className="text-blue-400">/unlock</span> - Request account unlock</div>
                <div><span className="text-blue-400">/help</span> - Show available commands</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Dashboard Component
  const Dashboard = () => {
    const activeUsers = users.filter(u => u.is_active && !u.is_banned && !u.is_locked && u.license_expires && !isLicenseExpired(u.license_expires));
    const expiredUsers = users.filter(u => u.license_expires && isLicenseExpired(u.license_expires));
    const bannedUsers = users.filter(u => u.is_banned);
    const lockedUsers = users.filter(u => u.is_locked);
    const unusedLicenses = licenses.filter(l => !l.is_used);
    const openTickets = tickets.filter(t => t.status === 'open');

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-xs font-medium text-gray-400">Active Users</h3>
            <p className="text-xl font-bold text-green-400">{activeUsers.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-xs font-medium text-gray-400">Expired</h3>
            <p className="text-xl font-bold text-red-400">{expiredUsers.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-xs font-medium text-gray-400">Banned</h3>
            <p className="text-xl font-bold text-yellow-400">{bannedUsers.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-xs font-medium text-gray-400">Locked</h3>
            <p className="text-xl font-bold text-orange-400">{lockedUsers.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-xs font-medium text-gray-400">Available Licenses</h3>
            <p className="text-xl font-bold text-blue-400">{unusedLicenses.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-xs font-medium text-gray-400">Open Tickets</h3>
            <p className="text-xl font-bold text-purple-400">{openTickets.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Bot Activities</h3>
              <button
                onClick={() => clearLogs('activities')}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                Clear Logs
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {activities.slice(0, 15).map((activity, index) => (
                <div key={index} className="border-b border-gray-700 py-2 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white text-sm font-medium">
                        @{activity.username || 'Unknown'} - {activity.action}
                      </p>
                      <p className="text-gray-400 text-xs">{activity.message}</p>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {formatDateTime(activity.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Script Executions</h3>
              <button
                onClick={() => clearLogs('executions')}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                Clear Logs
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {executions.slice(0, 15).map((execution, index) => (
                <div key={index} className="border-b border-gray-700 py-2 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white text-sm font-medium">
                        User: {execution.telegram_id}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Status: <span className={execution.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                          {execution.status}
                        </span>
                      </p>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {formatDateTime(execution.execution_time)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Users Component
  const Users = () => (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">User Management</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-gray-700">
            <tr>
              <th className="px-4 py-3">Telegram ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">License</th>
              <th className="px-4 py-3">Remaining</th>
              <th className="px-4 py-3">Executions</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="bg-gray-800 border-b border-gray-700">
                <td className="px-4 py-4 text-white">{user.telegram_id}</td>
                <td className="px-4 py-4 text-white">
                  <div>
                    <div className="font-medium">@{user.username || 'N/A'}</div>
                    <div className="text-xs text-gray-400">
                      {user.first_name} {user.last_name}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    user.is_banned 
                      ? 'bg-red-600 text-red-100' 
                      : user.is_locked
                      ? 'bg-orange-600 text-orange-100'
                      : user.is_active
                      ? 'bg-green-600 text-green-100'
                      : 'bg-gray-600 text-gray-100'
                  }`}>
                    {user.is_banned ? 'Banned' : user.is_locked ? 'Locked' : user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-4 text-gray-400 font-mono text-xs">
                  {user.license_key ? user.license_key.substring(0, 8) + '...' : 'None'}
                </td>
                <td className="px-4 py-4">
                  {user.license_expires ? (
                    <span className={`text-xs ${
                      isLicenseExpired(user.license_expires) ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {getTimeRemaining(user.license_expires)}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">N/A</span>
                  )}
                </td>
                <td className="px-4 py-4 text-blue-400 font-bold">
                  {user.script_executions || 0}
                </td>
                <td className="px-4 py-4 text-gray-400 text-xs">
                  {user.last_login ? formatDateTime(user.last_login) : 'Never'}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => {
                        const action = user.is_banned ? 'unban' : 'ban';
                        performUserAction(user.id, action);
                      }}
                      className={`px-2 py-1 rounded text-xs ${
                        user.is_banned 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-red-600 hover:bg-red-700'
                      } text-white`}
                    >
                      {user.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    <button
                      onClick={() => {
                        const action = user.is_locked ? 'unlock' : 'lock';
                        performUserAction(user.id, action);
                      }}
                      className={`px-2 py-1 rounded text-xs ${
                        user.is_locked 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-orange-600 hover:bg-orange-700'
                      } text-white`}
                    >
                      {user.is_locked ? 'Unlock' : 'Lock'}
                    </button>
                    {user.license_key && (
                      <>
                        <button
                          onClick={() => {
                            const days = prompt('Extend license by how many days?', '30');
                            if (days && !isNaN(days)) {
                              performUserAction(user.id, 'extend_license', parseInt(days));
                            }
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs"
                        >
                          Extend
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Really reset license?')) {
                              performUserAction(user.id, 'reset_license');
                            }
                          }}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs"
                        >
                          Reset
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="bg-red-800 hover:bg-red-900 text-white px-2 py-1 rounded text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Licenses Component
  const Licenses = () => (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">License Overview</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700">
              <tr>
                <th className="px-4 py-3">License Key</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Max Executions</th>
                <th className="px-4 py-3">Used By</th>
                <th className="px-4 py-3">Activated</th>
                <th className="px-4 py-3">Expires</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id} className="bg-gray-800 border-b border-gray-700">
                  <td className="px-4 py-4 text-white font-mono text-xs">{license.license_key}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      license.is_reset
                        ? 'bg-yellow-600 text-yellow-100'
                        : license.is_used 
                        ? 'bg-red-600 text-red-100' 
                        : 'bg-green-600 text-green-100'
                    }`}>
                      {license.is_reset ? 'Reset' : license.is_used ? 'Used' : 'Available'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-400">{license.duration_days}d</td>
                  <td className="px-4 py-4 text-gray-400">
                    {license.max_executions === -1 ? '∞' : license.max_executions}
                  </td>
                  <td className="px-4 py-4 text-gray-400">
                    {license.used_by_telegram_id || 'N/A'}
                  </td>
                  <td className="px-4 py-4 text-gray-400 text-xs">
                    {license.activated_at ? formatDateTime(license.activated_at) : 'N/A'}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {license.expires_at ? (
                      <span className={
                        isLicenseExpired(license.expires_at) ? 'text-red-400' : 'text-green-400'
                      }>
                        {getTimeRemaining(license.expires_at)}
                      </span>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* License Creation */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Create Licenses</h3>
        
        {/* Quick Create Buttons */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-white mb-3">Quick Create (Single License)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => createLicenses(1)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
            >
              1 Day
            </button>
            <button
              onClick={() => createLicenses(7)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
            >
              1 Week
            </button>
            <button
              onClick={() => createLicenses(30)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
            >
              1 Month
            </button>
            <button
              onClick={() => createLicenses(365)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
            >
              1 Year
            </button>
          </div>
        </div>

        {/* Custom Create Form */}
        <div>
          <h4 className="text-md font-medium text-white mb-3">Custom Create</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Duration</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <input
                    type="number"
                    placeholder="Days"
                    value={licenseForm.days}
                    onChange={(e) => setLicenseForm({...licenseForm, days: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                  <label className="text-xs text-gray-400">Days</label>
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Hours"
                    value={licenseForm.hours}
                    onChange={(e) => setLicenseForm({...licenseForm, hours: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                  <label className="text-xs text-gray-400">Hours</label>
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Minutes"
                    value={licenseForm.minutes}
                    onChange={(e) => setLicenseForm({...licenseForm, minutes: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                  <label className="text-xs text-gray-400">Minutes</label>
                </div>
              </div>
            </div>
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Quantity</label>
                <input
                  type="number"
                  placeholder="1"
                  value={licenseForm.quantity}
                  onChange={(e) => setLicenseForm({...licenseForm, quantity: parseInt(e.target.value)})}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Max Executions</label>
                <input
                  type="number"
                  placeholder="-1"
                  value={licenseForm.maxExecutions}
                  onChange={(e) => setLicenseForm({...licenseForm, maxExecutions: parseInt(e.target.value)})}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                />
                <div className="text-xs text-gray-400 mt-1">-1 = Unlimited</div>
              </div>
            </div>
          </div>
          <button
            onClick={createCustomLicenses}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
          >
            Create Custom License(s)
          </button>
        </div>
      </div>
    </div>
  );

  // Tickets Component
  const Tickets = () => (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Support Tickets</h3>
      <div className="space-y-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
            <div className="flex justify-between items-start mb-2">
              <div className="flex space-x-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  ticket.status === 'open' 
                    ? 'bg-yellow-600 text-yellow-100' 
                    : 'bg-green-600 text-green-100'
                }`}>
                  {ticket.status === 'open' ? 'Open' : 'Closed'}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  ticket.type === 'purchase' 
                    ? 'bg-blue-600 text-blue-100' 
                    : ticket.type === 'unlock'
                    ? 'bg-orange-600 text-orange-100'
                    : 'bg-purple-600 text-purple-100'
                }`}>
                  {ticket.type === 'purchase' ? 'Purchase' : ticket.type === 'unlock' ? 'Unlock' : 'Support'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-xs">
                  {formatDateTime(ticket.created_at)}
                </span>
                <button
                  onClick={() => deleteTicket(ticket.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-white mb-2">
              <strong>Telegram ID:</strong> {ticket.telegram_id}
            </p>
            <p className="text-gray-300 mb-3">{ticket.message}</p>
            {ticket.admin_response && (
              <div className="bg-gray-600 p-3 rounded mb-3">
                <p className="text-green-400 font-medium">Admin Response:</p>
                <p className="text-gray-200">{ticket.admin_response}</p>
              </div>
            )}
            {ticket.status === 'open' && (
              <button
                onClick={() => {
                  const response = prompt('Your response:');
                  if (response) {
                    respondToTicket(ticket.id, response);
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Respond
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white">License System</h1>
          <p className="text-gray-400">Advanced License Management Platform</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex space-x-8">
            {['dashboard', 'users', 'licenses', 'tickets', 'help'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'users' && <Users />}
        {activeTab === 'licenses' && <Licenses />}
        {activeTab === 'tickets' && <Tickets />}
        {activeTab === 'help' && <Help />}
      </main>

      {/* Auto-refresh indicator */}
      <div className="fixed bottom-4 right-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-gray-400 text-sm">Live Updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;