'use client';

import { useEffect, useState } from 'react';

interface QRCodeDisplayProps {
  data: {
    apiBase: string;
    token: string;
  };
}

/**
 * QR Code Display Component
 * Shows QR code for iOS pairing
 */
export default function QRCodeDisplay({ data }: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Dynamically load qrcode library to avoid SSR issues
    const generateQR = async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const qrString = JSON.stringify(data);
        const dataUrl = await QRCode.toDataURL(qrString, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateQR();
  }, [data]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6">
      <h3 className="text-xl font-semibold text-gray-800">
        Scan with Your iPhone
      </h3>

      {isLoading ? (
        <div className="w-80 h-80 bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Generating QR code...</p>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR code for iPhone pairing" className="w-[300px] h-[300px] object-contain" />
          ) : (
            <div className="w-[300px] h-[300px] flex items-center justify-center text-sm text-gray-500">
              QR generation failed
            </div>
          )}
        </div>
      )}

      <div className="text-center text-sm text-gray-600 max-w-md">
        <p className="mb-2">Scan this QR code with your iPhone to connect to the system.</p>
        <p className="text-xs">
          API Base: <code className="bg-gray-100 px-2 py-1 rounded">{data.apiBase}</code>
        </p>
      </div>
    </div>
  );
}
