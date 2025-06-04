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
  const [loading, setLoading] = useState(false);

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

  const createLicenses = async (duration, quantity) => {
    try {
      const response = await axios.post(`${API}/admin/create-licenses`, {
        duration_days: duration,
        quantity: quantity
      });
      fetchLicenses(); // Refresh licenses
      alert(`${quantity} Lizenzen erstellt!`);
      return response.data;
    } catch (error) {
      console.error('Error creating licenses:', error);
      alert('Fehler beim Erstellen der Lizenzen');
    }
  };

  const performUserAction = async (userId, action, value = null) => {
    try {
      await axios.post(`${API}/admin/user-action`, {
        user_id: userId,
        action: action,
        value: value
      });
      fetchUsers(); // Refresh users
      alert(`Aktion '${action}' erfolgreich ausgeführt!`);
    } catch (error) {
      console.error('Error performing user action:', error);
      alert('Fehler bei der Benutzeraktion');
    }
  };

  const respondToTicket = async (ticketId, response) => {
    try {
      await axios.post(`${API}/admin/respond-ticket/${ticketId}`, null, {
        params: { response }
      });
      fetchTickets(); // Refresh tickets
      alert('Antwort erfolgreich gesendet!');
    } catch (error) {
      console.error('Error responding to ticket:', error);
      alert('Fehler beim Senden der Antwort');
    }
  };

  // Auto-refresh data every 5 seconds
  useEffect(() => {
    const fetchAllData = () => {
      fetchUsers();
      fetchLicenses();
      fetchTickets();
      fetchActivities();
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Helper functions
  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  const isLicenseExpired = (expiry) => {
    return new Date(expiry) < new Date();
  };

  // Dashboard Component
  const Dashboard = () => {
    const activeUsers = users.filter(u => u.is_active && !u.is_banned && u.license_expires && !isLicenseExpired(u.license_expires));
    const expiredUsers = users.filter(u => u.license_expires && isLicenseExpired(u.license_expires));
    const bannedUsers = users.filter(u => u.is_banned);
    const unusedLicenses = licenses.filter(l => !l.is_used);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400">Aktive Benutzer</h3>
            <p className="text-2xl font-bold text-green-400">{activeUsers.length}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400">Abgelaufene Lizenzen</h3>
            <p className="text-2xl font-bold text-red-400">{expiredUsers.length}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400">Gesperrte Benutzer</h3>
            <p className="text-2xl font-bold text-yellow-400">{bannedUsers.length}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-sm font-medium text-gray-400">Verfügbare Lizenzen</h3>
            <p className="text-2xl font-bold text-blue-400">{unusedLicenses.length}</p>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">🔍 Bot-Aktivitäten</h3>
          <div className="max-h-96 overflow-y-auto">
            {activities.map((activity, index) => (
              <div key={index} className="border-b border-gray-700 py-3 last:border-b-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-medium">
                      @{activity.username || 'Unknown'} - {activity.action}
                    </p>
                    <p className="text-gray-400 text-sm">{activity.message}</p>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {formatDateTime(activity.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Users Component
  const Users = () => (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">👥 Benutzer-Verwaltung</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-gray-700">
            <tr>
              <th className="px-6 py-3">Telegram ID</th>
              <th className="px-6 py-3">Username</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Lizenz</th>
              <th className="px-6 py-3">Läuft ab</th>
              <th className="px-6 py-3">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="bg-gray-800 border-b border-gray-700">
                <td className="px-6 py-4 text-white">{user.telegram_id}</td>
                <td className="px-6 py-4 text-white">@{user.username || 'N/A'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    user.is_banned 
                      ? 'bg-red-600 text-red-100' 
                      : user.is_active
                      ? 'bg-green-600 text-green-100'
                      : 'bg-gray-600 text-gray-100'
                  }`}>
                    {user.is_banned ? 'Gesperrt' : user.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                  {user.license_key ? user.license_key.substring(0, 8) + '...' : 'Keine'}
                </td>
                <td className="px-6 py-4">
                  {user.license_expires ? (
                    <span className={`text-xs ${
                      isLicenseExpired(user.license_expires) ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {formatDateTime(user.license_expires)}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-1">
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
                      {user.is_banned ? 'Entsperren' : 'Sperren'}
                    </button>
                    {user.license_expires && (
                      <button
                        onClick={() => {
                          const days = prompt('Lizenz um wie viele Tage verlängern?', '30');
                          if (days && !isNaN(days)) {
                            performUserAction(user.id, 'extend_license', parseInt(days));
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                      >
                        Verlängern
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
  );

  // Licenses Component
  const Licenses = () => (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">🔑 Neue Lizenzen erstellen</h3>
        <div className="flex space-x-4">
          <button
            onClick={() => createLicenses(30, 1)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            1 Lizenz (30 Tage)
          </button>
          <button
            onClick={() => createLicenses(30, 5)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            5 Lizenzen (30 Tage)
          </button>
          <button
            onClick={() => {
              const duration = prompt('Dauer in Tagen:', '30');
              const quantity = prompt('Anzahl:', '1');
              if (duration && quantity && !isNaN(duration) && !isNaN(quantity)) {
                createLicenses(parseInt(duration), parseInt(quantity));
              }
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            Benutzerdefiniert
          </button>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">📝 Lizenz-Übersicht</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700">
              <tr>
                <th className="px-6 py-3">Lizenz-Key</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Dauer</th>
                <th className="px-6 py-3">Verwendet von</th>
                <th className="px-6 py-3">Aktiviert am</th>
                <th className="px-6 py-3">Läuft ab</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id} className="bg-gray-800 border-b border-gray-700">
                  <td className="px-6 py-4 text-white font-mono text-xs">{license.license_key}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      license.is_used 
                        ? 'bg-red-600 text-red-100' 
                        : 'bg-green-600 text-green-100'
                    }`}>
                      {license.is_used ? 'Verwendet' : 'Verfügbar'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{license.duration_days} Tage</td>
                  <td className="px-6 py-4 text-gray-400">
                    {license.used_by_telegram_id || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {license.activated_at ? formatDateTime(license.activated_at) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {license.expires_at ? (
                      <span className={
                        isLicenseExpired(license.expires_at) ? 'text-red-400' : 'text-green-400'
                      }>
                        {formatDateTime(license.expires_at)}
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
    </div>
  );

  // Tickets Component
  const Tickets = () => (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">🎫 Support-Tickets</h3>
      <div className="space-y-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  ticket.status === 'open' 
                    ? 'bg-yellow-600 text-yellow-100' 
                    : 'bg-green-600 text-green-100'
                }`}>
                  {ticket.status === 'open' ? 'Offen' : 'Geschlossen'}
                </span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  ticket.type === 'purchase' 
                    ? 'bg-blue-600 text-blue-100' 
                    : 'bg-purple-600 text-purple-100'
                }`}>
                  {ticket.type === 'purchase' ? 'Kauf' : 'Support'}
                </span>
              </div>
              <span className="text-gray-400 text-xs">
                {formatDateTime(ticket.created_at)}
              </span>
            </div>
            <p className="text-white mb-2">Telegram ID: {ticket.telegram_id}</p>
            <p className="text-gray-300 mb-3">{ticket.message}</p>
            {ticket.admin_response && (
              <div className="bg-gray-600 p-3 rounded mb-3">
                <p className="text-green-400 font-medium">Admin-Antwort:</p>
                <p className="text-gray-200">{ticket.admin_response}</p>
              </div>
            )}
            {ticket.status === 'open' && (
              <button
                onClick={() => {
                  const response = prompt('Ihre Antwort:');
                  if (response) {
                    respondToTicket(ticket.id, response);
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Antworten
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
          <h1 className="text-2xl font-bold text-white">🔐 License System Dashboard</h1>
          <p className="text-gray-400">Lizenz-Verwaltung und Bot-Monitoring</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex space-x-8">
            {['dashboard', 'users', 'licenses', 'tickets'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab === 'dashboard' && '📊 Dashboard'}
                {tab === 'users' && '👥 Benutzer'}
                {tab === 'licenses' && '🔑 Lizenzen'}
                {tab === 'tickets' && '🎫 Tickets'}
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