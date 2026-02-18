'use client';

import { useState } from 'react';
import { Folder } from 'lucide-react';

interface Step1Props {
  onContinue: (dataPath: string) => void;
  defaultValue: string;
}

/**
 * Step 1: Storage Location
 * User selects where to store data files (SQLite, uploads, configs)
 */
export function InitStep1({ onContinue, defaultValue }: Step1Props) {
  const [dataPath, setDataPath] = useState(defaultValue);
  const [useDefault, setUseDefault] = useState(!defaultValue);

  const getDefaultPath = (): string => {
    // These are examples - actual path depends on OS
    const platform = typeof navigator !== 'undefined'
      ? navigator.platform
      : 'unknown';

    if (platform.includes('Mac')) {
      return '~/Library/Application Support/TicketSystem/data';
    } else if (platform.includes('Win')) {
      return 'C:\\Users\\YourName\\AppData\\Roaming\\TicketSystem\\data';
    } else {
      return '~/.local/share/ticket-system/data';
    }
  };

  const defaultPath = getDefaultPath();

  const handleChooseFolder = async () => {
    // This will be called from Electron's preload script
    if (typeof window !== 'undefined' && (window as any).electron?.selectFolder) {
      try {
        const selected = await (window as any).electron.selectFolder();
        if (selected) {
          setDataPath(selected);
          setUseDefault(false);
        }
      } catch (error) {
        console.error('Failed to select folder:', error);
      }
    } else {
      // Fallback: show message that this only works in Electron
      alert(
        'Folder selection requires the Electron wrapper.\n\n' +
        'For browser-based setup, enter the path manually or use: ' + defaultPath
      );
    }
  };

  const handleContinue = () => {
    const finalPath = useDefault ? defaultPath : dataPath;
    
    if (!finalPath || finalPath.trim().length === 0) {
      alert('Please select or enter a data storage path');
      return;
    }

    onContinue(finalPath);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          📁 Choose Storage Location
        </h2>
        <p className="text-gray-600">
          Select where to store your database, files, and configuration.
        </p>
      </div>

      <div className="space-y-4">
        {/* Default Location Option */}
        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="radio"
            checked={useDefault}
            onChange={() => setUseDefault(true)}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-medium text-gray-800">Use Default Location</p>
            <p className="text-sm text-gray-600 font-mono mt-1">{defaultPath}</p>
            <p className="text-xs text-gray-500 mt-2">
              ✓ Recommended for most users
            </p>
          </div>
        </label>

        {/* Custom Folder Selection */}
        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="radio"
            checked={!useDefault}
            onChange={() => setUseDefault(false)}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-medium text-gray-800">Custom Location</p>
            <p className="text-sm text-gray-600 mt-2">
              {dataPath || 'No path selected'}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleChooseFolder}
                disabled={useDefault}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Folder size={18} />
                Browse Folders
              </button>
              <p className="text-xs text-gray-500 self-center">
                (Available in Electron)
              </p>
            </div>
          </div>
        </label>

        {/* Manual Path Entry */}
        {!useDefault && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or paste path directly:
            </label>
            <input
              type="text"
              value={dataPath}
              onChange={(e) => setDataPath(e.target.value)}
              placeholder="/Users/name/AppData/Roaming/TicketSystem"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>ℹ️ About storage:</strong> All your data including tickets, files, and settings will be stored in this location. Make sure you have at least 1GB of free space.
        </p>
      </div>

      {/* Continue Button */}
      <button
        onClick={handleContinue}
        className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Continue to Admin Setup →
      </button>
    </div>
  );
}
