import React, { useState } from 'react';
import { Users as UsersIcon, Plus, Edit2, Trash2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'AGENT' | 'REPORTER' | 'VIEWER';
  status: 'active' | 'inactive';
  joinDate: Date;
}

export const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      name: 'Anna Nowak',
      email: 'anna@apple-service.pl',
      role: 'ADMIN',
      status: 'active',
      joinDate: new Date('2024-01-15'),
    },
    {
      id: '2',
      name: 'Piotr Kowalczyk',
      email: 'piotr@apple-service.pl',
      role: 'AGENT',
      status: 'active',
      joinDate: new Date('2024-02-10'),
    },
    {
      id: '3',
      name: 'Marta Lewandowska',
      email: 'marta@apple-service.pl',
      role: 'AGENT',
      status: 'active',
      joinDate: new Date('2024-02-10'),
    },
    {
      id: '4',
      name: 'Tomasz Wiśniewski',
      email: 'tomasz@apple-service.pl',
      role: 'AGENT',
      status: 'inactive',
      joinDate: new Date('2023-11-20'),
    },
    {
      id: '5',
      name: 'Katarzyna Nowak',
      email: 'katarzyna@apple-service.pl',
      role: 'REPORTER',
      status: 'active',
      joinDate: new Date('2024-02-01'),
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'AGENT' as const,
  });

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { bg: string; text: string; label: string }> = {
      ADMIN: { bg: 'bg-red-100', text: 'text-red-800', label: 'Administrator' },
      AGENT: { bg: 'bg-green-100', text: 'text-green-800', label: 'Technik' },
      REPORTER: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Zgłaszający' },
      VIEWER: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Obserwator' },
    };
    const r = roles[role];
    return <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${r.bg} ${r.text}`}>{r.label}</span>;
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Aktywny</span>
    ) : (
      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Nieaktywny</span>
    );
  };

  const handleAddUser = () => {
    if (newUser.name && newUser.email) {
      setUsers([
        ...users,
        {
          id: String(users.length + 1),
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          status: 'active',
          joinDate: new Date(),
        },
      ]);
      setNewUser({ name: '', email: '', role: 'AGENT' });
      setShowAddModal(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-blue-600" />
          Użytkownicy
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Dodaj użytkownika
        </button>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Dodaj nowego użytkownika</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Imię i nazwisko"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="AGENT">Technik</option>
                <option value="REPORTER">Zgłaszający</option>
                <option value="VIEWER">Obserwator</option>
              </select>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleAddUser}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Dodaj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs font-semibold text-gray-600 uppercase">
                <th className="px-6 py-4">Imię i Nazwisko</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Rola</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Dołączył</th>
                <th className="px-6 py-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
                  <td className="px-6 py-4 text-gray-600">{user.joinDate.toLocaleDateString('pl-PL')}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <button className="text-blue-600 hover:text-blue-700 transition">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-700 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase mb-1">Razem użytkowników</p>
          <p className="text-2xl font-bold text-gray-800">{users.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase mb-1">Aktywni</p>
          <p className="text-2xl font-bold text-green-600">{users.filter(u => u.status === 'active').length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase mb-1">Technicy</p>
          <p className="text-2xl font-bold text-blue-600">{users.filter(u => u.role === 'AGENT').length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase mb-1">Administratorzy</p>
          <p className="text-2xl font-bold text-red-600">{users.filter(u => u.role === 'ADMIN').length}</p>
        </div>
      </div>
    </div>
  );
};
