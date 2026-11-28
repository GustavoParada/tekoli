import React, { useState, useEffect } from 'react';
import { X, MapPin, Shield, Zap, Sparkles, Hash, Server, FileText } from 'lucide-react';
import { Rathole, RatholeStatus } from '../types/rathole';

interface RatholeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rathole: Rathole) => void;
  initialData?: Rathole | null;
  suggestedNumber?: number;
}

export const RatholeModal: React.FC<RatholeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  suggestedNumber = 1,
}) => {
  const [numero, setNumero] = useState<number>(suggestedNumber);
  const [name, setName] = useState<string>('');
  const [coordX, setCoordX] = useState<number>(12.0);
  const [coordY, setCoordY] = useState<number>(20.0);
  const [owner, setOwner] = useState<string>('');
  const [coOwner, setCoOwner] = useState<string>('');
  const [tp, setTp] = useState<string>('');
  const [server, setServer] = useState<string>('The Island #104');
  const [status, setStatus] = useState<RatholeStatus>('ocupado');
  const [turretsCount, setTurretsCount] = useState<number>(12);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (initialData) {
      setNumero(initialData.numero);
      setName(initialData.name);
      setCoordX(initialData.coords.x);
      setCoordY(initialData.coords.y);
      setOwner(initialData.owner);
      setCoOwner(initialData.coOwner);
      setTp(initialData.tp);
      setServer(initialData.server || 'The Island #104');
      setStatus(initialData.status);
      setTurretsCount(initialData.turretsCount || 0);
      setNotes(initialData.notes || '');
    } else {
      setNumero(suggestedNumber);
      setName(`Rathole #${suggestedNumber}`);
      setCoordX(12.0);
      setCoordY(20.0);
      setOwner('');
      setCoOwner('');
      setTp(`TP-RH-${suggestedNumber < 10 ? '0' + suggestedNumber : suggestedNumber}`);
      setServer('The Island #104');
      setStatus('ocupado');
      setTurretsCount(10);
      setNotes('');
    }
  }, [initialData, suggestedNumber, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRathole: Rathole = {
      id: initialData ? initialData.id : `rh-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      numero: Number(numero),
      name: name.trim() || `Rathole #${numero}`,
      coords: {
        x: parseFloat(Number(coordX).toFixed(1)),
        y: parseFloat(Number(coordY).toFixed(1)),
      },
      owner: owner.trim() || 'Sem Dono',
      coOwner: coOwner.trim() || 'Nenhum',
      tp: tp.trim() || `TP-RH-${numero}`,
      server: server.trim() || 'The Island',
      status,
      turretsCount: Number(turretsCount) || 0,
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    onSave(finalRathole);
    onClose();
  };

  const fillAutoTp = (format: 'code' | 'command') => {
    if (format === 'code') {
      const pad = numero < 10 ? `0${numero}` : `${numero}`;
      setTp(`TP-RH-${pad}`);
    } else {
      setTp(`/tp ${coordX} ${coordY}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {initialData ? `Edit Rathole #${initialData.numero}` : 'Add a new rathole'}
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  MongoDB Ready
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                TEKOli answers owner, TP, and proximity questions from this data.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                Rathole number
              </label>
              <input
                type="number"
                required
                min={1}
                value={numero}
                onChange={(e) => setNumero(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Name / tactical nickname
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Central waterfall crack"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          {/* Coordenadas (xx, yy) */}
          <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                GPS (latitude, longitude) — same order as the radar map
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                GPS: ({Number(coordX).toFixed(1)}, {Number(coordY).toFixed(1)})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Latitude — top to bottom (left numbers):</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={coordX}
                  onChange={(e) => setCoordX(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Longitude — left to right (top numbers):</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={coordY}
                  onChange={(e) => setCoordY(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Owner and Co-Owner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                👑 Primary owner
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Gustavo Parada"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                🛡️ Co-owner (partner)
              </label>
              <input
                type="text"
                placeholder="Ex: Valkyrie / SniperWolf"
                value={coOwner}
                onChange={(e) => setCoOwner(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          {/* TP (Teleport) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Teleport (TP / bed name / command)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fillAutoTp('code')}
                  className="text-[11px] text-zinc-400 hover:text-indigo-400 hover:underline"
                >
                  Use TP-RH-{numero}
                </button>
                <span className="text-zinc-600">•</span>
                <button
                  type="button"
                  onClick={() => fillAutoTp('command')}
                  className="text-[11px] text-zinc-400 hover:text-indigo-400 hover:underline"
                >
                  Use /tp X Y
                </button>
              </div>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. TP-RH-03 or /tp 12.4 20.2 or Bed_Rathole3"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Server & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-zinc-400" />
                Server / map
              </label>
              <input
                type="text"
                placeholder="Ex: The Island #104"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RatholeStatus)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="ocupado">🔒 Occupied</option>
                <option value="Builded">🏗️ Built</option>
                <option value="livre">🟢 Open</option>
                <option value="aliado">🛡️ Ally</option>
                <option value="em_raid">🚨 Under raid</option>
                <option value="reserva">📦 Reserve / backup</option>
                {!['ocupado', 'Builded', 'livre', 'aliado', 'em_raid', 'reserva'].includes(status) && (
                  <option value={status}>🏷️ {status}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Active heavy turrets</label>
              <input
                type="number"
                min="0"
                value={turretsCount}
                onChange={(e) => setTurretsCount(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              Tactical notes, access & defense
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Crouch in behind the waterfall. Keep the generator fueled. Bring a cryopod."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Save to database
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
