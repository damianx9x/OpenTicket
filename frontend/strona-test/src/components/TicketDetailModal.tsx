import React, { useState } from 'react';
import { X, Lock, Trash2, Send, Mail, Image, Plus } from 'lucide-react';
import { Ticket, STATUSES, PRIORITIES, AGENTS } from '../types';
import { dataStore } from '../services/dataStore';
import { QRCodeDisplay } from './QRCodeDisplay';

interface TicketDetailModalProps {
  ticket: Ticket;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onRefresh
}) => {
  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [newCostItem, setNewCostItem] = useState({
    description: '',
    quantity: 1,
    unitPrice: 0,
    vat: 23
  });
  const [photos, setPhotos] = useState<string[]>([
    'Photo_1',
    'Photo_2',
    'Photo_3'
  ]);

  if (!isOpen || !ticket) return null;

  const handleAddComment = () => {
    if (newComment.trim()) {
      dataStore.addComment(ticket.id, 'Anna Nowak (Agent)', newComment, isInternalNote);
      setNewComment('');
      setIsInternalNote(false);
      onRefresh();
    }
  };

  const handleAddCostItem = () => {
    if (newCostItem.description && newCostItem.quantity > 0 && newCostItem.unitPrice > 0) {
      dataStore.addCostItem(
        ticket.id,
        newCostItem.description,
        newCostItem.quantity,
        newCostItem.unitPrice,
        newCostItem.vat
      );
      setNewCostItem({ description: '', quantity: 1, unitPrice: 0, vat: 23 });
      onRefresh();
    }
  };

  const handleDeleteComment = (commentId: string) => {
    dataStore.deleteComment(ticket.id, commentId);
    onRefresh();
  };

  const handleDeleteCostItem = (costItemId: string) => {
    dataStore.deleteCostItem(ticket.id, costItemId);
    onRefresh();
  };

  const handleStatusChange = (newStatus: string) => {
    dataStore.updateTicket(ticket.id, { status: newStatus as any });
    onRefresh();
  };

  const handlePriorityChange = (newPriority: string) => {
    dataStore.updateTicket(ticket.id, { priority: newPriority as any });
    onRefresh();
  };

  const handleAssigneeChange = (newAssignee: string) => {
    dataStore.updateTicket(ticket.id, { assignedTo: newAssignee });
    onRefresh();
  };

  const updatedTicket = dataStore.getTicketById(ticket.id)!;
  const totalCost = updatedTicket.costItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${isOpen ? 'flex' : 'hidden'} justify-end transition-opacity duration-300`}>
      <div className="bg-white w-full md:w-2/3 lg:w-1/2 h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        {/* Modal Header */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-gray-50">
          <div>
            <span className="text-xs font-mono text-gray-500">#{updatedTicket.id}</span>
            <h2 className="text-lg font-bold text-gray-800">{updatedTicket.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                    {updatedTicket.customerName.substring(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{updatedTicket.customerName}</p>
                    <p className="text-xs text-gray-400">Zgłoszono: {updatedTicket.createdAt.toLocaleString('pl-PL')}</p>
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{updatedTicket.description}</p>
                <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                  <p><strong>Urządzenie:</strong> {updatedTicket.deviceType}</p>
                  <p><strong>Nr seryjny:</strong> {updatedTicket.serialNumber}</p>
                  <p><strong>Tel:</strong> {updatedTicket.customerPhone}</p>
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-4">
                {updatedTicket.comments.length > 0 && (
                  <div className="space-y-3">
                    {updatedTicket.comments.map(comment => (
                      <div
                        key={comment.id}
                        className={`flex gap-3 ${comment.isInternal ? 'justify-start' : 'justify-start'}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          comment.isInternal ? 'bg-yellow-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                          {comment.isInternal ? <Lock className="w-4 h-4" /> : 'AN'}
                        </div>
                        <div className={`${comment.isInternal ? 'bg-yellow-50 border-yellow-100' : 'bg-blue-50 border-blue-100'} p-3 rounded-lg border w-full`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-xs font-bold ${comment.isInternal ? 'text-yellow-800' : 'text-blue-800'}`}>
                              {comment.author}
                              {comment.isInternal && ' (Notatka Wewnętrzna)'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${comment.isInternal ? 'text-yellow-600' : 'text-blue-400'}`}>{comment.createdAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-gray-400 hover:text-red-600 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700">{comment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New Comment */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <label className="text-xs text-gray-500 block mb-2">Dodaj nowy komentarz</label>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Napisz odpowiedź..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-600">Notatka wewnętrzna</span>
                    </label>
                    <button
                      onClick={handleAddComment}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Wyślij
                    </button>
                  </div>
                </div>
              </div>

              {/* Photos Gallery */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Zdjęcia z przyjęcia
                  </h3>
                  <button className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center gap-1 transition">
                    <Plus className="w-3 h-3" />
                    Dodaj
                  </button>
                </div>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, idx) => (
                      <div
                        key={idx}
                        className="aspect-square bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer transition group relative"
                      >
                        <div className="text-center text-gray-600 group-hover:text-blue-600 transition">
                          <Image className="w-6 h-6 mx-auto mb-1" />
                          <p className="text-xs">{photo}</p>
                        </div>
                        <button
                          onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
                    <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Brak zdjęć z przyjęcia</p>
                  </div>
                )}
              </div>

              {/* Costs */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800">Pozycje Kosztów</h3>
                  <button
                    onClick={() => alert('Wysyłanie kosztorysu do ' + updatedTicket.customerName + ' na adres: ' + updatedTicket.customerPhone)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition flex items-center gap-2"
                  >
                    <Mail className="w-3 h-3" />
                    Wyślij kosztorys
                  </button>
                </div>
                {updatedTicket.costItems.length > 0 && (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-xs mb-3">
                      <thead className="border-b border-gray-200">
                        <tr>
                          <th className="text-left py-2 px-2">Opis</th>
                          <th className="text-right py-2 px-2">Ilość</th>
                          <th className="text-right py-2 px-2">Cena j.</th>
                          <th className="text-right py-2 px-2">VAT</th>
                          <th className="text-right py-2 px-2">Razem</th>
                          <th className="text-center py-2 px-2">Akcja</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        {updatedTicket.costItems.map(item => (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-2">{item.description}</td>
                            <td className="text-right py-2 px-2">{item.quantity}</td>
                            <td className="text-right py-2 px-2">{item.unitPrice} PLN</td>
                            <td className="text-right py-2 px-2">{item.vat}%</td>
                            <td className="text-right py-2 px-2 font-bold">{item.total.toFixed(2)} PLN</td>
                            <td className="text-center py-2 px-2">
                              <button
                                onClick={() => handleDeleteCostItem(item.id)}
                                className="text-red-500 hover:text-red-700 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 font-bold text-gray-800">
                          <td colSpan={4} className="py-2 px-2 text-right">Razem:</td>
                          <td className="text-right py-2 px-2">{totalCost.toFixed(2)} PLN</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="grid grid-cols-5 gap-2">
                  <input type="text" placeholder="Opis" value={newCostItem.description} onChange={(e) => setNewCostItem({ ...newCostItem, description: e.target.value })} className="col-span-2 px-2 py-1 border border-gray-300 rounded text-xs" />
                  <input type="number" placeholder="Ilość" min="1" value={newCostItem.quantity} onChange={(e) => setNewCostItem({ ...newCostItem, quantity: parseInt(e.target.value) || 1 })} className="px-2 py-1 border border-gray-300 rounded text-xs" />
                  <input type="number" placeholder="Cena" min="0" value={newCostItem.unitPrice} onChange={(e) => setNewCostItem({ ...newCostItem, unitPrice: parseFloat(e.target.value) || 0 })} className="px-2 py-1 border border-gray-300 rounded text-xs" />
                  <button onClick={handleAddCostItem} className="bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition">Dodaj</button>
                </div>
              </div>
            </div>

            {/* Right Column: Management */}
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 sticky top-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Zarządzanie</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                    <select
                      value={updatedTicket.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Priorytet</label>
                    <select
                      value={updatedTicket.priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    >
                      {PRIORITIES.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Przypisany Agent</label>
                    <select
                      value={updatedTicket.assignedTo}
                      onChange={(e) => handleAssigneeChange(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {AGENTS.map(agent => (
                        <option key={agent} value={agent}>{agent}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Informacje</h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-gray-500">Urządzenie</p>
                    <p className="font-semibold text-gray-800">{updatedTicket.deviceType}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Nr seryjny</p>
                    <p className="font-semibold text-gray-800 font-mono">{updatedTicket.serialNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Szacunkowy koszt</p>
                    <p className="font-bold text-blue-600 text-lg">{totalCost.toFixed(2)} PLN</p>
                  </div>
                </div>
              </div>

              {/* QR Code Display */}
              <QRCodeDisplay ticketId={updatedTicket.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
