import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  MapPin,
  Edit2,
  Trash2,
  Copy,
  Check,
  MessageSquare,
  Database,
  Download,
  Upload,
  RefreshCw,
  Compass,
  Shield,
  Zap,
} from 'lucide-react';
import { Rathole, RatholeStatus } from '../types/rathole';

interface RatholeManagerProps {
  ratholes: Rathole[];
  onOpenCreateModal: () => void;
  onEditRathole: (rathole: Rathole) => void;
  onDeleteRathole: (id: string) => void;
  onOpenMongoConfig: () => void;
  onAskInDiscord: (question: string) => void;
  onNavigateToRadar: (coords?: { x: number; y: number }) => void;
  onResetDefaults: () => void;
  onImportJson: (imported: Rathole[]) => void;
}

export const RatholeManager: React.FC<RatholeManagerProps> = ({
  ratholes,
  onOpenCreateModal,
  onEditRathole,
  onDeleteRathole,
  onOpenMongoConfig,
  onAskInDiscord,
  onNavigateToRadar,
  onResetDefaults,
  onImportJson,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedTp, setCopiedTp] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyTp = (tp: string) => {
    navigator.clipboard.writeText(tp);
    setCopiedTp(tp);
    showToast(`⚡ TP "${tp}" copiado para a área de transferência!`);
    setTimeout(() => setCopiedTp(null), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(ratholes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `tekoli-ratholes-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('📁 Arquivo JSON de ratholes exportado!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportJson(parsed);
          showToast(`✅ ${parsed.length} ratholes importados com sucesso!`);
        }
      } catch (err: any) {
        showToast('❌ Erro ao importar JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const [memberFilterMode, setMemberFilterMode] = useState<'owner' | 'co_owner' | 'responsible'>('owner');

  const coOwnerExtraCount = search.trim()
    ? ratholes.filter((rh) => {
        if (filterStatus !== 'all' && rh.status !== filterStatus) return false;
        const q = search.toLowerCase().trim();
        return rh.coOwner.toLowerCase().includes(q) && !rh.owner.toLowerCase().includes(q);
      }).length
    : 0;

  const filtered = ratholes.filter((rh) => {
    if (filterStatus !== 'all' && rh.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const isNumOrTp = /^\d+$/.test(q) || q.startsWith('#') || q.startsWith('tp-');
      if (isNumOrTp) {
        return (
          rh.numero.toString().includes(q.replace('#', '')) ||
          rh.tp.toLowerCase().includes(q)
        );
      }
      if (memberFilterMode === 'owner') {
        // REGRA: se não especificar, filtra estritamente por Owner
        return rh.owner.toLowerCase().includes(q) || rh.name.toLowerCase().includes(q);
      } else if (memberFilterMode === 'co_owner') {
        return rh.coOwner.toLowerCase().includes(q);
      } else {
        // REGRA: responsavel filtra pelo owner e co:owner
        return rh.owner.toLowerCase().includes(q) || rh.coOwner.toLowerCase().includes(q) || rh.name.toLowerCase().includes(q);
      }
    }
    return true;
  });

  const getStatusBadge = (status: RatholeStatus) => {
    const normalized = String(status || '').toLowerCase();
    switch (normalized) {
      case 'ocupado':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">Ocupado</span>;
      case 'livre':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Livre</span>;
      case 'em_raid':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">Em Raid</span>;
      case 'aliado':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">Aliado</span>;
      case 'reserva':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">Reserva</span>;
      case 'builded':
      case 'built':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/40">🏗️ Builded</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/40">{status}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 p-4 md:p-6 overflow-y-auto relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-indigo-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-fadeIn">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-400">Total de Ratholes</div>
            <div className="text-xl font-bold text-white font-mono">{ratholes.length}</div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-400">Vagas / Livres</div>
            <div className="text-xl font-bold text-emerald-400 font-mono">
              {ratholes.filter((r) => r.status === 'livre').length}
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-400">Em Raid / Alerta</div>
            <div className="text-xl font-bold text-rose-400 font-mono">
              {ratholes.filter((r) => r.status === 'em_raid').length}
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-400">Coleção MongoDB</div>
            <div className="text-sm font-bold text-amber-300 font-mono truncate">ratholes</div>
          </div>
        </div>
      </div>

      {/* Control & Actions Bar */}
      <div className="flex flex-col gap-3 mb-4 bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input & Member Filter Modes */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  memberFilterMode === 'owner'
                    ? '👑 Filtrando por OWNER (padrão)... ex: Clutch, Joey, #3'
                    : memberFilterMode === 'co_owner'
                    ? '🛡️ Filtrando apenas por CO-OWNER... ex: Joey, Gameron'
                    : '👥 Filtrando por RESPONSÁVEL (Owner + Co-Owner)... ex: Joey, Oli'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-700/80 rounded-xl text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Member Selector */}
            <select
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-2.5 py-2 bg-zinc-950 border border-zinc-700/80 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Selecionar Jogador...</option>
              {Array.from(
                new Set(
                  ratholes
                    .flatMap((r) => [r.owner.split('(')[0].trim(), r.coOwner.split('(')[0].trim()])
                    .filter((n) => n && n !== 'Nenhum' && !n.toLowerCase().includes('livre'))
                )
              )
                .sort()
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>

            {/* Member Filter Mode Toggle: Owner (Padrão) vs Co-Owner vs Responsável */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setMemberFilterMode('owner')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  memberFilterMode === 'owner'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
                title="Padrão: filtra estritamente por Owner principal"
              >
                👑 Owner (Padrão)
              </button>
              <button
                type="button"
                onClick={() => setMemberFilterMode('co_owner')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  memberFilterMode === 'co_owner'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-400/80 hover:text-emerald-300'
                }`}
                title="Filtra estritamente por Co-Owner"
              >
                🛡️ Só Co-Owner
              </button>
              <button
                type="button"
                onClick={() => setMemberFilterMode('responsible')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  memberFilterMode === 'responsible'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-indigo-400/80 hover:text-indigo-300'
                }`}
                title="Filtra onde o jogador é Owner ou Co-Owner"
              >
                👥 Owner + Co-Owner
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenCreateModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              Novo Rathole
            </button>

          <button
            onClick={onOpenMongoConfig}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
            title="Conectar ou sincronizar com MongoDB Atlas"
          >
            <Database className="w-4 h-4" />
            Configurar MongoDB
          </button>

          <button
            onClick={handleExportJson}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
            title="Exportar base como JSON"
          >
            <Download className="w-4 h-4" />
          </button>

          <label
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition cursor-pointer"
            title="Importar base de arquivo JSON"
          >
            <Upload className="w-4 h-4" />
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>

          <button
            onClick={onResetDefaults}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 rounded-xl transition"
            title="Restaurar dados padrão do clã"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

      {/* Co-Owner Prompt Banner when searching in default Owner mode */}
      {memberFilterMode === 'owner' && search.trim() && coOwnerExtraCount > 0 && (
        <div className="mb-4 px-4 py-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-emerald-200">
            🛡️ <strong>{search}</strong> também é <strong>Co-Owner</strong> em mais <strong>{coOwnerExtraCount}</strong> rathole(s). Deseja visualizar como Co-Owner também?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMemberFilterMode('co_owner')}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
            >
              Ver Só Co-Owner ({coOwnerExtraCount})
            </button>
            <button
              type="button"
              onClick={() => setMemberFilterMode('responsible')}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
            >
              Ver Owner + Co-Owner
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4"># / Nome</th>
                <th className="py-3 px-4">Coordenadas (xx, yy)</th>
                <th className="py-3 px-4">👑 Owner Principal</th>
                <th className="py-3 px-4">🛡️ Co-Owner</th>
                <th className="py-3 px-4">⚡ Teleport (TP)</th>
                <th className="py-3 px-4">Servidor / Mapa</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((rh) => (
                <tr
                  key={rh.id}
                  className="hover:bg-zinc-800/40 transition group"
                >
                  {/* Number & Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-indigo-400 font-mono">
                        #{rh.numero}
                      </span>
                      <div>
                        <div className="font-bold text-white text-xs">{rh.name}</div>
                        {rh.notes && (
                          <div className="text-[10px] text-zinc-400 truncate max-w-[180px]">
                            {rh.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Coords */}
                  <td className="py-3 px-4 font-mono">
                    <button
                      onClick={() => onNavigateToRadar(rh.coords)}
                      className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-emerald-400 hover:border-emerald-500/50 flex items-center gap-1.5 transition text-[11px]"
                      title="Ver este rathole no radar tático"
                    >
                      <MapPin className="w-3 h-3 text-emerald-500" />
                      ({rh.coords.x.toFixed(1)}, {rh.coords.y.toFixed(1)})
                    </button>
                  </td>

                  {/* Owner */}
                  <td className="py-3 px-4">
                    <span className="font-bold text-zinc-200">{rh.owner}</span>
                  </td>

                  {/* Co-Owner */}
                  <td className="py-3 px-4">
                    <span className="text-zinc-300">{rh.coOwner}</span>
                  </td>

                  {/* TP */}
                  <td className="py-3 px-4 font-mono">
                    <button
                      onClick={() => handleCopyTp(rh.tp)}
                      className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition text-[11px]"
                      title="Clique para copiar o comando de TP"
                    >
                      {copiedTp === rh.tp ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{rh.tp}</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Server */}
                  <td className="py-3 px-4 text-zinc-400">
                    {rh.server}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    {getStatusBadge(rh.status)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onAskInDiscord(`A quem pertence o rathole ${rh.numero}?`)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-indigo-600 text-zinc-300 hover:text-white transition"
                        title={`Perguntar ao TEKOli sobre o Rathole #${rh.numero}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onEditRathole(rh)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                        title="Editar Rathole"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          onDeleteRathole(rh.id);
                          showToast(`🗑️ Rathole #${rh.numero} (${rh.name}) excluído.`);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 transition"
                        title="Excluir Rathole"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500">
                    Nenhum rathole encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <span>
            Exibindo <strong>{filtered.length}</strong> de <strong>{ratholes.length}</strong> ratholes
          </span>
          <span className="text-zinc-500 text-[11px]">
            Sincronizado com MongoDB e pronto para queries em tempo real pelo bot TEKOli
          </span>
        </div>
      </div>
    </div>
  );
};
