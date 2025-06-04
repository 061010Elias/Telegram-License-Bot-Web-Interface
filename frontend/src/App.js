import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [accounts, setAccounts] = useState([]);
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

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/tickets`);
      setTickets(response.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API}/accounts`);
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
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

  const addCredits = async (userId, credits) => {
    try {
      await axios.post(`${API}/admin/add-credits`, {
        user_id: userId,
        credits_to_add: credits
      });
      fetchUsers(); // Refresh users
      alert('Credits added successfully!');
    } catch (error) {
      console.error('Error adding credits:', error);
      alert('Error adding credits');
    }
  };

  const respondToTicket = async (ticketId, response) => {
    try {
      await axios.post(`${API}/admin/respond-ticket/${ticketId}`, null, {
        params: { response }
      });
      fetchTickets(); // Refresh tickets
      alert('Response sent successfully!');
    } catch (error) {
      console.error('Error responding to ticket:', error);
      alert('Error sending response');
    }
  };

  const sendMessage = async (telegramId, message) => {
    try {
      await axios.post(`${API}/admin/send-message`, null, {
        params: { telegram_id: telegramId, message }
      });
      alert('Message sent successfully!');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message');
    }
  };

  // Auto-refresh data every 5 seconds
  useEffect(() => {
    const fetchAllData = () => {
      fetchUsers();
      fetchTickets();
      fetchAccounts();
      fetchActivities();
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Dashboard Component
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400">Total Users</h3>
          <p className="text-2xl font-bold text-white">{users.length}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400">Open Tickets</h3>
          <p className="text-2xl font-bold text-yellow-400">
            {tickets.filter(t => t.status === 'open').length}
          </p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400">Available Accounts</h3>
          <p className="text-2xl font-bold text-green-400">
            {accounts.filter(a => a.is_available).length}
          </p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400">Total Credits</h3>
          <p className="text-2xl font-bold text-blue-400">
            {users.reduce((sum, user) => sum + user.credits, 0)}
          </p>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
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
                  {new Date(activity.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Users Component
  const Users = () => (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Users Management</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-gray-700">
            <tr>
              <th className="px-6 py-3">Telegram ID</th>
              <th className="px-6 py-3">Username</th>
              <th className="px-6 py-3">Credits</th>
              <th className="px-6 py-3">Last Activity</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="bg-gray-800 border-b border-gray-700">
                <td className="px-6 py-4 text-white">{user.telegram_id}</td>
                <td className="px-6 py-4 text-white">@{user.username || 'N/A'}</td>
                <td className="px-6 py-4 text-green-400 font-bold">{user.credits}</td>
                <td className="px-6 py-4 text-gray-400">
                  {new Date(user.last_activity).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => {
                      const credits = prompt('How many credits to add?');
                      if (credits && !isNaN(credits)) {
                        addCredits(user.id, parseInt(credits));
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm mr-2"
                  >
                    Add Credits
                  </button>
                  <button
                    onClick={() => {
                      const message = prompt('Message to send:');
                      if (message) {
                        sendMessage(user.telegram_id, message);
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Send Message
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              <div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  ticket.status === 'open' 
                    ? 'bg-yellow-600 text-yellow-100' 
                    : 'bg-green-600 text-green-100'
                }`}>
                  {ticket.status}
                </span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  ticket.type === 'payment' 
                    ? 'bg-blue-600 text-blue-100' 
                    : 'bg-purple-600 text-purple-100'
                }`}>
                  {ticket.type}
                </span>
              </div>
              <span className="text-gray-400 text-xs">
                {new Date(ticket.created_at).toLocaleString()}
              </span>
            </div>
            <p className="text-white mb-2">Telegram ID: {ticket.telegram_id}</p>
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

  // Accounts Component
  const Accounts = () => (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Account Management</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-gray-700">
            <tr>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Username</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Info</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="bg-gray-800 border-b border-gray-700">
                <td className="px-6 py-4 text-white">{account.type}</td>
                <td className="px-6 py-4 text-white">{account.username}</td>
                <td className="px-6 py-4 text-gray-400">{account.email || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-400">{account.additional_info || 'N/A'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    account.is_available 
                      ? 'bg-green-600 text-green-100' 
                      : 'bg-red-600 text-red-100'
                  }`}>
                    {account.is_available ? 'Available' : 'Used'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white">🤖 Telegram Bot Dashboard</h1>
          <p className="text-gray-400">Monitor and manage your Telegram bot</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex space-x-8">
            {['dashboard', 'users', 'tickets', 'accounts'].map((tab) => (
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
        {activeTab === 'tickets' && <Tickets />}
        {activeTab === 'accounts' && <Accounts />}
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