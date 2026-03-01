'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Folder, Loader2, RefreshCw, Wifi } from 'lucide-react';
import { normalizeApiBaseUrl } from '@/lib/api-base';
import {
  discoverLocalDataSources,
  discoverSetupServers,
  type DiscoveredSetupServer,
  type InstallationMode,
  type SetupBootstrapMode,
  validateDataPath as validateDataPathRequest,
  validateRemoteApiBase,
} from '@/lib/setup-client';

interface Step1Props {
  onContinue: (payload: {
    installationMode: InstallationMode;
    dataPath: string;
    remoteApiBaseUrl?: string;
    bootstrapMode?: SetupBootstrapMode;
    existingDatabasePath?: string;
    existingBackupArchivePath?: string;
    backupEncryptionKey?: string;
    demoTicketCount?: number;
    autoBackupEnabled?: boolean;
    autoBackupIntervalHours?: number;
    autoBackupPath?: string;
  }) => void;
  defaultValue: string;
}

/**
 * Step 1: Storage Location
 * User selects where to store data files (SQLite, uploads, configs)
 */
export function InitStep1({ onContinue, defaultValue }: Step1Props) {
  const defaultBackupPathFor = (targetPath: string): string => {
    const trimmed = targetPath.trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('\\')) {
      return `${trimmed.replace(/[\\]+$/, '')}\\backups\\auto`;
    }
    return `${trimmed.replace(/[\\/]+$/, '')}/backups/auto`;
  };

  const getPlatformDefaultPath = (): string => {
    const platform = typeof navigator !== 'undefined' ? navigator.platform : 'unknown';

    if (platform.includes('Mac')) {
      return '~/Library/Application Support/OpenTicket/data';
    } else if (platform.includes('Win')) {
      return 'C:\\Users\\YourName\\AppData\\Roaming\\OpenTicket\\data';
    }
    return '~/.local/share/openticket/data';
  };

  const resolvedDefaultPath = defaultValue?.trim().length > 0 ? defaultValue : getPlatformDefaultPath();
  const [installationMode, setInstallationMode] = useState<InstallationMode>('server_client');
  const [setupScenario, setSetupScenario] = useState<'new' | 'restore'>('new');
  const [dataPath, setDataPath] = useState(resolvedDefaultPath);
  const [bootstrapMode, setBootstrapMode] = useState<SetupBootstrapMode>('fresh');
  const [existingDatabasePath, setExistingDatabasePath] = useState('');
  const [existingBackupArchivePath, setExistingBackupArchivePath] = useState('');
  const [demoTicketCount, setDemoTicketCount] = useState<number>(200);
  const [backupEncryptionKey, setBackupEncryptionKey] = useState('');
  const [remoteApiBaseUrl, setRemoteApiBaseUrl] = useState('http://127.0.0.1:3200');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [autoBackupIntervalHours, setAutoBackupIntervalHours] = useState<number>(24);
  const [autoBackupPath, setAutoBackupPath] = useState(defaultBackupPathFor(resolvedDefaultPath));
  const [autoBackupPathTouched, setAutoBackupPathTouched] = useState(false);
  const [useDefault, setUseDefault] = useState(true);
  const [checkingPath, setCheckingPath] = useState(false);
  const [discoveringServers, setDiscoveringServers] = useState(false);
  const [discoveringLocalData, setDiscoveringLocalData] = useState(false);
  const [validatingRemote, setValidatingRemote] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredSetupServer[]>([]);
  const [discoveredDatabases, setDiscoveredDatabases] = useState<string[]>([]);
  const [discoveredBackups, setDiscoveredBackups] = useState<string[]>([]);
  const [discoverySummary, setDiscoverySummary] = useState('');
  const [remoteValidated, setRemoteValidated] = useState<{ url: string; latencyMs?: number } | null>(null);
  const [pathFeedback, setPathFeedback] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    text: string;
  } | null>(null);

  const isElectron =
    typeof window !== 'undefined' &&
    Boolean((window as any).electron?.selectFolder || (window as any).electronAPI?.selectFolder);

  const selectFilePath = async (kind: 'database' | 'backup'): Promise<string | null> => {
    const bridge =
      typeof window !== 'undefined'
        ? (window as any).electron || (window as any).electronAPI
        : null;

    if (!bridge?.selectFile) {
      setPathFeedback({
        type: 'info',
        text: 'W trybie przeglądarki wpisz ścieżkę ręcznie. W instalatorze możesz wybrać plik natywnie.',
      });
      return null;
    }

    try {
      const selected = await bridge.selectFile(kind);
      return selected || null;
    } catch (error) {
      setPathFeedback({
        type: 'error',
        text: `Nie udało się wybrać pliku: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
      return null;
    }
  };

  const runPathValidation = async (targetPath: string): Promise<string | null> => {
    setCheckingPath(true);
    try {
      const result = await validateDataPathRequest(targetPath);
      if (!result.ok) {
        setPathFeedback({
          type: 'error',
          text: result.error || 'Brak uprawnień do zapisu w wybranej lokalizacji.',
        });
        return null;
      }

      if (result.warning) {
        setPathFeedback({
          type: 'warning',
          text: `${result.warning} (aktywnie: ${result.resolvedPath})`,
        });
      } else {
        setPathFeedback({
          type: 'success',
          text: `Lokalizacja gotowa: ${result.resolvedPath}`,
        });
      }

      return result.resolvedPath;
    } catch (error) {
      setPathFeedback({
        type: 'error',
        text: `Nie udało się sprawdzić lokalizacji: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
      return null;
    } finally {
      setCheckingPath(false);
    }
  };

  const discoverServers = async (deepScan: boolean): Promise<void> => {
    setDiscoveringServers(true);
    setPathFeedback({
      type: 'info',
      text: deepScan
        ? 'Skanuję pełną podsieć lokalną... To może potrwać kilkanaście sekund.'
        : 'Skanuję lokalną sieć w poszukiwaniu serwera...',
    });

    try {
      const result = await discoverSetupServers({
        deepScan,
        includeLocalhost: true,
      });

      setDiscoveredServers(result.servers || []);
      setDiscoverySummary(
        `Przeskanowano ${result.scannedTargets} adresów w ${Math.max(1, Math.round(result.durationMs / 1000))}s.`,
      );

      if (result.servers.length > 0) {
        const best = result.servers[0];
        setRemoteApiBaseUrl(best.apiBaseUrl);
        setRemoteValidated({ url: best.apiBaseUrl, latencyMs: best.latencyMs });
        setPathFeedback({
          type: 'success',
          text: `Znaleziono ${result.servers.length} serwer(y). Wybrano: ${best.apiBaseUrl}`,
        });
      } else {
        setRemoteValidated(null);
        setPathFeedback({
          type: 'warning',
          text:
            result.message ||
            'Nie znaleziono serwera automatycznie. Podaj adres ręcznie (LAN lub zewnętrzny URL).',
        });
      }
    } catch (error) {
      setPathFeedback({
        type: 'error',
        text: `Skanowanie serwerów nie powiodło się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setDiscoveringServers(false);
    }
  };

  const discoverLocalData = async (): Promise<void> => {
    setDiscoveringLocalData(true);
    setPathFeedback({
      type: 'info',
      text: 'Szukam poprzedniej bazy i backupów na tym komputerze...',
    });
    try {
      const result = await discoverLocalDataSources();
      setDiscoveredDatabases(result.existingDatabases || []);
      setDiscoveredBackups(result.backupArchives || []);
      if ((result.existingDatabases || []).length === 0 && (result.backupArchives || []).length === 0) {
        setPathFeedback({
          type: 'warning',
          text: 'Nie znaleziono poprzedniej bazy ani backupów. Możesz kontynuować z nową bazą.',
        });
      } else {
        setPathFeedback({
          type: 'success',
          text: `Wykryto ${result.existingDatabases.length} baz i ${result.backupArchives.length} backupów.`,
        });
      }
    } catch (error) {
      setPathFeedback({
        type: 'error',
        text: `Nie udało się wykryć poprzednich danych: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
    } finally {
      setDiscoveringLocalData(false);
    }
  };

  const validateRemoteAddress = async (
    options?: { showSuccess?: boolean },
  ): Promise<string | null> => {
    const showSuccess = options?.showSuccess !== false;

    let normalizedRemote: string | null = null;
    try {
      normalizedRemote = normalizeApiBaseUrl(remoteApiBaseUrl);
    } catch {
      normalizedRemote = null;
    }

    if (!normalizedRemote) {
      setPathFeedback({
        type: 'error',
        text: 'URL serwera jest nieprawidłowy. Użyj formatu http://host:port lub https://host.',
      });
      return null;
    }

    setValidatingRemote(true);
    try {
      const result = await validateRemoteApiBase(normalizedRemote);
      if (!result.ok) {
        setRemoteValidated(null);
        setPathFeedback({
          type: 'error',
          text: result.error || 'Nie udało się połączyć z serwerem pod podanym adresem.',
        });
        return null;
      }

      setRemoteApiBaseUrl(result.apiBaseUrl);
      setRemoteValidated({ url: result.apiBaseUrl, latencyMs: result.latencyMs });

      if (showSuccess) {
        setPathFeedback({
          type: 'success',
          text: `Połączenie z serwerem OK: ${result.apiBaseUrl}${result.latencyMs ? ` (${result.latencyMs} ms)` : ''}`,
        });
      }

      return result.apiBaseUrl;
    } catch (error) {
      setRemoteValidated(null);
      setPathFeedback({
        type: 'error',
        text: `Weryfikacja adresu nie powiodła się: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
      });
      return null;
    } finally {
      setValidatingRemote(false);
    }
  };

  useEffect(() => {
    if (autoBackupPathTouched) {
      return;
    }
    const nextBase = useDefault ? resolvedDefaultPath : dataPath;
    setAutoBackupPath(defaultBackupPathFor(nextBase));
  }, [autoBackupPathTouched, dataPath, resolvedDefaultPath, useDefault]);

  useEffect(() => {
    if (installationMode !== 'client_only') {
      return;
    }
    if (discoveredServers.length > 0 || discoveringServers) {
      return;
    }
    void discoverServers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationMode]);

  useEffect(() => {
    if (installationMode === 'client_only') {
      return;
    }

    if (setupScenario === 'restore' && bootstrapMode !== 'encrypted_backup') {
      setBootstrapMode('encrypted_backup');
      return;
    }

    if (setupScenario === 'new' && bootstrapMode === 'encrypted_backup') {
      setBootstrapMode('fresh');
    }
  }, [bootstrapMode, installationMode, setupScenario]);

  const handleChooseFolder = async () => {
    const bridge =
      typeof window !== 'undefined'
        ? (window as any).electron || (window as any).electronAPI
        : null;

    if (bridge?.selectFolder) {
      try {
        const selected = await bridge.selectFolder();
        if (selected) {
          setDataPath(selected);
          setUseDefault(false);
          setPathFeedback({
            type: 'info',
            text: 'Folder wybrany. Kliknij „Sprawdź uprawnienia” albo przejdź dalej.',
          });
        }
      } catch (error) {
        setPathFeedback({
          type: 'error',
          text: `Nie udało się otworzyć wyboru folderu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
        });
      }
    } else {
      setPathFeedback({
        type: 'info',
        text: 'W trybie przeglądarki wybór folderu działa ręcznie (wpisz ścieżkę). Dla klienta użyj aplikacji z instalatora.',
      });
    }
  };

  const handleChooseBackupFolder = async () => {
    const bridge =
      typeof window !== 'undefined'
        ? (window as any).electron || (window as any).electronAPI
        : null;

    if (bridge?.selectFolder) {
      try {
        const selected = await bridge.selectFolder();
        if (selected) {
          setAutoBackupPath(selected);
          setAutoBackupPathTouched(true);
          setPathFeedback({
            type: 'info',
            text: 'Folder backupu wybrany.',
          });
        }
      } catch (error) {
        setPathFeedback({
          type: 'error',
          text: `Nie udało się wybrać folderu backupu: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
        });
      }
    } else {
      setPathFeedback({
        type: 'info',
        text: 'W trybie przeglądarki wpisz ścieżkę backupu ręcznie. W instalatorze działa natywny wybór folderu.',
      });
    }
  };

  const handleContinue = async () => {
    if (installationMode === 'client_only') {
      const validatedRemote = await validateRemoteAddress({ showSuccess: false });
      if (!validatedRemote) {
        return;
      }

      onContinue({
        installationMode,
        dataPath: resolvedDefaultPath,
        remoteApiBaseUrl: validatedRemote,
        autoBackupEnabled: false,
      });
      return;
    }

    const finalPath = useDefault ? resolvedDefaultPath : dataPath;
    if (!finalPath || finalPath.trim().length === 0) {
      setPathFeedback({
        type: 'error',
        text: 'Podaj lokalizację danych, aby kontynuować.',
      });
      return;
    }

    const validatedPath = await runPathValidation(finalPath);
    if (!validatedPath) {
      return;
    }

    if (setupScenario === 'restore' && existingBackupArchivePath.trim().length === 0) {
      setPathFeedback({
        type: 'error',
        text: 'Wskaż plik backupu (.otbackup), aby kontynuować odtworzenie.',
      });
      return;
    }

    const restorePath = existingBackupArchivePath.trim().toLowerCase();
    const restoreLooksEncrypted = restorePath.endsWith('.otbackup');
    if (setupScenario === 'restore' && restoreLooksEncrypted && backupEncryptionKey.trim().length < 16) {
      setPathFeedback({
        type: 'error',
        text: 'Podaj klucz szyfrowania backupu (minimum 16 znaków).',
      });
      return;
    }

    if (bootstrapMode === 'existing_db' && existingDatabasePath.trim().length === 0) {
      setPathFeedback({
        type: 'error',
        text: 'Wskaż plik istniejącej bazy app.db, aby kontynuować.',
      });
      return;
    }

    if (bootstrapMode === 'backup_archive' && existingBackupArchivePath.trim().length === 0) {
      setPathFeedback({
        type: 'error',
        text: 'Wskaż archiwum backupu (.tar.gz), aby kontynuować.',
      });
      return;
    }

    if (bootstrapMode === 'demo_dataset') {
      const normalized = Number(demoTicketCount);
      if (!Number.isFinite(normalized) || normalized < 20 || normalized > 1000) {
        setPathFeedback({
          type: 'error',
          text: 'Dla bazy demo podaj liczbę zgłoszeń od 20 do 1000.',
        });
        return;
      }
    }

    let validatedBackupPath = autoBackupPath.trim();
    if (autoBackupEnabled) {
      if (!validatedBackupPath) {
        validatedBackupPath = defaultBackupPathFor(validatedPath);
      }
      const backupPathCheck = await runPathValidation(validatedBackupPath);
      if (!backupPathCheck) {
        return;
      }
      validatedBackupPath = backupPathCheck;
    }

    onContinue({
      installationMode,
      dataPath: validatedPath,
      bootstrapMode,
      existingDatabasePath: existingDatabasePath.trim() || undefined,
      existingBackupArchivePath: existingBackupArchivePath.trim() || undefined,
      backupEncryptionKey: bootstrapMode === 'encrypted_backup' ? backupEncryptionKey.trim() : undefined,
      demoTicketCount: bootstrapMode === 'demo_dataset' ? Math.floor(Number(demoTicketCount) || 200) : undefined,
      autoBackupEnabled,
      autoBackupIntervalHours: autoBackupEnabled
        ? Math.max(1, Math.min(168, Math.floor(Number(autoBackupIntervalHours) || 24)))
        : undefined,
      autoBackupPath: autoBackupEnabled ? validatedBackupPath : undefined,
    });
  };

  const isBusy = checkingPath || discoveringServers || discoveringLocalData || validatingRemote;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold text-gray-800">📁 Choose Storage Location</h2>
        <p className="text-gray-600">Select where to store your database, files, and configuration.</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Tryb instalacji</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
          <input
            type="radio"
            checked={installationMode === 'server_client'}
            onChange={() => {
              setInstallationMode('server_client');
              setSetupScenario('new');
              setPathFeedback(null);
            }}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-medium text-gray-800">Serwer + klient (zalecane)</p>
            <p className="mt-1 text-sm text-gray-600">Instalujesz pełny system lokalnie: baza, pliki i panel operatora.</p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
          <input
            type="radio"
            checked={installationMode === 'client_only'}
            onChange={() => {
              setInstallationMode('client_only');
              setPathFeedback(null);
            }}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-medium text-gray-800">Sam klient (połącz z istniejącym serwerem)</p>
            <p className="mt-1 text-sm text-gray-600">Aplikacja desktop łączy się do serwera, który już działa w firmie.</p>
          </div>
        </label>
      </div>

      {installationMode === 'client_only' ? (
        <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-blue-900">Adres istniejącego serwera</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void discoverServers(false)}
                disabled={discoveringServers || validatingRemote}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {discoveringServers ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                Wyszukaj w LAN
              </button>
              <button
                type="button"
                onClick={() => void discoverServers(true)}
                disabled={discoveringServers || validatingRemote}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {discoveringServers ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Skan pełny /24
              </button>
            </div>
          </div>

          <input
            type="text"
            value={remoteApiBaseUrl}
            onChange={(e) => {
              setRemoteApiBaseUrl(e.target.value);
              setRemoteValidated(null);
              setPathFeedback(null);
            }}
            placeholder="http://192.168.1.50:3200 lub https://serwer.twojafirma.pl"
            className="w-full rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-mono"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void validateRemoteAddress({ showSuccess: true })}
              disabled={validatingRemote || discoveringServers}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {validatingRemote ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Sprawdź adres
            </button>

            {remoteValidated && (
              <p className="text-xs text-emerald-800">
                Połączenie potwierdzone: <code>{remoteValidated.url}</code>
                {remoteValidated.latencyMs ? ` (${remoteValidated.latencyMs} ms)` : ''}
              </p>
            )}
          </div>

          {discoverySummary && <p className="text-xs text-blue-700">{discoverySummary}</p>}

          {discoveredServers.length > 0 && (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Wykryte serwery</p>
              <div className="max-h-48 space-y-2 overflow-auto pr-1">
                {discoveredServers.map((server) => (
                  <button
                    key={server.apiBaseUrl}
                    type="button"
                    onClick={() => {
                      setRemoteApiBaseUrl(server.apiBaseUrl);
                      setRemoteValidated({ url: server.apiBaseUrl, latencyMs: server.latencyMs });
                      setPathFeedback({
                        type: 'info',
                        text: `Wybrano serwer: ${server.apiBaseUrl}`,
                      });
                    }}
                    className="w-full rounded-lg border border-blue-100 px-3 py-2 text-left hover:bg-blue-50"
                  >
                    <p className="text-sm font-medium text-slate-800">{server.apiBaseUrl}</p>
                    <p className="text-xs text-slate-600">
                      {server.app || 'openticket'} {server.version ? `• v${server.version}` : ''} • {server.latencyMs} ms
                      {server.setupMode ? ' • setup mode' : ' • gotowy'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-blue-800">
            Najpierw użyj <strong>Wyszukaj w LAN</strong>. Jeśli serwer jest poza LAN lub pod domeną firmową, wpisz ręcznie adres zewnętrzny i kliknij
            {' '}
            <strong>Sprawdź adres</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <p className="mb-2 text-sm font-semibold text-indigo-900">Scenariusz startu serwera</p>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-indigo-200 bg-white p-3 hover:bg-indigo-50">
                <input
                  type="radio"
                  checked={setupScenario === 'new'}
                  onChange={() => {
                    setSetupScenario('new');
                    setPathFeedback(null);
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-slate-800">Postaw nowy system</p>
                  <p className="text-xs text-slate-600">Nowa baza danych + konfiguracja administratora.</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-indigo-200 bg-white p-3 hover:bg-indigo-50">
                <input
                  type="radio"
                  checked={setupScenario === 'restore'}
                  onChange={() => {
                    setSetupScenario('restore');
                    setPathFeedback(null);
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-slate-800">Odtwórz z działającego systemu</p>
                  <p className="text-xs text-slate-600">Wskaż backup i klucz szyfrowania, aby odtworzyć bazę + zdjęcia.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">
                {setupScenario === 'restore'
                  ? 'Odtwarzanie danych (backup + klucz)'
                  : 'Źródło danych przy pierwszym uruchomieniu'}
              </p>
              <button
                type="button"
                onClick={() => void discoverLocalData()}
                disabled={discoveringLocalData || checkingPath}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {discoveringLocalData ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Wykryj poprzednią bazę/backup
              </button>
            </div>
            {setupScenario === 'new' ? (
              <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  checked={bootstrapMode === 'fresh'}
                  onChange={() => {
                    setBootstrapMode('fresh');
                    setPathFeedback(null);
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-slate-800">Nowa baza (czysta instalacja)</p>
                  <p className="text-xs text-slate-600">Utworzy świeżą bazę `app.db` i strukturę katalogów.</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  checked={bootstrapMode === 'demo_dataset'}
                  onChange={() => {
                    setBootstrapMode('demo_dataset');
                    setPathFeedback(null);
                  }}
                  className="mt-1"
                />
                <div className="w-full">
                  <p className="font-medium text-slate-800">Wczytaj bazę demo (realistyczne zgłoszenia)</p>
                  <p className="text-xs text-slate-600">
                    Tworzy nową bazę i automatycznie dodaje dane testowe do podglądu pełnego UI.
                  </p>
                  {bootstrapMode === 'demo_dataset' && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-600">Liczba zgłoszeń demo</label>
                      <input
                        type="number"
                        min={20}
                        max={1000}
                        step={10}
                        value={demoTicketCount}
                        onChange={(event) => setDemoTicketCount(Number(event.target.value))}
                        className="w-36 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                      />
                      <p className="text-xs text-slate-500">Zakres: 20-1000 (zalecane: 200)</p>
                    </div>
                  )}
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  checked={bootstrapMode === 'existing_db'}
                  onChange={() => {
                    setBootstrapMode('existing_db');
                    setPathFeedback(null);
                  }}
                  className="mt-1"
                />
                <div className="w-full">
                  <p className="font-medium text-slate-800">Import istniejącej bazy `app.db`</p>
                  <p className="text-xs text-slate-600">Przenosi dane z poprzedniej instalacji i uruchamia migracje.</p>
                  {bootstrapMode === 'existing_db' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={existingDatabasePath}
                        onChange={(event) => setExistingDatabasePath(event.target.value)}
                        placeholder="/ścieżka/do/app.db"
                        className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const selected = await selectFilePath('database');
                          if (selected) {
                            setExistingDatabasePath(selected);
                          }
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Wybierz plik
                      </button>
                    </div>
                  )}
                </div>
              </label>

              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="font-medium text-slate-800">Backup systemu (1 plik)</p>
                  <p className="text-xs text-slate-600">
                    Wybierz plik `.otbackup` wygenerowany w poprzedniej instalacji.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={existingBackupArchivePath}
                      onChange={(event) => setExistingBackupArchivePath(event.target.value)}
                      placeholder="/ścieżka/do/backup.otbackup"
                      className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const selected = await selectFilePath('backup');
                        if (selected) {
                          setBootstrapMode('encrypted_backup');
                          setExistingBackupArchivePath(selected);
                        }
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Wybierz plik
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900">Klucz szyfrowania backupu</p>
                  <input
                    type="text"
                    value={backupEncryptionKey}
                    onChange={(event) => setBackupEncryptionKey(event.target.value)}
                    placeholder="Wklej klucz wygenerowany podczas poprzedniej konfiguracji"
                    autoComplete="off"
                    className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-amber-800">
                    Dla plików `.otbackup` klucz jest obowiązkowy. Dla starego `.tar.gz` może nie być wymagany.
                  </p>
                </div>
              </div>
            )}

            {(discoveredDatabases.length > 0 || discoveredBackups.length > 0) && (
              <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                {discoveredDatabases.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-600">Wykryte bazy app.db</p>
                    <div className="max-h-32 space-y-2 overflow-auto pr-1">
                      {discoveredDatabases.slice(0, 6).map((dbPath) => (
                        <button
                          key={dbPath}
                          type="button"
                          onClick={() => {
                            setSetupScenario('new');
                            setBootstrapMode('existing_db');
                            setExistingDatabasePath(dbPath);
                            setPathFeedback({ type: 'info', text: `Wybrano bazę: ${dbPath}` });
                          }}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-left font-mono text-[11px] text-slate-700 hover:bg-slate-50"
                        >
                          {dbPath}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {discoveredBackups.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-600">Wykryte backupy (.otbackup / .tar.gz)</p>
                    <div className="max-h-32 space-y-2 overflow-auto pr-1">
                      {discoveredBackups.slice(0, 6).map((backupPath) => (
                        <button
                          key={backupPath}
                          type="button"
                          onClick={() => {
                            setSetupScenario('restore');
                            setBootstrapMode('encrypted_backup');
                            setExistingBackupArchivePath(backupPath);
                            setPathFeedback({ type: 'info', text: `Wybrano backup: ${backupPath}` });
                          }}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-left font-mono text-[11px] text-slate-700 hover:bg-slate-50"
                        >
                          {backupPath}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
            <input
              type="radio"
              checked={useDefault}
              onChange={() => {
                setUseDefault(true);
                setPathFeedback(null);
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-800">Use Default Location</p>
              <p className="mt-1 font-mono text-sm text-gray-600">{resolvedDefaultPath}</p>
              <p className="mt-2 text-xs text-gray-500">✓ Recommended for most users</p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
            <input
              type="radio"
              checked={!useDefault}
              onChange={() => {
                setUseDefault(false);
                setPathFeedback(null);
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-800">Custom Location</p>
              <p className="mt-2 text-sm text-gray-600">{dataPath || 'No path selected'}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleChooseFolder}
                  disabled={useDefault}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  <Folder size={18} />
                  Browse Folders
                </button>
                <p className="self-center text-xs text-gray-500">
                  {isElectron ? '(Natywny wybór folderu)' : '(Dostępne w aplikacji z instalatora)'}
                </p>
              </div>
            </div>
          </label>

          {!useDefault && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Or paste path directly:</label>
              <input
                type="text"
                value={dataPath}
                onChange={(e) => {
                  setDataPath(e.target.value);
                  setPathFeedback(null);
                }}
                placeholder="/Users/name/AppData/Roaming/OpenTicket"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => void runPathValidation(dataPath)}
                disabled={checkingPath || dataPath.trim().length === 0}
                className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingPath ? 'Sprawdzanie...' : 'Sprawdź uprawnienia'}
              </button>
            </div>
          )}

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-emerald-900">Automatyczny backup</p>
              <label className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(event) => setAutoBackupEnabled(event.target.checked)}
                />
                Włącz
              </label>
            </div>

            {autoBackupEnabled ? (
              <div className="space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-xs font-semibold text-emerald-800">
                    Co ile godzin
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={autoBackupIntervalHours}
                      onChange={(event) => setAutoBackupIntervalHours(Number(event.target.value))}
                      className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="self-end text-xs text-emerald-800">
                    Backup nadpisuje plik bieżący i zachowuje 1 kopię wstecz.
                  </div>
                </div>

                <label className="text-xs font-semibold text-emerald-800">
                  Folder backupu
                  <input
                    type="text"
                    value={autoBackupPath}
                    onChange={(event) => {
                      setAutoBackupPath(event.target.value);
                      setAutoBackupPathTouched(true);
                    }}
                    placeholder={defaultBackupPathFor(useDefault ? resolvedDefaultPath : dataPath)}
                    className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleChooseBackupFolder}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
                  >
                    Wybierz folder backupu
                  </button>
                  <button
                    type="button"
                    onClick={() => void runPathValidation(autoBackupPath)}
                    disabled={checkingPath || autoBackupPath.trim().length === 0}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    Sprawdź uprawnienia folderu backupu
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-emerald-800">
                Backup automatyczny wyłączony. Nadal możesz robić backup ręcznie z panelu Konfiguracja.
              </p>
            )}
          </div>
        </div>
      )}

      {pathFeedback && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            pathFeedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : pathFeedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : pathFeedback.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          {pathFeedback.text}
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          <strong>ℹ️ About storage:</strong> All your data including tickets, files, and settings will be stored in this location. Make sure you have at least 1GB of free space.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleContinue()}
        disabled={isBusy}
        className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {isBusy
          ? 'Przetwarzanie...'
          : installationMode === 'client_only'
            ? 'Połącz z serwerem →'
            : setupScenario === 'restore'
              ? 'Dalej: ustaw konto admina i odtwórz →'
              : 'Dalej do konfiguracji admina →'}
      </button>
    </div>
  );
}
