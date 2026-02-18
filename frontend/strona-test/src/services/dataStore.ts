import { Ticket, Comment, CostItem } from '../types';

// Symulacja bazy danych w pamięci
class DataStore {
  private tickets: Map<string, Ticket> = new Map();
  private nextTicketId = 1;

  constructor() {
    this.initializeDemo();
  }

  private initializeDemo() {
    // Dodaj przykładowe zgłoszenia dla serwisu Apple
    const demoTickets: Ticket[] = [
      {
        id: '36',
        title: 'Nie działa internet na 2. piętrze',
        description: 'W całym biurze na 2. piętrze nie ma dostępu do internetu. Diody na switchu mrugają na pomarańczowo. Próbowaliśmy restartu routera, ale nie pomogło. Proszę o pilną interwencję, dział handlowy nie może pracować.',
        status: 'in_progress',
        priority: 'urgent',
        deviceType: 'Mac mini',
        customerName: 'Jan Kowalski',
        customerPhone: '+48 123 456 789',
        serialNumber: 'C02A1234567890',
        assignedTo: 'Anna Nowak',
        createdAt: new Date(Date.now() - 3600000 * 2),
        updatedAt: new Date(Date.now() - 1800000),
        comments: [
          {
            id: 'c1',
            ticketId: '36',
            author: 'Anna Nowak',
            text: 'Przyjęłam zgłoszenie. Jadę na miejsce sprawdzić główny switch.',
            isInternal: false,
            createdAt: new Date(Date.now() - 1800000)
          },
          {
            id: 'c2',
            ticketId: '36',
            author: 'Anna Nowak',
            text: 'Switch Cisco się przegrzał. Konieczna wymiana wentylatora lub całego urządzenia. Zamawiam część.',
            isInternal: true,
            createdAt: new Date(Date.now() - 600000)
          }
        ],
        costItems: [
          {
            id: 'ci1',
            ticketId: '36',
            description: 'Wentylator do switcha Cisco',
            quantity: 1,
            unitPrice: 450,
            vat: 23,
            total: 554.50
          },
          {
            id: 'ci2',
            ticketId: '36',
            description: 'Usługi techniczne (2 godz)',
            quantity: 2,
            unitPrice: 150,
            vat: 23,
            total: 369
          }
        ],
        estimatedCost: 923.50,
        actualCost: 0
      },
      {
        id: '35',
        title: 'Wymiana myszki w foyer',
        description: 'Myszka biurowa nie reaguje na kliknięcia. Pytanie: co to Apple mouse czy zwykła? Potrzebna wymiana ASAP.',
        status: 'new',
        priority: 'low',
        deviceType: 'Apple Mouse',
        customerName: 'Marek Kamiński',
        customerPhone: '+48 987 654 321',
        serialNumber: 'N/A',
        assignedTo: 'Nieprzypisany',
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 86400000),
        comments: [],
        costItems: [
          {
            id: 'ci3',
            ticketId: '35',
            description: 'Apple Magic Mouse 2 (wymiana)',
            quantity: 1,
            unitPrice: 320,
            vat: 23,
            total: 393.60
          }
        ],
        estimatedCost: 393.60,
        actualCost: 0
      },
      {
        id: '34',
        title: 'Problem z drukarką (Księgowość)',
        description: 'Drukarka Brother HL-L8360CDW nie drukuje z MacBook Księgowości. Inne komputery drukują OK. Błąd: 102 w systemie.',
        status: 'waiting_for_customer',
        priority: 'high',
        deviceType: 'MacBook Pro',
        customerName: 'Ewa Dąbrowska',
        customerPhone: '+48 555 123 456',
        serialNumber: 'H8K9L2M3N4P5Q6R7',
        assignedTo: 'Anna Nowak',
        createdAt: new Date(Date.now() - 86400000 * 2),
        updatedAt: new Date(Date.now() - 3600000),
        comments: [
          {
            id: 'c3',
            ticketId: '34',
            author: 'Piotr Kowalczyk',
            text: 'Zresetowałem drukarkę i MacBooka. Czekam na potwierdzenie od klienta, czy działa.',
            isInternal: false,
            createdAt: new Date(Date.now() - 3600000)
          }
        ],
        costItems: [
          {
            id: 'ci4',
            ticketId: '34',
            description: 'Diagnostyka sieciowa',
            quantity: 1,
            unitPrice: 180,
            vat: 23,
            total: 221.40
          }
        ],
        estimatedCost: 221.40,
        actualCost: 0
      },
      {
        id: '33',
        title: 'Zamknięto: Wymiana baterii w MacBook',
        description: 'MacBook Air z 2018r. nie podtrzymuje ładowania. Wymiana baterii wymagana. Wykonano wymianę na nową baterię.',
        status: 'closed',
        priority: 'normal',
        deviceType: 'MacBook Air',
        customerName: 'Tomasz Lewandowski',
        customerPhone: '+48 777 888 999',
        serialNumber: 'C02ABC1234567890',
        assignedTo: 'Marta Lewandowska',
        createdAt: new Date(Date.now() - 86400000 * 5),
        updatedAt: new Date(Date.now() - 86400000),
        closedAt: new Date(Date.now() - 86400000),
        comments: [
          {
            id: 'c4',
            ticketId: '33',
            author: 'Marta Lewandowska',
            text: 'Wymieniona bateria Apple A1405. Testowana i pracuje prawidłowo. Gwarancja 12 miesięcy.',
            isInternal: false,
            createdAt: new Date(Date.now() - 86400000 * 1)
          }
        ],
        costItems: [
          {
            id: 'ci5',
            ticketId: '33',
            description: 'Bateria Apple A1405 (MacBook Air)',
            quantity: 1,
            unitPrice: 450,
            vat: 23,
            total: 553.50
          },
          {
            id: 'ci6',
            ticketId: '33',
            description: 'Usługi montażu i testowania',
            quantity: 1,
            unitPrice: 120,
            vat: 23,
            total: 147.60
          }
        ],
        estimatedCost: 701.10,
        actualCost: 701.10
      },
      {
        id: '32',
        title: 'iPhone 12 - zbita obudowa (ekran)',
        description: 'Klient przyniósł iPhone 12 z pęknięciem ekranu u góry. Wymaga wymiany wyświetlacza.',
        status: 'in_progress',
        priority: 'high',
        deviceType: 'iPhone',
        customerName: 'Katarzyna Wojcik',
        customerPhone: '+48 444 555 666',
        serialNumber: 'F1A1B2C3D4E5F6G7',
        assignedTo: 'Tomasz Wiśniewski',
        createdAt: new Date(Date.now() - 86400000 * 1),
        updatedAt: new Date(Date.now() - 3600000),
        comments: [
          {
            id: 'c5',
            ticketId: '32',
            author: 'Tomasz Wiśniewski',
            text: 'Rozpoczęty demontaż i diagnostyka. Ekran rzeczywiście pęknięty, LCD pracuje. Czekam na dostawę zamiennika.',
            isInternal: true,
            createdAt: new Date(Date.now() - 3600000)
          }
        ],
        costItems: [
          {
            id: 'ci7',
            ticketId: '32',
            description: 'Wyświetlacz LCD do iPhone 12',
            quantity: 1,
            unitPrice: 280,
            vat: 23,
            total: 344.40
          },
          {
            id: 'ci8',
            ticketId: '32',
            description: 'Usługi montażu',
            quantity: 1,
            unitPrice: 100,
            vat: 23,
            total: 123
          }
        ],
        estimatedCost: 467.40,
        actualCost: 0
      }
    ];

    demoTickets.forEach(ticket => {
      this.tickets.set(ticket.id, ticket);
      this.nextTicketId = Math.max(this.nextTicketId, parseInt(ticket.id) + 1);
    });
  }

  // Zgłoszenia
  getAllTickets(): Ticket[] {
    return Array.from(this.tickets.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getTicketById(id: string): Ticket | undefined {
    return this.tickets.get(id);
  }

  createTicket(
    title: string,
    description: string,
    deviceType: string,
    customerName: string,
    customerPhone: string,
    serialNumber: string,
    priority: string
  ): Ticket {
    const id = String(this.nextTicketId++);
    const ticket: Ticket = {
      id,
      title,
      description,
      status: 'new',
      priority: priority as any,
      deviceType,
      customerName,
      customerPhone,
      serialNumber,
      assignedTo: 'Nieprzypisany',
      createdAt: new Date(),
      updatedAt: new Date(),
      comments: [],
      costItems: [],
      estimatedCost: 0,
      actualCost: 0
    };
    this.tickets.set(id, ticket);
    return ticket;
  }

  updateTicket(id: string, updates: Partial<Ticket>): Ticket | undefined {
    const ticket = this.tickets.get(id);
    if (ticket) {
      const updated = { ...ticket, ...updates, updatedAt: new Date() };
      this.tickets.set(id, updated);
      return updated;
    }
    return undefined;
  }

  deleteTicket(id: string): boolean {
    return this.tickets.delete(id);
  }

  // Komentarze
  addComment(ticketId: string, author: string, text: string, isInternal: boolean): Comment | undefined {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      const comment: Comment = {
        id: `c_${Date.now()}`,
        ticketId,
        author,
        text,
        isInternal,
        createdAt: new Date()
      };
      ticket.comments.push(comment);
      ticket.updatedAt = new Date();
      return comment;
    }
    return undefined;
  }

  deleteComment(ticketId: string, commentId: string): boolean {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      const index = ticket.comments.findIndex(c => c.id === commentId);
      if (index > -1) {
        ticket.comments.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  // Koszty
  addCostItem(ticketId: string, description: string, quantity: number, unitPrice: number, vat: number): CostItem | undefined {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      const costItem: CostItem = {
        id: `ci_${Date.now()}`,
        ticketId,
        description,
        quantity,
        unitPrice,
        vat,
        total: quantity * unitPrice * (1 + vat / 100)
      };
      ticket.costItems.push(costItem);
      ticket.estimatedCost = this.calculateTotalCost(ticket);
      ticket.updatedAt = new Date();
      return costItem;
    }
    return undefined;
  }

  deleteCostItem(ticketId: string, costItemId: string): boolean {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      const index = ticket.costItems.findIndex(c => c.id === costItemId);
      if (index > -1) {
        ticket.costItems.splice(index, 1);
        ticket.estimatedCost = this.calculateTotalCost(ticket);
        return true;
      }
    }
    return false;
  }

  calculateTotalCost(ticket: Ticket): number {
    return ticket.costItems.reduce((sum, item) => sum + item.total, 0);
  }
}

export const dataStore = new DataStore();
