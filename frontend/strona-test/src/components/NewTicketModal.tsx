import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import { DEVICE_TYPES, PRIORITIES } from '../types';
import { ticketsAPI } from '../services/api';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ticketId: string) => void;
}

export const NewTicketModal: React.FC<NewTicketModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'customer' | 'device' | 'issue' | 'review'> ('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    deviceType: 'Inne',
    deviceSN: '',
    title: '',
    description: '',
    priority: 'normal',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 'customer':
        if (!formData.customerName || !formData.customerPhone) {
          setError('Imię i telefon są wymagane');
          return false;
        }
        return true;
      case 'device':
        if (!formData.deviceType || formData.deviceType === 'Inne') {
          setError('Wybierz typ urządzenia');
          return false;
        }
        return true;
      case 'issue':
        if (!formData.title || !formData.description) {
          setError('Tytuł i opis są wymagane');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNextStep = () => {
    if (!validateStep()) return;

    const steps: Array<'customer' | 'device' | 'issue' | 'review'> = ['customer', 'device', 'issue', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handlePrevStep = () => {
    const steps: Array<'customer' | 'device' | 'issue' | 'review'> = ['customer', 'device', 'issue', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await ticketsAPI.create({
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        deviceType: formData.deviceType,
        deviceSN: formData.deviceSN,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
      });

      if (response.success && response.data?.id) {
        onSuccess(response.data.id);
        onClose();
      } else {
        setError(response.error || 'Błąd przy tworzeniu zgłoszenia');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-90vh overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Nowe Zgłoszenie</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between mb-2">
            {['customer', 'device', 'issue', 'review'].map((s, idx) => (
              <div
                key={s}
                className={`flex-1 h-2 mx-1 rounded-full ${
                  ['customer', 'device', 'issue', 'review'].indexOf(step) >= idx ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <div className="text-xs text-gray-600 text-center">
            {step === 'customer' && '1/4 - Dane Klienta'}
            {step === 'device' && '2/4 - Urządzenie'}
            {step === 'issue' && '3/4 - Problem'}
            {step === 'review' && '4/4 - Podsumowanie'}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4">
          {step === 'customer' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imię i Nazwisko *</label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="np. Jan Kowalski"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="customerEmail"
                  value={formData.customerEmail}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="jan@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon *</label>
                <input
                  type="tel"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+48 123 456 789"
                />
              </div>
            </div>
          )}

          {step === 'device' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ Urządzenia *</label>
                <select
                  name="deviceType"
                  value={formData.deviceType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Wybierz --</option>
                  {DEVICE_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numer Seryjny (SN)</label>
                <input
                  type="text"
                  name="deviceSN"
                  value={formData.deviceSN}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="np. C02A1234567890"
                />
              </div>
            </div>
          )}

          {step === 'issue' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł Problemu *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="np. Nie włącza się"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opis Problemu *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Opisz dokładnie co się stało, kiedy to się zaczęło, co próbowałeś już robić..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priorytet</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Klient</p>
                  <p className="font-semibold">{formData.customerName}</p>
                  <p className="text-sm text-gray-600">{formData.customerPhone}</p>
                </div>
                <hr />
                <div>
                  <p className="text-xs text-gray-500 uppercase">Urządzenie</p>
                  <p className="font-semibold">{formData.deviceType}</p>
                  {formData.deviceSN && <p className="text-sm text-gray-600">SN: {formData.deviceSN}</p>}
                </div>
                <hr />
                <div>
                  <p className="text-xs text-gray-500 uppercase">Problem</p>
                  <p className="font-semibold">{formData.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{formData.description}</p>
                </div>
                <hr />
                <div>
                  <p className="text-xs text-gray-500 uppercase">Priorytet</p>
                  <p className="font-semibold capitalize">{formData.priority}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between gap-3">
          {step !== 'customer' && (
            <button
              onClick={handlePrevStep}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              ← Wstecz
            </button>
          )}

          {step !== 'review' ? (
            <button
              onClick={handleNextStep}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              Dalej →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Tworzenie...
                </>
              ) : (
                '✓ Utwórz Zgłoszenie'
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
};
