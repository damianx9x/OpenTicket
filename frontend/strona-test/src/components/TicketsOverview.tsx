import React from 'react';
import { Folder, Flame, Clock, CheckCheck } from 'lucide-react';
import { dataStore } from '../services/dataStore';

export const TicketsOverview: React.FC = () => {
  const tickets = dataStore.getAllTickets();
  
  const stats = {
    new: tickets.filter(t => t.status === 'new').length,
    urgent: tickets.filter(t => t.priority === 'urgent').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    closedToday: tickets.filter(t => 
      t.status === 'closed' && 
      t.closedAt && 
      new Date(t.closedAt).toDateString() === new Date().toDateString()
    ).length,
    total: tickets.length,
  };

  const statCards = [
    {
      icon: Folder,
      color: 'bg-blue-50 text-blue-600',
      label: 'Otwarte',
      value: stats.new,
      bgDark: 'bg-blue-600'
    },
    {
      icon: Flame,
      color: 'bg-red-50 text-red-600',
      label: 'Pilne (Urgent)',
      value: stats.urgent,
      bgDark: 'bg-red-600'
    },
    {
      icon: Clock,
      color: 'bg-yellow-50 text-yellow-600',
      label: 'W toku',
      value: stats.inProgress,
      bgDark: 'bg-yellow-600'
    },
    {
      icon: CheckCheck,
      color: 'bg-green-50 text-green-600',
      label: 'Zamknięte (Dziś)',
      value: stats.closedToday,
      bgDark: 'bg-green-600'
    }
  ];

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">{card.label}</p>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-full ${card.color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Notes */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Informacje</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Razem zgłoszeń:</strong> {stats.total}
            </p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-700">
              <strong>Czekające na klienta:</strong> {tickets.filter(t => t.status === 'waiting_for_customer').length}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-700">
              <strong>Zamknięte razem:</strong> {tickets.filter(t => t.status === 'closed').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
