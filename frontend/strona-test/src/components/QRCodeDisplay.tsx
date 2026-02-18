import React, { useState, useEffect } from 'react';
import { Copy, Check, Download, AlertCircle } from 'lucide-react';

interface QRCodeDisplayProps {
  ticketId: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ ticketId }) => {
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateQR();
  }, [ticketId]);

  const generateQR = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/tickets/${ticketId}/generate-qr`, {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.success) {
        setQrData(result.data);
      } else {
        setError('Nie udało się wygenerować kodu QR');
      }
    } catch (err) {
      setError('Błąd połączenia: ' + (err instanceof Error ? err.message : 'Nieznany błąd'));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (qrData?.qrToken) {
      await navigator.clipboard.writeText(qrData.qrToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadQR = async () => {
    if (qrData?.qrImage) {
      const link = document.createElement('a');
      link.href = qrData.qrImage;
      link.download = `ticket-${ticketId}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <span className="text-red-700 text-sm">{error}</span>
      </div>
    );
  }

  if (!qrData) {
    return null;
  }

  return (
    <div className="space-y-4 p-6 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Kod QR</h3>
        <div className="flex gap-2">
          <button
            onClick={downloadQR}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Pobierz kod QR"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* QR Code Image */}
      <div className="flex justify-center bg-white p-4 rounded-lg border border-gray-300">
        <img 
          src={qrData.qrImage} 
          alt={`QR Code for Ticket ${ticketId}`}
          className="w-64 h-64"
        />
      </div>

      {/* Token Display */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Token nagłośnienia</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={qrData.qrToken}
            readOnly
            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono text-gray-600"
          />
          <button
            onClick={copyToClipboard}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Skopiuj token"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Copy className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Public URL */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Publiczny link</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={qrData.publicUrl}
            readOnly
            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-blue-600 truncate"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(qrData.publicUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Skopiuj link"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Copy className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Expiration Info */}
      <div className="text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-200">
        <span>Ważny do: {new Date(qrData.expiresAt).toLocaleDateString('pl-PL')}</span>
        <button
          onClick={generateQR}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Odśwież kod
        </button>
      </div>
    </div>
  );
};
