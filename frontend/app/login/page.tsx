'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyRuntimeApiBaseFromSetupStatus, checkSetupStatus } from '@/lib/setup-client';
import { login } from '@/lib/auth-client';

type ServiceAction = 'refresh' | 'restart' | 'repair' | 'logs' | 'diagnostics' | 'factoryReset' | null;

function getElectronBridge(): ElectronBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return (window.electron || window.electronAPI || null) as ElectronBridge | null;
}

function formatStatusDate(value?: string | null): string {
  if (!value) {
    return '-';
  }
  try {
    return new Date(value).toLocaleString('pl-PL');
  } catch {
    return value;
  }
}

export default function LoginPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const [serviceBusy, setServiceBusy] = useState<ServiceAction>(null);
  const [serviceInfo, setServiceInfo] = useState('');
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);

  const electronBridge = useMemo(() => getElectronBridge(), []);
  const isElectron = !!electronBridge;

  const refreshEngineStatus = useCallback(async () => {
    if (!electronBridge) {
      return;
    }
    setServiceBusy('refresh');
    try {
      const status = await electronBridge.getEngineStatus();
      setEngineStatus(status);
      setServiceInfo('Status silnika odświeżony.');
    } catch (err) {
      setServiceInfo(err instanceof Error ? err.message : 'Nie udało się pobrać statusu silnika.');
    } finally {
      setServiceBusy(null);
    }
  }, [electronBridge]);

  useEffect(() => {
    const run = async () => {
      try {
        const status = await checkSetupStatus();
        applyRuntimeApiBaseFromSetupStatus(status);
        if (status.setupMode) {
          window.location.href = '/setup';
          return;
        }
      } catch {
        // If setup-status temporarily fails, keep login form available.
      }

      const params = new URLSearchParams(window.location.search);
      const prefillEmail = params.get('email');
      if (prefillEmail) {
        setEmail(prefillEmail);
      }

      if (electronBridge) {
        try {
          const status = await electronBridge.getEngineStatus();
          setEngineStatus(status);
        } catch (err) {
          setServiceInfo(err instanceof Error ? err.message : 'Nie udało się pobrać statusu silnika.');
        }
      }

      setLoading(false);
    };

    void run();
  }, [electronBridge]);

  useEffect(() => {
    if (!electronBridge) {
      return;
    }

    return electronBridge.onBackendCrashed(() => {
      setServiceInfo('Silnik został zatrzymany. Użyj „Restart silnika” lub „Szybka naprawa”.');
      void refreshEngineStatus();
    });
  }, [electronBridge, refreshEngineStatus]);

  useEffect(() => {
    if (!electronBridge?.onBackendWatchdog) {
      return;
    }

    return electronBridge.onBackendWatchdog((payload) => {
      if (!payload) {
        return;
      }
      setServiceInfo(payload.message || 'Watchdog wykonał akcję serwisową.');
      if (payload.status) {
        setEngineStatus(payload.status);
      } else {
        void refreshEngineStatus();
      }
    });
  }, [electronBridge, refreshEngineStatus]);

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logowanie nie powiodło się.');
      if (electronBridge) {
        void refreshEngineStatus();
      }
    } finally {
      setBusy(false);
    }
  };

  const runRestart = async () => {
    if (!electronBridge) {
      return;
    }
    setServiceBusy('restart');
    try {
      const result = await electronBridge.restartEngine();
      setEngineStatus(result.status);
      setServiceInfo(result.message);
    } catch (err) {
      setServiceInfo(err instanceof Error ? err.message : 'Restart silnika nie powiódł się.');
    } finally {
      setServiceBusy(null);
    }
  };

  const runQuickRepair = async () => {
    if (!electronBridge) {
      return;
    }
    setServiceBusy('repair');
    try {
      const result = await electronBridge.quickRepairEngine();
      setEngineStatus(result.status);
      setServiceInfo(result.message);
    } catch (err) {
      setServiceInfo(err instanceof Error ? err.message : 'Szybka naprawa nie powiodła się.');
    } finally {
      setServiceBusy(null);
    }
  };

  const openLogs = async () => {
    if (!electronBridge) {
      return;
    }
    setServiceBusy('logs');
    try {
      const result = await electronBridge.openLogsFolder();
      setServiceInfo(result.message);
    } catch (err) {
      setServiceInfo(err instanceof Error ? err.message : 'Nie udało się otworzyć folderu logów.');
    } finally {
      setServiceBusy(null);
    }
  };

  const saveDiagnostics = async () => {
    if (!electronBridge) {
      return;
    }
    setServiceBusy('diagnostics');
    try {
      const result = await electronBridge.createEngineDiagnostics();
      setServiceInfo(`${result.message} ${result.reportPath}`);
    } catch (err) {
      setServiceInfo(err instanceof Error ? err.message : 'Nie udało się zapisać raportu diagnostycznego.');
    } finally {
      setServiceBusy(null);
    }
  };

  const runFactoryReset = async () => {
    if (!electronBridge?.factoryReset) {
      return;
    }
    const confirmation = window.prompt(
      'To usunie lokalną bazę i konfigurację oraz uruchomi setup od nowa. Wpisz RESET aby potwierdzić.',
      '',
    );
    if (confirmation !== 'RESET') {
      setServiceInfo('Reset anulowany.');
      return;
    }

    setServiceBusy('factoryReset');
    try {
      const result = await electronBridge.factoryReset();
      setEngineStatus(result.status);
      setServiceInfo(result.message);
      if (result.success) {
        setTimeout(() => {
          window.location.href = '/setup?fresh=1';
        }, 400);
      }
    } catch (err) {
      setServiceInfo(err instanceof Error ? err.message : 'Reset systemu nie powiódł się.');
    } finally {
      setServiceBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
          <p className="text-sm text-slate-600">Sprawdzam konfigurację systemu...</p>
        </div>
      </div>
    );
  }

  const engineBadgeClass = engineStatus?.healthy
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-red-100 text-red-700';

  return (
    <div className="min-h-screen bg-[var(--ts-bg)] px-4 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2">
        <section className="ticket-surface rounded-2xl border border-slate-200 p-6">
          <h1 className="text-2xl font-bold text-slate-900">Logowanie</h1>
          <p className="mt-1 text-sm text-slate-600">Panel admina i techników serwisu.</p>

          <form className="mt-5 space-y-3" onSubmit={submitLogin}>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="E-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Hasło"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {busy ? 'Logowanie...' : 'Zaloguj'}
            </button>
          </form>
        </section>

        <section className="ticket-surface rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Narzędzia serwisowe</h2>
          <p className="mt-1 text-sm text-slate-600">
            Szybkie akcje gdy silnik serwera lub baza działają niestabilnie.
          </p>

          {!isElectron && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Te narzędzia są dostępne w aplikacji instalatora (desktop). W przeglądarce pozostaje tylko logowanie.
            </div>
          )}

          {isElectron && (
            <>
              <div className="mt-5 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Stan silnika</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${engineBadgeClass}`}>
                    {engineStatus?.healthy ? 'ONLINE' : 'AWARIA'}
                  </span>
                </div>
                <div>Proces: {engineStatus?.running ? `DZIAŁA (PID ${engineStatus.pid ?? '-'})` : 'NIE DZIAŁA'}</div>
                <div>Port: {engineStatus?.port ?? '-'}</div>
                <div>Start: {formatStatusDate(engineStatus?.lastStartAt)}</div>
                <div>Ostatnie wyjście: {formatStatusDate(engineStatus?.lastExitAt)}</div>
                <div className="break-all">Błąd: {engineStatus?.lastError || engineStatus?.probeError || '-'}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void refreshEngineStatus()}
                  disabled={serviceBusy !== null}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  {serviceBusy === 'refresh' ? 'Odświeżam...' : 'Odśwież status'}
                </button>
                <button
                  type="button"
                  onClick={() => void runRestart()}
                  disabled={serviceBusy !== null}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {serviceBusy === 'restart' ? 'Restart...' : 'Restart silnika'}
                </button>
                <button
                  type="button"
                  onClick={() => void runQuickRepair()}
                  disabled={serviceBusy !== null}
                  className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-60"
                >
                  {serviceBusy === 'repair' ? 'Naprawiam...' : 'Szybka naprawa'}
                </button>
                <button
                  type="button"
                  onClick={() => void openLogs()}
                  disabled={serviceBusy !== null}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  {serviceBusy === 'logs' ? 'Otwieram...' : 'Otwórz logi'}
                </button>
                <button
                  type="button"
                  onClick={() => void saveDiagnostics()}
                  disabled={serviceBusy !== null}
                  className="col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  {serviceBusy === 'diagnostics' ? 'Zapisuję...' : 'Zapisz raport diagnostyczny'}
                </button>
                <button
                  type="button"
                  onClick={() => void runFactoryReset()}
                  disabled={serviceBusy !== null}
                  className="col-span-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  {serviceBusy === 'factoryReset' ? 'Resetuję...' : 'Reset systemu (setup od nowa)'}
                </button>
              </div>

              {serviceInfo && <p className="mt-3 text-sm text-slate-700">{serviceInfo}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
