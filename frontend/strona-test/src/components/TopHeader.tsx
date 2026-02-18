import React from 'react';
import { Menu, LogOut, Bell, Plus } from 'lucide-react';

interface TopHeaderProps {
  title: string;
  unreadCount: number;
  onMenuClick: () => void;
  onNewTicket?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ title, unreadCount, onMenuClick, onNewTicket }) => {
  return (
    <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 z-10 border-b border-gray-200">
      <div className="flex items-center text-gray-500">
        <button onClick={onMenuClick} className="p-2 text-gray-400 hover:text-blue-600 transition md:hidden mr-2">
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-400 hover:text-blue-600 transition">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          )}
        </button>
        {onNewTicket && (
          <button
            onClick={onNewTicket}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nowe Zgłoszenie
          </button>
        )}
      </div>
    </header>
  );
};
