'use client';

import { useEffect, useState, useMemo } from 'react';

// --- TYPY DANYCH ---
interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'AGENT' | 'REPORTER';
}

interface VatRate {
  code: string;
  percent: number;
  name: string;
}

interface CostItem {
  id: string;
  name: string;
  qty: number;
  unitNet: number;
  vatCode: string;
}

interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  ownerId: string;
  assignedAgentId?: string;
  costItems: CostItem[];
  comments: { author: string; body: string; date: string }[];
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  date: string;
}

// --- DANE STARTOWE (MOCK) ---
const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Anna Nowak', email: 'anna@admin.pl', role: 'ADMIN' },
  { id: 'u2', name: 'Jan Kowalski', email: 'jan@agent.pl', role: 'AGENT' },
  { id: 'u3', name: 'Klient Testowy', email: 'klient@firma.pl', role: 'REPORTER' },
];

const INITIAL_VAT: VatRate[] = [
  { code: 'VAT23', percent: 23, name: 'Podstawowa 23%' },
  { code: 'VAT8', percent: 8, name: 'Obniżona 8%' },
  { code: 'ZW', percent: 0, name: 'Zwolniony' },
];

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 't1',
    number: 101,
    title: 'Awaria drukarki w księgowości',
    description: 'Drukarka HP nie odpowiada na pingi. Świeci się czerwona dioda.',
    status: 'NEW',
    priority: 'HIGH',
    createdAt: new Date().toISOString(),
    ownerId: 'u3',
    costItems: [],
    comments: []
  }
];

export default function DemoPage() {
  // --- STAN APLIKACJI ---
  const [isMounted, setIsMounted] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'tickets' | 'users' | 'vat'>('dashboard');
  
  // Dane (zapisywane w localStorage)
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [vatRates, setVatRates] = useState<VatRate[]>(INITIAL_VAT);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // UI State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Formularze
  const [newTicketForm, setNewTicketForm] = useState({ title: '', description: '', priority: 'NORMAL' });
  const [newCostForm, setNewCostForm] = useState({ name: '', qty: 1, unitNet: 0, vatCode: 'VAT23' });
  const [newComment, setNewComment] = useState('');

  // --- INICJALIZACJA ---
  useEffect(() => {
    setIsMounted(true);
    const savedTickets = localStorage.getItem('demo_tickets');
    if (savedTickets) {
      setTickets(JSON.parse(savedTickets));
    } else {
      setTickets(INITIAL_TICKETS);
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('demo_tickets', JSON.stringify(tickets));
    }
  }, [tickets, isMounted]);

  // --- LOGIKA BIZNESOWA ---

  const addNotification = (msg: string) => {
    const newNotif: Notification = {
      id: Date.now().toString(),
      message: msg,
      read: false,
      date: new Date().toLocaleTimeString()
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleCreateTicket = () => {
    const newTicket: Ticket = {
      id: Date.now().toString(),
      number: 100 + tickets.length + 1,
      title: newTicketForm.title,
      description: newTicketForm.description,
      priority: newTicketForm.priority,
      status: 'NEW',
      createdAt: new Date().toISOString(),
      ownerId: 'u1', // Domyślnie zalogowany admin
      costItems: [],
      comments: []
    };
    setTickets([newTicket, ...tickets]);
    setIsCreateModalOpen(false);
    setNewTicketForm({ title: '', description: '', priority: 'NORMAL' });
    addNotification(`Utworzono nowe zgłoszenie #${newTicket.number}`);
  };

  const handleUpdateStatus = (ticketId: string, newStatus: string) => {
    setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    }
    addNotification(`Zmieniono status zgłoszenia na ${newStatus}`);
  };

  const handleAddComment = () => {
    if (!selectedTicket || !newComment) return;
    const comment = { author: 'Anna Nowak', body: newComment, date: new Date().toLocaleString() };
    const updatedTicket = {
      ...selectedTicket,
      comments: [...selectedTicket.comments, comment]
    };
    
    setTickets(tickets.map(t => t.id === selectedTicket.id ? updatedTicket : t));
    setSelectedTicket(updatedTicket);
    setNewComment('');
  };

  const handleAddCostItem = () => {
    if (!selectedTicket) return;
    const item: CostItem = {
      id: Date.now().toString(),
      name: newCostForm.name,
      qty: Number(newCostForm.qty),
      unitNet: Number(newCostForm.unitNet),
      vatCode: newCostForm.vatCode
    };
    
    const updatedTicket = {
      ...selectedTicket,
      costItems: [...selectedTicket.costItems, item]
    };

    setTickets(tickets.map(t => t.id === selectedTicket.id ? updatedTicket : t));
    setSelectedTicket(updatedTicket);
    setNewCostForm({ name: '', qty: 1, unitNet: 0, vatCode: 'VAT23' });
  };

  // --- KALKULATOR VAT ---
  const calculateTotals = (items: CostItem[]) => {
    let totalNet = 0;
    let totalGross = 0;
    let totalVat = 0;

    items.forEach(item => {
      const rate = vatRates.find(r => r.code === item.vatCode)?.percent || 0;
      const lineNet = item.qty * item.unitNet;
      const lineVat = lineNet * (rate / 100);
      const lineGross = lineNet + lineVat;

      totalNet += lineNet;
      totalVat += lineVat;
      totalGross += lineGross;
    });

    return { totalNet, totalVat, totalGross };
  };

  // --- STATYSTYKI ---
  const stats = useMemo(() => ({
    open: tickets.filter(t => t.status !== 'CLOSED').length,
    urgent: tickets.filter(t => t.priority === 'URGENT').length,
    closed: tickets.filter(t => t.status === 'CLOSED').length,
    totalCost: tickets.reduce((acc, t) => acc + calculateTotals(t.costItems).totalGross, 0)
  }), [tickets]);

  if (!isMounted) return null;

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800">
      {/* Import ikon */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="h-16 flex items-center justify-center border-b border-slate-800 font-bold text-xl tracking-wider">
          <i className="fa-solid fa-layer-group mr-2"></i> DEMO
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setCurrentView('dashboard')} className={`w-full text-left px-4 py-3 rounded ${currentView === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <i className="fa-solid fa-chart-pie w-6"></i> Pulpit
          </button>
          <button onClick={() => setCurrentView('tickets')} className={`w-full text-left px-4 py-3 rounded ${currentView === 'tickets' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <i className="fa-solid fa-ticket w-6"></i> Zgłoszenia
          </button>
          <button onClick={() => setCurrentView('users')} className={`w-full text-left px-4 py-3 rounded ${currentView === 'users' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <i className="fa-solid fa-users w-6"></i> Użytkownicy
          </button>
          <button onClick={() => setCurrentView('vat')} className={`w-full text-left px-4 py-3 rounded ${currentView === 'vat' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <i className="fa-solid fa-calculator w-6"></i> Stawki VAT
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800 text-sm text-slate-400">
          Tryb: Symulator (Local)
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="h-16 bg-white shadow-sm flex justify-between items-center px-6">
          <h2 className="font-semibold text-lg capitalize">{currentView}</h2>
          <div className="flex items-center gap-4">
            {/* Powiadomienia */}
            <div className="relative">
              <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 text-gray-500 hover:text-blue-600 relative">
                <i className="fa-solid fa-bell text-xl"></i>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white shadow-xl rounded-lg border border-gray-100 z-50">
                  <div className="p-3 border-b font-bold text-sm">Powiadomienia</div>
                  <div className="max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-sm text-gray-400 text-center">Brak powiadomień</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="p-3 border-b hover:bg-gray-50 text-sm">
                          <p>{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{n.date}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm font-medium">
              <i className="fa-solid fa-plus mr-2"></i> Nowe Zgłoszenie
            </button>
          </div>
        </header>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* DASHBOARD VIEW */}
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
                <p className="text-gray-500 text-xs font-bold uppercase">Otwarte</p>
                <p className="text-3xl font-bold">{stats.open}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
                <p className="text-gray-500 text-xs font-bold uppercase">Pilne</p>
                <p className="text-3xl font-bold">{stats.urgent}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                <p className="text-gray-500 text-xs font-bold uppercase">Zamknięte</p>
                <p className="text-3xl font-bold">{stats.closed}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-purple-500">
                <p className="text-gray-500 text-xs font-bold uppercase">Wartość Brutto</p>
                <p className="text-3xl font-bold">{stats.totalCost.toFixed(2)} zł</p>
              </div>
            </div>
          )}

          {/* TICKETS VIEW */}
          {currentView === 'tickets' && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="min-w-full text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">Nr</th>
                    <th className="px-6 py-4">Temat</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Priorytet</th>
                    <th className="px-6 py-4">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {tickets.map(t => (
                    <tr key={t.id} onClick={() => setSelectedTicket(t)} className="hover:bg-blue-50 cursor-pointer transition">
                      <td className="px-6 py-4 font-mono text-gray-500">#{t.number}</td>
                      <td className="px-6 py-4 font-medium">{t.title}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          t.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                          t.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{t.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={t.priority === 'URGENT' ? 'text-red-600 font-bold' : 'text-gray-600'}>{t.priority}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* USERS VIEW */}
          {currentView === 'users' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold mb-4">Lista Użytkowników</h3>
              <ul className="space-y-2">
                {users.map(u => (
                  <li key={u.id} className="flex justify-between p-3 bg-gray-50 rounded border">
                    <span>{u.name} <span className="text-gray-400 text-sm">({u.email})</span></span>
                    <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">{u.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* VAT VIEW */}
          {currentView === 'vat' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold mb-4">Konfiguracja Stawek VAT</h3>
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3">Kod</th>
                    <th className="p-3">Nazwa</th>
                    <th className="p-3">Wartość %</th>
                  </tr>
                </thead>
                <tbody>
                  {vatRates.map(v => (
                    <tr key={v.code} className="border-b">
                      <td className="p-3 font-mono font-bold">{v.code}</td>
                      <td className="p-3">{v.name}</td>
                      <td className="p-3">{v.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* --- MODAL: CREATE TICKET --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Nowe Zgłoszenie</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tytuł</label>
                <input 
                  type="text" 
                  className="w-full border rounded p-2 mt-1"
                  value={newTicketForm.title}
                  onChange={e => setNewTicketForm({...newTicketForm, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Opis</label>
                <textarea 
                  className="w-full border rounded p-2 mt-1"
                  value={newTicketForm.description}
                  onChange={e => setNewTicketForm({...newTicketForm, description: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priorytet</label>
                <select 
                  className="w-full border rounded p-2 mt-1"
                  value={newTicketForm.priority}
                  onChange={e => setNewTicketForm({...newTicketForm, priority: e.target.value})}
                >
                  <option value="LOW">Niski</option>
                  <option value="NORMAL">Normalny</option>
                  <option value="HIGH">Wysoki</option>
                  <option value="URGENT">Pilny</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Anuluj</button>
                <button onClick={handleCreateTicket} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Utwórz</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: TICKET DETAILS --- */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50 transition-opacity">
          <div className="bg-white w-full md:w-2/3 h-full shadow-2xl flex flex-col animate-slide-in">
            {/* Header */}
            <div className="h-16 border-b flex items-center justify-between px-6 bg-gray-50">
              <div>
                <span className="text-xs font-mono text-gray-500">#{selectedTicket.number}</span>
                <h2 className="text-lg font-bold">{selectedTicket.title}</h2>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-600">
                <i className="fa-solid fa-xmark text-2xl"></i>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left: Chat & Info */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-4 rounded shadow-sm border">
                    <h4 className="font-bold text-sm text-gray-500 uppercase mb-2">Opis</h4>
                    <p className="text-gray-800">{selectedTicket.description}</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-gray-500 uppercase text-center">Komentarze</h4>
                    {selectedTicket.comments.length === 0 && <p className="text-center text-gray-400 text-sm">Brak komentarzy</p>}
                    {selectedTicket.comments.map((c, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span className="font-bold text-blue-600">{c.author}</span>
                          <span>{c.date}</span>
                        </div>
                        <p className="text-sm">{c.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Tools & Calculator */}
                <div className="space-y-6">
                  {/* Status Control */}
                  <div className="bg-white p-4 rounded shadow-sm border">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                    <select 
                      className="w-full border rounded p-2 mb-3"
                      value={selectedTicket.status}
                      onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value)}
                    >
                      <option value="NEW">NEW</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="WAITING_FOR_CUSTOMER">WAITING_FOR_CUSTOMER</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priorytet</label>
                    <div className="font-bold text-gray-800">{selectedTicket.priority}</div>
                  </div>

                  {/* Cost Calculator */}
                  <div className="bg-white p-4 rounded shadow-sm border">
                    <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                      <i className="fa-solid fa-calculator mr-2 text-blue-500"></i> Kalkulator Kosztów
                    </h3>
                    
                    {/* Add Item Form */}
                    <div className="bg-gray-50 p-3 rounded mb-4 text-sm space-y-2 border border-gray-200">
                      <input 
                        placeholder="Nazwa usługi/części" 
                        className="w-full border rounded p-1"
                        value={newCostForm.name}
                        onChange={e => setNewCostForm({...newCostForm, name: e.target.value})}
                      />
                      <div className="flex gap-2">
                        <input 
                          type="number" placeholder="Ilość" className="w-1/4 border rounded p-1"
                          value={newCostForm.qty}
                          onChange={e => setNewCostForm({...newCostForm, qty: Number(e.target.value)})}
                        />
                        <input 
                          type="number" placeholder="Cena Netto" className="w-1/3 border rounded p-1"
                          value={newCostForm.unitNet}
                          onChange={e => setNewCostForm({...newCostForm, unitNet: Number(e.target.value)})}
                        />
                        <select 
                          className="w-1/3 border rounded p-1"
                          value={newCostForm.vatCode}
                          onChange={e => setNewCostForm({...newCostForm, vatCode: e.target.value})}
                        >
                          {vatRates.map(v => <option key={v.code} value={v.code}>{v.code}</option>)}
                        </select>
                      </div>
                      <button onClick={handleAddCostItem} className="w-full bg-blue-600 text-white rounded py-1 text-xs hover:bg-blue-700">Dodaj pozycję</button>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2 mb-4">
                      {selectedTicket.costItems.map(item => (
                        <div key={item.id} className="flex justify-between text-xs border-b border-dashed pb-1">
                          <span>{item.name} ({item.qty}x)</span>
                          <span className="font-mono">{item.unitNet.toFixed(2)} + {item.vatCode}</span>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    {(() => {
                      const totals = calculateTotals(selectedTicket.costItems);
                      return (
                        <div className="bg-gray-100 p-3 rounded text-right space-y-1">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Netto:</span>
                            <span>{totals.totalNet.toFixed(2)} PLN</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>VAT:</span>
                            <span>{totals.totalVat.toFixed(2)} PLN</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold text-gray-800 pt-1 border-t border-gray-300">
                            <span>Brutto:</span>
                            <span>{totals.totalGross.toFixed(2)} PLN</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer: Add Comment */}
            <div className="p-4 border-t bg-white flex gap-2">
              <input 
                className="flex-1 border rounded px-4 py-2" 
                placeholder="Napisz komentarz..." 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              />
              <button onClick={handleAddComment} className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700">Wyślij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}