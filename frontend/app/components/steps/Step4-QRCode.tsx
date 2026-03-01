'use client';

import { useEffect, useState } from 'react';
import QRCodeDisplay from '../QRCodeDisplay';
import { SetupResponse } from '@/lib/setup-client';

interface Step4Props {
  result: SetupResponse;
  installationMode: 'server_client' | 'client_only';
  remoteApiBaseUrl?: string;
  onNewSetup: () => void;
  onContinueToDashboard: () => void;
}

export function InitStep4({
  result,
  installationMode,
  remoteApiBaseUrl,
  onNewSetup,
  onContinueToDashboard,
}: Step4Props) {
  const [copyFeedback, setCopyFeedback] = useState('');
  const [localIp, setLocalIp] = useState<string>('localhost');
  const apiPort = typeof window !== 'undefined' ? window.location.port || '3000' : '3000';
  const explicitApiBase = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const getLocalIp = async () => {
      try {
        const bridge =
          typeof window !== 'undefined' ? (window as any).electron || (window as any).electronAPI : null;

        if (bridge?.getLocalIp) {
          const ip = await bridge.getLocalIp();
          setLocalIp(ip);
        } else {
          setLocalIp(window.location.hostname || 'localhost');
        }
      } catch {
        setLocalIp(window.location.hostname || 'localhost');
      }
    };

    void getLocalIp();
  }, []);

  const resolvedApiBase = explicitApiBase
    ? explicitApiBase.replace('127.0.0.1', localIp).replace('localhost', localIp)
    : installationMode === 'client_only' && remoteApiBaseUrl
      ? remoteApiBaseUrl
      : `http://${localIp}:${apiPort}`;

  const qrData = {
    apiBase: resolvedApiBase,
    token: 'temporary-pairing-token',
  };

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(''), 2200);
    }
  };

  const hasGeneratedKey = Boolean(result.backupEncryptionKeyGenerated);
  const backupKeyToDisplay = result.backupEncryptionKeyGenerated || result.backupEncryptionKeyHint || '';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 p-5">
        <h2 className="text-2xl font-bold text-emerald-700">
          {installationMode === 'client_only' ? 'Klient gotowy do pracy' : 'System skonfigurowany poprawnie'}
        </h2>
        <p className="mt-1 text-sm text-emerald-900">
          {installationMode === 'client_only'
            ? 'Połączenie z serwerem zapisane. Możesz od razu przejść do logowania.'
            : 'Silnik, baza i panel zostały uruchomione. Poniżej masz komplet informacji startowych.'}
        </p>
      </div>

      {installationMode !== 'client_only' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Połącz iPhone</p>
            <div className="mt-3 flex justify-center rounded-lg border border-slate-100 bg-slate-50 p-4">
              <QRCodeDisplay data={qrData} />
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parametry systemu</p>
            <div className="space-y-1 text-sm text-slate-700">
              <p>
                <strong>API:</strong>{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{resolvedApiBase}</code>
              </p>
              <p>
                <strong>Tryb:</strong> Serwer + klient
              </p>
              <p>
                <strong>Admin:</strong> {result.adminEmail || '-'}
              </p>
              <p>
                <strong>Lokalizacja danych:</strong>{' '}
                <span className="break-all font-mono text-xs">{result.configPath || '-'}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(resolvedApiBase, 'API')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {copyFeedback === 'API' ? 'Skopiowano adres API' : 'Kopiuj adres API'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Klient będzie łączył się z adresem:{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">
            {remoteApiBaseUrl || result.remoteApiBaseUrl || resolvedApiBase}
          </code>
        </div>
      )}

      {installationMode !== 'client_only' && backupKeyToDisplay ? (
        <div
          className={`rounded-xl border p-4 ${
            hasGeneratedKey ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <p className={`text-sm font-semibold ${hasGeneratedKey ? 'text-red-800' : 'text-amber-900'}`}>
            {hasGeneratedKey ? 'WAŻNE: Klucz odzyskiwania backupu' : 'Klucz backupu (podpowiedź)'}
          </p>
          <p className={`mt-1 text-xs ${hasGeneratedKey ? 'text-red-700' : 'text-amber-800'}`}>
            {hasGeneratedKey
              ? 'Zapisz ten klucz poza systemem (np. manager haseł). Bez niego nie odtworzysz zaszyfrowanego backupu.'
              : 'System używa klucza skonfigurowanego wcześniej. Zachowaj go do przyszłego odtwarzania danych.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded bg-white px-2 py-1 font-mono text-xs text-slate-800">{backupKeyToDisplay}</code>
            {hasGeneratedKey ? (
              <button
                type="button"
                onClick={() => copyToClipboard(backupKeyToDisplay, 'KEY')}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                {copyFeedback === 'KEY' ? 'Skopiowano klucz' : 'Kopiuj klucz'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Podsumowanie</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li>✓ Konfiguracja została zapisana.</li>
          <li>✓ Silnik uruchomi się automatycznie po starcie aplikacji.</li>
          <li>✓ Backup zawiera bazę + zdjęcia w jednym pliku.</li>
          <li>✓ W każdej chwili możesz wrócić do konfiguracji w panelu administratora.</li>
        </ul>
      </div>

      <div className="space-y-3">
        <button
          onClick={onContinueToDashboard}
          className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Zaczynamy →
        </button>
        <button
          onClick={onNewSetup}
          className="w-full rounded-xl border border-red-300 bg-white px-6 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Od nowa: uruchom kreator ponownie
        </button>
      </div>
    </div>
  );
}
