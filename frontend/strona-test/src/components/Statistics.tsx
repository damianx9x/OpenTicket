import React from 'react';
import { TrendingUp, BarChart3, Clock, AlertCircle } from 'lucide-react';
import { dataStore } from '../services/dataStore';

export const Statistics: React.FC = () => {
  const tickets = dataStore.getAllTickets();

  // Statystyki po statusach
  const statusStats = {
    new: tickets.filter(t => t.status === 'new').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    waitingForCustomer: tickets.filter(t => t.status === 'waiting_for_customer').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  // Statystyki po priorytetach
  const priorityStats = {
    urgent: tickets.filter(t => t.priority === 'urgent').length,
    high: tickets.filter(t => t.priority === 'high').length,
    normal: tickets.filter(t => t.priority === 'normal').length,
    low: tickets.filter(t => t.priority === 'low').length,
  };

  // Wydajność agentów
  const agentStats = new Map<string, number>();
  tickets.forEach(t => {
    if (t.assignedTo !== 'Nieprzypisany') {
      agentStats.set(t.assignedTo, (agentStats.get(t.assignedTo) || 0) + 1);
    }
  });

  // Średni czas obsługi (simulation)
  const closedTickets = tickets.filter(t => t.status === 'closed');
  const avgHandlingTime = closedTickets.length > 0
    ? Math.round(
        closedTickets.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime();
          const closed = t.closedAt ? new Date(t.closedAt).getTime() : Date.now();
          return sum + (closed - created);
        }, 0) / closedTickets.length / 3600000
      )
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
        <BarChart3 className="w-8 h-8 text-blue-600" />
        Statystyki
      </h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Razem zgłoszenia</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{tickets.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Średni czas obsługi</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{avgHandlingTime}h</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Otwarte / W toku</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {statusStats.new + statusStats.inProgress}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Zamknięte</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{statusStats.closed}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-6">Rozkład po statusach</h2>
          <div className="space-y-4">
            {[
              { label: 'Nowe', value: statusStats.new, color: 'bg-blue-500', width: '25%' },
              { label: 'W toku', value: statusStats.inProgress, color: 'bg-yellow-500', width: '30%' },
              { label: 'Oczekujące na klienta', value: statusStats.waitingForCustomer, color: 'bg-purple-500', width: '15%' },
              { label: 'Zamknięte', value: statusStats.closed, color: 'bg-green-500', width: '40%' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  <span className="text-sm font-bold text-gray-800">{item.value}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`${item.color} h-full rounded-full`} style={{ width: item.width }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-6">Rozkład po priorytetach</h2>
          <div className="space-y-4">
            {[
              { label: 'URGENT', value: priorityStats.urgent, color: 'bg-red-500' },
              { label: 'HIGH', value: priorityStats.high, color: 'bg-orange-500' },
              { label: 'NORMAL', value: priorityStats.normal, color: 'bg-blue-500' },
              { label: 'LOW', value: priorityStats.low, color: 'bg-gray-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-6">Wydajność agentów</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200">
              <tr className="text-xs font-semibold text-gray-600 uppercase">
                <th className="text-left py-3 px-4">Technik</th>
                <th className="text-right py-3 px-4">Liczba zgłoszeń</th>
                <th className="text-right py-3 px-4">% z całości</th>
                <th className="text-left py-3 px-4">Wizualizacja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Array.from(agentStats.entries()).map(([agent, count]) => (
                <tr key={agent} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-800">{agent}</td>
                  <td className="py-3 px-4 text-right text-sm font-bold text-gray-600">{count}</td>
                  <td className="py-3 px-4 text-right text-sm font-bold text-blue-600">
                    {((count / tickets.length) * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(count / Math.max(...agentStats.values())) * 100}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
