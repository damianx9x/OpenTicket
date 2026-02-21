'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  ArrowDownUp,
  CheckCheck,
  ChevronRight,
  Clock3,
  DollarSign,
  Download,
  Flame,
  Folder,
  Headphones,
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
} from 'lucide-react';
import { getMe, getStoredToken, getStoredUser, logout, type AuthUser } from '@/lib/auth-client';
import { applyRuntimeApiBaseFromSetupStatus, buildApiUrl, checkSetupStatus } from '@/lib/setup-client';
import {
  addComment,
  addCostItem,
  asNumber,
  createTicket,
  listComments,
  listCostItems,
  listTickets,
  type CommentItem,
  type CostItem,
  type CostSummary,
  type CreateTicketInput,
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

const PRIORITIES: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const STATUSES: TicketStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'ARCHIVED'];
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

const STATUS_META: Record<TicketStatus, { className: string }> = {
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

const NAV_ITEMS = [
  { id: 'tickets', labelPl: 'Zgłoszenia', labelEn: 'Tickets', icon: TicketIcon },
  { id: 'statistics', labelPl: 'Statystyki', labelEn: 'Statistics', icon: BarChart3 },
  { id: 'users', labelPl: 'Użytkownicy', labelEn: 'Users', icon: Users },
  { id: 'vat', labelPl: 'Konfiguracja', labelEn: 'Settings', icon: Settings2 },
  { id: 'server', labelPl: 'Serwer', labelEn: 'Server', icon: Server },
] as const;

type NavItemId = (typeof NAV_ITEMS)[number]['id'];

type SavedFilterPreset = {
  name: string;
  status?: string;
  priority?: string;
  search?: string;
  onlyMine?: boolean;
  minAgeDays?: number;
};

type DashboardPreferences = {
  widgetOrder?: Array<'open' | 'urgent' | 'inProgress' | 'closedToday'>;
  savedFilters?: SavedFilterPreset[];
  compactMode?: boolean;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('pl-PL');
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
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
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
    widgetOrder: ['open', 'urgent', 'inProgress', 'closedToday'],
    savedFilters: [],
    compactMode: false,
  });

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
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testSmsTo, setTestSmsTo] = useState('');
  const [serverInfo, setServerInfo] = useState<SystemInfo | null>(null);
  const [serverDiagnostics, setServerDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

  const [ticketReminders, setTicketReminders] = useState<ReminderItem[]>([]);
  const [newReminder, setNewReminder] = useState({
    title: '',
    note: '',
    dueAt: '',
  });
  const [reminderSubmitting, setReminderSubmitting] = useState(false);

  const [ticketForm, setTicketForm] = useState<CreateTicketInput>(emptyTicketForm);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentInternal, setCommentInternal] = useState(false);
  const [costForm, setCostForm] = useState({
    name: '',
    qty: '1',
    unitNet: '0',
    vatCode: '23',
  });

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    onlyMine: false,
    minAgeDays: '',
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

  const statusLabels = STATUS_LABELS[uiLanguage];
  const priorityLabels = PRIORITY_LABELS[uiLanguage];
  const roleLabels = ROLE_LABELS[uiLanguage];
  const isPolish = uiLanguage === 'pl';
  const normalizedCurrentRole = (currentUser?.role || '').toUpperCase();
  const isAdmin = normalizedCurrentRole === 'ADMIN';
  const companyName = settings?.branding?.companyName?.trim() || 'OpenTicket';
  const companyLogo = settings?.branding?.logoDataUrl?.trim() || '';
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => isAdmin || (item.id !== 'vat' && item.id !== 'server')),
    [isAdmin],
  );

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
          : activeNav === 'server'
            ? isPolish
              ? 'Status Serwera'
              : 'Server Status'
            : isPolish
              ? 'Konfiguracja'
              : 'Settings';

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const open = tickets.filter((ticket) => !['CLOSED', 'ARCHIVED'].includes(ticket.status)).length;
    const urgent = tickets.filter((ticket) => ticket.priority === 'URGENT').length;
    const inProgress = tickets.filter((ticket) => ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER'].includes(ticket.status)).length;
    const closedToday = tickets.filter(
      (ticket) => ticket.status === 'CLOSED' && new Date(ticket.updatedAt).toDateString() === today,
    ).length;

    return {
      open,
      urgent,
      inProgress,
      closedToday,
      total: tickets.length,
      waitingForCustomer: tickets.filter((ticket) => ticket.status === 'WAITING_FOR_CUSTOMER').length,
      closedAll: tickets.filter((ticket) => ticket.status === 'CLOSED').length,
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

    const fallbackOrder: Array<'open' | 'urgent' | 'inProgress' | 'closedToday'> = [
      'open',
      'urgent',
      'inProgress',
      'closedToday',
    ];
    const order =
      dashboardPrefs.widgetOrder && dashboardPrefs.widgetOrder.length === 4
        ? dashboardPrefs.widgetOrder
        : fallbackOrder;

    return order.map((key) => definitions[key]);
  }, [dashboardPrefs.widgetOrder, stats, uiLanguage]);

  const notify = (next: Notice) => {
    setNotice(next);
    window.setTimeout(() => {
      setNotice((prev) => (prev?.text === next.text ? null : prev));
    }, 4000);
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
      search: filter.search || '',
      onlyMine: Boolean(filter.onlyMine),
      minAgeDays:
        filter.minAgeDays && Number.isFinite(filter.minAgeDays) && filter.minAgeDays > 0
          ? String(Math.floor(filter.minAgeDays))
          : '',
    }));
  };

  const addCurrentFilterToSaved = async () => {
    const name = window.prompt(isPolish ? 'Nazwa filtra (np. "Pilne Apple")' : 'Filter name (for example: "Urgent Apple")');
    if (!name) return;
    const normalizedMinAge = Number(filters.minAgeDays);
    const next: DashboardPreferences = {
      ...dashboardPrefs,
      savedFilters: [
        ...(dashboardPrefs.savedFilters || []),
        {
          name: name.trim(),
          status: filters.status || undefined,
          priority: filters.priority || undefined,
          search: filters.search || undefined,
          onlyMine: filters.onlyMine || undefined,
          minAgeDays: Number.isFinite(normalizedMinAge) && normalizedMinAge > 0 ? Math.floor(normalizedMinAge) : undefined,
        },
      ],
    };
    await savePrefs(next);
  };

  const loadStatistics = async () => {
    setStatisticsLoading(true);
    try {
      const next = await getStatisticsOverview();
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

  const loadTicketsData = async () => {
    setLoadingTickets(true);
    try {
      const response = await listTickets({
        search: filters.search || undefined,
        status: (filters.status as TicketStatus) || undefined,
        priority: (filters.priority as TicketPriority) || undefined,
        onlyMine: filters.onlyMine,
        minAgeDays: filters.minAgeDays ? Number(filters.minAgeDays) : undefined,
      });

      setTickets(response.items);

      if (response.items.length === 0) {
        setSelectedTicketId(null);
      } else if (selectedTicketId && !response.items.some((ticket) => ticket.id === selectedTicketId)) {
        setSelectedTicketId(response.items[0].id);
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
      const [nextComments, nextCosts, nextAttachments] = await Promise.all([
        listComments(ticketId),
        listCostItems(ticketId),
        listAttachments(ticketId),
      ]);
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
        setDashboardPrefs((prev) => ({
          ...prev,
          ...(prefs as DashboardPreferences),
          widgetOrder:
            ((prefs as DashboardPreferences).widgetOrder as DashboardPreferences['widgetOrder']) ||
            prev.widgetOrder,
          savedFilters:
            ((prefs as DashboardPreferences).savedFilters as DashboardPreferences['savedFilters']) ||
            prev.savedFilters,
        }));

        await loadTicketsData();
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
  }, [filters.search, filters.status, filters.priority, filters.onlyMine, filters.minAgeDays]);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetails(selectedTicketId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId]);

  useEffect(() => {
    if (!isAdmin && (activeNav === 'vat' || activeNav === 'server')) {
      setActiveNav('tickets');
    }
  }, [activeNav, isAdmin]);

  useEffect(() => {
    if (bootLoading) {
      return;
    }

    if (activeNav === 'statistics') {
      void loadStatistics();
    } else if (activeNav === 'users') {
      void loadUsers();
    } else if (activeNav === 'vat' && isAdmin) {
      void loadSettings();
    } else if (activeNav === 'server' && isAdmin) {
      void loadServerStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav, bootLoading, isAdmin]);

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

      setCostForm({ name: '', qty: '1', unitNet: '0', vatCode: '23' });
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

  const handleResetSetup = async () => {
    if (!isElectron) {
      notify({ type: 'error', text: 'Reset setup jest dostępny tylko w aplikacji desktop.' });
      return;
    }

    if (!confirm('Na pewno zresetować konfigurację setup?')) {
      return;
    }

    try {
      const bridge = getElectron();
      const result = await bridge.resetSetup();
      if (result.success) {
        notify({ type: 'success', text: result.message || 'Setup został zresetowany.' });
      } else {
        notify({ type: 'error', text: result.message || 'Reset setup nie powiódł się.' });
      }
    } catch (error) {
      notify({
        type: 'error',
        text: `Reset setup nie powiódł się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const moveWidget = async (
    widgetKey: 'open' | 'urgent' | 'inProgress' | 'closedToday',
    direction: 'up' | 'down',
  ) => {
    const current = [...(dashboardPrefs.widgetOrder || ['open', 'urgent', 'inProgress', 'closedToday'])];
    const index = current.indexOf(widgetKey);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    [current[index], current[targetIndex]] = [current[targetIndex], current[index]];
    await savePrefs({ ...dashboardPrefs, widgetOrder: current });
  };

  const handleCreateAppUser = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createAppUser(newUser);
      setNewUser({ email: '', name: '', role: 'AGENT', phone: '', password: '' });
      await loadUsers();
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
      await loadUsers();
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

  const handleExportBackup = async () => {
    if (!isAdmin) {
      notify({ type: 'error', text: 'Eksport backupu wymaga roli ADMIN.' });
      return;
    }
    try {
      const result = await exportBackup();
      setBackupPath(result.archivePath);
      notify({ type: 'success', text: `Backup gotowy: ${result.archiveName}` });
    } catch (error) {
      notify({
        type: 'error',
        text: `Eksport backupu nie powiódł się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
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
      setNewReminder({ title: '', note: '', dueAt: '' });
      await loadTicketReminders(selectedTicketId);
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
        await loadTicketReminders(selectedTicketId);
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
        await loadTicketReminders(selectedTicketId);
      }
      notify({ type: 'success', text: 'Przypomnienie zostało usunięte.' });
    } catch (error) {
      notify({
        type: 'error',
        text: `Nie udało się usunąć przypomnienia: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    }
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
              <Headphones className="h-6 w-6" />
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
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('vat');
                    notify({
                      type: 'success',
                      text: isPolish
                        ? 'Otworzono konfigurację przypomnień i powiadomień.'
                        : 'Notification settings opened.',
                    });
                  }}
                  className="rounded-md p-2 text-slate-400 transition hover:text-blue-600"
                  title={isPolish ? 'Powiadomienia' : 'Notifications'}
                >
                  <Bell className="h-5 w-5" />
                </button>
              )}

              {isElectron && (
                <button
                  type="button"
                  onClick={() => void handleResetSetup()}
                  className="rounded-md border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                >
                  Reset setup (DEV)
                </button>
              )}

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
                <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {orderedWidgets.map((widget, idx) => {
                    const Icon = widget.icon;
                    return (
                      <article
                        key={widget.key}
                        className={`ticket-surface animate-enter rounded-xl border border-slate-100 p-5 ${
                          idx > 0 ? `[animation-delay:${idx * 60}ms]` : ''
                        }`}
                      >
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void addCurrentFilterToSaved()}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        <ArrowDownUp className="h-3.5 w-3.5" />
                        Zapisz filtr
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                      <strong>Razem zgłoszeń:</strong> {stats.total}
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <strong>Czekające na klienta:</strong> {stats.waitingForCustomer}
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
                      <strong>Zamknięte razem:</strong> {stats.closedAll}
                    </div>
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

                    <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={filters.onlyMine}
                          onChange={(event) => setFilters((prev) => ({ ...prev, onlyMine: event.target.checked }))}
                        />
                        {isPolish ? 'Tylko moje' : 'Only mine'}
                      </label>

                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:w-36"
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
                        <option value="">Wszystkie statusy</option>
                        {STATUSES.map((status) => (
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
                        <option value="">Wszystkie priorytety</option>
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {PRIORITY_LABELS[uiLanguage][priority]}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void loadTicketsData()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Odśwież
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
                            const statusMeta = STATUS_META[ticket.status];
                            const priorityMeta = PRIORITY_META[ticket.priority];

                            return (
                              <tr
                                key={ticket.id}
                                onClick={() => setSelectedTicketId(ticket.id)}
                                className={`cursor-pointer transition hover:bg-blue-50 ${
                                  selectedTicketId === ticket.id ? 'bg-blue-50/70' : 'bg-white'
                                }`}
                              >
                                <td className="px-4 py-3 text-slate-500">#{ticket.number}</td>
                                <td className="px-4 py-3 font-medium text-slate-900">{ticket.title}</td>
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
                                    {STATUS_LABELS[uiLanguage][ticket.status]}
                                  </span>
                                </td>
                                <td className={`px-4 py-3 text-xs ${priorityMeta.className}`}>
                                  {PRIORITY_LABELS[uiLanguage][ticket.priority]}
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                  {ticket.assignedAgentId ? 'Przypisany' : 'Nieprzypisany'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="inline-flex items-center text-slate-400">
                                    <ChevronRight className="h-4 w-4" />
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {selectedTicket && (
                  <section className="ticket-surface mt-5 rounded-xl border border-slate-100 p-5">
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-base font-semibold text-slate-900">
                            #{selectedTicket.number} - {selectedTicket.title}
                          </h3>
                          <div className="text-xs text-slate-500">Utworzono: {formatDate(selectedTicket.createdAt)}</div>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">{selectedTicket.description}</p>
                      </div>

                      {loadingDetails ? (
                        <p className="text-sm text-slate-500">Ładowanie komentarzy i kosztów...</p>
                      ) : (
                        <>
                        <div className="grid gap-4 xl:grid-cols-2">
                          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                            <h4 className="text-sm font-semibold text-slate-900">Komentarze</h4>
                            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
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

                            <form className="space-y-2" onSubmit={handleAddComment}>
                              <textarea
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Dodaj komentarz"
                                value={commentBody}
                                onChange={(event) => setCommentBody(event.target.value)}
                              />
                              <label className="flex items-center gap-2 text-xs text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={commentInternal}
                                  onChange={(event) => setCommentInternal(event.target.checked)}
                                />
                                Notatka wewnętrzna
                              </label>
                              <button
                                type="submit"
                                disabled={submittingComment}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-300"
                              >
                                {submittingComment ? 'Dodawanie...' : 'Dodaj komentarz'}
                              </button>
                            </form>
                          </div>

                          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
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
                  </section>
                )}
              </>
            )}

            {activeNav === 'statistics' && (
              <section className="ticket-surface rounded-xl border border-slate-100 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Zaawansowane statystyki</h2>
                  <button
                    type="button"
                    onClick={() => void loadStatistics()}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Odśwież
                  </button>
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
                        <h3 className="mb-2 text-sm font-semibold text-slate-800">Statusy</h3>
                        <ul className="space-y-1 text-sm text-slate-700">
                          {statistics.byStatus.map((row) => (
                            <li key={row.key} className="flex items-center justify-between">
                              <span>{statusLabels[row.key] || row.key}</span>
                              <strong>{row.count}</strong>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3">
                        <h3 className="mb-2 text-sm font-semibold text-slate-800">Priorytety</h3>
                        <ul className="space-y-1 text-sm text-slate-700">
                          {statistics.byPriority.map((row) => (
                            <li key={row.key} className="flex items-center justify-between">
                              <span>{priorityLabels[row.key] || row.key}</span>
                              <strong>{row.count}</strong>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3">
                        <h3 className="mb-2 text-sm font-semibold text-slate-800">Kanały</h3>
                        <ul className="space-y-1 text-sm text-slate-700">
                          {statistics.byChannel.map((row) => (
                            <li key={row.key} className="flex items-center justify-between">
                              <span>{row.key}</span>
                              <strong>{row.count}</strong>
                            </li>
                          ))}
                        </ul>
                      </div>
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
                      {editingUser && (
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
                              {STATUSES.map((status) => (
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
                  <div className="space-y-2">
                    {(dashboardPrefs.widgetOrder || ['open', 'urgent', 'inProgress', 'closedToday']).map((key, index) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-sm text-slate-700">
                          {index + 1}. {key}
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                {serverDiagnostics && (
                  <div className="ticket-surface rounded-xl border border-slate-100 p-5">
                    <h3 className="mb-2 text-sm font-semibold text-slate-900">Raport diagnostyczny (JSON)</h3>
                    <pre className="max-h-[340px] overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
                      {JSON.stringify(serverDiagnostics, null, 2)}
                    </pre>
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
