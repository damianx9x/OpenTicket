'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  ArrowDownUp,
  CheckCheck,
  ChevronRight,
  Clock3,
  DollarSign,
  Download,
  ExternalLink,
  Flame,
  Folder,
  GripHorizontal,
  Image as ImageIcon,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Smartphone,
  Ticket as TicketIcon,
  Users,
  X,
} from 'lucide-react';
import { getMe, getStoredToken, getStoredUser, logout, type AuthUser } from '@/lib/auth-client';
import { applyRuntimeApiBaseFromSetupStatus, buildApiUrl, checkSetupStatus } from '@/lib/setup-client';
import {
  addComment,
  addCostItem,
  asNumber,
  createTicket,
  getTicketDetails,
  getCustomerHistory,
  listComments,
  listCostItems,
  listTickets,
  type TicketStatusHistoryEntry,
  updateTicket,
  type CommentItem,
  type CostItem,
  type CostSummary,
  type CreateTicketInput,
  type TicketChannel,
  type TicketPriority,
  type TicketStatus,
  type TicketSummary,
} from '@/lib/tickets-client';
import {
  addUserNote,
  createUser as createAppUser,
  getMyPreferences,
  listUserNotes,
  listUsers as listAppUsers,
  saveMyPreferences,
  setTechnicianSignupCode,
  updateUser as updateAppUser,
  type AppUser,
  type UserNote,
} from '@/lib/users-client';
import { getStatisticsOverview, type StatisticsOverview } from '@/lib/statistics-client';
import { exportBackup, importBackupByPath, importBackupFromFile } from '@/lib/backup-client';
import {
  getAdminSettings,
  sendTestEmail,
  sendTestSms,
  type SystemSettings,
  updateAdminSettings,
} from '@/lib/settings-client';
import {
  deleteAttachment,
  getAttachmentFileUrl,
  listAttachments,
  uploadAttachment,
  type TicketAttachment,
} from '@/lib/attachments-client';
import {
  createReminder,
  deleteReminder,
  listReminders,
  markReminderDone,
  type ReminderItem,
} from '@/lib/reminders-client';
import {
  getDiagnosticsReport,
  getSystemInfo,
  loadDemoDataset,
  type DiagnosticsReport,
  type SystemInfo,
} from '@/lib/system-client';
import {
  normalizeLanguage,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  SUPPORTED_LANGUAGES,
  type UILanguage,
} from '@/lib/i18n';
import { ApiRequestError } from '@/lib/api-base';
import { listCostCatalog, saveCostCatalog, type CostCatalogItem } from '@/lib/cost-catalog-client';

const PRIORITIES: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const CHANNELS: TicketChannel[] = ['APP', 'WEB_FORM', 'EMAIL', 'DROP_OFF'];
const WORKFLOW_STATUSES: TicketStatus[] = [
  'RECEIVED',
  'DIAGNOSIS',
  'QUOTE_READY',
  'PARTS_ORDERED',
  'WAITING_FOR_APPROVAL',
  'SENT_TO_CUSTOMER',
  'CLOSED',
];
const FILTER_STATUSES: TicketStatus[] = [
  ...WORKFLOW_STATUSES,
  'ARCHIVED',
  'NEW',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'RESOLVED',
];
const VAT_CODES = ['23', '8', '5', '0', 'ZW'];

type Notice = {
  type: 'success' | 'error';
  text: string;
};

const emptyTicketForm: CreateTicketInput = {
  title: '',
  description: '',
  priority: 'NORMAL',
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  deviceType: '',
  serialNumber: '',
};

const emptyCostForm = {
  name: '',
  qty: '1',
  unitNet: '0',
  vatCode: '23',
};

const emptyReminderForm = {
  title: '',
  note: '',
  dueAt: '',
};

const STATUS_META: Record<TicketStatus, { className: string }> = {
  RECEIVED: { className: 'bg-blue-100 text-blue-700' },
  DIAGNOSIS: { className: 'bg-amber-100 text-amber-700' },
  QUOTE_READY: { className: 'bg-fuchsia-100 text-fuchsia-700' },
  PARTS_ORDERED: { className: 'bg-cyan-100 text-cyan-700' },
  WAITING_FOR_APPROVAL: { className: 'bg-violet-100 text-violet-700' },
  SENT_TO_CUSTOMER: { className: 'bg-emerald-100 text-emerald-700' },
  NEW: { className: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { className: 'bg-amber-100 text-amber-700' },
  WAITING_FOR_CUSTOMER: { className: 'bg-violet-100 text-violet-700' },
  RESOLVED: { className: 'bg-emerald-100 text-emerald-700' },
  CLOSED: { className: 'bg-green-100 text-green-700' },
  ARCHIVED: { className: 'bg-slate-200 text-slate-600' },
};

const PRIORITY_META: Record<TicketPriority, { className: string }> = {
  LOW: { className: 'text-slate-500' },
  NORMAL: { className: 'text-blue-600' },
  HIGH: { className: 'font-semibold text-orange-600' },
  URGENT: { className: 'font-bold text-red-600' },
};

const LEGACY_STATUS_TO_WORKFLOW: Partial<Record<TicketStatus, TicketStatus>> = {
  NEW: 'RECEIVED',
  IN_PROGRESS: 'DIAGNOSIS',
  WAITING_FOR_CUSTOMER: 'WAITING_FOR_APPROVAL',
  RESOLVED: 'SENT_TO_CUSTOMER',
  ARCHIVED: 'CLOSED',
};

const ACTIVE_SERVICE_STATUSES = new Set<TicketStatus>([
  'RECEIVED',
  'DIAGNOSIS',
  'QUOTE_READY',
  'PARTS_ORDERED',
  'WAITING_FOR_APPROVAL',
  'SENT_TO_CUSTOMER',
  'NEW',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
]);

const WAITING_FOR_CUSTOMER_STATUSES = new Set<TicketStatus>([
  'WAITING_FOR_APPROVAL',
  'WAITING_FOR_CUSTOMER',
]);

const CLOSED_STATUSES = new Set<TicketStatus>(['CLOSED', 'ARCHIVED']);

function toWorkflowStatus(status: TicketStatus): TicketStatus {
  return LEGACY_STATUS_TO_WORKFLOW[status] || status;
}

const NAV_ITEMS = [
  { id: 'tickets', labelPl: 'Zgłoszenia', labelEn: 'Tickets', icon: TicketIcon },
  { id: 'statistics', labelPl: 'Statystyki', labelEn: 'Statistics', icon: BarChart3 },
  { id: 'users', labelPl: 'Użytkownicy', labelEn: 'Users', icon: Users },
  { id: 'profile', labelPl: 'Mój interfejs', labelEn: 'My UI', icon: Settings2 },
  { id: 'vat', labelPl: 'Konfiguracja', labelEn: 'Settings', icon: Settings2 },
  { id: 'server', labelPl: 'Serwer', labelEn: 'Server', icon: Server },
] as const;

type NavItemId = (typeof NAV_ITEMS)[number]['id'];

type DashboardWidgetKey = 'open' | 'urgent' | 'inProgress' | 'closedToday';
type DashboardWidgetSize = 'sm' | 'md' | 'lg';
type DashboardTheme = 'helpdesk-blue' | 'graphite-noir' | 'emerald-flow';

const DASHBOARD_WIDGET_ORDER_DEFAULT: DashboardWidgetKey[] = ['open', 'urgent', 'inProgress', 'closedToday'];
const DASHBOARD_WIDGET_SIZES_DEFAULT: Record<DashboardWidgetKey, DashboardWidgetSize> = {
  open: 'md',
  urgent: 'md',
  inProgress: 'md',
  closedToday: 'md',
};
const DASHBOARD_THEMES: Array<{ value: DashboardTheme; label: string }> = [
  { value: 'helpdesk-blue', label: 'Nordic Blue Pro' },
  { value: 'graphite-noir', label: 'Graphite Noir Pro' },
  { value: 'emerald-flow', label: 'Emerald Focus Pro' },
];

type FilterState = {
  search: string;
  status: string;
  priority: string;
  channel: string;
  assignedAgentId: string;
  assignedState: '' | 'assigned' | 'unassigned';
  onlyMine: boolean;
  minAgeDays: string;
  hasAttachments: '' | 'yes' | 'no';
  hasComments: '' | 'yes' | 'no';
  createdFrom: string;
  createdTo: string;
  sort:
    | 'createdAt_desc'
    | 'createdAt_asc'
    | 'updatedAt_desc'
    | 'updatedAt_asc'
    | 'priority_desc'
    | 'priority_asc'
    | 'number_desc'
    | 'number_asc'
    | 'status_desc'
    | 'status_asc';
};

type SavedFilterPreset = {
  name: string;
  status?: string;
  priority?: string;
  channel?: string;
  assignedAgentId?: string;
  assignedState?: '' | 'assigned' | 'unassigned';
  search?: string;
  onlyMine?: boolean;
  minAgeDays?: number;
  hasAttachments?: boolean;
  hasComments?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sort?: FilterState['sort'];
};

type DashboardPreferences = {
  widgetOrder?: DashboardWidgetKey[];
  widgetSizes?: Partial<Record<DashboardWidgetKey, DashboardWidgetSize>>;
  savedFilters?: SavedFilterPreset[];
  compactMode?: boolean;
  theme?: DashboardTheme;
  defaultFilters?: {
    status?: string;
    priority?: string;
    channel?: string;
    assignedAgentId?: string;
    assignedState?: '' | 'assigned' | 'unassigned';
    onlyMine?: boolean;
    minAgeDays?: number;
    hasAttachments?: boolean;
    hasComments?: boolean;
    createdFrom?: string;
    createdTo?: string;
    sort?: FilterState['sort'];
  };
};

const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  status: '',
  priority: '',
  channel: '',
  assignedAgentId: '',
  assignedState: '',
  onlyMine: false,
  minAgeDays: '',
  hasAttachments: '',
  hasComments: '',
  createdFrom: '',
  createdTo: '',
  sort: 'createdAt_desc',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('pl-PL');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function humanizeCheckReason(reason?: string): string {
  switch (reason) {
    case 'redis-not-configured':
      return 'Redis nie jest skonfigurowany';
    case 'storage-mode-local':
      return 'Tryb lokalnego storage';
    case 's3-config-missing':
      return 'Brak konfiguracji S3/MinIO';
    default:
      return reason || 'brak';
  }
}

function renderCheckStatus(check?: { ok: boolean; reason?: string; skipped?: boolean }): string {
  if (!check) {
    return '-';
  }

  if (check.skipped) {
    return check.reason ? `NIEAKTYWNE (${humanizeCheckReason(check.reason)})` : 'NIEAKTYWNE';
  }

  if (check.ok) {
    return 'OK';
  }

  return `BŁĄD (${humanizeCheckReason(check.reason)})`;
}

export default function DashboardPage() {
  const [bootLoading, setBootLoading] = useState(true);
  const [activeNav, setActiveNav] = useState<NavItemId>('tickets');
  const [uiLanguage, setUiLanguage] = useState<UILanguage>(() => {
    if (typeof window === 'undefined') {
      return 'pl';
    }
    return normalizeLanguage(window.localStorage.getItem('ts_ui_language'));
  });
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser());
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [attachmentPreview, setAttachmentPreview] = useState<{
    attachmentId: string;
    filename: string;
    url: string;
  } | null>(null);
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary>({
    netTotal: 0,
    vatTotal: 0,
    grossTotal: 0,
    itemCount: 0,
  });
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingCost, setSubmittingCost] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dashboardPrefs, setDashboardPrefs] = useState<DashboardPreferences>({
    widgetOrder: DASHBOARD_WIDGET_ORDER_DEFAULT,
    widgetSizes: DASHBOARD_WIDGET_SIZES_DEFAULT,
    savedFilters: [],
    compactMode: false,
    theme: 'helpdesk-blue',
  });
  const [draggingWidget, setDraggingWidget] = useState<DashboardWidgetKey | null>(null);

  const [statistics, setStatistics] = useState<StatisticsOverview | null>(null);
  const [statisticsLoading, setStatisticsLoading] = useState(false);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [userNoteText, setUserNoteText] = useState('');
  const [editingUser, setEditingUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
    phone: string;
    password: string;
    disabled: boolean;
  } | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'AGENT',
    phone: '',
    password: '',
  });

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [signupCode, setSignupCode] = useState('');
  const [backupPath, setBackupPath] = useState('');
  const [backupFileToImport, setBackupFileToImport] = useState<File | null>(null);
  const [loadingDemoDataset, setLoadingDemoDataset] = useState(false);
  const [costCatalog, setCostCatalog] = useState<CostCatalogItem[]>([]);
  const [costCatalogSaving, setCostCatalogSaving] = useState(false);
  const [catalogEditor, setCatalogEditor] = useState<CostCatalogItem>({
    id: '',
    name: '',
    unitNet: 0,
    vatCode: '23',
    defaultQty: 1,
    category: '',
    unit: '',
    active: true,
  });
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [selectedPresetName, setSelectedPresetName] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testSmsTo, setTestSmsTo] = useState('');
  const [serverInfo, setServerInfo] = useState<SystemInfo | null>(null);
  const [serverDiagnostics, setServerDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [backupBeforeUpdate, setBackupBeforeUpdate] = useState(true);

  const [ticketReminders, setTicketReminders] = useState<ReminderItem[]>([]);
  const [globalReminders, setGlobalReminders] = useState<ReminderItem[]>([]);
  const [ticketStatusHistory, setTicketStatusHistory] = useState<TicketStatusHistoryEntry[]>([]);
  const [showReminderPanel, setShowReminderPanel] = useState(false);
  const [newReminder, setNewReminder] = useState(emptyReminderForm);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [assignableAgents, setAssignableAgents] = useState<AppUser[]>([]);
  const [assignmentDraft, setAssignmentDraft] = useState('');
  const [assigningTicket, setAssigningTicket] = useState(false);
  const [updatingWorkflow, setUpdatingWorkflow] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<
    Array<{
      id: string;
      number: number;
      title: string;
      status: TicketStatus;
      priority: TicketPriority;
      createdAt: string;
    }>
  >([]);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [serviceBusy, setServiceBusy] = useState<
    | 'restart'
    | 'repair'
    | 'logs'
    | 'diagnostics'
    | 'permissions'
    | 'factory-reset'
    | 'update-check'
    | 'update-download'
    | 'update-install'
    | 'update-backup'
    | 'open-backups'
    | null
  >(null);
  const [serviceInfo, setServiceInfo] = useState('');

  const [ticketForm, setTicketForm] = useState<CreateTicketInput>(emptyTicketForm);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentInternal, setCommentInternal] = useState(false);
  const [costForm, setCostForm] = useState(emptyCostForm);
  const [ticketModalOffset, setTicketModalOffset] = useState({ x: 0, y: 0 });
  const [ticketModalDragging, setTicketModalDragging] = useState(false);
  const ticketModalDragCleanupRef = useRef<(() => void) | null>(null);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [statisticsFilters, setStatisticsFilters] = useState({
    from: '',
    to: '',
    assignedAgentId: '',
    channel: '',
    priority: '',
    status: '',
  });

  const getElectron = () =>
    typeof window !== 'undefined'
      ? (window as any).electron || (window as any).electronAPI
      : null;

  const isElectron = !!getElectron();

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );
  const imageAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.mimeType.startsWith('image/')),
    [attachments],
  );
  const currentWorkflowStatus = useMemo(
    () => (selectedTicket ? toWorkflowStatus(selectedTicket.status) : null),
    [selectedTicket],
  );
  const currentWorkflowIndex = useMemo(
    () => (currentWorkflowStatus ? WORKFLOW_STATUSES.indexOf(currentWorkflowStatus) : -1),
    [currentWorkflowStatus],
  );
  const nextWorkflowStatus = useMemo(() => {
    if (currentWorkflowIndex < 0) return null;
    return WORKFLOW_STATUSES[currentWorkflowIndex + 1] || null;
  }, [currentWorkflowIndex]);
  const canReopenTicket = useMemo(
    () => Boolean(selectedTicket && CLOSED_STATUSES.has(selectedTicket.status)),
    [selectedTicket],
  );
  const assignmentDirty = selectedTicket ? assignmentDraft !== (selectedTicket.assignedAgentId || '') : false;
  const commentDirty = commentBody.trim().length > 0 || commentInternal;
  const costDraftTouched =
    costForm.name.trim().length > 0 ||
    costForm.qty.trim() !== emptyCostForm.qty ||
    costForm.unitNet.trim() !== emptyCostForm.unitNet ||
    costForm.vatCode !== emptyCostForm.vatCode;
  const reminderDraftTouched =
    newReminder.title.trim().length > 0 || newReminder.note.trim().length > 0 || newReminder.dueAt.trim().length > 0;
  const hasTicketDraftChanges = assignmentDirty || commentDirty || costDraftTouched || reminderDraftTouched;

  const statusLabels = STATUS_LABELS[uiLanguage];
  const priorityLabels = PRIORITY_LABELS[uiLanguage];
  const roleLabels = ROLE_LABELS[uiLanguage];
  const getStatusMeta = (status: string) =>
    STATUS_META[status as TicketStatus] || { className: 'bg-slate-200 text-slate-600' };
  const isPolish = uiLanguage === 'pl';
  const normalizedCurrentRole = (currentUser?.role || '').toUpperCase();
  const isAdmin = normalizedCurrentRole === 'ADMIN';
  const companyName = settings?.branding?.companyName?.trim() || 'OpenTicket';
  const companyLogo = settings?.branding?.logoDataUrl?.trim() || '';
  const fallbackBrandMark = '/openticket-mark.svg';
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => isAdmin || (item.id !== 'vat' && item.id !== 'server')),
    [isAdmin],
  );
  const savedPresetOptions = dashboardPrefs.savedFilters || [];

  useEffect(() => {
    if (!isAdmin && (activeNav === 'vat' || activeNav === 'server')) {
      setActiveNav('tickets');
    }
  }, [activeNav, isAdmin]);

  const activeNavTitle =
    activeNav === 'tickets'
      ? isPolish
        ? 'Lista Zgłoszeń'
        : 'Ticket List'
      : activeNav === 'statistics'
        ? isPolish
          ? 'Statystyki'
          : 'Statistics'
        : activeNav === 'users'
          ? isPolish
            ? 'Użytkownicy'
            : 'Users'
          : activeNav === 'profile'
            ? isPolish
              ? 'Mój interfejs'
              : 'My UI'
          : activeNav === 'server'
            ? isPolish
              ? 'Status Serwera'
              : 'Server Status'
            : isPolish
              ? 'Konfiguracja'
              : 'Settings';

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const open = tickets.filter((ticket) => !CLOSED_STATUSES.has(ticket.status)).length;
    const urgent = tickets.filter((ticket) => ticket.priority === 'URGENT').length;
    const inProgress = tickets.filter((ticket) => ACTIVE_SERVICE_STATUSES.has(ticket.status)).length;
    const closedToday = tickets.filter(
      (ticket) => CLOSED_STATUSES.has(ticket.status) && new Date(ticket.updatedAt).toDateString() === today,
    ).length;

    return {
      open,
      urgent,
      inProgress,
      closedToday,
      total: tickets.length,
      waitingForCustomer: tickets.filter((ticket) => WAITING_FOR_CUSTOMER_STATUSES.has(ticket.status)).length,
      closedAll: tickets.filter((ticket) => CLOSED_STATUSES.has(ticket.status)).length,
    };
  }, [tickets]);

  const orderedWidgets = useMemo(() => {
    const definitions = {
      open: {
        key: 'open' as const,
        title: uiLanguage === 'pl' ? 'Otwarte' : 'Open',
        value: stats.open,
        icon: Folder,
        iconClass: 'bg-blue-50 text-blue-600',
      },
      urgent: {
        key: 'urgent' as const,
        title: uiLanguage === 'pl' ? 'Pilne' : 'Urgent',
        value: stats.urgent,
        icon: Flame,
        iconClass: 'bg-red-50 text-red-600',
      },
      inProgress: {
        key: 'inProgress' as const,
        title: uiLanguage === 'pl' ? 'W toku' : 'In progress',
        value: stats.inProgress,
        icon: Clock3,
        iconClass: 'bg-amber-50 text-amber-600',
      },
      closedToday: {
        key: 'closedToday' as const,
        title: uiLanguage === 'pl' ? 'Zamknięte (Dziś)' : 'Closed (Today)',
        value: stats.closedToday,
        icon: CheckCheck,
        iconClass: 'bg-green-50 text-green-600',
      },
    };

    const fallbackOrder: DashboardWidgetKey[] = DASHBOARD_WIDGET_ORDER_DEFAULT;
    const order =
      dashboardPrefs.widgetOrder && dashboardPrefs.widgetOrder.length === 4
        ? dashboardPrefs.widgetOrder
        : fallbackOrder;

    return order.map((key) => definitions[key]);
  }, [dashboardPrefs.widgetOrder, stats, uiLanguage]);
  const widgetSizes = useMemo(
    () => ({
      ...DASHBOARD_WIDGET_SIZES_DEFAULT,
      ...(dashboardPrefs.widgetSizes || {}),
    }),
    [dashboardPrefs.widgetSizes],
  );

  const pendingReminderCount = useMemo(
    () => globalReminders.filter((item) => item.status === 'PENDING').length,
    [globalReminders],
  );
  const overdueReminderCount = useMemo(
    () =>
      globalReminders.filter(
        (item) => item.status === 'PENDING' && new Date(item.dueAt).getTime() <= Date.now(),
      ).length,
    [globalReminders],
  );
  const topReminderItems = useMemo(
    () =>
      [...globalReminders]
        .filter((item) => item.status === 'PENDING')
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
        .slice(0, 8),
    [globalReminders],
  );
  const statisticsTrend = useMemo(() => {
    if (!statistics) {
      return [] as Array<{ date: string; created: number; closed: number }>;
    }

    const keys = Array.from(
      new Set([...Object.keys(statistics.trend.created), ...Object.keys(statistics.trend.closed)]),
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return keys.map((date) => ({
      date,
      created: statistics.trend.created[date] || 0,
      closed: statistics.trend.closed[date] || 0,
    }));
  }, [statistics]);
  const statisticsMaxima = useMemo(() => {
    if (!statistics) {
      return { byStatus: 1, byPriority: 1, byChannel: 1, trend: 1 };
    }
    return {
      byStatus: Math.max(1, ...statistics.byStatus.map((row) => row.count)),
      byPriority: Math.max(1, ...statistics.byPriority.map((row) => row.count)),
      byChannel: Math.max(1, ...statistics.byChannel.map((row) => row.count)),
      trend: Math.max(1, ...statisticsTrend.map((row) => Math.max(row.created, row.closed))),
    };
  }, [statistics, statisticsTrend]);
  const statisticsTrendPath = useMemo(() => {
    const width = 720;
    const height = 180;
    if (statisticsTrend.length === 0) {
      return {
        width,
        height,
        createdPath: '',
        closedPath: '',
      };
    }

    const xStep = statisticsTrend.length > 1 ? width / (statisticsTrend.length - 1) : width;
    const toY = (value: number) => height - (value / statisticsMaxima.trend) * (height - 18) - 9;

    const createdPath = statisticsTrend
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${Math.round(index * xStep)} ${toY(point.created).toFixed(1)}`)
      .join(' ');
    const closedPath = statisticsTrend
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${Math.round(index * xStep)} ${toY(point.closed).toFixed(1)}`)
      .join(' ');

    return {
      width,
      height,
      createdPath,
      closedPath,
    };
  }, [statisticsTrend, statisticsMaxima.trend]);

  const notify = (next: Notice) => {
    setNotice(next);
    window.setTimeout(() => {
      setNotice((prev) => (prev?.text === next.text ? null : prev));
    }, 4000);
  };

  const clearAttachmentPreview = () => {
    setAttachmentPreview((prev) => {
      if (prev?.url) {
        window.URL.revokeObjectURL(prev.url);
      }
      return null;
    });
  };

  const resetTicketDraftInputs = () => {
    setCommentBody('');
    setCommentInternal(false);
    setCostForm(emptyCostForm);
    setNewReminder(emptyReminderForm);
    clearAttachmentPreview();
  };

  const saveTicketDraftChanges = async (ticketId: string): Promise<boolean> => {
    const appliedChanges: string[] = [];

    try {
      if (assignmentDirty) {
        await updateTicket(ticketId, {
          assignedAgentId: assignmentDraft || null,
        });
        appliedChanges.push(isPolish ? 'przypisanie technika' : 'technician assignment');
      }

      if (commentBody.trim().length > 0) {
        await addComment(ticketId, {
          body: commentBody.trim(),
          isInternal: commentInternal,
          author: 'WebUI Agent',
        });
        setCommentBody('');
        setCommentInternal(false);
        appliedChanges.push(isPolish ? 'komentarz' : 'comment');
      }

      if (costDraftTouched) {
        const qty = Number(costForm.qty);
        const unitNet = Number(costForm.unitNet);
        if (
          costForm.name.trim().length === 0 ||
          !Number.isFinite(qty) ||
          qty <= 0 ||
          !Number.isFinite(unitNet) ||
          unitNet < 0
        ) {
          notify({
            type: 'error',
            text: isPolish
              ? 'Nie można zapisać kosztu: uzupełnij poprawnie nazwę, ilość i cenę netto.'
              : 'Cannot save cost item: provide valid name, quantity and net price.',
          });
          return false;
        }

        await addCostItem(ticketId, {
          name: costForm.name.trim(),
          qty,
          unitNet,
          vatCode: costForm.vatCode,
        });
        setCostForm(emptyCostForm);
        appliedChanges.push(isPolish ? 'koszt' : 'cost item');
      }

      if (reminderDraftTouched) {
        if (newReminder.title.trim().length < 2 || !newReminder.dueAt) {
          notify({
            type: 'error',
            text: isPolish
              ? 'Nie można zapisać przypomnienia: uzupełnij tytuł i termin.'
              : 'Cannot save reminder: title and due date are required.',
          });
          return false;
        }

        await createReminder({
          ticketId,
          title: newReminder.title.trim(),
          note: newReminder.note.trim() || undefined,
          dueAt: newReminder.dueAt,
        });
        setNewReminder(emptyReminderForm);
        appliedChanges.push(isPolish ? 'przypomnienie' : 'reminder');
      }

      if (appliedChanges.length > 0) {
        await Promise.all([loadTicketsData(), loadTicketDetails(ticketId), loadGlobalReminders()]);
        notify({
          type: 'success',
          text: isPolish
            ? `Zapisano zmiany: ${appliedChanges.join(', ')}.`
            : `Saved changes: ${appliedChanges.join(', ')}.`,
        });
      }

      return true;
    } catch (error) {
      notify({
        type: 'error',
        text: isPolish
          ? `Nie udało się zapisać zmian: ${error instanceof Error ? error.message : 'nieznany błąd'}`
          : `Failed to save changes: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
      return false;
    }
  };

  const handleRequestCloseTicketModal = async () => {
    if (!showTicketModal) {
      return;
    }

    if (!selectedTicketId || !hasTicketDraftChanges) {
      setShowTicketModal(false);
      clearAttachmentPreview();
      return;
    }

    const shouldSave = window.confirm(
      isPolish
        ? 'Wykryto niezapisane zmiany. Czy zapisać je przed zamknięciem okna?'
        : 'You have unsaved changes. Save them before closing this window?',
    );

    if (shouldSave) {
      const saved = await saveTicketDraftChanges(selectedTicketId);
      if (!saved) {
        return;
      }
      setShowTicketModal(false);
      clearAttachmentPreview();
      return;
    }

    const shouldDiscard = window.confirm(
      isPolish
        ? 'Odrzucić niezapisane zmiany i zamknąć okno zgłoszenia?'
        : 'Discard unsaved changes and close the ticket window?',
    );
    if (!shouldDiscard) {
      return;
    }

    setAssignmentDraft(selectedTicket?.assignedAgentId || '');
    resetTicketDraftInputs();
    setShowTicketModal(false);
  };

  const startTicketModalDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, select, label, a')) {
      return;
    }

    event.preventDefault();
    ticketModalDragCleanupRef.current?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...ticketModalOffset };
    setTicketModalDragging(true);

    const onMove = (moveEvent: MouseEvent) => {
      setTicketModalOffset({
        x: origin.x + (moveEvent.clientX - startX),
        y: origin.y + (moveEvent.clientY - startY),
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      ticketModalDragCleanupRef.current = null;
      setTicketModalDragging(false);
    };

    ticketModalDragCleanupRef.current = onUp;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleOpenTicketDetails = async (ticketId: string) => {
    if (showTicketModal && selectedTicketId && selectedTicketId !== ticketId && hasTicketDraftChanges) {
      const shouldSaveBeforeSwitch = window.confirm(
        isPolish
          ? 'Masz niezapisane zmiany. Zapisać je przed przejściem do innego zgłoszenia?'
          : 'You have unsaved changes. Save them before switching to another ticket?',
      );

      if (shouldSaveBeforeSwitch) {
        const saved = await saveTicketDraftChanges(selectedTicketId);
        if (!saved) {
          return;
        }
      } else {
        const shouldDiscard = window.confirm(
          isPolish
            ? 'Odrzucić niezapisane zmiany i przejść do innego zgłoszenia?'
            : 'Discard unsaved changes and switch to another ticket?',
        );
        if (!shouldDiscard) {
          return;
        }
        setAssignmentDraft(selectedTicket?.assignedAgentId || '');
        resetTicketDraftInputs();
      }
    }

    clearAttachmentPreview();
    setTicketModalOffset({ x: 0, y: 0 });
    setSelectedTicketId(ticketId);
    setShowTicketModal(true);
  };

  const savePrefs = async (next: DashboardPreferences) => {
    setDashboardPrefs(next);
    try {
      await saveMyPreferences(next as Record<string, unknown>);
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się zapisać preferencji UI: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const applySavedFilter = (filter: SavedFilterPreset) => {
    setFilters((prev) => ({
      ...prev,
      status: filter.status || '',
      priority: filter.priority || '',
      channel: filter.channel || '',
      assignedAgentId: filter.assignedAgentId || '',
      assignedState: filter.assignedState || '',
      search: filter.search || '',
      onlyMine: Boolean(filter.onlyMine),
      minAgeDays:
        filter.minAgeDays && Number.isFinite(filter.minAgeDays) && filter.minAgeDays > 0
          ? String(Math.floor(filter.minAgeDays))
          : '',
      hasAttachments:
        typeof filter.hasAttachments === 'boolean' ? (filter.hasAttachments ? 'yes' : 'no') : '',
      hasComments: typeof filter.hasComments === 'boolean' ? (filter.hasComments ? 'yes' : 'no') : '',
      createdFrom: filter.createdFrom || '',
      createdTo: filter.createdTo || '',
      sort: filter.sort || prev.sort,
    }));
    setSelectedPresetName(filter.name);
    setNewPresetName(filter.name);
  };

  const addCurrentFilterToSaved = async (preferredName?: string) => {
    let normalizedName = (preferredName || newPresetName).trim();
    if (!normalizedName) {
      const promptedName = window.prompt(
        isPolish ? 'Nazwa filtra (np. "Pilne Apple")' : 'Filter name (for example: "Urgent Apple")',
      );
      if (!promptedName) return;
      normalizedName = promptedName.trim();
    }
    if (!normalizedName) {
      return;
    }

    const normalizedMinAge = Number(filters.minAgeDays);
    const nextPreset: SavedFilterPreset = {
      name: normalizedName,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      channel: filters.channel || undefined,
      assignedAgentId: filters.assignedAgentId || undefined,
      assignedState: filters.assignedState || undefined,
      search: filters.search || undefined,
      onlyMine: filters.onlyMine || undefined,
      minAgeDays: Number.isFinite(normalizedMinAge) && normalizedMinAge > 0 ? Math.floor(normalizedMinAge) : undefined,
      hasAttachments: filters.hasAttachments === 'yes' ? true : filters.hasAttachments === 'no' ? false : undefined,
      hasComments: filters.hasComments === 'yes' ? true : filters.hasComments === 'no' ? false : undefined,
      createdFrom: filters.createdFrom || undefined,
      createdTo: filters.createdTo || undefined,
      sort: filters.sort || undefined,
    };
    const existing = dashboardPrefs.savedFilters || [];
    const deduped = existing.filter((preset) => preset.name !== normalizedName);
    const next: DashboardPreferences = {
      ...dashboardPrefs,
      savedFilters: [...deduped, nextPreset],
    };
    await savePrefs(next);
    setSelectedPresetName(normalizedName);
    setNewPresetName(normalizedName);
  };

  const applyInfoCardFilter = (target: 'all' | 'waiting' | 'closed') => {
    setSelectedPresetName('');
    if (target === 'all') {
      setFilters((prev) => ({ ...prev, status: '' }));
      return;
    }
    if (target === 'waiting') {
      setFilters((prev) => ({
        ...prev,
        status: prev.status === 'WAITING_FOR_APPROVAL' ? 'WAITING_FOR_CUSTOMER' : 'WAITING_FOR_APPROVAL',
      }));
      return;
    }
    setFilters((prev) => ({
      ...prev,
      status: prev.status === 'CLOSED' ? 'ARCHIVED' : 'CLOSED',
    }));
  };

  const loadStatistics = async () => {
    setStatisticsLoading(true);
    try {
      const next = await getStatisticsOverview({
        from: statisticsFilters.from || undefined,
        to: statisticsFilters.to || undefined,
        assignedAgentId: statisticsFilters.assignedAgentId || undefined,
        channel: statisticsFilters.channel || undefined,
        priority: statisticsFilters.priority || undefined,
        status: statisticsFilters.status || undefined,
      });
      setStatistics(next);
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się pobrać statystyk: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setStatisticsLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const nextUsers = await listAppUsers(true);
      setUsers(nextUsers);
      if (selectedUserId && !nextUsers.some((item) => item.id === selectedUserId)) {
        setSelectedUserId(null);
      }
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się pobrać użytkowników: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAssignableAgents = async () => {
    try {
      const nextUsers = await listAppUsers(true);
      const techs = nextUsers.filter((item) => {
        const role = (item.role || '').toUpperCase();
        return (role === 'ADMIN' || role === 'AGENT') && !item.disabledAt;
      });
      setAssignableAgents(techs);
    } catch {
      setAssignableAgents([]);
    }
  };

  const loadSelectedUserNotes = async (userId: string) => {
    try {
      const notes = await listUserNotes(userId);
      setUserNotes(notes);
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się pobrać notatek użytkownika: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const next = await getAdminSettings();
      setSettings(next);
      const language = normalizeLanguage(next.uiDefaults?.language);
      setUiLanguage(language);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('ts_ui_language', language);
      }
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się pobrać konfiguracji: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadCostCatalogData = async () => {
    try {
      const catalog = await listCostCatalog();
      setCostCatalog(Array.isArray(catalog) ? catalog : []);
    } catch {
      setCostCatalog([]);
    }
  };

  const loadServerStatus = async () => {
    setServerLoading(true);
    try {
      const [info, report] = await Promise.all([getSystemInfo(), getDiagnosticsReport()]);
      setServerInfo(info);
      setServerDiagnostics(report);
    } catch (error) {
      const message =
        error instanceof ApiRequestError && error.status === 403
          ? 'Podgląd statusu serwera wymaga roli ADMIN.'
          : `Nie udało się pobrać statusu serwera: ${error instanceof Error ? error.message : 'nieznany błąd'}`;
      notify({
        type: 'error',
        text: message,
      });
    } finally {
      setServerLoading(false);
    }
  };

  const loadUpdateStatus = async () => {
    const bridge = getElectron();
    if (!bridge?.getUpdateStatus) {
      setUpdateStatus(null);
      return;
    }
    try {
      const status = await bridge.getUpdateStatus();
      setUpdateStatus(status);
    } catch {
      setUpdateStatus(null);
    }
  };

  const loadTicketReminders = async (ticketId: string) => {
    try {
      const items = await listReminders({ ticketId, includeDone: true });
      setTicketReminders(items);
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się pobrać przypomnień: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
      setTicketReminders([]);
    }
  };

  const loadGlobalReminders = async () => {
    try {
      const items = await listReminders({ includeDone: false });
      setGlobalReminders(items);
    } catch {
      setGlobalReminders([]);
    }
  };

  const loadCustomerHistoryForTicket = async (ticketId: string) => {
    setCustomerHistoryLoading(true);
    try {
      const history = await getCustomerHistory(ticketId, 12);
      setCustomerHistory(
        history.items.map((item) => ({
          id: item.id,
          number: item.number,
          title: item.title,
          status: item.status,
          priority: item.priority,
          createdAt: item.createdAt,
        })),
      );
    } catch {
      setCustomerHistory([]);
    } finally {
      setCustomerHistoryLoading(false);
    }
  };

  const loadTicketsData = async () => {
    setLoadingTickets(true);
    try {
      const response = await listTickets({
        search: filters.search || undefined,
        status: (filters.status as TicketStatus) || undefined,
        priority: (filters.priority as TicketPriority) || undefined,
        channel: (filters.channel as TicketChannel) || undefined,
        assignedAgentId: filters.assignedAgentId || undefined,
        assignedState: filters.assignedState || undefined,
        onlyMine: filters.onlyMine,
        minAgeDays: filters.minAgeDays ? Number(filters.minAgeDays) : undefined,
        hasAttachments:
          filters.hasAttachments === 'yes' ? true : filters.hasAttachments === 'no' ? false : undefined,
        hasComments: filters.hasComments === 'yes' ? true : filters.hasComments === 'no' ? false : undefined,
        createdFrom: filters.createdFrom || undefined,
        createdTo: filters.createdTo || undefined,
        sort: filters.sort || undefined,
      });

      setTickets(response.items);

      if (response.items.length === 0) {
        setSelectedTicketId(null);
      } else if (selectedTicketId && !response.items.some((ticket) => ticket.id === selectedTicketId)) {
        setSelectedTicketId(null);
      }
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się pobrać ticketów: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setLoadingTickets(false);
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    setLoadingDetails(true);
    try {
      const [ticketDetails, nextComments, nextCosts, nextAttachments] = await Promise.all([
        getTicketDetails(ticketId),
        listComments(ticketId),
        listCostItems(ticketId),
        listAttachments(ticketId),
      ]);
      setTicketStatusHistory(ticketDetails.statusHistory || []);
      setTickets((prev) =>
        prev.map((item) =>
          item.id === ticketId
            ? {
                ...item,
                title: ticketDetails.title,
                description: ticketDetails.description,
                status: ticketDetails.status,
                priority: ticketDetails.priority,
                assignedAgentId: ticketDetails.assignedAgentId,
                owner: ticketDetails.owner,
                assignedAgent: ticketDetails.assignedAgent || null,
                updatedAt: ticketDetails.updatedAt,
              }
            : item,
        ),
      );
      setComments(nextComments);
      setCostItems(nextCosts.items);
      setCostSummary(nextCosts.summary);
      setAttachments(nextAttachments);
      await loadTicketReminders(ticketId);
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się pobrać szczegółów ticketu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
      setComments([]);
      setCostItems([]);
      setAttachments([]);
      setTicketStatusHistory([]);
      setTicketReminders([]);
      setCostSummary({ netTotal: 0, vatTotal: 0, grossTotal: 0, itemCount: 0 });
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const status = await checkSetupStatus();
        applyRuntimeApiBaseFromSetupStatus(status);
        if (status.setupMode) {
          window.location.href = '/setup';
          return;
        }

        const token = typeof window !== 'undefined' ? window.localStorage.getItem('ts_auth_token') : null;
        if (!token) {
          window.location.href = '/login';
          return;
        }

        const me = await getMe();
        setCurrentUser(me);

        const prefs = await getMyPreferences();
        const prefObject = prefs as DashboardPreferences;
        setDashboardPrefs((prev) => ({
          ...prev,
          ...prefObject,
          widgetOrder:
            (prefObject.widgetOrder as DashboardPreferences['widgetOrder']) || prev.widgetOrder,
          widgetSizes:
            (prefObject.widgetSizes as DashboardPreferences['widgetSizes']) || prev.widgetSizes,
          savedFilters:
            (prefObject.savedFilters as DashboardPreferences['savedFilters']) || prev.savedFilters,
          theme: prefObject.theme || prev.theme,
          defaultFilters:
            (prefObject.defaultFilters as DashboardPreferences['defaultFilters']) || prev.defaultFilters,
        }));

        if (prefObject.defaultFilters) {
          setFilters((prev) => ({
            ...prev,
            status: prefObject.defaultFilters?.status || prev.status,
            priority: prefObject.defaultFilters?.priority || prev.priority,
            channel: prefObject.defaultFilters?.channel || prev.channel,
            assignedAgentId: prefObject.defaultFilters?.assignedAgentId || prev.assignedAgentId,
            assignedState: prefObject.defaultFilters?.assignedState || prev.assignedState,
            onlyMine:
              typeof prefObject.defaultFilters?.onlyMine === 'boolean'
                ? prefObject.defaultFilters.onlyMine
                : prev.onlyMine,
            minAgeDays:
              prefObject.defaultFilters?.minAgeDays && Number.isFinite(prefObject.defaultFilters.minAgeDays)
                ? String(Math.max(1, Math.floor(prefObject.defaultFilters.minAgeDays)))
                : prev.minAgeDays,
            hasAttachments:
              typeof prefObject.defaultFilters?.hasAttachments === 'boolean'
                ? prefObject.defaultFilters.hasAttachments
                  ? 'yes'
                  : 'no'
                : prev.hasAttachments,
            hasComments:
              typeof prefObject.defaultFilters?.hasComments === 'boolean'
                ? prefObject.defaultFilters.hasComments
                  ? 'yes'
                  : 'no'
                : prev.hasComments,
            createdFrom: prefObject.defaultFilters?.createdFrom || prev.createdFrom,
            createdTo: prefObject.defaultFilters?.createdTo || prev.createdTo,
            sort: prefObject.defaultFilters?.sort || prev.sort,
          }));
        }

        await Promise.all([loadTicketsData(), loadAssignableAgents(), loadGlobalReminders(), loadCostCatalogData()]);
      } catch (error) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('ts_auth_token');
          window.localStorage.removeItem('ts_auth_user');
        }
        notify({
          type: 'error',
          text: `Błąd inicjalizacji dashboardu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
        });
        window.location.href = '/login';
      } finally {
        setBootLoading(false);
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bootLoading) {
      loadTicketsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.search,
    filters.status,
    filters.priority,
    filters.channel,
    filters.assignedAgentId,
    filters.assignedState,
    filters.onlyMine,
    filters.minAgeDays,
    filters.hasAttachments,
    filters.hasComments,
    filters.createdFrom,
    filters.createdTo,
    filters.sort,
  ]);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetails(selectedTicketId);
      void loadCustomerHistoryForTicket(selectedTicketId);
    } else {
      setCustomerHistory([]);
      setTicketStatusHistory([]);
      setAssignmentDraft('');
      setShowTicketModal(false);
      clearAttachmentPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId]);

  useEffect(() => {
    if (!showTicketModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void handleRequestCloseTicketModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showTicketModal]);

  useEffect(() => {
    return () => {
      ticketModalDragCleanupRef.current?.();
      ticketModalDragCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (attachmentPreview?.url) {
        window.URL.revokeObjectURL(attachmentPreview.url);
      }
    };
  }, [attachmentPreview]);

  useEffect(() => {
    if (!isAdmin && (activeNav === 'vat' || activeNav === 'server')) {
      setActiveNav('tickets');
    }
  }, [activeNav, isAdmin]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const theme = dashboardPrefs.theme || 'helpdesk-blue';
    document.documentElement.setAttribute('data-ts-theme', theme);
    document.body.classList.toggle('ts-compact', Boolean(dashboardPrefs.compactMode));
    return () => {
      document.body.classList.remove('ts-compact');
    };
  }, [dashboardPrefs.theme, dashboardPrefs.compactMode]);

  useEffect(() => {
    if (bootLoading) {
      return;
    }

    if (activeNav === 'statistics') {
      void loadStatistics();
    } else if (activeNav === 'users') {
      void loadUsers();
    } else if (activeNav === 'vat' && isAdmin) {
      void Promise.all([loadSettings(), loadCostCatalogData()]);
    } else if (activeNav === 'server' && isAdmin) {
      void loadServerStatus();
      void loadUpdateStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav, bootLoading, isAdmin]);

  useEffect(() => {
    setAssignmentDraft(selectedTicket?.assignedAgentId || '');
  }, [selectedTicket?.id, selectedTicket?.assignedAgentId]);

  useEffect(() => {
    if (activeNav === 'users' && selectedUserId) {
      void loadSelectedUserNotes(selectedUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      setEditingUser(null);
      return;
    }

    const selected = users.find((item) => item.id === selectedUserId);
    if (!selected) {
      setEditingUser(null);
      return;
    }

    setEditingUser({
      id: selected.id,
      email: selected.email || '',
      name: selected.name || '',
      role: selected.role || 'AGENT',
      phone: selected.phone || '',
      password: '',
      disabled: Boolean(selected.disabledAt),
    });
  }, [selectedUserId, users]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setTestEmailTo((prev) => prev || currentUser.email || '');
    setTestSmsTo((prev) => prev || currentUser.phone || '');
  }, [currentUser]);

  useEffect(() => {
    if (bootLoading) {
      return;
    }

    void loadGlobalReminders();
    const timer = window.setInterval(() => {
      void loadGlobalReminders();
    }, 45000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootLoading]);

  useEffect(() => {
    const bridge = getElectron();
    if (!bridge?.onUpdateStatus) {
      return;
    }

    const unsubscribe = bridge.onUpdateStatus((payload: UpdateStatus) => {
      setUpdateStatus(payload);
    });
    void loadUpdateStatus();

    return () => {
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault();

    if (ticketForm.title.trim().length < 3) {
      notify({ type: 'error', text: 'Tytuł musi mieć co najmniej 3 znaki.' });
      return;
    }

    if (ticketForm.description.trim().length < 10) {
      notify({ type: 'error', text: 'Opis musi mieć co najmniej 10 znaków.' });
      return;
    }

    if (ticketForm.customerName.trim().length === 0) {
      notify({ type: 'error', text: 'Imię i nazwisko klienta jest wymagane.' });
      return;
    }

    setSubmittingTicket(true);
    try {
      const created = await createTicket({
        ...ticketForm,
        title: ticketForm.title.trim(),
        description: ticketForm.description.trim(),
        customerName: ticketForm.customerName.trim(),
        customerEmail: ticketForm.customerEmail?.trim() || undefined,
        customerPhone: ticketForm.customerPhone?.trim() || undefined,
        deviceType: ticketForm.deviceType?.trim() || undefined,
        serialNumber: ticketForm.serialNumber?.trim() || undefined,
      });

      if (ticketFiles.length > 0) {
        await handleUploadTicketFiles(created.id, ticketFiles);
      }

      setTicketForm(emptyTicketForm);
      setTicketFiles([]);
      setShowCreateModal(false);
      await loadTicketsData();
      setSelectedTicketId(created.id);
      setShowTicketModal(true);
      notify({ type: 'success', text: `Utworzono ticket #${created.number}.` });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się utworzyć ticketu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleAddComment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedTicketId) {
      notify({ type: 'error', text: 'Najpierw wybierz ticket.' });
      return;
    }

    if (commentBody.trim().length === 0) {
      notify({ type: 'error', text: 'Treść komentarza nie może być pusta.' });
      return;
    }

    setSubmittingComment(true);
    try {
      await addComment(selectedTicketId, {
        body: commentBody.trim(),
        isInternal: commentInternal,
        author: 'WebUI Agent',
      });
      setCommentBody('');
      setCommentInternal(false);
      await loadTicketDetails(selectedTicketId);
      notify({ type: 'success', text: 'Komentarz został dodany.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się dodać komentarza: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddCostItem = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedTicketId) {
      notify({ type: 'error', text: 'Najpierw wybierz ticket.' });
      return;
    }

    const qty = Number(costForm.qty);
    const unitNet = Number(costForm.unitNet);

    if (costForm.name.trim().length === 0 || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitNet) || unitNet < 0) {
      notify({ type: 'error', text: 'Uzupełnij poprawnie nazwę, ilość i cenę netto.' });
      return;
    }

    setSubmittingCost(true);
    try {
      await addCostItem(selectedTicketId, {
        name: costForm.name.trim(),
        qty,
        unitNet,
        vatCode: costForm.vatCode,
      });

      setCostForm(emptyCostForm);
      setSelectedCatalogId('');
      await loadTicketDetails(selectedTicketId);
      notify({ type: 'success', text: 'Pozycja kosztowa została dodana.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się dodać kosztu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setSubmittingCost(false);
    }
  };

  const handleSelectCatalogItem = (catalogId: string) => {
    setSelectedCatalogId(catalogId);
    if (!catalogId) {
      return;
    }
    const item = costCatalog.find((entry) => entry.id === catalogId && entry.active);
    if (!item) {
      return;
    }
    setCostForm({
      name: item.name,
      qty: String(item.defaultQty || 1),
      unitNet: String(item.unitNet || 0),
      vatCode: item.vatCode || '23',
    });
  };

  const handleSaveCostCatalog = async (nextCatalog: CostCatalogItem[], successMessage: string) => {
    if (!isAdmin) {
      notify({ type: 'error', text: 'Edycja katalogu kosztów wymaga roli ADMIN.' });
      return;
    }

    setCostCatalogSaving(true);
    try {
      const saved = await saveCostCatalog(nextCatalog);
      setCostCatalog(saved);
      notify({ type: 'success', text: successMessage });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się zapisać katalogu kosztów: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setCostCatalogSaving(false);
    }
  };

  const handleAddCatalogEntry = async () => {
    const name = catalogEditor.name.trim();
    if (!name) {
      notify({ type: 'error', text: 'Nazwa pozycji kosztowej jest wymagana.' });
      return;
    }
    const unitNet = Number(catalogEditor.unitNet);
    const defaultQty = Number(catalogEditor.defaultQty);
    if (!Number.isFinite(unitNet) || unitNet < 0) {
      notify({ type: 'error', text: 'Cena netto musi być poprawną liczbą.' });
      return;
    }
    if (!Number.isFinite(defaultQty) || defaultQty <= 0) {
      notify({ type: 'error', text: 'Domyślna ilość musi być dodatnia.' });
      return;
    }

    const next: CostCatalogItem[] = [
      ...costCatalog,
      {
        id: crypto.randomUUID(),
        name,
        unitNet: Number(unitNet.toFixed(2)),
        vatCode: catalogEditor.vatCode || '23',
        defaultQty: Number(defaultQty.toFixed(2)),
        category: catalogEditor.category?.trim() || undefined,
        unit: catalogEditor.unit?.trim() || undefined,
        active: catalogEditor.active,
      },
    ];
    await handleSaveCostCatalog(next, 'Dodano pozycję do katalogu kosztorysu.');
    setCatalogEditor({
      id: '',
      name: '',
      unitNet: 0,
      vatCode: '23',
      defaultQty: 1,
      category: '',
      unit: '',
      active: true,
    });
  };

  const handleToggleCatalogEntry = async (id: string, active: boolean) => {
    const next = costCatalog.map((item) => (item.id === id ? { ...item, active } : item));
    await handleSaveCostCatalog(next, active ? 'Pozycja została aktywowana.' : 'Pozycja została dezaktywowana.');
  };

  const handleRemoveCatalogEntry = async (id: string) => {
    const item = costCatalog.find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm(`Usunąć pozycję katalogu "${item.name}"?`)) {
      return;
    }
    const next = costCatalog.filter((entry) => entry.id !== id);
    await handleSaveCostCatalog(next, 'Pozycja została usunięta z katalogu.');
  };

  const handleReinstallSystem = async (source: 'settings' | 'server') => {
    if (!isElectron) {
      notify({ type: 'error', text: 'Reinstal systemu jest dostępny tylko w aplikacji desktop.' });
      return;
    }

    const confirmText = isPolish
      ? 'Reinstalacja systemu usunie lokalną bazę, konfigurację i wymusi ponowny setup. Kontynuować?'
      : 'System reinstall will remove local database/configuration and restart setup. Continue?';
    if (!window.confirm(confirmText)) {
      return;
    }

    setServiceBusy('factory-reset');
    try {
      const bridge = getElectron();
      const result = bridge.factoryReset
        ? await bridge.factoryReset()
        : ({ success: false, message: 'Brak funkcji factory reset w tej wersji aplikacji.' } as const);
      if (result.success) {
        const sourceLabel = source === 'settings' ? 'konfiguracja' : 'serwer';
        const successText =
          result.message ||
          (isPolish
            ? 'Reinstalacja zakończona. Uruchamiam kreator konfiguracji od nowa.'
            : 'Reinstall completed. Opening setup wizard again.');
        setServiceInfo(`${successText} (${sourceLabel})`);
        notify({ type: 'success', text: successText });
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('ts_auth_token');
            window.localStorage.removeItem('ts_auth_user');
          }
        } catch {
          // ignore
        }
        window.setTimeout(() => {
          window.location.href = '/setup?source=installer&reinstall=1';
        }, 900);
      } else {
        notify({ type: 'error', text: result.message || 'Reinstal systemu nie powiódł się.' });
      }
    } catch (error) {
      notify({
        type: 'error',
        text: `Reinstal systemu nie powiódł się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setServiceBusy(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const moveWidget = async (widgetKey: DashboardWidgetKey, direction: 'up' | 'down') => {
    const current = [...(dashboardPrefs.widgetOrder || DASHBOARD_WIDGET_ORDER_DEFAULT)];
    const index = current.indexOf(widgetKey);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    [current[index], current[targetIndex]] = [current[targetIndex], current[index]];
    await savePrefs({ ...dashboardPrefs, widgetOrder: current });
  };

  const reorderWidgets = async (sourceKey: DashboardWidgetKey, targetKey: DashboardWidgetKey) => {
    if (sourceKey === targetKey) return;
    const current = [...(dashboardPrefs.widgetOrder || DASHBOARD_WIDGET_ORDER_DEFAULT)];
    const sourceIndex = current.indexOf(sourceKey);
    const targetIndex = current.indexOf(targetKey);
    if (sourceIndex === -1 || targetIndex === -1) return;
    current.splice(sourceIndex, 1);
    current.splice(targetIndex, 0, sourceKey);
    await savePrefs({ ...dashboardPrefs, widgetOrder: current });
  };

  const handleWidgetSizeStep = async (widgetKey: DashboardWidgetKey, direction: 'down' | 'up') => {
    const sequence: DashboardWidgetSize[] = ['sm', 'md', 'lg'];
    const currentSize = widgetSizes[widgetKey] || 'md';
    const currentIndex = sequence.indexOf(currentSize);
    const nextIndex = direction === 'up' ? Math.min(sequence.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
    if (nextIndex === currentIndex) {
      return;
    }
    await savePrefs({
      ...dashboardPrefs,
      widgetSizes: {
        ...widgetSizes,
        [widgetKey]: sequence[nextIndex],
      },
    });
  };

  const removeSavedFilter = async (name: string) => {
    const next = (dashboardPrefs.savedFilters || []).filter((saved) => saved.name !== name);
    await savePrefs({
      ...dashboardPrefs,
      savedFilters: next,
    });
    if (selectedPresetName === name) {
      setSelectedPresetName('');
    }
    if (newPresetName === name) {
      setNewPresetName('');
    }
  };

  const saveDefaultFiltersFromCurrent = async () => {
    const normalizedMinAge = Number(filters.minAgeDays);
    await savePrefs({
      ...dashboardPrefs,
      defaultFilters: {
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        channel: filters.channel || undefined,
        assignedAgentId: filters.assignedAgentId || undefined,
        assignedState: filters.assignedState || undefined,
        onlyMine: filters.onlyMine || undefined,
        minAgeDays: Number.isFinite(normalizedMinAge) && normalizedMinAge > 0 ? Math.floor(normalizedMinAge) : undefined,
        hasAttachments: filters.hasAttachments === 'yes' ? true : filters.hasAttachments === 'no' ? false : undefined,
        hasComments: filters.hasComments === 'yes' ? true : filters.hasComments === 'no' ? false : undefined,
        createdFrom: filters.createdFrom || undefined,
        createdTo: filters.createdTo || undefined,
        sort: filters.sort || undefined,
      },
    });
    notify({
      type: 'success',
      text: isPolish ? 'Domyślne filtry użytkownika zapisane.' : 'Default user filters saved.',
    });
  };

  const resetWidgetLayout = async () => {
    await savePrefs({
      ...dashboardPrefs,
      widgetOrder: DASHBOARD_WIDGET_ORDER_DEFAULT,
      widgetSizes: DASHBOARD_WIDGET_SIZES_DEFAULT,
    });
    notify({
      type: 'success',
      text: isPolish ? 'Układ dashboardu przywrócony do domyślnego.' : 'Dashboard layout reset to defaults.',
    });
  };

  const handleCreateAppUser = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createAppUser(newUser);
      setNewUser({ email: '', name: '', role: 'AGENT', phone: '', password: '' });
      await Promise.all([loadUsers(), loadAssignableAgents()]);
      notify({ type: 'success', text: 'Użytkownik został dodany.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się dodać użytkownika: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleSaveUserEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) {
      notify({ type: 'error', text: 'Wybierz użytkownika do edycji.' });
      return;
    }

    try {
      await updateAppUser(editingUser.id, {
        email: editingUser.email.trim(),
        name: editingUser.name.trim() || null,
        role: editingUser.role,
        phone: editingUser.phone.trim() || null,
        password: editingUser.password.trim() || undefined,
        disabled: editingUser.disabled,
      });
      setEditingUser((prev) => (prev ? { ...prev, password: '' } : prev));
      await Promise.all([loadUsers(), loadAssignableAgents()]);
      notify({ type: 'success', text: 'Dane użytkownika zostały zaktualizowane.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się zaktualizować użytkownika: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleAddUserNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) {
      notify({ type: 'error', text: 'Wybierz użytkownika, aby dodać notatkę.' });
      return;
    }
    if (userNoteText.trim().length < 2) {
      notify({ type: 'error', text: 'Notatka jest za krótka.' });
      return;
    }

    try {
      await addUserNote(selectedUserId, { body: userNoteText.trim(), isInternal: true });
      setUserNoteText('');
      await loadSelectedUserNotes(selectedUserId);
      notify({ type: 'success', text: 'Notatka została dodana.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się dodać notatki: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleExportBackup = async (options?: { silentSuccess?: boolean }): Promise<string | null> => {
    if (!isAdmin) {
      notify({ type: 'error', text: 'Eksport backupu wymaga roli ADMIN.' });
      return null;
    }
    try {
      const result = await exportBackup();
      setBackupPath(result.archivePath);
      if (!options?.silentSuccess) {
        notify({ type: 'success', text: `Backup gotowy: ${result.archiveName}` });
      }
      return result.archivePath;
    } catch (error) {
      notify({
        type: 'error',
        text: `Eksport backupu nie powiódł się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
      return null;
    }
  };

  const handleImportBackupByPath = async () => {
    if (!isAdmin) {
      notify({ type: 'error', text: 'Import backupu wymaga roli ADMIN.' });
      return;
    }
    if (!backupPath.trim()) {
      notify({ type: 'error', text: 'Podaj ścieżkę do backupu.' });
      return;
    }
    try {
      await importBackupByPath(backupPath.trim());
      notify({
        type: 'success',
        text: 'Backup zaimportowany. Dla bezpieczeństwa uruchom ponownie aplikację desktop.',
      });
    } catch (error) {
      notify({
        type: 'error',
        text: `Import backupu nie powiódł się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleImportBackupFile = async () => {
    if (!isAdmin) {
      notify({ type: 'error', text: 'Import backupu wymaga roli ADMIN.' });
      return;
    }
    if (!backupFileToImport) {
      notify({ type: 'error', text: 'Najpierw wybierz plik backupu (.tar.gz).' });
      return;
    }
    try {
      await importBackupFromFile(backupFileToImport);
      notify({
        type: 'success',
        text: 'Backup zaimportowany z pliku. Dla bezpieczeństwa uruchom ponownie aplikację desktop.',
      });
    } catch (error) {
      const suffix =
        error instanceof ApiRequestError && error.status === 403
          ? ` (zalogowane konto ma rolę: ${normalizedCurrentRole || 'BRAK'})`
          : '';
      notify({
        type: 'error',
        text: `Import backupu z pliku nie powiódł się: ${error instanceof Error ? error.message : 'nieznany błąd'}${suffix} (upewnij się, że plik to .tar.gz)`,
      });
    } finally {
      setBackupFileToImport(null);
      if (typeof document !== 'undefined') {
        const input = document.getElementById('backup-import-file') as HTMLInputElement | null;
        if (input) {
          input.value = '';
        }
      }
    }
  };

  const handleLoadDemoDataset = async () => {
    if (!isAdmin) {
      notify({ type: 'error', text: 'Wczytanie bazy demo wymaga roli ADMIN.' });
      return;
    }

    const confirmed = window.confirm(
      isPolish
        ? 'Wczytać bazę demo (200 zgłoszeń) i zastąpić aktualne zgłoszenia?'
        : 'Load demo dataset (200 tickets) and replace current tickets?',
    );
    if (!confirmed) {
      return;
    }

    setLoadingDemoDataset(true);
    try {
      const result = await loadDemoDataset({ count: 200, reset: true });
      await loadTicketsData();
      notify({
        type: 'success',
        text: isPolish
          ? `Baza demo gotowa. Dodano ${result.createdTickets} zgłoszeń (łącznie: ${result.totalTickets}).`
          : `Demo data loaded. Created ${result.createdTickets} tickets (total: ${result.totalTickets}).`,
      });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się wczytać bazy demo: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setLoadingDemoDataset(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      const saved = await updateAdminSettings(settings);
      setSettings(saved);
      const lang = normalizeLanguage(saved.uiDefaults?.language);
      setUiLanguage(lang);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('ts_ui_language', lang);
      }
      notify({ type: 'success', text: 'Konfiguracja została zapisana.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się zapisać konfiguracji: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleLanguageChange = (next: UILanguage) => {
    setUiLanguage(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ts_ui_language', next);
    }
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            uiDefaults: {
              ...prev.uiDefaults,
              language: next,
            },
          }
        : prev,
    );
  };

  const handleSetTechnicianCode = async () => {
    if (!signupCode.trim()) {
      notify({ type: 'error', text: 'Wpisz kod samorejestracji technika.' });
      return;
    }
    try {
      await setTechnicianSignupCode({
        code: signupCode.trim(),
        enabled: settings?.features.technicianSelfSignup ?? true,
      });
      notify({ type: 'success', text: 'Kod rejestracji technika zapisany.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się zapisać kodu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleLogoFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      notify({ type: 'error', text: 'Logo musi być plikiem obrazu (PNG/JPG/SVG).' });
      event.target.value = '';
      return;
    }

    try {
      const asDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Nie udało się wczytać pliku logo.'));
        reader.readAsDataURL(file);
      });

      setSettings((prev) =>
        prev
          ? {
              ...prev,
              branding: {
                ...prev.branding,
                logoDataUrl: asDataUrl,
              },
            }
          : prev,
      );
      notify({ type: 'success', text: 'Logo wczytane. Zapisz konfigurację, aby utrwalić.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się wczytać logo: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      event.target.value = '';
    }
  };

  const handleUploadTicketFiles = async (ticketId: string, files: File[]) => {
    if (files.length === 0) {
      return;
    }
    setUploadingAttachment(true);
    try {
      for (const file of files) {
        await uploadAttachment(ticketId, file);
      }
      await loadTicketDetails(ticketId);
      notify({ type: 'success', text: `Dodano ${files.length} załącznik(i).` });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się wysłać załączników: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleOpenAttachment = async (attachment: TicketAttachment) => {
    setOpeningAttachmentId(attachment.id);
    try {
      const token = getStoredToken();
      const response = await fetch(getAttachmentFileUrl(attachment.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.filename;
      link.target = '_blank';
      link.rel = 'noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się pobrać załącznika: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  const handlePreviewAttachment = async (attachment: TicketAttachment) => {
    setPreviewingAttachmentId(attachment.id);
    try {
      const token = getStoredToken();
      const response = await fetch(getAttachmentFileUrl(attachment.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const previewUrl = window.URL.createObjectURL(blob);
      setAttachmentPreview((prev) => {
        if (prev?.url) {
          window.URL.revokeObjectURL(prev.url);
        }
        return {
          attachmentId: attachment.id,
          filename: attachment.filename,
          url: previewUrl,
        };
      });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się przygotować podglądu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setPreviewingAttachmentId(null);
    }
  };

  const handleDeleteAttachment = async (attachment: TicketAttachment) => {
    if (!selectedTicketId) {
      return;
    }

    if (!window.confirm(`Usunąć załącznik "${attachment.filename}"?`)) {
      return;
    }

    try {
      await deleteAttachment(attachment.id);
      await loadTicketDetails(selectedTicketId);
      if (attachmentPreview?.attachmentId === attachment.id) {
        clearAttachmentPreview();
      }
      notify({ type: 'success', text: 'Załącznik został usunięty.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się usunąć załącznika: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleCreateReminder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTicketId) {
      notify({ type: 'error', text: 'Wybierz ticket, aby dodać przypomnienie.' });
      return;
    }
    if (newReminder.title.trim().length < 2 || !newReminder.dueAt) {
      notify({ type: 'error', text: 'Uzupełnij tytuł i termin przypomnienia.' });
      return;
    }

    setReminderSubmitting(true);
    try {
      await createReminder({
        ticketId: selectedTicketId,
        title: newReminder.title.trim(),
        note: newReminder.note.trim() || undefined,
        dueAt: newReminder.dueAt,
      });
      setNewReminder(emptyReminderForm);
      await Promise.all([loadTicketReminders(selectedTicketId), loadGlobalReminders()]);
      notify({ type: 'success', text: 'Przypomnienie zostało dodane.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się dodać przypomnienia: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setReminderSubmitting(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailTo.trim()) {
      notify({ type: 'error', text: 'Podaj adres e-mail do testu.' });
      return;
    }

    try {
      const result = await sendTestEmail({
        to: testEmailTo.trim(),
        subject: 'Test integracji e-mail OpenTicket',
        message: 'OpenTicket: test kanału e-mail.',
      });
      if ((result as any)?.ok) {
        notify({ type: 'success', text: 'Test e-mail wysłany poprawnie.' });
      } else {
        notify({
          type: 'error',
          text: `Test e-mail nie został wysłany: ${(result as any)?.reason || 'sprawdź konfigurację'}`,
        });
      }
    } catch (error) {
      notify({
        type: 'error',
        text: `Test e-mail nie powiódł się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleTestSms = async () => {
    if (!testSmsTo.trim()) {
      notify({ type: 'error', text: 'Podaj numer telefonu do testu SMS.' });
      return;
    }

    try {
      const result = await sendTestSms({
        to: testSmsTo.trim(),
        message: 'OpenTicket: test kanału SMS.',
      });
      if ((result as any)?.ok) {
        notify({ type: 'success', text: 'Test SMS wysłany poprawnie.' });
      } else {
        notify({
          type: 'error',
          text: `Test SMS nie został wysłany: ${(result as any)?.reason || 'sprawdź konfigurację'}`,
        });
      }
    } catch (error) {
      notify({
        type: 'error',
        text: `Test SMS nie powiódł się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleToggleReminder = async (reminder: ReminderItem, done: boolean) => {
    try {
      await markReminderDone(reminder.id, done);
      if (selectedTicketId) {
        await Promise.all([loadTicketReminders(selectedTicketId), loadGlobalReminders()]);
      }
      notify({ type: 'success', text: done ? 'Przypomnienie oznaczone jako wykonane.' : 'Przypomnienie ponownie aktywne.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się zaktualizować przypomnienia: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleDeleteReminder = async (reminder: ReminderItem) => {
    try {
      await deleteReminder(reminder.id);
      if (selectedTicketId) {
        await Promise.all([loadTicketReminders(selectedTicketId), loadGlobalReminders()]);
      }
      notify({ type: 'success', text: 'Przypomnienie zostało usunięte.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się usunąć przypomnienia: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const applyTicketWorkflowStatus = async (nextStatus: TicketStatus, mode: 'manual' | 'next' | 'reopen') => {
    if (!selectedTicketId || !selectedTicket) {
      notify({ type: 'error', text: 'Najpierw wybierz ticket.' });
      return;
    }

    if (selectedTicket.status === nextStatus) {
      return;
    }

    setUpdatingWorkflow(true);
    try {
      await updateTicket(selectedTicketId, { status: nextStatus });
      await Promise.all([loadTicketsData(), loadTicketDetails(selectedTicketId)]);
      const actionLabel =
        mode === 'reopen'
          ? 'Zgłoszenie zostało wznowione.'
          : mode === 'next'
            ? 'Przejście do kolejnego etapu zapisane.'
            : 'Etap zgłoszenia został zaktualizowany.';
      notify({ type: 'success', text: actionLabel });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się zmienić etapu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setUpdatingWorkflow(false);
    }
  };

  const handleAdvanceWorkflow = async () => {
    if (!nextWorkflowStatus) {
      notify({ type: 'error', text: 'To zgłoszenie jest już na ostatnim etapie.' });
      return;
    }
    await applyTicketWorkflowStatus(nextWorkflowStatus, 'next');
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket || !canReopenTicket) {
      return;
    }
    const confirmed = window.confirm(
      isPolish
        ? 'Wznowić zgłoszenie i wrócić do etapu diagnozy?'
        : 'Reopen this ticket and move it back to diagnosis?',
    );
    if (!confirmed) {
      return;
    }
    await applyTicketWorkflowStatus('DIAGNOSIS', 'reopen');
  };

  const handleExportStatisticsPdf = () => {
    if (!statistics) {
      notify({ type: 'error', text: 'Najpierw załaduj statystyki.' });
      return;
    }

    const rowsToHtml = (rows: Array<{ key: string; count: number }>, label: (key: string) => string) =>
      rows
        .map(
          (row) =>
            `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(
              label(row.key),
            )}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right"><strong>${row.count}</strong></td></tr>`,
        )
        .join('');

    const trendRows = statisticsTrend
      .map(
        (row) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${escapeHtml(
            row.date,
          )}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${row.created}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${row.closed}</td></tr>`,
      )
      .join('');

    const printedAt = formatDate(new Date().toISOString());
    const html = `
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>OpenTicket - Raport statystyk</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:#0f172a; margin:24px; }
    h1,h2 { margin:0 0 10px; }
    .meta { color:#475569; font-size:12px; margin-bottom:16px; }
    .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:16px; }
    .card { border:1px solid #e2e8f0; border-radius:10px; padding:10px; background:#f8fafc; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:14px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <h1>OpenTicket - Raport statystyk</h1>
  <div class="meta">Wygenerowano: ${escapeHtml(printedAt)}</div>
  <div class="meta">Filtry: od=${escapeHtml(
    statisticsFilters.from || '-',
  )}, do=${escapeHtml(statisticsFilters.to || '-')}, status=${escapeHtml(
    statisticsFilters.status || '-',
  )}, priorytet=${escapeHtml(statisticsFilters.priority || '-')}, kanał=${escapeHtml(
    statisticsFilters.channel || '-',
  )}</div>

  <div class="grid">
    <div class="card"><strong>Łączna liczba zgłoszeń</strong><div style="font-size:22px;margin-top:6px;">${statistics.totalTickets}</div></div>
    <div class="card"><strong>Śr. czas rozwiązania (h)</strong><div style="font-size:22px;margin-top:6px;">${
      statistics.sla.averageResolutionHours ?? '-'
    }</div></div>
    <div class="card"><strong>Suma brutto kosztów</strong><div style="font-size:22px;margin-top:6px;">${asNumber(
      statistics.costs.grossTotal,
    ).toFixed(2)} PLN</div></div>
  </div>

  <h2>Statusy</h2>
  <table><tbody>${rowsToHtml(statistics.byStatus, (key) => statusLabels[key] || key)}</tbody></table>
  <h2>Priorytety</h2>
  <table><tbody>${rowsToHtml(statistics.byPriority, (key) => priorityLabels[key] || key)}</tbody></table>
  <h2>Kanały</h2>
  <table><tbody>${rowsToHtml(statistics.byChannel, (key) => key)}</tbody></table>
  <h2>Trend dzienny</h2>
  <table>
    <thead><tr><th style="text-align:left;padding:6px 8px;">Dzień</th><th style="text-align:right;padding:6px 8px;">Nowe</th><th style="text-align:right;padding:6px 8px;">Zamknięte</th></tr></thead>
    <tbody>${trendRows}</tbody>
  </table>
</body>
</html>`;

    const fileName = `openticket-raport-${new Date().toISOString().slice(0, 10)}.html`;
    const downloadFallback = (reason?: string) => {
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1500);
        notify({
          type: 'success',
          text: reason
            ? `Druk bezpośredni był niedostępny (${reason}). Pobrano raport do wydruku: ${fileName}.`
            : `Pobrano raport do wydruku: ${fileName}.`,
        });
      } catch (error) {
        notify({
          type: 'error',
          text: `Nie udało się wygenerować raportu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
        });
      }
    };

    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('title', 'OpenTicket print frame');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) {
          return;
        }
        cleaned = true;
        iframe.remove();
      };

      iframe.onload = () => {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) {
          cleanup();
          downloadFallback('brak okna wydruku');
          return;
        }

        frameWindow.focus();
        frameWindow.addEventListener(
          'afterprint',
          () => {
            cleanup();
          },
          { once: true },
        );

        window.setTimeout(() => {
          try {
            frameWindow.print();
            // Safari czasem nie wywołuje afterprint dla iframe.
            window.setTimeout(cleanup, 4000);
          } catch {
            cleanup();
            downloadFallback('błąd wywołania print()');
          }
        }, 200);
      };

      document.body.appendChild(iframe);
      iframe.srcdoc = html;
    } catch {
      downloadFallback('błąd inicjalizacji wydruku');
    }
  };

  const handleAssignSelectedTicket = async () => {
    if (!selectedTicketId) {
      notify({ type: 'error', text: 'Najpierw wybierz ticket.' });
      return;
    }

    setAssigningTicket(true);
    try {
      await updateTicket(selectedTicketId, {
        assignedAgentId: assignmentDraft || null,
      });
      await Promise.all([loadTicketsData(), loadTicketDetails(selectedTicketId)]);
      notify({
        type: 'success',
        text: assignmentDraft ? 'Technik został przypisany do zgłoszenia.' : 'Przypisanie technika zostało usunięte.',
      });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się zapisać przypisania: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setAssigningTicket(false);
    }
  };

  const resolvePreferredWebUiUrl = (): string => {
    if (serverInfo?.installationMode === 'client_only' && serverInfo?.remoteApiBaseUrl) {
      return serverInfo.remoteApiBaseUrl;
    }

    try {
      const docsUrl = new URL(buildApiUrl('/api/docs'));
      const port = docsUrl.port || '3000';
      return `${docsUrl.protocol}//ticketmaster.localhost:${port}`;
    } catch {
      if (typeof window !== 'undefined') {
        return window.location.origin;
      }
      return 'http://127.0.0.1:3000';
    }
  };

  const handleOpenWebUi = async () => {
    const targetUrl = resolvePreferredWebUiUrl();
    try {
      const bridge = getElectron();
      if (bridge?.openExternalUrl) {
        await bridge.openExternalUrl(targetUrl);
      } else if (typeof window !== 'undefined') {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
      notify({ type: 'success', text: `Otwarto WebUI: ${targetUrl}` });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się otworzyć WebUI: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const runEngineAction = async (
    action: 'restart' | 'repair' | 'logs' | 'diagnostics' | 'permissions',
    runner: (bridge: ElectronBridge) => Promise<any>,
  ) => {
    const bridge = getElectron();
    if (!bridge) {
      notify({ type: 'error', text: 'Akcja dostępna tylko w aplikacji desktop.' });
      return;
    }

    setServiceBusy(action);
    try {
      const result = await runner(bridge);
      const message = result?.message || 'Akcja wykonana.';
      setServiceInfo(message);
      if (result?.success === false) {
        notify({ type: 'error', text: message });
      } else {
        await loadServerStatus();
        notify({ type: 'success', text: message });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd.';
      setServiceInfo(message);
      notify({ type: 'error', text: message });
    } finally {
      setServiceBusy(null);
    }
  };

  const runUpdateAction = async (
    action: 'update-check' | 'update-download' | 'update-install' | 'open-backups',
    runner: (bridge: ElectronBridge) => Promise<any>,
  ) => {
    const bridge = getElectron();
    if (!bridge) {
      notify({ type: 'error', text: 'Akcja aktualizacji jest dostępna tylko w aplikacji desktop.' });
      return null;
    }

    setServiceBusy(action);
    try {
      const result = await runner(bridge);
      if (result?.status) {
        setUpdateStatus(result.status);
      } else {
        await loadUpdateStatus();
      }
      const message = result?.message || 'Akcja aktualizacji wykonana.';
      setServiceInfo(message);
      notify({ type: 'success', text: message });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd aktualizacji.';
      setServiceInfo(message);
      notify({ type: 'error', text: message });
      return null;
    } finally {
      setServiceBusy(null);
    }
  };

  const handleCreateDesktopBackup = async (
    reason = 'manual-before-update',
    options?: { silentSuccess?: boolean },
  ): Promise<string | null> => {
    const bridge = getElectron();
    if (!bridge?.createUpdateBackup) {
      notify({ type: 'error', text: 'Backup desktop jest dostępny tylko w aplikacji instalatora.' });
      return null;
    }

    setServiceBusy('update-backup');
    try {
      const result = await bridge.createUpdateBackup(reason);
      const ok = Boolean(result?.success);
      const message = result?.message || (ok ? 'Backup utworzony.' : 'Backup nie powiódł się.');
      setServiceInfo(message);
      if (ok) {
        if (result.backupPath) {
          setBackupPath(result.backupPath);
        }
        await loadUpdateStatus();
        if (!options?.silentSuccess) {
          notify({ type: 'success', text: message });
        }
        return result.backupPath || null;
      }

      notify({ type: 'error', text: message });
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd backupu.';
      setServiceInfo(message);
      notify({ type: 'error', text: message });
      return null;
    } finally {
      setServiceBusy(null);
    }
  };

  const handleCheckForUpdates = async () => {
    await runUpdateAction('update-check', (bridge) => bridge.checkForUpdates());
  };

  const handleDownloadUpdate = async () => {
    if (backupBeforeUpdate) {
      const backupPath = await handleCreateDesktopBackup('before-update-download', { silentSuccess: true });
      if (!backupPath) {
        notify({
          type: 'error',
          text: 'Przerwano aktualizację, bo backup przed aktualizacją nie został utworzony.',
        });
        return;
      }
    }

    await runUpdateAction('update-download', (bridge) => bridge.downloadUpdate());
  };

  const handleInstallUpdate = async () => {
    if (backupBeforeUpdate) {
      const backupPath = await handleCreateDesktopBackup('before-update-install', { silentSuccess: true });
      if (!backupPath) {
        notify({
          type: 'error',
          text: 'Przerwano instalację aktualizacji, bo backup nie został utworzony.',
        });
        return;
      }
    }

    await runUpdateAction('update-install', (bridge) => bridge.installUpdate());
  };

  if (bootLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
          <p className="text-sm text-slate-600">Ładowanie dashboardu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ts-bg)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-[var(--ts-sidebar-border)] bg-[var(--ts-sidebar)] text-white md:flex">
          <div className="flex h-16 items-center justify-center gap-2 border-b border-[var(--ts-sidebar-border)] px-4 text-xl font-bold tracking-wide">
            {companyLogo ? (
              <img src={companyLogo} alt={companyName} className="h-8 w-8 rounded-md bg-white/90 object-contain p-1" />
            ) : (
              <img src={fallbackBrandMark} alt="OpenTicket" className="h-8 w-8 rounded-md bg-white/90 object-contain p-1" />
            )}
            <span className="truncate">{companyName}</span>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`flex w-full items-center rounded-lg px-4 py-3 text-sm font-medium transition ${
                    active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="ml-3">{isPolish ? item.labelPl : item.labelEn}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-[var(--ts-sidebar-border)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-bold">
                {(currentUser?.name || currentUser?.email || 'U')[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{currentUser?.name || currentUser?.email || 'Użytkownik'}</p>
                <p className="text-xs text-slate-400">
                  {currentUser?.role ? roleLabels[currentUser.role] || currentUser.role : isPolish ? 'Brak roli' : 'No role'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isPolish ? 'Wyloguj' : 'Log out'}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
            <span className="text-sm font-medium text-slate-500">
              {isPolish
                ? `Panel ${currentUser?.role === 'ADMIN' ? 'Administratora' : 'Technika'} / ${activeNavTitle}`
                : `${currentUser?.role === 'ADMIN' ? 'Admin Panel' : 'Technician Panel'} / ${activeNavTitle}`}
            </span>
            <div className="flex items-center gap-3">
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                value={uiLanguage}
                onChange={(event) => handleLanguageChange(event.target.value as UILanguage)}
                title={isPolish ? 'Wybór języka' : 'Language'}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang === 'pl' ? 'Polski' : 'English'}
                  </option>
                ))}
              </select>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReminderPanel((prev) => !prev)}
                  className="relative rounded-md p-2 text-slate-400 transition hover:text-blue-600"
                  title={isPolish ? 'Powiadomienia i przypomnienia' : 'Notifications and reminders'}
                >
                  <Bell className="h-5 w-5" />
                  {pendingReminderCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {overdueReminderCount > 0 ? '!' : pendingReminderCount > 9 ? '9+' : pendingReminderCount}
                    </span>
                  )}
                </button>
                {showReminderPanel && (
                  <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {isPolish ? 'Przypomnienia' : 'Reminders'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowReminderPanel(false)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        X
                      </button>
                    </div>
                    {topReminderItems.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        {isPolish ? 'Brak aktywnych przypomnień.' : 'No pending reminders.'}
                      </p>
                    ) : (
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {topReminderItems.map((item) => {
                          const ticket = tickets.find((entry) => entry.id === item.ticketId);
                          const overdue = new Date(item.dueAt).getTime() <= Date.now();
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                if (item.ticketId) {
                                  setActiveNav('tickets');
                                  void handleOpenTicketDetails(item.ticketId);
                                }
                                setShowReminderPanel(false);
                              }}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                                overdue
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <p className="font-semibold">{item.title}</p>
                              <p className="mt-0.5 text-[11px]">
                                {isPolish ? 'Termin' : 'Due'}: {formatDate(item.dueAt)}
                              </p>
                              {ticket && <p className="text-[11px]">#{ticket.number} - {ticket.title}</p>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNav('vat');
                          setShowReminderPanel(false);
                        }}
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        {isPolish ? 'Konfiguracja powiadomień' : 'Notification settings'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleOpenWebUi()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                title={isPolish ? 'Otwórz WebUI w przeglądarce' : 'Open WebUI in browser'}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                WebUI
              </button>

              {activeNav === 'tickets' && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  {isPolish ? 'Nowe Zgłoszenie' : 'New Ticket'}
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {notice && (
              <div
                className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                  notice.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {notice.text}
              </div>
            )}

            {activeNav === 'tickets' && (
              <>
                <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
                  {orderedWidgets.map((widget, idx) => {
                    const Icon = widget.icon;
                    const widgetSize = widgetSizes[widget.key] || 'md';
                    const spanClass =
                      widgetSize === 'lg'
                        ? 'md:col-span-6 xl:col-span-6'
                        : widgetSize === 'sm'
                          ? 'md:col-span-3 xl:col-span-2'
                          : 'md:col-span-3 xl:col-span-3';
                    return (
                      <article
                        key={widget.key}
                        draggable
                        onDragStart={() => setDraggingWidget(widget.key)}
                        onDragEnd={() => setDraggingWidget(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggingWidget) {
                            void reorderWidgets(draggingWidget, widget.key);
                            setDraggingWidget(null);
                          }
                        }}
                        className={`ticket-surface animate-enter rounded-xl border border-slate-100 p-5 ${spanClass} ${
                          draggingWidget === widget.key ? 'opacity-70 ring-2 ring-blue-200' : ''
                        } ${
                          idx > 0 ? `[animation-delay:${idx * 60}ms]` : ''
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                            {isPolish ? `Rozmiar: ${widgetSize.toUpperCase()}` : `Size: ${widgetSize.toUpperCase()}`}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleWidgetSizeStep(widget.key, 'down')}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-100"
                              title={isPolish ? 'Zmniejsz widget' : 'Smaller widget'}
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleWidgetSizeStep(widget.key, 'up')}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-100"
                              title={isPolish ? 'Powiększ widget' : 'Larger widget'}
                            >
                              +
                            </button>
                            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold">
                              {isPolish ? 'Przeciągnij' : 'Drag'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{widget.title}</p>
                            <p className="text-3xl font-bold text-slate-900">{widget.value}</p>
                          </div>
                          <div className={`rounded-full p-2 ${widget.iconClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>

                <section className="ticket-surface mb-5 rounded-xl border border-slate-100 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">Informacje</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                        value={selectedPresetName}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSelectedPresetName(value);
                          const selected = savedPresetOptions.find((item) => item.name === value);
                          if (selected) {
                            applySavedFilter(selected);
                          }
                        }}
                        title={isPolish ? 'Szybka zmiana filtra' : 'Quick filter switch'}
                      >
                        <option value="">{isPolish ? 'Wczytaj zapisany filtr' : 'Load saved filter'}</option>
                        {savedPresetOptions.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={newPresetName}
                        onChange={(event) => setNewPresetName(event.target.value)}
                        className="min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                        placeholder={isPolish ? 'Nazwa nowego filtra' : 'New filter name'}
                      />
                      <button
                        type="button"
                        onClick={() => void addCurrentFilterToSaved(newPresetName)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        <ArrowDownUp className="h-3.5 w-3.5" />
                        {isPolish ? 'Zapisz filtr' : 'Save filter'}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => applyInfoCardFilter('all')}
                      className={`rounded-lg border p-4 text-left text-sm transition ${
                        !filters.status
                          ? 'border-blue-300 bg-blue-100 text-blue-900 shadow-sm'
                          : 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                      }`}
                      title={isPolish ? 'Pokaż wszystkie statusy' : 'Show all statuses'}
                    >
                      <strong>Razem zgłoszeń:</strong> {stats.total}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyInfoCardFilter('waiting')}
                      className={`rounded-lg border p-4 text-left text-sm transition ${
                        filters.status === 'WAITING_FOR_APPROVAL' || filters.status === 'WAITING_FOR_CUSTOMER'
                          ? 'border-amber-300 bg-amber-100 text-amber-900 shadow-sm'
                          : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                      title={isPolish ? 'Filtr: oczekujące na klienta' : 'Filter: waiting for customer'}
                    >
                      <strong>Czekające na klienta:</strong> {stats.waitingForCustomer}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyInfoCardFilter('closed')}
                      className={`rounded-lg border p-4 text-left text-sm transition ${
                        filters.status === 'CLOSED' || filters.status === 'ARCHIVED'
                          ? 'border-violet-300 bg-violet-100 text-violet-900 shadow-sm'
                          : 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
                      }`}
                      title={isPolish ? 'Filtr: zgłoszenia zamknięte' : 'Filter: closed tickets'}
                    >
                      <strong>Zamknięte razem:</strong> {stats.closedAll}
                    </button>
                  </div>

                  {(dashboardPrefs.savedFilters || []).length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(dashboardPrefs.savedFilters || []).map((saved) => (
                        <button
                          key={saved.name}
                          type="button"
                          onClick={() => applySavedFilter(saved)}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          {saved.name}
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="ticket-surface rounded-xl border border-slate-100">
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-md">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="Szukaj po temacie, #numerze, treści, imieniu i nazwisku..."
                        value={filters.search}
                        onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                      />
                    </div>

                    <div className="grid w-full gap-2 md:w-auto md:grid-cols-4 xl:grid-cols-5">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={filters.onlyMine}
                          onChange={(event) => setFilters((prev) => ({ ...prev, onlyMine: event.target.checked }))}
                        />
                        {isPolish ? 'Tylko moje' : 'Only mine'}
                      </label>

                      <input
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        type="number"
                        min={1}
                        max={3650}
                        placeholder={isPolish ? '> X dni' : '> X days'}
                        value={filters.minAgeDays}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            minAgeDays: event.target.value.replace(/[^0-9]/g, ''),
                          }))
                        }
                      />

                      <select
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        value={filters.status}
                        onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                      >
                        <option value="">{isPolish ? 'Status: wszystkie' : 'Status: all'}</option>
                        {FILTER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[uiLanguage][status]}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        value={filters.priority}
                        onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))}
                      >
                        <option value="">{isPolish ? 'Priorytet: wszystkie' : 'Priority: all'}</option>
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {PRIORITY_LABELS[uiLanguage][priority]}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        value={filters.channel}
                        onChange={(event) => setFilters((prev) => ({ ...prev, channel: event.target.value }))}
                      >
                        <option value="">{isPolish ? 'Kanał: wszystkie' : 'Channel: all'}</option>
                        {CHANNELS.map((channel) => (
                          <option key={channel} value={channel}>
                            {channel}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        value={filters.assignedState}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, assignedState: event.target.value as FilterState['assignedState'] }))
                        }
                      >
                        <option value="">{isPolish ? 'Przypisanie: dowolne' : 'Assignment: any'}</option>
                        <option value="assigned">{isPolish ? 'Przypisane' : 'Assigned'}</option>
                        <option value="unassigned">{isPolish ? 'Nieprzypisane' : 'Unassigned'}</option>
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        value={filters.assignedAgentId}
                        onChange={(event) => setFilters((prev) => ({ ...prev, assignedAgentId: event.target.value }))}
                      >
                        <option value="">{isPolish ? 'Technik: wszyscy' : 'Technician: all'}</option>
                        {assignableAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name || agent.email}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        value={filters.hasAttachments}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, hasAttachments: event.target.value as FilterState['hasAttachments'] }))
                        }
                      >
                        <option value="">{isPolish ? 'Załączniki: wszystkie' : 'Attachments: all'}</option>
                        <option value="yes">{isPolish ? 'Tylko z załącznikami' : 'Only with attachments'}</option>
                        <option value="no">{isPolish ? 'Tylko bez załączników' : 'Only without attachments'}</option>
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        value={filters.hasComments}
                        onChange={(event) =>
                          setFilters((prev) => ({ ...prev, hasComments: event.target.value as FilterState['hasComments'] }))
                        }
                      >
                        <option value="">{isPolish ? 'Komentarze: wszystkie' : 'Comments: all'}</option>
                        <option value="yes">{isPolish ? 'Tylko z komentarzami' : 'Only with comments'}</option>
                        <option value="no">{isPolish ? 'Tylko bez komentarzy' : 'Only without comments'}</option>
                      </select>

                      <input
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        type="date"
                        value={filters.createdFrom}
                        onChange={(event) => setFilters((prev) => ({ ...prev, createdFrom: event.target.value }))}
                      />
                      <input
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        type="date"
                        value={filters.createdTo}
                        onChange={(event) => setFilters((prev) => ({ ...prev, createdTo: event.target.value }))}
                      />

                      <select
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        value={filters.sort}
                        onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value as FilterState['sort'] }))}
                      >
                        <option value="createdAt_desc">{isPolish ? 'Sortuj: najnowsze' : 'Sort: newest'}</option>
                        <option value="createdAt_asc">{isPolish ? 'Sortuj: najstarsze' : 'Sort: oldest'}</option>
                        <option value="updatedAt_desc">{isPolish ? 'Ostatnio aktualizowane' : 'Recently updated'}</option>
                        <option value="priority_desc">{isPolish ? 'Priorytet malejąco' : 'Priority desc'}</option>
                        <option value="number_desc">{isPolish ? 'Numer malejąco' : 'Number desc'}</option>
                        <option value="status_asc">{isPolish ? 'Status A→Z' : 'Status A→Z'}</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setFilters({ ...DEFAULT_FILTER_STATE });
                          setSelectedPresetName('');
                          setNewPresetName('');
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                      >
                        {isPolish ? 'Wyczyść filtry' : 'Clear filters'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void loadTicketsData()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {isPolish ? 'Odśwież' : 'Refresh'}
                      </button>
                    </div>
                  </div>

                  {loadingTickets ? (
                    <p className="px-4 py-8 text-sm text-slate-500">Ładuję tickety...</p>
                  ) : tickets.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-slate-500">Brak zgłoszeń spełniających kryteria.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left">
                        <thead className="border-b border-slate-200 bg-white text-xs font-semibold uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Temat</th>
                            <th className="px-4 py-3">Zgłaszający</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Priorytet</th>
                            <th className="px-4 py-3">Przypisany</th>
                            <th className="px-4 py-3 text-right">Akcje</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {tickets.map((ticket) => {
                            const ownerName = ticket.owner?.name || ticket.owner?.email || 'Nieznany klient';
                            const ownerInitial = ownerName[0]?.toUpperCase() || '?';
                            const statusMeta = getStatusMeta(ticket.status);
                            const priorityMeta = PRIORITY_META[ticket.priority];

                            return (
                              <tr
                                key={ticket.id}
                                onClick={() => void handleOpenTicketDetails(ticket.id)}
                                className={`cursor-pointer transition hover:bg-blue-50 ${
                                  selectedTicketId === ticket.id ? 'bg-blue-50/70' : 'bg-white'
                                }`}
                              >
                                <td className="px-4 py-3 text-slate-500">#{ticket.number}</td>
                                <td className="px-4 py-3 font-medium text-slate-900">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleOpenTicketDetails(ticket.id);
                                    }}
                                    className="rounded px-1 py-0.5 text-left transition hover:bg-blue-100 hover:text-blue-700"
                                  >
                                    {ticket.title}
                                  </button>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                                      {ownerInitial}
                                    </div>
                                    <span>{ownerName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                                    {STATUS_LABELS[uiLanguage][ticket.status] || ticket.status}
                                  </span>
                                </td>
                                <td className={`px-4 py-3 text-xs ${priorityMeta.className}`}>
                                  {PRIORITY_LABELS[uiLanguage][ticket.priority]}
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                  {ticket.assignedAgent
                                    ? ticket.assignedAgent.name || ticket.assignedAgent.email
                                    : 'Nieprzypisany'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleOpenTicketDetails(ticket.id);
                                    }}
                                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                  >
                                    <span>{isPolish ? 'Otwórz' : 'Open'}</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {selectedTicket && showTicketModal && (
                  <div
                    className="modal-overlay fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-3 py-5 backdrop-blur-sm md:p-8"
                    onClick={() => void handleRequestCloseTicketModal()}
                  >
                    <section
                      className="ticket-surface modal-panel flex max-h-[95vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-slate-100 shadow-2xl md:resize"
                      style={{
                        transform: `translate(${ticketModalOffset.x}px, ${ticketModalOffset.y}px)`,
                        minHeight: '560px',
                        minWidth: 'min(760px, 94vw)',
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div
                        className={`flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 ${
                          ticketModalDragging ? 'cursor-grabbing' : 'cursor-grab'
                        }`}
                        onMouseDown={startTicketModalDrag}
                      >
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {isPolish ? 'Szczegóły zgłoszenia' : 'Ticket details'}
                          </p>
                          <h3 className="mt-1 text-lg font-bold text-slate-900">
                            #{selectedTicket.number} - {selectedTicket.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
                            <GripHorizontal className="h-3.5 w-3.5" />
                            {isPolish ? 'Przeciągnij / Skaluj' : 'Drag / Resize'}
                          </span>
                          {hasTicketDraftChanges && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                              {isPolish ? 'Niezapisane zmiany' : 'Unsaved changes'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleRequestCloseTicketModal()}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <X className="h-3.5 w-3.5" />
                            {isPolish ? 'Zamknij' : 'Close'}
                          </button>
                        </div>
                      </div>
                      <div className="overflow-y-auto px-5 py-5">
                        <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-base font-semibold text-slate-900">
                            #{selectedTicket.number} - {selectedTicket.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusMeta(selectedTicket.status).className}`}>
                              {statusLabels[selectedTicket.status] || selectedTicket.status}
                            </span>
                            <span className={`rounded-full border border-slate-200 px-3 py-1 text-[11px] ${PRIORITY_META[selectedTicket.priority].className}`}>
                              {priorityLabels[selectedTicket.priority]}
                            </span>
                            <span className="text-xs text-slate-500">Utworzono: {formatDate(selectedTicket.createdAt)}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">{selectedTicket.description}</p>

                        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-slate-900">Etap zgłoszenia</h4>
                            <span className="text-xs text-slate-500">
                              Krok {Math.max(currentWorkflowIndex + 1, 1)} / {WORKFLOW_STATUSES.length}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Ścieżka: przyjęcie → diagnoza → kosztorys → zamawianie części → oczekiwanie na zgodę → wysłano do klienta → zamknięte.
                          </p>
                          <div className="mt-2 flex flex-col gap-2 md:flex-row">
                            <select
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:max-w-sm"
                              value={currentWorkflowStatus || selectedTicket.status}
                              onChange={(event) =>
                                void applyTicketWorkflowStatus(event.target.value as TicketStatus, 'manual')
                              }
                              disabled={updatingWorkflow}
                            >
                              {WORKFLOW_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabels[status] || status}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void handleAdvanceWorkflow()}
                              disabled={updatingWorkflow || !nextWorkflowStatus}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                            >
                              {updatingWorkflow ? 'Zapisywanie...' : 'Następny krok'}
                            </button>
                            {canReopenTicket && (
                              <button
                                type="button"
                                onClick={() => void handleReopenTicket()}
                                disabled={updatingWorkflow}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                Reopen (wznów zgłoszenie)
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                          <h4 className="text-sm font-semibold text-slate-900">{isPolish ? 'Opis usterki' : 'Issue description'}</h4>
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <p className="whitespace-pre-wrap text-sm text-slate-700">
                              {selectedTicket.description?.trim() || (isPolish ? 'Brak opisu.' : 'No description.')}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 p-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                              {isPolish ? 'Technik prowadzący' : 'Assigned technician'}
                            </h4>
                            <div className="mt-2 flex flex-col gap-2">
                              <select
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                value={assignmentDraft}
                                onChange={(event) => setAssignmentDraft(event.target.value)}
                                disabled={assigningTicket}
                              >
                                <option value="">{isPolish ? 'Nieprzypisany' : 'Unassigned'}</option>
                                {assignableAgents.map((agent) => (
                                  <option key={agent.id} value={agent.id}>
                                    {(agent.name || agent.email) + ` (${agent.role})`}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => void handleAssignSelectedTicket()}
                                disabled={assigningTicket}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                              >
                                {assigningTicket ? (isPolish ? 'Zapisywanie...' : 'Saving...') : isPolish ? 'Zapisz przypisanie' : 'Save assignment'}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-slate-900">{isPolish ? 'Zdjęcia' : 'Photos'}</h4>
                            <span className="text-xs text-slate-500">
                              {isPolish ? `Liczba: ${imageAttachments.length}` : `Count: ${imageAttachments.length}`}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {imageAttachments.length === 0 ? (
                              <p className="col-span-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                {isPolish ? 'Brak zdjęć w zgłoszeniu.' : 'No photos in this ticket.'}
                              </p>
                            ) : (
                              imageAttachments.slice(0, 6).map((attachment) => (
                                <button
                                  key={attachment.id}
                                  type="button"
                                  className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                  onClick={() => void handlePreviewAttachment(attachment)}
                                >
                                  <img
                                    src={buildApiUrl(`/tickets/${selectedTicket.id}/attachments/${attachment.id}/raw`)}
                                    alt={attachment.filename}
                                    className="h-20 w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                                    loading="lazy"
                                  />
                                </button>
                              ))
                            )}
                          </div>
                          <form className="space-y-2" onSubmit={handleAddComment}>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                              {isPolish ? 'Dodaj komentarz' : 'Add comment'}
                            </label>
                            <textarea
                              rows={3}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              placeholder={isPolish ? 'Dodaj komentarz do zgłoszenia' : 'Add a ticket comment'}
                              value={commentBody}
                              onChange={(event) => setCommentBody(event.target.value)}
                            />
                            <label className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={commentInternal}
                                onChange={(event) => setCommentInternal(event.target.checked)}
                              />
                              {isPolish ? 'Notatka wewnętrzna' : 'Internal note'}
                            </label>
                            <button
                              type="submit"
                              disabled={submittingComment}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-300"
                            >
                              {submittingComment ? (isPolish ? 'Dodawanie...' : 'Adding...') : isPolish ? 'Dodaj komentarz' : 'Add comment'}
                            </button>
                          </form>
                        </div>
                      </div>

                      {loadingDetails ? (
                        <p className="text-sm text-slate-500">Ładowanie komentarzy i kosztów...</p>
                      ) : (
                        <>
                        <div className="grid gap-4 xl:grid-cols-3">
                          <div className="min-h-[210px] resize-y overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
                            <h4 className="text-sm font-semibold text-slate-900">Historia klienta</h4>
                            {customerHistoryLoading ? (
                              <p className="mt-2 text-xs text-slate-500">Ładowanie historii klienta...</p>
                            ) : customerHistory.length === 0 ? (
                              <p className="mt-2 text-xs text-slate-500">Brak wcześniejszych zgłoszeń dla tego klienta.</p>
                            ) : (
                              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                                {customerHistory.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => void handleOpenTicketDetails(item.id)}
                                    className="flex w-full items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1 text-left hover:bg-slate-100"
                                  >
                                    <span>
                                      #{item.number} - {item.title}
                                    </span>
                                    <span className="text-slate-500">{formatDate(item.createdAt)}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="min-h-[210px] resize-y overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
                            <h4 className="text-sm font-semibold text-slate-900">Historia etapów</h4>
                            {ticketStatusHistory.length === 0 ? (
                              <p className="mt-2 text-xs text-slate-500">Brak historii zmian statusu.</p>
                            ) : (
                              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                                {ticketStatusHistory.map((entry) => (
                                  <div key={entry.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                                    <p className="font-medium text-slate-700">
                                      {entry.fromStatus === 'CREATED'
                                        ? 'Utworzenie zgłoszenia'
                                        : `${statusLabels[entry.fromStatus] || entry.fromStatus} → ${
                                            statusLabels[entry.toStatus] || entry.toStatus
                                          }`}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {formatDate(entry.changedAt)} · {entry.user?.name || 'system'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="min-h-[210px] resize-y overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
                            <h4 className="text-sm font-semibold text-slate-900">Komentarze</h4>
                            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
                              {comments.length === 0 ? (
                                <p className="text-xs text-slate-500">Brak komentarzy.</p>
                              ) : (
                                comments.map((comment) => (
                                  <article key={comment.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                                    <div className="mb-1 flex items-center justify-between text-slate-500">
                                      <span>{comment.author?.name || comment.author?.email || 'Agent'}</span>
                                      <span>{formatDate(comment.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-slate-800">{comment.body}</p>
                                    {comment.isInternal && <p className="mt-1 text-[11px] text-amber-700">Notatka wewnętrzna</p>}
                                  </article>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                            <h4 className="text-sm font-semibold text-slate-900">Koszty</h4>
                            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
                              {costItems.length === 0 ? (
                                <p className="text-xs text-slate-500">Brak pozycji kosztowych.</p>
                              ) : (
                                <table className="min-w-full text-xs">
                                  <thead className="text-slate-500">
                                    <tr>
                                      <th className="px-1 py-1 text-left">Nazwa</th>
                                      <th className="px-1 py-1 text-right">Ilość</th>
                                      <th className="px-1 py-1 text-right">Netto</th>
                                      <th className="px-1 py-1 text-right">Brutto</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {costItems.map((item) => (
                                      <tr key={item.id} className="border-t border-slate-200 text-slate-700">
                                        <td className="px-1 py-1">{item.name}</td>
                                        <td className="px-1 py-1 text-right">{asNumber(item.qty).toFixed(2)}</td>
                                        <td className="px-1 py-1 text-right">{asNumber(item.netTotal).toFixed(2)} PLN</td>
                                        <td className="px-1 py-1 text-right">{asNumber(item.grossTotal).toFixed(2)} PLN</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>

                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                              <p>Netto: {costSummary.netTotal.toFixed(2)} PLN</p>
                              <p>VAT: {costSummary.vatTotal.toFixed(2)} PLN</p>
                              <p className="font-semibold">Brutto: {costSummary.grossTotal.toFixed(2)} PLN</p>
                            </div>

                            <form className="grid gap-2" onSubmit={handleAddCostItem}>
                              <select
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                value={selectedCatalogId}
                                onChange={(event) => handleSelectCatalogItem(event.target.value)}
                              >
                                <option value="">{isPolish ? 'Wybierz z katalogu (opcjonalnie)' : 'Select from catalog (optional)'}</option>
                                {costCatalog
                                  .filter((entry) => entry.active)
                                  .map((entry) => (
                                    <option key={entry.id} value={entry.id}>
                                      {entry.category ? `${entry.category} · ` : ''}
                                      {entry.name} ({Number(entry.unitNet).toFixed(2)} PLN)
                                    </option>
                                  ))}
                              </select>
                              <input
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Nazwa pozycji"
                                value={costForm.name}
                                onChange={(event) => setCostForm((prev) => ({ ...prev, name: event.target.value }))}
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                  placeholder="Ilość"
                                  value={costForm.qty}
                                  onChange={(event) => setCostForm((prev) => ({ ...prev, qty: event.target.value }))}
                                />
                                <input
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                  placeholder="Cena netto"
                                  value={costForm.unitNet}
                                  onChange={(event) => setCostForm((prev) => ({ ...prev, unitNet: event.target.value }))}
                                />
                                <select
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                  value={costForm.vatCode}
                                  onChange={(event) => setCostForm((prev) => ({ ...prev, vatCode: event.target.value }))}
                                >
                                  {VAT_CODES.map((code) => (
                                    <option key={code} value={code}>
                                      VAT {code}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="submit"
                                disabled={submittingCost}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-300"
                              >
                                {submittingCost ? 'Dodawanie...' : 'Dodaj koszt'}
                              </button>
                            </form>
                          </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-slate-900">Załączniki</h4>
                              <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                                + Dodaj zdjęcia / PDF
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(event) => {
                                    const files = Array.from(event.target.files || []);
                                    if (selectedTicketId && files.length > 0) {
                                      void handleUploadTicketFiles(selectedTicketId, files);
                                    }
                                    event.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                            {attachmentPreview && (
                              <div className="rounded-xl border border-slate-200 bg-slate-900/95 p-3">
                                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-200">
                                  <span className="inline-flex items-center gap-1">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    {attachmentPreview.filename}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => clearAttachmentPreview()}
                                    className="rounded border border-slate-500 px-2 py-0.5 text-slate-200 hover:bg-slate-700"
                                  >
                                    {isPolish ? 'Zamknij podgląd' : 'Close preview'}
                                  </button>
                                </div>
                                <img
                                  src={attachmentPreview.url}
                                  alt={attachmentPreview.filename}
                                  className="max-h-64 w-full rounded-lg border border-slate-600 object-contain"
                                />
                              </div>
                            )}
                            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
                              {attachments.length === 0 ? (
                                <p className="text-xs text-slate-500">Brak załączników.</p>
                              ) : (
                                attachments.map((attachment) => (
                                  <article
                                    key={attachment.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-medium text-slate-800">{attachment.filename}</p>
                                      <p className="text-[11px] text-slate-500">
                                        {(attachment.byteSize / 1024).toFixed(1)} KB · {formatDate(attachment.createdAt)}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      {attachment.mimeType.startsWith('image/') && (
                                        <button
                                          type="button"
                                          onClick={() => void handlePreviewAttachment(attachment)}
                                          disabled={previewingAttachmentId === attachment.id}
                                          className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                        >
                                          {previewingAttachmentId === attachment.id ? '...' : isPolish ? 'Podgląd' : 'Preview'}
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => void handleOpenAttachment(attachment)}
                                        disabled={openingAttachmentId === attachment.id}
                                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] hover:bg-slate-100 disabled:opacity-50"
                                      >
                                        {openingAttachmentId === attachment.id ? '...' : 'Otwórz'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteAttachment(attachment)}
                                        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100"
                                      >
                                        Usuń
                                      </button>
                                    </div>
                                  </article>
                                ))
                              )}
                            </div>
                            {uploadingAttachment && <p className="text-xs text-blue-600">Przesyłanie załączników...</p>}
                          </div>

                          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                            <h4 className="text-sm font-semibold text-slate-900">Przypomnienia</h4>
                            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
                              {ticketReminders.length === 0 ? (
                                <p className="text-xs text-slate-500">Brak przypomnień.</p>
                              ) : (
                                ticketReminders.map((reminder) => {
                                  const isDone = reminder.status === 'DONE';
                                  return (
                                  <article key={reminder.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className={`font-medium ${isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                        {reminder.title}
                                      </p>
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          onClick={() => void handleToggleReminder(reminder, !isDone)}
                                          className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] hover:bg-slate-100"
                                        >
                                          {isDone ? 'Wznów' : 'Wykonane'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteReminder(reminder)}
                                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100"
                                        >
                                          Usuń
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Termin: {formatDate(reminder.dueAt)}</p>
                                    {reminder.note && <p className="mt-1 text-[11px] text-slate-700">{reminder.note}</p>}
                                  </article>
                                )})
                              )}
                            </div>
                            <form className="grid gap-2" onSubmit={handleCreateReminder}>
                              <input
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Tytuł przypomnienia"
                                value={newReminder.title}
                                onChange={(event) => setNewReminder((prev) => ({ ...prev, title: event.target.value }))}
                              />
                              <input
                                type="datetime-local"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                value={newReminder.dueAt}
                                onChange={(event) => setNewReminder((prev) => ({ ...prev, dueAt: event.target.value }))}
                              />
                              <textarea
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                rows={2}
                                placeholder="Notatka (opcjonalnie)"
                                value={newReminder.note}
                                onChange={(event) => setNewReminder((prev) => ({ ...prev, note: event.target.value }))}
                              />
                              <button
                                type="submit"
                                disabled={reminderSubmitting}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
                              >
                                {reminderSubmitting ? 'Dodawanie...' : 'Dodaj przypomnienie'}
                              </button>
                            </form>
                          </div>
                        </div>
                        </>
                      )}
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </>
            )}

            {activeNav === 'statistics' && (
              <section className="ticket-surface rounded-xl border border-slate-100 p-5">
                <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Zaawansowane statystyki i raportowanie</h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadStatistics()}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Odśwież
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportStatisticsPdf()}
                      disabled={!statistics}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      <Download className="h-4 w-4" />
                      Raport PDF
                    </button>
                  </div>
                </div>

                <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-6">
                  <input
                    type="date"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={statisticsFilters.from}
                    onChange={(event) => setStatisticsFilters((prev) => ({ ...prev, from: event.target.value }))}
                    placeholder="Od"
                  />
                  <input
                    type="date"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={statisticsFilters.to}
                    onChange={(event) => setStatisticsFilters((prev) => ({ ...prev, to: event.target.value }))}
                    placeholder="Do"
                  />
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={statisticsFilters.status}
                    onChange={(event) => setStatisticsFilters((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="">{isPolish ? 'Status: wszystkie' : 'Status: all'}</option>
                    {FILTER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status] || status}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={statisticsFilters.priority}
                    onChange={(event) => setStatisticsFilters((prev) => ({ ...prev, priority: event.target.value }))}
                  >
                    <option value="">{isPolish ? 'Priorytet: wszystkie' : 'Priority: all'}</option>
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priorityLabels[priority]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={statisticsFilters.channel}
                    onChange={(event) => setStatisticsFilters((prev) => ({ ...prev, channel: event.target.value }))}
                  >
                    <option value="">{isPolish ? 'Kanał: wszystkie' : 'Channel: all'}</option>
                    <option value="WEB_FORM">WEB_FORM</option>
                    <option value="APP">APP</option>
                    <option value="EMAIL">EMAIL</option>
                    <option value="DROP_OFF">DROP_OFF</option>
                  </select>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={statisticsFilters.assignedAgentId}
                    onChange={(event) => setStatisticsFilters((prev) => ({ ...prev, assignedAgentId: event.target.value }))}
                  >
                    <option value="">{isPolish ? 'Technik: wszyscy' : 'Technician: all'}</option>
                    {assignableAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name || agent.email}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 md:col-span-2 xl:col-span-6">
                    <button
                      type="button"
                      onClick={() => void loadStatistics()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Zastosuj filtry
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatisticsFilters({
                          from: '',
                          to: '',
                          assignedAgentId: '',
                          channel: '',
                          priority: '',
                          status: '',
                        });
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Wyczyść filtry
                    </button>
                  </div>
                </div>
                {statisticsLoading ? (
                  <p className="text-sm text-slate-500">Ładowanie statystyk...</p>
                ) : statistics ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">Łączna liczba ticketów</p>
                        <p className="text-3xl font-bold text-slate-900">{statistics.totalTickets}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">Śr. czas rozwiązania (h)</p>
                        <p className="text-3xl font-bold text-slate-900">{statistics.sla.averageResolutionHours ?? '-'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">Suma brutto kosztów</p>
                        <p className="text-3xl font-bold text-slate-900">{asNumber(statistics.costs.grossTotal).toFixed(2)} PLN</p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 p-3">
                        <h3 className="mb-2 text-sm font-semibold text-slate-800">Statusy (wykres słupkowy)</h3>
                        <ul className="space-y-2 text-sm text-slate-700">
                          {statistics.byStatus.map((row) => (
                            <li key={row.key}>
                              <div className="mb-1 flex items-center justify-between">
                                <span>{statusLabels[row.key] || row.key}</span>
                                <strong>{row.count}</strong>
                              </div>
                              <div className="h-2 rounded-full bg-slate-200">
                                <div
                                  className="h-2 rounded-full bg-blue-500"
                                  style={{ width: `${(row.count / statisticsMaxima.byStatus) * 100}%` }}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3">
                        <h3 className="mb-2 text-sm font-semibold text-slate-800">Priorytety (wykres słupkowy)</h3>
                        <ul className="space-y-2 text-sm text-slate-700">
                          {statistics.byPriority.map((row) => (
                            <li key={row.key}>
                              <div className="mb-1 flex items-center justify-between">
                                <span>{priorityLabels[row.key] || row.key}</span>
                                <strong>{row.count}</strong>
                              </div>
                              <div className="h-2 rounded-full bg-slate-200">
                                <div
                                  className="h-2 rounded-full bg-fuchsia-500"
                                  style={{ width: `${(row.count / statisticsMaxima.byPriority) * 100}%` }}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3">
                        <h3 className="mb-2 text-sm font-semibold text-slate-800">Kanały (wykres słupkowy)</h3>
                        <ul className="space-y-2 text-sm text-slate-700">
                          {statistics.byChannel.map((row) => (
                            <li key={row.key}>
                              <div className="mb-1 flex items-center justify-between">
                                <span>{row.key}</span>
                                <strong>{row.count}</strong>
                              </div>
                              <div className="h-2 rounded-full bg-slate-200">
                                <div
                                  className="h-2 rounded-full bg-emerald-500"
                                  style={{ width: `${(row.count / statisticsMaxima.byChannel) * 100}%` }}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Trend dzienny (nowe vs zamknięte)</h3>
                      {statisticsTrend.length === 0 ? (
                        <p className="text-xs text-slate-500">Brak danych trendu dla wybranych filtrów.</p>
                      ) : (
                        <div className="space-y-2">
                          <svg
                            viewBox={`0 0 ${statisticsTrendPath.width} ${statisticsTrendPath.height}`}
                            className="h-44 w-full rounded-lg border border-slate-200 bg-slate-50"
                            role="img"
                            aria-label="Trend nowych i zamkniętych zgłoszeń"
                          >
                            <path d={statisticsTrendPath.createdPath} fill="none" stroke="#2563eb" strokeWidth="3" />
                            <path d={statisticsTrendPath.closedPath} fill="none" stroke="#16a34a" strokeWidth="3" />
                          </svg>
                          <div className="flex items-center gap-4 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-2 w-4 rounded bg-blue-600" />
                              Nowe zgłoszenia
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-2 w-4 rounded bg-green-600" />
                              Zamknięte zgłoszenia
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Brak danych statystycznych.</p>
                )}
              </section>
            )}

            {activeNav === 'users' && (
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">Użytkownicy (widok kontaktów)</h2>
                  {usersLoading ? (
                    <p className="text-sm text-slate-500">Ładowanie użytkowników...</p>
                  ) : (
                    <div className="max-h-[380px] space-y-2 overflow-y-auto">
                      {users.map((user) => (
                        <button
                          type="button"
                          key={user.id}
                          onClick={() => setSelectedUserId(user.id)}
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                            selectedUserId === user.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <span>
                            <strong className="text-slate-900">{user.name || user.email}</strong>
                            <span className="block text-xs text-slate-500">
                              {roleLabels[user.role] || user.role} · {user.email}
                            </span>
                          </span>
                          <span className="text-xs text-slate-500">{user.phone || '-'}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {isAdmin ? (
                    <form className="mt-4 grid gap-2" onSubmit={handleCreateAppUser}>
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Email"
                        value={newUser.email}
                        onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
                        required
                      />
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Imię i nazwisko"
                        value={newUser.name}
                        onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          value={newUser.role}
                          onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value }))}
                        >
                          <option value="AGENT">Technik</option>
                          <option value="ADMIN">Admin</option>
                          <option value="REPORTER">Reporter</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Telefon"
                          value={newUser.phone}
                          onChange={(event) => setNewUser((prev) => ({ ...prev, phone: event.target.value }))}
                        />
                      </div>
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Hasło"
                        type="password"
                        value={newUser.password}
                        onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                      />
                      <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">
                        Dodaj użytkownika
                      </button>
                    </form>
                  ) : (
                    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Tylko administrator może dodawać i edytować konta użytkowników.
                    </p>
                  )}
                </div>

                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">Notatki wewnętrzne użytkownika</h2>
                  {!selectedUserId ? (
                    <p className="text-sm text-slate-500">Wybierz użytkownika z listy po lewej.</p>
                  ) : (
                    <>
                      <div className="max-h-[280px] space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                        {userNotes.length === 0 ? (
                          <p className="text-xs text-slate-500">Brak notatek.</p>
                        ) : (
                          userNotes.map((note) => (
                            <article key={note.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                              <div className="mb-1 flex items-center justify-between text-slate-500">
                                <span>{note.authorUser?.name || note.authorUser?.email || 'System'}</span>
                                <span>{formatDate(note.createdAt)}</span>
                              </div>
                              <p className="text-sm text-slate-800">{note.body}</p>
                            </article>
                          ))
                        )}
                      </div>
                      <form className="mt-3 space-y-2" onSubmit={handleAddUserNote}>
                        <textarea
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          rows={4}
                          placeholder="Wpisz notatkę wewnętrzną..."
                          value={userNoteText}
                          onChange={(event) => setUserNoteText(event.target.value)}
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Dodaj notatkę
                        </button>
                      </form>
                      {isAdmin && editingUser && (
                        <form className="mt-4 space-y-2 border-t border-slate-200 pt-3" onSubmit={handleSaveUserEdit}>
                          <h3 className="text-sm font-semibold text-slate-800">Edycja danych użytkownika</h3>
                          <input
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={editingUser.email}
                            onChange={(event) => setEditingUser((prev) => (prev ? { ...prev, email: event.target.value } : prev))}
                            placeholder="E-mail"
                          />
                          <input
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={editingUser.name}
                            onChange={(event) => setEditingUser((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                            placeholder="Imię i nazwisko"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={editingUser.role}
                              onChange={(event) => setEditingUser((prev) => (prev ? { ...prev, role: event.target.value } : prev))}
                            >
                              <option value="AGENT">Technik</option>
                              <option value="ADMIN">Admin</option>
                              <option value="REPORTER">Reporter</option>
                              <option value="VIEWER">Podgląd</option>
                            </select>
                            <input
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={editingUser.phone}
                              onChange={(event) => setEditingUser((prev) => (prev ? { ...prev, phone: event.target.value } : prev))}
                              placeholder="Telefon"
                            />
                          </div>
                          <input
                            type="password"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={editingUser.password}
                            onChange={(event) => setEditingUser((prev) => (prev ? { ...prev, password: event.target.value } : prev))}
                            placeholder="Nowe hasło (opcjonalnie, min. 8)"
                          />
                          <label className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={editingUser.disabled}
                              onChange={(event) =>
                                setEditingUser((prev) => (prev ? { ...prev, disabled: event.target.checked } : prev))
                              }
                            />
                            Konto zablokowane
                          </label>
                          <button
                            type="submit"
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Zapisz dane użytkownika
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}

            {activeNav === 'profile' && (
              <section className="space-y-4">
                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <h2 className="mb-2 text-lg font-semibold text-slate-900">
                    {isPolish ? 'Mój profil interfejsu' : 'My interface profile'}
                  </h2>
                  <p className="mb-4 text-sm text-slate-600">
                    {isPolish
                      ? 'Te ustawienia zapisują się na Twoim koncie i działają tak samo w WebUI oraz aplikacji macOS.'
                      : 'These preferences are stored on your account and work the same in WebUI and macOS app.'}
                  </p>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {isPolish ? 'Wygląd dashboardu' : 'Dashboard appearance'}
                      </h3>
                      <label className="block text-xs font-semibold text-slate-600">
                        {isPolish ? 'Motyw kolorystyczny' : 'Color theme'}
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={dashboardPrefs.theme || 'helpdesk-blue'}
                          onChange={(event) =>
                            void savePrefs({
                              ...dashboardPrefs,
                              theme: event.target.value as DashboardTheme,
                            })
                          }
                        >
                          {DASHBOARD_THEMES.map((themeOption) => (
                            <option key={themeOption.value} value={themeOption.value}>
                              {themeOption.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'helpdesk-blue', swatch: 'from-blue-500 to-indigo-700' },
                          { key: 'graphite-noir', swatch: 'from-slate-700 to-slate-900' },
                          { key: 'emerald-flow', swatch: 'from-emerald-500 to-teal-700' },
                        ].map((themeCard) => (
                          <button
                            key={themeCard.key}
                            type="button"
                            onClick={() =>
                              void savePrefs({
                                ...dashboardPrefs,
                                theme: themeCard.key as DashboardTheme,
                              })
                            }
                            className={`rounded-lg border p-2 text-left text-[11px] ${
                              (dashboardPrefs.theme || 'helpdesk-blue') === themeCard.key
                                ? 'border-blue-400 ring-2 ring-blue-100'
                                : 'border-slate-200'
                            }`}
                          >
                            <div className={`mb-2 h-8 rounded bg-gradient-to-r ${themeCard.swatch}`} />
                            <span className="font-semibold text-slate-700">
                              {DASHBOARD_THEMES.find((item) => item.value === themeCard.key)?.label || themeCard.key}
                            </span>
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(dashboardPrefs.compactMode)}
                          onChange={(event) =>
                            void savePrefs({
                              ...dashboardPrefs,
                              compactMode: event.target.checked,
                            })
                          }
                        />
                        {isPolish ? 'Tryb kompaktowy (gęstszy układ)' : 'Compact mode (denser layout)'}
                      </label>
                      <button
                        type="button"
                        onClick={() => void resetWidgetLayout()}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        {isPolish ? 'Przywróć domyślny układ widgetów' : 'Reset widget layout to default'}
                      </button>
                    </div>

                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {isPolish ? 'Domyślne filtry użytkownika' : 'Default user filters'}
                      </h3>
                      <div className="grid gap-2 md:grid-cols-3">
                        <select
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={filters.status}
                          onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                        >
                          <option value="">{isPolish ? 'Status: wszystkie' : 'Status: all'}</option>
                          {FILTER_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status] || status}
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={filters.priority}
                          onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))}
                        >
                          <option value="">{isPolish ? 'Priorytet: wszystkie' : 'Priority: all'}</option>
                          {PRIORITIES.map((priority) => (
                            <option key={priority} value={priority}>
                              {priorityLabels[priority]}
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={filters.channel}
                          onChange={(event) => setFilters((prev) => ({ ...prev, channel: event.target.value }))}
                        >
                          <option value="">{isPolish ? 'Kanał: wszystkie' : 'Channel: all'}</option>
                          {CHANNELS.map((channel) => (
                            <option key={channel} value={channel}>
                              {channel}
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={filters.assignedState}
                          onChange={(event) =>
                            setFilters((prev) => ({ ...prev, assignedState: event.target.value as FilterState['assignedState'] }))
                          }
                        >
                          <option value="">{isPolish ? 'Przypisanie: dowolne' : 'Assignment: any'}</option>
                          <option value="assigned">{isPolish ? 'Przypisane' : 'Assigned'}</option>
                          <option value="unassigned">{isPolish ? 'Nieprzypisane' : 'Unassigned'}</option>
                        </select>
                        <select
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={filters.assignedAgentId}
                          onChange={(event) => setFilters((prev) => ({ ...prev, assignedAgentId: event.target.value }))}
                        >
                          <option value="">{isPolish ? 'Technik: wszyscy' : 'Technician: all'}</option>
                          {assignableAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name || agent.email}
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={filters.hasAttachments}
                          onChange={(event) =>
                            setFilters((prev) => ({ ...prev, hasAttachments: event.target.value as FilterState['hasAttachments'] }))
                          }
                        >
                          <option value="">{isPolish ? 'Załączniki: wszystkie' : 'Attachments: all'}</option>
                          <option value="yes">{isPolish ? 'Tylko z załącznikami' : 'Only with attachments'}</option>
                          <option value="no">{isPolish ? 'Tylko bez załączników' : 'Only without attachments'}</option>
                        </select>
                        <select
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={filters.hasComments}
                          onChange={(event) =>
                            setFilters((prev) => ({ ...prev, hasComments: event.target.value as FilterState['hasComments'] }))
                          }
                        >
                          <option value="">{isPolish ? 'Komentarze: wszystkie' : 'Comments: all'}</option>
                          <option value="yes">{isPolish ? 'Tylko z komentarzami' : 'Only with comments'}</option>
                          <option value="no">{isPolish ? 'Tylko bez komentarzy' : 'Only without comments'}</option>
                        </select>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3">
                        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={filters.onlyMine}
                            onChange={(event) => setFilters((prev) => ({ ...prev, onlyMine: event.target.checked }))}
                          />
                          {isPolish ? 'Tylko moje zgłoszenia' : 'Only my tickets'}
                        </label>
                        <input
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          type="number"
                          min={1}
                          max={3650}
                          placeholder={isPolish ? '> X dni w serwisie' : '> X days in service'}
                          value={filters.minAgeDays}
                          onChange={(event) =>
                            setFilters((prev) => ({ ...prev, minAgeDays: event.target.value.replace(/[^0-9]/g, '') }))
                          }
                        />
                        <input
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          type="date"
                          value={filters.createdFrom}
                          onChange={(event) => setFilters((prev) => ({ ...prev, createdFrom: event.target.value }))}
                        />
                        <input
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          type="date"
                          value={filters.createdTo}
                          onChange={(event) => setFilters((prev) => ({ ...prev, createdTo: event.target.value }))}
                        />
                        <select
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={filters.sort}
                          onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value as FilterState['sort'] }))}
                        >
                          <option value="createdAt_desc">{isPolish ? 'Sortuj: najnowsze' : 'Sort: newest'}</option>
                          <option value="createdAt_asc">{isPolish ? 'Sortuj: najstarsze' : 'Sort: oldest'}</option>
                          <option value="updatedAt_desc">{isPolish ? 'Ostatnio aktualizowane' : 'Recently updated'}</option>
                          <option value="priority_desc">{isPolish ? 'Priorytet malejąco' : 'Priority desc'}</option>
                          <option value="number_desc">{isPolish ? 'Numer malejąco' : 'Number desc'}</option>
                          <option value="status_asc">{isPolish ? 'Status A→Z' : 'Status A→Z'}</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveDefaultFiltersFromCurrent()}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          {isPolish ? 'Zapisz jako domyślne' : 'Save as default'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              status: dashboardPrefs.defaultFilters?.status || '',
                              priority: dashboardPrefs.defaultFilters?.priority || '',
                              channel: dashboardPrefs.defaultFilters?.channel || '',
                              assignedAgentId: dashboardPrefs.defaultFilters?.assignedAgentId || '',
                              assignedState: dashboardPrefs.defaultFilters?.assignedState || '',
                              onlyMine: Boolean(dashboardPrefs.defaultFilters?.onlyMine),
                              minAgeDays:
                                dashboardPrefs.defaultFilters?.minAgeDays &&
                                Number.isFinite(dashboardPrefs.defaultFilters.minAgeDays)
                                  ? String(Math.floor(dashboardPrefs.defaultFilters.minAgeDays))
                                  : '',
                              hasAttachments:
                                typeof dashboardPrefs.defaultFilters?.hasAttachments === 'boolean'
                                  ? dashboardPrefs.defaultFilters.hasAttachments
                                    ? 'yes'
                                    : 'no'
                                  : '',
                              hasComments:
                                typeof dashboardPrefs.defaultFilters?.hasComments === 'boolean'
                                  ? dashboardPrefs.defaultFilters.hasComments
                                    ? 'yes'
                                    : 'no'
                                  : '',
                              createdFrom: dashboardPrefs.defaultFilters?.createdFrom || '',
                              createdTo: dashboardPrefs.defaultFilters?.createdTo || '',
                              sort: dashboardPrefs.defaultFilters?.sort || 'createdAt_desc',
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          {isPolish ? 'Wczytaj domyślne' : 'Load defaults'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {isPolish ? 'Zapisane presety filtrów' : 'Saved filter presets'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => void addCurrentFilterToSaved()}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {isPolish ? 'Utwórz preset z bieżących filtrów' : 'Create preset from current filters'}
                    </button>
                  </div>
                  {(dashboardPrefs.savedFilters || []).length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {isPolish ? 'Brak zapisanych presetów. Zapisz filtr z widoku zgłoszeń.' : 'No saved presets yet.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(dashboardPrefs.savedFilters || []).map((saved) => (
                        <div
                          key={saved.name}
                          className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:flex-row md:items-center"
                        >
                          <div className="text-sm text-slate-700">
                            <strong>{saved.name}</strong>
                            <p className="text-xs text-slate-500">
                              status={saved.status || '-'}, priorytet={saved.priority || '-'}, kanał={saved.channel || '-'},
                              przypisanie={saved.assignedState || '-'}, onlyMine={saved.onlyMine ? '1' : '0'}, minAgeDays=
                              {saved.minAgeDays || 0}, załączniki=
                              {typeof saved.hasAttachments === 'boolean' ? (saved.hasAttachments ? '1' : '0') : '-'}, komentarze=
                              {typeof saved.hasComments === 'boolean' ? (saved.hasComments ? '1' : '0') : '-'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => applySavedFilter(saved)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              {isPolish ? 'Zastosuj' : 'Apply'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeSavedFilter(saved.name)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              {isPolish ? 'Usuń' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">
                    {isPolish ? 'Widgety dashboardu (drag + skalowanie)' : 'Dashboard widgets (drag + resize)'}
                  </h3>
                  <div className="space-y-2">
                    {(dashboardPrefs.widgetOrder || DASHBOARD_WIDGET_ORDER_DEFAULT).map((key, index) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-sm text-slate-700">
                          {index + 1}. {key} ({(widgetSizes[key] || 'md').toUpperCase()})
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => void moveWidget(key, 'up')}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => void moveWidget(key, 'down')}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleWidgetSizeStep(key, 'down')}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleWidgetSizeStep(key, 'up')}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {activeNav === 'vat' && isAdmin && (
              <section className="space-y-4">
                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Konfiguracja firmy i integracji</h2>
                    <button
                      type="button"
                      onClick={() => void handleSaveSettings()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Zapisz konfigurację
                    </button>
                  </div>
                  {settingsLoading || !settings ? (
                    <p className="text-sm text-slate-500">Ładowanie konfiguracji...</p>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                        <h3 className="text-sm font-semibold text-slate-800">Branding / personalizacja</h3>
                        <input
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Nazwa firmy"
                          value={settings.branding.companyName}
                          onChange={(event) =>
                            setSettings((prev) =>
                              prev
                                ? { ...prev, branding: { ...prev.branding, companyName: event.target.value } }
                                : prev,
                            )
                          }
                        />
                        <div className="grid gap-2 md:grid-cols-2">
                          <label className="text-xs font-semibold text-slate-600">
                            Język interfejsu
                            <select
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={uiLanguage}
                              onChange={(event) => handleLanguageChange(event.target.value as UILanguage)}
                            >
                              <option value="pl">Polski</option>
                              <option value="en">English</option>
                            </select>
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Domyślny filtr statusu
                            <select
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              value={settings.uiDefaults.defaultStatusFilter || ''}
                              onChange={(event) =>
                                setSettings((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        uiDefaults: {
                                          ...prev.uiDefaults,
                                          defaultStatusFilter: event.target.value,
                                        },
                                      }
                                    : prev,
                                )
                              }
                            >
                              <option value="">Brak</option>
                              {FILTER_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabels[status]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <input
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Logo jako Data URL (PNG/JPG)"
                          value={settings.branding.logoDataUrl}
                          onChange={(event) =>
                            setSettings((prev) =>
                              prev
                                ? { ...prev, branding: { ...prev.branding, logoDataUrl: event.target.value } }
                                : prev,
                            )
                          }
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => void handleLogoFilePicked(event)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        {settings.branding.logoDataUrl && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <p className="mb-2 text-xs text-slate-500">Podgląd logo:</p>
                            <img
                              src={settings.branding.logoDataUrl}
                              alt="Logo firmy"
                              className="max-h-16 rounded border border-slate-200 bg-white p-1"
                            />
                          </div>
                        )}
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={settings.features.technicianSelfSignup}
                            onChange={(event) =>
                              setSettings((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      features: {
                                        ...prev.features,
                                        technicianSelfSignup: event.target.checked,
                                      },
                                    }
                                  : prev,
                              )
                            }
                          />
                          Włącz samodzielną rejestrację techników
                        </label>
                        <div className="flex gap-2">
                          <input
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Kod rejestracji technika"
                            value={signupCode}
                            onChange={(event) => setSignupCode(event.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => void handleSetTechnicianCode()}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                          >
                            Ustaw kod
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                        <h3 className="text-sm font-semibold text-slate-800">Kanały komunikacji</h3>
                        <div className="rounded-lg border border-slate-200 p-2">
                          <p className="mb-2 text-xs font-semibold text-slate-700">E-mail</p>
                          <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={settings.integrations.email.mode}
                            onChange={(event) =>
                              setSettings((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      integrations: {
                                        ...prev.integrations,
                                        email: {
                                          ...prev.integrations.email,
                                          mode: event.target.value as any,
                                        },
                                      },
                                    }
                                  : prev,
                              )
                            }
                          >
                            <option value="disabled">Wyłączone</option>
                            <option value="webhook">Webhook</option>
                            <option value="smtp">SMTP (bridge)</option>
                          </select>
                          <input
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            type="email"
                            placeholder="Adres testowy e-mail"
                            value={testEmailTo}
                            onChange={(event) => setTestEmailTo(event.target.value)}
                          />
                          <input
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Webhook URL / SMTP host"
                            value={settings.integrations.email.webhookUrl || settings.integrations.email.host}
                            onChange={(event) =>
                              setSettings((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      integrations: {
                                        ...prev.integrations,
                                        email: {
                                          ...prev.integrations.email,
                                          webhookUrl: event.target.value,
                                          host: event.target.value,
                                        },
                                      },
                                    }
                                  : prev,
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() => void handleTestEmail()}
                            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                          >
                            <Mail className="h-4 w-4" />
                            Test e-mail
                          </button>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-2">
                          <p className="mb-2 text-xs font-semibold text-slate-700">SMS</p>
                          <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={settings.integrations.sms.mode}
                            onChange={(event) =>
                              setSettings((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      integrations: {
                                        ...prev.integrations,
                                        sms: {
                                          ...prev.integrations.sms,
                                          mode: event.target.value as any,
                                        },
                                      },
                                    }
                                  : prev,
                              )
                            }
                          >
                            <option value="disabled">Wyłączone</option>
                            <option value="webhook">Webhook (uniwersalny)</option>
                            <option value="twilio">Twilio</option>
                          </select>
                          <input
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Numer testowy (np. +48123123123)"
                            value={testSmsTo}
                            onChange={(event) => setTestSmsTo(event.target.value)}
                          />
                          <input
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Webhook URL / Twilio SID"
                            value={settings.integrations.sms.webhookUrl || settings.integrations.sms.accountSid || ''}
                            onChange={(event) =>
                              setSettings((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      integrations: {
                                        ...prev.integrations,
                                        sms: {
                                          ...prev.integrations.sms,
                                          webhookUrl: event.target.value,
                                          accountSid: event.target.value,
                                        },
                                      },
                                    }
                                  : prev,
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() => void handleTestSms()}
                            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                          >
                            <Smartphone className="h-4 w-4" />
                            Test SMS
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {isPolish ? 'Katalog pozycji kosztorysu' : 'Cost catalog'}
                    </h2>
                    <span className="text-xs text-slate-500">
                      {isPolish ? `Aktywne pozycje: ${costCatalog.filter((item) => item.active).length}` : `Active entries: ${costCatalog.filter((item) => item.active).length}`}
                    </span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.1fr_1.5fr]">
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-600">
                        {isPolish
                          ? 'Pozycje z katalogu pojawią się technikom w rozwijanej liście podczas dodawania kosztu.'
                          : 'Catalog entries are available in the cost dropdown for technicians.'}
                      </p>
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder={isPolish ? 'Nazwa pozycji (np. Diagnostyka płyty)' : 'Entry name'}
                        value={catalogEditor.name}
                        onChange={(event) => setCatalogEditor((prev) => ({ ...prev, name: event.target.value }))}
                      />
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder={isPolish ? 'Kategoria (opcjonalnie)' : 'Category (optional)'}
                          value={catalogEditor.category || ''}
                          onChange={(event) => setCatalogEditor((prev) => ({ ...prev, category: event.target.value }))}
                        />
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder={isPolish ? 'Jednostka (np. szt.)' : 'Unit (e.g. pcs)'}
                          value={catalogEditor.unit || ''}
                          onChange={(event) => setCatalogEditor((prev) => ({ ...prev, unit: event.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2 md:grid-cols-3">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder={isPolish ? 'Cena netto' : 'Net price'}
                          value={catalogEditor.unitNet}
                          onChange={(event) =>
                            setCatalogEditor((prev) => ({
                              ...prev,
                              unitNet: Number(event.target.value),
                            }))
                          }
                        />
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder={isPolish ? 'Domyślna ilość' : 'Default qty'}
                          value={catalogEditor.defaultQty}
                          onChange={(event) =>
                            setCatalogEditor((prev) => ({
                              ...prev,
                              defaultQty: Number(event.target.value),
                            }))
                          }
                        />
                        <select
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          value={catalogEditor.vatCode}
                          onChange={(event) => setCatalogEditor((prev) => ({ ...prev, vatCode: event.target.value }))}
                        >
                          {VAT_CODES.map((code) => (
                            <option key={code} value={code}>
                              VAT {code}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={catalogEditor.active}
                          onChange={(event) => setCatalogEditor((prev) => ({ ...prev, active: event.target.checked }))}
                        />
                        {isPolish ? 'Pozycja aktywna' : 'Entry active'}
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleAddCatalogEntry()}
                        disabled={costCatalogSaving}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {costCatalogSaving ? (isPolish ? 'Zapisywanie...' : 'Saving...') : isPolish ? 'Dodaj do katalogu' : 'Add to catalog'}
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                      {costCatalog.length === 0 ? (
                        <p className="p-4 text-sm text-slate-500">
                          {isPolish ? 'Katalog jest pusty. Dodaj pierwszą pozycję.' : 'Catalog is empty. Add your first entry.'}
                        </p>
                      ) : (
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-left">{isPolish ? 'Pozycja' : 'Item'}</th>
                              <th className="px-3 py-2 text-right">{isPolish ? 'Netto' : 'Net'}</th>
                              <th className="px-3 py-2 text-right">{isPolish ? 'VAT' : 'VAT'}</th>
                              <th className="px-3 py-2 text-right">{isPolish ? 'Ilość' : 'Qty'}</th>
                              <th className="px-3 py-2 text-right">{isPolish ? 'Akcje' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {costCatalog.map((entry) => (
                              <tr key={entry.id} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <p className={`font-medium ${entry.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                    {entry.category ? `${entry.category} · ` : ''}
                                    {entry.name}
                                  </p>
                                  {entry.unit && <p className="text-xs text-slate-500">{entry.unit}</p>}
                                </td>
                                <td className="px-3 py-2 text-right">{Number(entry.unitNet).toFixed(2)} PLN</td>
                                <td className="px-3 py-2 text-right">VAT {entry.vatCode}</td>
                                <td className="px-3 py-2 text-right">{Number(entry.defaultQty).toFixed(2)}</td>
                                <td className="px-3 py-2">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      disabled={costCatalogSaving}
                                      onClick={() => void handleToggleCatalogEntry(entry.id, !entry.active)}
                                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                    >
                                      {entry.active ? (isPolish ? 'Ukryj' : 'Disable') : isPolish ? 'Aktywuj' : 'Enable'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={costCatalogSaving}
                                      onClick={() => void handleRemoveCatalogEntry(entry.id)}
                                      className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                                    >
                                      {isPolish ? 'Usuń' : 'Delete'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>

                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">Dane demonstracyjne</h2>
                  <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      Wczytuje realistyczny zestaw testowy (200 zgłoszeń, użytkownicy, komentarze, koszty) i zastępuje
                      aktualną listę zgłoszeń.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleLoadDemoDataset()}
                      disabled={!isAdmin || loadingDemoDataset}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {loadingDemoDataset ? 'Wczytywanie...' : 'Wczytaj bazę demo (200 zgłoszeń)'}
                    </button>
                  </div>
                </div>

                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">Backup i odtwarzanie (1 plik)</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                      <p className="text-sm text-slate-600">
                        Eksport zawiera bazę, zdjęcia i konfigurację. Jeden plik, gotowy do reinstalacji.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleExportBackup()}
                        disabled={!isAdmin}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Download className="h-4 w-4" />
                        Eksportuj backup
                      </button>
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                        placeholder="/ścieżka/do/backup.tar.gz"
                        value={backupPath}
                        onChange={(event) => setBackupPath(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => void handleImportBackupByPath()}
                        disabled={!isAdmin}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Importuj po ścieżce
                      </button>
                    </div>

                    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                      <p className="text-sm text-slate-600">Import bezpośrednio z pliku (upload).</p>
                      <input
                        id="backup-import-file"
                        type="file"
                        accept=".tar.gz,.tgz,.gz"
                        onChange={(event) => setBackupFileToImport(event.target.files?.[0] ?? null)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      {backupFileToImport ? (
                        <p className="text-xs text-slate-600">Wybrano plik: {backupFileToImport.name}</p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleImportBackupFile()}
                        disabled={!isAdmin || !backupFileToImport}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Importuj z pliku
                      </button>
                      <p className="text-xs text-slate-500">
                        Po imporcie zalecany restart aplikacji, aby wszystkie połączenia odświeżyć.
                      </p>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                        Wymagane uprawnienia: ADMIN. Twoja rola: {normalizedCurrentRole || 'BRAK'}.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">Personalizacja technika (profil UI)</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm text-slate-700">
                        Każdy użytkownik ma własny profil UI (widgety, filtry, motyw). Możesz sprawdzić to z poziomu zakładki
                        <strong> Mój interfejs</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveNav('profile')}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Otwórz „Mój interfejs”
                      </button>
                    </div>
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <h3 className="text-sm font-semibold text-slate-800">Globalne domyślne UI (dla nowych kont)</h3>
                      <label className="block text-xs font-semibold text-slate-600">
                        Domyślny priorytet filtra
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          value={settings?.uiDefaults.defaultPriorityFilter || ''}
                          onChange={(event) =>
                            setSettings((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    uiDefaults: {
                                      ...prev.uiDefaults,
                                      defaultPriorityFilter: event.target.value,
                                    },
                                  }
                                : prev,
                            )
                          }
                        >
                          <option value="">Brak</option>
                          {PRIORITIES.map((priority) => (
                            <option key={priority} value={priority}>
                              {priorityLabels[priority]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(settings?.uiDefaults.compactMode)}
                          onChange={(event) =>
                            setSettings((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    uiDefaults: {
                                      ...prev.uiDefaults,
                                      compactMode: event.target.checked,
                                    },
                                  }
                                : prev,
                            )
                          }
                        />
                        Domyślnie tryb kompaktowy dla nowych użytkowników
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(settings?.reminders.enabled)}
                          onChange={(event) =>
                            setSettings((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    reminders: {
                                      ...prev.reminders,
                                      enabled: event.target.checked,
                                    },
                                  }
                                : prev,
                            )
                          }
                        />
                        Włącz globalne przypomnienia
                      </label>
                    </div>
                  </div>
                </div>

                {isElectron && (
                  <div className="ticket-surface rounded-xl border border-red-200 bg-red-50/70 p-5">
                    <h2 className="text-lg font-semibold text-red-900">{isPolish ? 'Reinstal systemu' : 'System reinstall'}</h2>
                    <p className="mt-2 text-sm text-red-800">
                      {isPolish
                        ? 'Użyj tylko przy poważnych problemach. Operacja czyści lokalną bazę, konfigurację i logowania, a następnie uruchamia setup od nowa.'
                        : 'Use only for severe issues. This clears local database, configuration and sessions, then starts setup again.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleReinstallSystem('settings')}
                      disabled={serviceBusy !== null}
                      className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {serviceBusy === 'factory-reset'
                        ? isPolish
                          ? 'Reinstaluję...'
                          : 'Reinstalling...'
                        : isPolish
                          ? 'Reinstal systemu (setup od nowa)'
                          : 'Reinstall system (setup from scratch)'}
                    </button>
                  </div>
                )}
              </section>
            )}

            {activeNav === 'server' && isAdmin && (
              <section className="space-y-4">
                <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Status serwera</h2>
                    <button
                      type="button"
                      onClick={() => void loadServerStatus()}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Odśwież
                    </button>
                  </div>
                  {isElectron && (
                    <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                      <button
                        type="button"
                        onClick={() => void runEngineAction('restart', (bridge) => bridge.restartEngine())}
                        disabled={serviceBusy !== null}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {serviceBusy === 'restart' ? 'Restart...' : 'Restart silnika'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runEngineAction('repair', (bridge) => bridge.quickRepairEngine())}
                        disabled={serviceBusy !== null}
                        className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-60"
                      >
                        {serviceBusy === 'repair' ? 'Naprawiam...' : 'Szybka naprawa'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runEngineAction('logs', (bridge) => bridge.openLogsFolder())}
                        disabled={serviceBusy !== null}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {serviceBusy === 'logs' ? 'Otwieram...' : 'Otwórz logi'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runEngineAction('diagnostics', (bridge) => bridge.createEngineDiagnostics())}
                        disabled={serviceBusy !== null}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {serviceBusy === 'diagnostics' ? 'Tworzę raport...' : 'Raport diagnostyczny'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runEngineAction('permissions', (bridge) =>
                            bridge.requestDesktopPermissions
                              ? bridge.requestDesktopPermissions()
                              : Promise.resolve({ success: false, message: 'Brak asystenta uprawnień w tej wersji.' }),
                          )
                        }
                        disabled={serviceBusy !== null}
                        className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                      >
                        {serviceBusy === 'permissions' ? 'Sprawdzam...' : 'Sprawdź zgody macOS'}
                      </button>
                    </div>
                  )}
                  {serviceInfo && (
                    <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                      {serviceInfo}
                    </div>
                  )}
                  {serverLoading ? (
                    <p className="text-sm text-slate-500">Ładowanie diagnostyki serwera...</p>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p>
                          <strong>Aplikacja:</strong> {serverInfo?.app || '-'}
                        </p>
                        <p>
                          <strong>Wersja:</strong> {serverInfo?.version || '-'}
                        </p>
                        <p>
                          <strong>Node:</strong> {serverInfo?.node || '-'}
                        </p>
                        <p>
                          <strong>Środowisko:</strong> {serverInfo?.environment || '-'}
                        </p>
                        <p>
                          <strong>Tryb setup:</strong> {serverInfo?.setupMode ? 'TAK' : 'NIE'}
                        </p>
                        <p>
                          <strong>Tryb instalacji:</strong>{' '}
                          {serverInfo?.installationMode === 'client_only' ? 'SAM KLIENT' : 'SERWER + KLIENT'}
                        </p>
                        {serverInfo?.installationMode === 'client_only' && (
                          <p>
                            <strong>Serwer zdalny:</strong> {serverInfo?.remoteApiBaseUrl || '-'}
                          </p>
                        )}
                        <p>
                          <strong>Port:</strong> {serverInfo?.port || '-'}
                        </p>
                        <p>
                          <strong>WebUI:</strong>{' '}
                          <a
                            className="text-blue-600 hover:underline"
                            href={resolvePreferredWebUiUrl()}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {resolvePreferredWebUiUrl()}
                          </a>
                        </p>
                        <p className="text-xs text-slate-500">
                          Alias lokalny: <code>ticketmaster.localhost</code> (wariant <code>.local</code> wymaga mDNS / ręcznej konfiguracji DNS).
                        </p>
                      </div>
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p>
                          <strong>Baza danych:</strong>{' '}
                          {renderCheckStatus(serverDiagnostics?.checks?.database)}
                        </p>
                        <p>
                          <strong>Object storage:</strong>{' '}
                          {renderCheckStatus(serverDiagnostics?.checks?.objectStorage)}
                        </p>
                        <p>
                          <strong>Redis:</strong>{' '}
                          {renderCheckStatus(serverDiagnostics?.checks?.redis)}
                        </p>
                        <p>
                          <strong>Wygenerowano:</strong> {serverDiagnostics?.generatedAt ? formatDate(serverDiagnostics.generatedAt) : '-'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {isElectron && (
                  <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-slate-900">Aktualizacje aplikacji</h2>
                      <button
                        type="button"
                        onClick={() => void handleCheckForUpdates()}
                        disabled={serviceBusy !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {serviceBusy === 'update-check' ? 'Sprawdzam...' : 'Sprawdź aktualizacje'}
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p>
                          <strong>Wersja lokalna:</strong> {updateStatus?.appVersion || serverInfo?.version || '-'}
                        </p>
                        <p>
                          <strong>Status:</strong> {updateStatus?.message || 'Brak danych'}
                        </p>
                        <p>
                          <strong>Dostępna wersja:</strong> {updateStatus?.releaseVersion || '-'}
                        </p>
                        <p>
                          <strong>Nazwa wydania:</strong> {updateStatus?.releaseName || '-'}
                        </p>
                        <p>
                          <strong>Postęp pobierania:</strong>{' '}
                          {updateStatus?.progressPercent !== null && updateStatus?.progressPercent !== undefined
                            ? `${Math.round(updateStatus.progressPercent)}%`
                            : '-'}
                        </p>
                        <p>
                          <strong>Ostatni backup update:</strong> {updateStatus?.lastBackupPath || '-'}
                        </p>
                      </div>

                      <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
                        <label className="flex items-center gap-2 text-slate-700">
                          <input
                            type="checkbox"
                            checked={backupBeforeUpdate}
                            onChange={(event) => setBackupBeforeUpdate(event.target.checked)}
                          />
                          Zrób backup bazy + zdjęć przed aktualizacją
                        </label>
                        <div className="grid gap-2 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => void handleDownloadUpdate()}
                            disabled={serviceBusy !== null}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {serviceBusy === 'update-download' ? 'Pobieranie...' : 'Pobierz aktualizację'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleInstallUpdate()}
                            disabled={serviceBusy !== null}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {serviceBusy === 'update-install' ? 'Instalowanie...' : 'Zainstaluj aktualizację'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCreateDesktopBackup('manual-update-backup')}
                            disabled={serviceBusy !== null}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {serviceBusy === 'update-backup' ? 'Tworzenie...' : 'Backup teraz'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void runUpdateAction('open-backups', (bridge) => bridge.openBackupsFolder())
                            }
                            disabled={serviceBusy !== null}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {serviceBusy === 'open-backups' ? 'Otwieranie...' : 'Otwórz folder backupów'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          Aktualizacja nadpisuje tylko aplikację. Dane klienta zostają w katalogu danych i są dodatkowo
                          archiwizowane przed update.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {serverDiagnostics && (
                  <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                    <h3 className="mb-2 text-sm font-semibold text-slate-900">Raport diagnostyczny (JSON)</h3>
                    <pre className="max-h-[340px] overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
                      {JSON.stringify(serverDiagnostics, null, 2)}
                    </pre>
                  </div>
                )}

                {isElectron && (
                  <div className="ticket-surface rounded-xl border border-red-200 bg-red-50/70 p-5">
                    <h2 className="text-lg font-semibold text-red-900">{isPolish ? 'Reinstal systemu' : 'System reinstall'}</h2>
                    <p className="mt-2 text-sm text-red-800">
                      {isPolish
                        ? 'Ta operacja przywróci aplikację do stanu po instalacji: wyczyści bazę, pliki i konfigurację, a następnie uruchomi setup.'
                        : 'This operation restores the app to post-install state: database, files and configuration are wiped, then setup starts.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleReinstallSystem('server')}
                      disabled={serviceBusy !== null}
                      className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {serviceBusy === 'factory-reset'
                        ? isPolish
                          ? 'Reinstaluję...'
                          : 'Reinstalling...'
                        : isPolish
                          ? 'Reinstal systemu (setup od nowa)'
                          : 'Reinstall system (setup from scratch)'}
                    </button>
                  </div>
                )}
              </section>
            )}

            <section className="ticket-surface mt-5 rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
              API docs:{' '}
              <a className="text-blue-600 hover:underline" href={buildApiUrl('/api/docs')} target="_blank" rel="noreferrer">
                {buildApiUrl('/api/docs')}
              </a>
            </section>
          </main>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Nowe zgłoszenie</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setTicketFiles([]);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Zamknij
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleCreateTicket}>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Tytuł problemu"
                value={ticketForm.title}
                onChange={(event) => setTicketForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Opis problemu (min. 10 znaków)"
                rows={4}
                value={ticketForm.description}
                onChange={(event) => setTicketForm((prev) => ({ ...prev, description: event.target.value }))}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Imię i nazwisko klienta"
                  value={ticketForm.customerName}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, customerName: event.target.value }))}
                />
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Email klienta"
                  value={ticketForm.customerEmail ?? ''}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, customerEmail: event.target.value }))}
                />
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Telefon klienta"
                  value={ticketForm.customerPhone ?? ''}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, customerPhone: event.target.value }))}
                />
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Typ urządzenia"
                  value={ticketForm.deviceType ?? ''}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, deviceType: event.target.value }))}
                />
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Numer seryjny"
                  value={ticketForm.serialNumber ?? ''}
                  onChange={(event) => setTicketForm((prev) => ({ ...prev, serialNumber: event.target.value }))}
                />
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={ticketForm.priority}
                  onChange={(event) =>
                    setTicketForm((prev) => ({ ...prev, priority: event.target.value as TicketPriority }))
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {isPolish ? 'Priorytet' : 'Priority'}: {priorityLabels[priority]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {isPolish ? 'Zdjęcia / pliki do zgłoszenia (opcjonalnie)' : 'Attachments (optional)'}
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(event) => {
                    setTicketFiles(Array.from(event.target.files || []));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {ticketFiles.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {isPolish ? 'Wybrane pliki:' : 'Selected files:'} {ticketFiles.map((item) => item.name).join(', ')}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                  onClick={() => {
                    setShowCreateModal(false);
                    setTicketFiles([]);
                  }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {submittingTicket ? 'Tworzenie...' : 'Utwórz ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
