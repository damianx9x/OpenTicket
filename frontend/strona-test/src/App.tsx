import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { TicketsOverview } from './components/TicketsOverview';
import { TicketsTable } from './components/TicketsTable';
import { TicketDetailModal } from './components/TicketDetailModal';
import { NewTicketModal } from './components/NewTicketModal';
import { Statistics } from './components/Statistics';
import { Users } from './components/Users';
import { VATRates } from './components/VATRates';
import { dataStore } from './services/dataStore';
import { Ticket } from './types';

type PageType = 'tickets' | 'statistics' | 'users' | 'vat';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('tickets');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>(dataStore.getAllTickets());
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    refreshTickets();
  }, []);

  const refreshTickets = () => {
    setTickets([...dataStore.getAllTickets()]);
  };

  const handleSelectTicket = (ticketId: string) => {
    const ticket = dataStore.getTicketById(ticketId);
    if (ticket) {
      setSelectedTicket(ticket);
      setIsDetailOpen(true);
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedTicket(null);
    refreshTickets();
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'tickets':
        return 'Panel Administratora / Lista Zgłoszeń';
      case 'statistics':
        return 'Panel Administratora / Statystyki';
      case 'users':
        return 'Panel Administratora / Użytkownicy';
      case 'vat':
        return 'Panel Administratora / Stawki VAT';
      default:
        return 'Panel Administratora';
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onPageChange={(page: string) => setCurrentPage(page as PageType)} />

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <TopHeader
          title={getPageTitle()}
          unreadCount={0}
          onNewTicket={() => setIsNewTicketOpen(true)}
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentPage === 'tickets' && (
            <div className="space-y-6">
              <TicketsOverview />
              <TicketsTable onSelectTicket={handleSelectTicket} tickets={tickets} />
            </div>
          )}

          {currentPage === 'statistics' && (
            <Statistics />
          )}

          {currentPage === 'users' && (
            <Users />
          )}

          {currentPage === 'vat' && (
            <VATRates />
          )}
        </div>
      </main>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
          onRefresh={refreshTickets}
        

      {/* New Ticket Modal */}
      <NewTicketModal
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onSuccess={(ticketId) => {
          setIsNewTicketOpen(false);
          refreshTickets();
          alert(`✓ Zgłoszenie #${ticketId} utworzone!`);
        }}
      />/>
      )}
    </div>
  );
}

export default App;
