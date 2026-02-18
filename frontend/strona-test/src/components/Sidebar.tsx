import React from 'react';
import { Headphones, Ticket, BarChart3, Users, DollarSign } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onPageChange
}) => {
  const menuItems = [
    { id: 'tickets', label: 'Zgłoszenia', icon: Ticket },
    { id: 'statistics', label: 'Statystyki', icon: BarChart3 },
    { id: 'users', label: 'Użytkownicy', icon: Users },
    { id: 'vat', label: 'Stawki VAT', icon: DollarSign },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20 hidden md:flex">
      {/* Header */}
      <div className="h-16 flex items-center justify-center border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-wider">
          <Headphones className="w-6 h-6 inline-block mr-2" />
          HELPDESK
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="ml-3 font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm">AN</div>
          <div>
            <p className="text-sm font-semibold">Anna Nowak</p>
            <p className="text-xs text-slate-400">Administrator</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
