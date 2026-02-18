import React, { useState } from 'react';
import { DollarSign, Edit2, Trash2, Plus, Check, X } from 'lucide-react';

interface VATRate {
  id: string;
  rate: number;
  label: string;
  description: string;
  isActive: boolean;
}

export const VATRates: React.FC = () => {
  const [rates, setRates] = useState<VATRate[]>([
    {
      id: '1',
      rate: 0,
      label: 'Zwolnienie z VAT',
      description: 'Towary i usługi zwolnione z podatku VAT',
      isActive: true,
    },
    {
      id: '2',
      rate: 5,
      label: 'Stawka obniżona (5%)',
      description: 'Podstawowe artykuły żywnościowe, leki, książki',
      isActive: true,
    },
    {
      id: '3',
      rate: 8,
      label: 'Stawka obniżona (8%)',
      description: 'Usługi publiczne, oprawy, paliwo do ogrzewania',
      isActive: true,
    },
    {
      id: '4',
      rate: 23,
      label: 'Stawka standardowa (23%)',
      description: 'Większość towarów i usług',
      isActive: true,
    },
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRate, setNewRate] = useState({ rate: 0, label: '', description: '' });
  const [editValues, setEditValues] = useState<{ [key: string]: number }>({});

  const handleToggleActive = (id: string) => {
    setRates(rates.map(r => (r.id === id ? { ...r, isActive: !r.isActive } : r)));
  };

  const handleStartEdit = (id: string, rate: number) => {
    setEditingId(id);
    setEditValues({ ...editValues, [id]: rate });
  };

  const handleSaveEdit = (id: string) => {
    const newRate = editValues[id];
    if (newRate !== undefined && newRate >= 0) {
      setRates(rates.map(r => (r.id === id ? { ...r, rate: newRate } : r)));
      setEditingId(null);
    }
  };

  const handleAddRate = () => {
    if (newRate.rate >= 0 && newRate.label && newRate.description) {
      setRates([
        ...rates,
        {
          id: String(rates.length + 1),
          rate: newRate.rate,
          label: newRate.label,
          description: newRate.description,
          isActive: true,
        },
      ]);
      setNewRate({ rate: 0, label: '', description: '' });
      setShowAddModal(false);
    }
  };

  const handleDeleteRate = (id: string) => {
    setRates(rates.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-blue-600" />
          Stawki VAT
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Dodaj stawkę
        </button>
      </div>

      {/* Add Rate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Dodaj nową stawkę VAT</h2>
            <div className="space-y-4">
              <input
                type="number"
                placeholder="Stawka (%)"
                min="0"
                max="100"
                value={newRate.rate}
                onChange={(e) => setNewRate({ ...newRate, rate: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Nazwa stawki"
                value={newRate.label}
                onChange={(e) => setNewRate({ ...newRate, label: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Opis stawki"
                value={newRate.description}
                onChange={(e) => setNewRate({ ...newRate, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleAddRate}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Dodaj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VAT Rates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rates.map(vat => (
          <div key={vat.id} className={`p-6 rounded-xl shadow-sm border-2 transition ${vat.isActive ? 'bg-white border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                {editingId === vat.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editValues[vat.id]}
                      onChange={(e) => setEditValues({ ...editValues, [vat.id]: parseFloat(e.target.value) })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded"
                    />
                    <span className="text-2xl font-bold text-gray-800">%</span>
                  </div>
                ) : (
                  <p className="text-4xl font-bold text-blue-600">{vat.rate}%</p>
                )}
                <p className="text-sm text-gray-600 mt-2">{vat.label}</p>
              </div>
              <button
                onClick={() => handleToggleActive(vat.id)}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition flex items-center gap-1 ${
                  vat.isActive ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {vat.isActive ? (
                  <>
                    <Check className="w-4 h-4" />
                    Aktywna
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    Nieaktywna
                  </>
                )}
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4 border-t border-gray-200 pt-4">{vat.description}</p>

            <div className="flex gap-3">
              {editingId === vat.id ? (
                <>
                  <button
                    onClick={() => handleSaveEdit(vat.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition text-sm"
                  >
                    Zapisz
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg font-medium hover:bg-gray-50 transition text-sm"
                  >
                    Anuluj
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleStartEdit(vat.id, vat.rate)}
                    className="flex-1 text-blue-600 hover:text-blue-700 flex items-center justify-center gap-2 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edytuj
                  </button>
                  <button
                    onClick={() => handleDeleteRate(vat.id)}
                    className="flex-1 text-red-600 hover:text-red-700 flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Usuń
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Podsumowanie</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-2">Razem stawek</p>
            <p className="text-2xl font-bold text-gray-800">{rates.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-2">Aktywne</p>
            <p className="text-2xl font-bold text-green-600">{rates.filter(r => r.isActive).length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-2">Średnia stawka</p>
            <p className="text-2xl font-bold text-blue-600">
              {(rates.reduce((sum, r) => sum + r.rate, 0) / rates.length).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
