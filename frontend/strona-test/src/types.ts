// Typy dla aplikacji - Serwis Apple
export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'new' | 'in_progress' | 'waiting_for_customer' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  deviceType: string; // MacBook Pro, Mac mini, iPhone, iPad, iMac, Apple Watch, etc
  customerName: string;
  customerPhone: string;
  serialNumber: string;
  assignedTo: string;
  createdAt: Date;
  updatedAt: Date;
  comments: Comment[];
  costItems: CostItem[];
  estimatedCost: number;
  actualCost: number;
  closedAt?: Date;
}

export interface Comment {
  id: string;
  ticketId: string;
  author: string;
  text: string;
  isInternal: boolean; // true = notatka wewnętrzna, false = odpowiedź dla klienta
  createdAt: Date;
}

export interface CostItem {
  id: string;
  ticketId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vat: number; // 0, 5, 8, 23
  total: number;
}

export const DEVICE_TYPES = [
  'MacBook Pro',
  'MacBook Air',
  'Mac mini',
  'iMac',
  'Mac Studio',
  'iPhone',
  'iPad',
  'iPad Pro',
  'Apple Watch',
  'AirPods',
  'AirPods Pro',
  'Apple TV',
  'Inne'
];

export const STATUSES = [
  { value: 'new', label: 'NEW', color: 'bg-blue-100 text-blue-700', bgColor: 'bg-blue-50' },
  { value: 'in_progress', label: 'IN_PROGRESS', color: 'bg-yellow-100 text-yellow-700', bgColor: 'bg-yellow-50' },
  { value: 'waiting_for_customer', label: 'WAITING_FOR_CUSTOMER', color: 'bg-purple-100 text-purple-700', bgColor: 'bg-purple-50' },
  { value: 'closed', label: 'CLOSED', color: 'bg-green-100 text-green-700', bgColor: 'bg-green-50' },
];

export const PRIORITIES = [
  { value: 'low', label: 'LOW', color: 'text-gray-500', bgColor: 'bg-gray-50' },
  { value: 'normal', label: 'NORMAL', color: 'text-blue-500', bgColor: 'bg-blue-50' },
  { value: 'high', label: 'HIGH', color: 'text-orange-600 font-semibold', bgColor: 'bg-orange-50' },
  { value: 'urgent', label: 'URGENT', color: 'text-red-600 font-bold', bgColor: 'bg-red-50' },
];

export const VAT_RATES = [
  { value: 0, label: 'Zwolnienie' },
  { value: 5, label: '5%' },
  { value: 8, label: '8%' },
  { value: 23, label: '23%' },
];

export const AGENTS = [
  'Anna Nowak',
  'Piotr Kowalczyk',
  'Marta Lewandowska',
  'Tomasz Wiśniewski',
  'Katarzyna Nowak',
  'Nieprzypisany'
];
