'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Folder, Loader2, RefreshCw, Wifi } from 'lucide-react';
import { normalizeApiBaseUrl } from '@/lib/api-base';
import {
  discoverSetupServers,
  type DiscoveredSetupServer,
  type InstallationMode,
  validateDataPath as validateDataPathRequest,
  validateRemoteApiBase,
} from '@/lib/setup-client';

interface Step1Props {
  onContinue: (payload: {
    installationMode: InstallationMode;
    dataPath: string;
    remoteApiBaseUrl?: string;
  }) => void;
  defaultValue: string;
}

/**
 * Step 1: Storage Location
 * User selects where to store data files (SQLite, uploads, configs)
 */
export function InitStep1({ onContinue, defaultValue }: Step1Props) {
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
  const [dataPath, setDataPath] = useState(resolvedDefaultPath);
  const [remoteApiBaseUrl, setRemoteApiBaseUrl] = useState('http://127.0.0.1:3200');
  const [useDefault, setUseDefault] = useState(true);
  const [checkingPath, setCheckingPath] = useState(false);
  const [discoveringServers, setDiscoveringServers] = useState(false);
  const [validatingRemote, setValidatingRemote] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredSetupServer[]>([]);
  const [discoverySummary, setDiscoverySummary] = useState('');
  const [remoteValidated, setRemoteValidated] = useState<{ url: string; latencyMs?: number } | null>(null);
  const [pathFeedback, setPathFeedback] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    text: string;
  } | null>(null);

  const isElectron =
    typeof window !== 'undefined' &&
    Boolean((window as any).electron?.selectFolder || (window as any).electronAPI?.selectFolder);

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
    if (installationMode !== 'client_only') {
      return;
    }
    if (discoveredServers.length > 0 || discoveringServers) {
      return;
    }
    void discoverServers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationMode]);

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

    onContinue({
      installationMode,
      dataPath: validatedPath,
    });
  };

  const isBusy = checkingPath || discoveringServers || validatingRemote;

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
            : 'Continue to Admin Setup →'}
      </button>
    </div>
  );
}
