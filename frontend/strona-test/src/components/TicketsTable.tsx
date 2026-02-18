import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, AlertCircle } from 'lucide-react';
import { Ticket, STATUSES, PRIORITIES } from '../types';
import { ticketsAPI } from '../services/api';

interface TicketsTableProps {
  onSelectTicket: (ticketId: string) => void;
  tickets: Ticket[];
}

export const TicketsTable: React.FC<TicketsTableProps> = ({ onSelectTicket, tickets: initialTickets }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tickets when filters change
  useEffect(() => {
    loadTickets();
  }, [filterStatus, filterPriority, searchTerm]);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ticketsAPI.getAll({
        status: filterStatus || undefined,
        priority: filterPriority || undefined,
        search: searchTerm || undefined,
      });

      if (response.success && response.data) {
        setTickets(response.data);
      } else {
        setError(response.error || 'Failed to load tickets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || ticket.status === filterStatus;
    const matchesPriority = !filterPriority || ticket.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find(st => st.value === status);
    return s;
  };

  const getPriorityBadge = (priority: string) => {
    const p = PRIORITIES.find(pr => pr.value === priority);
    return p;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
      {/* Filters  */}
      <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj po tytule, ID lub kliencie..."
            value={searchTerm}
        {loading && (
          <div className="text-center py-8 text-gray-500">
            <p>⏳ Ładuję tickety...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 p-4 m-4 rounded-lg border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>Nie znaleziono zgłoszeń spełniających kryteria</p>
          </div>
        )}

        {!loading && tickets.length > 0 && (tety</option>
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Temat</th>
              <th className="px-6 py-4">Zgłaszający</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Priorytet</th>
              <th className="px-6 py-4">Przypisany</th>
              <th className="px-6 py-4 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Nie znaleziono zgłoszeń spełniających kryteria
                </td>
              </tr>
            ) : (
              filteredTickets.map(ticket => {
                const status = getStatusBadge(ticket.status);
                const priority = getPriorityBadge(ticket.priority);
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket.id)}
                    className="hover:bg-blue-50 transition cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono text-gray-500">#{ticket.id}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{ticket.title}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                          {ticket.customerName.substring(0, 1)}
                        </div>
                        <span className="text-sm">{ticket.customerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status?.color}`}>
                        {status?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${priority?.color}`}>
                        {priority?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{ticket.assignedTo}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-gray-400 group-hover:text-blue-600 transition">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
