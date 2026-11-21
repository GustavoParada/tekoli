import React, { useState, useRef } from 'react';
import {
  MapPin,
  Crosshair,
  Compass,
  Zap,
  Shield,
  Eye,
  Copy,
  Check,
  MessageSquare,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { Rathole, RatholeStatus } from '../types/rathole';
import { calculateDistance, findNearestRatholes } from '../utils/ratholeQuery';

interface TacticalRadarMapProps {
  ratholes: Rathole[];
  onSelectRathole: (rathole: Rathole) => void;
  onAskInDiscord: (question: string) => void;
  highlightedIds?: string[];
}

export const TacticalRadarMap: React.FC<TacticalRadarMapProps> = ({
  ratholes,
  onSelectRathole,
  onAskInDiscord,
  highlightedIds = [],
}) => {
  const [targetCoords, setTargetCoords] = useState<{ x: number; y: number }>({ x: 14.9, y: 85.8 });
  const [activePin, setActivePin] = useState<Rathole | null>(null);
  const [copiedTp, setCopiedTp] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [radarMemberFilter, setRadarMemberFilter] = useState<'owner' | 'co_owner' | 'responsible'>('owner');
  const [showRadarLines, setShowRadarLines] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);

  const coOwnerExtraCount = searchQuery.trim()
    ? ratholes.filter((rh) => {
        if (filterStatus !== 'all' && rh.status !== filterStatus) return false;
        const q = searchQuery.toLowerCase().trim();
        return rh.coOwner.toLowerCase().includes(q) && !rh.owner.toLowerCase().includes(q);
      }).length
    : 0;

  // Filter ratholes
  const filteredRatholes = ratholes.filter((rh) => {
    if (filterStatus !== 'all' && rh.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const isNum = /^\d+$/.test(q) || q.startsWith('#');
      if (isNum) {
        return rh.numero.toString().includes(q.replace('#', ''));
      }
      if (radarMemberFilter === 'owner') {
        // REGRA: se não especificar, filtra por owner
        return rh.owner.toLowerCase().includes(q) || rh.name.toLowerCase().includes(q);
      } else if (radarMemberFilter === 'co_owner') {
        return rh.coOwner.toLowerCase().includes(q);
      } else {
        // REGRA: responsavel filtra por owner e co:owner
        return rh.owner.toLowerCase().includes(q) || rh.coOwner.toLowerCase().includes(q) || rh.name.toLowerCase().includes(q);
      }
    }
    return true;
  });

  // Calculate nearest ratholes to targetCoords
  const nearest = findNearestRatholes(ratholes, targetCoords.x, targetCoords.y, 3);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const pctX = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, (clickY / rect.height) * 100));

    setTargetCoords({
      x: parseFloat(pctX.toFixed(1)),
      y: parseFloat(pctY.toFixed(1)),
    });
    setActivePin(null);
  };

  const handleCopyTp = (tp: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(tp);
    setCopiedTp(tp);
    setTimeout(() => setCopiedTp(null), 2000);
  };

  const getStatusColor = (status: RatholeStatus) => {
    switch (String(status || '').toLowerCase()) {
      case 'ocupado':
        return '#6366f1'; // indigo
      case 'livre':
        return '#10b981'; // emerald
      case 'em_raid':
        return '#ef4444'; // rose
      case 'aliado':
        return '#06b6d4'; // cyan
      case 'reserva':
        return '#f59e0b'; // amber
      case 'builded':
      case 'built':
        return '#14b8a6'; // teal
      default:
        return '#8b5cf6';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-zinc-950 overflow-hidden">
      {/* Left / Top Radar Controls & Map View */}
      <div className="flex-1 flex flex-col p-4 md:p-6 min-h-0 overflow-y-auto">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Crosshair className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                Radar Tático de Coordenadas (0 a 100)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {ratholes.length} Bases Rastreadas
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Clique em qualquer ponto do mapa para buscar ratholes próximos e calcular distâncias
              </p>
            </div>
          </div>

            {/* Quick presets */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-500 text-[11px] mr-1 hidden sm:inline">Pontos Rápidos:</span>
              <button
                onClick={() => setTargetCoords({ x: 14.9, y: 85.8 })}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition border ${
                  targetCoords.x === 14.9 && targetCoords.y === 85.8
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                (14.9, 85.8) [RH #3 Beno]
              </button>
              <button
                onClick={() => setTargetCoords({ x: 9.6, y: 87.1 })}
                className="px-2.5 py-1 rounded-lg font-mono text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition"
              >
                (9.6, 87.1) [RH #1 DAB]
              </button>
              <button
                onClick={() => setTargetCoords({ x: 34.8, y: 54.1 })}
                className="px-2.5 py-1 rounded-lg font-mono text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition"
              >
                (34.8, 54.1) [Underworld]
              </button>
              <button
                onClick={() => setTargetCoords({ x: 73.3, y: 85.9 })}
                className="px-2.5 py-1 rounded-lg font-mono text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition"
              >
                (73.3, 85.9) [Redwoods]
              </button>
            </div>
        </div>

        {/* Radar Search & Dono vs Responsável Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 px-1">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <input
              type="text"
              placeholder={
                radarMemberFilter === 'owner'
                  ? '👑 Filtrando mapa por OWNER (padrão)... ex: Clutch, Joey'
                  : radarMemberFilter === 'co_owner'
                  ? '🛡️ Filtrando mapa apenas por CO-OWNER... ex: Joey'
                  : '👥 Filtrando mapa por RESPONSÁVEL (Owner + Co-Owner)... ex: Joey'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 flex-1"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-zinc-400 hover:text-white px-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setRadarMemberFilter('owner')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                radarMemberFilter === 'owner'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
              title="Padrão: filtra apenas onde é Owner"
            >
              👑 Owner (Padrão)
            </button>
            <button
              onClick={() => setRadarMemberFilter('co_owner')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                radarMemberFilter === 'co_owner'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-400/80 hover:text-emerald-300'
              }`}
              title="Filtra apenas onde é Co-Owner"
            >
              🛡️ Só Co-Owner
            </button>
            <button
              onClick={() => setRadarMemberFilter('responsible')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                radarMemberFilter === 'responsible'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-400/80 hover:text-indigo-300'
              }`}
              title="Filtra onde é Responsável (Owner ou Co-Owner)"
            >
              👥 Owner + Co-Owner
            </button>
          </div>
        </div>

        {/* Co-Owner Prompt Banner */}
        {radarMemberFilter === 'owner' && searchQuery.trim() && coOwnerExtraCount > 0 && (
          <div className="mb-3 px-3.5 py-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-emerald-200">
              🛡️ <strong>{searchQuery}</strong> também é Co-Owner em mais <strong>{coOwnerExtraCount}</strong> rathole(s). Quer ver como Co-Owner também?
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRadarMemberFilter('co_owner')}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
              >
                Só Co-Owner ({coOwnerExtraCount})
              </button>
              <button
                onClick={() => setRadarMemberFilter('responsible')}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
              >
                Owner + Co-Owner
              </button>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div className="relative flex-1 min-h-[460px] md:min-h-[520px] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
          {/* Tactical Grid Background (0 - 100) */}
          <div
            ref={containerRef}
            onClick={handleMapClick}
            className="relative w-full h-full cursor-crosshair select-none bg-[#0a0d14]"
            style={{
              backgroundImage: `
                radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 70%),
                linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
                linear-gradient(to right, rgba(99, 102, 241, 0.12) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(99, 102, 241, 0.12) 1px, transparent 1px)
              `,
              backgroundSize: '100% 100%, 10% 10%, 10% 10%, 20% 20%, 20% 20%',
            }}
          >
            {/* Coordinate Axis Labels */}
            <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-600 font-bold">
              (0, 0) NOROESTE
            </div>
            <div className="absolute top-2 right-2 text-[10px] font-mono text-zinc-600 font-bold">
              (100, 0) NORDESTE
            </div>
            <div className="absolute bottom-2 left-2 text-[10px] font-mono text-zinc-600 font-bold">
              (0, 100) SUDOESTE
            </div>
            <div className="absolute bottom-2 right-2 text-[10px] font-mono text-zinc-600 font-bold">
              (100, 100) SUDESTE
            </div>

            {/* Compass Rose in Corner */}
            <div className="absolute bottom-4 right-4 pointer-events-none opacity-25">
              <Compass className="w-16 h-16 text-indigo-400" />
            </div>

            {/* Target Crosshair / Radar Center */}
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${targetCoords.x}%`, top: `${targetCoords.y}%` }}
            >
              {/* Radar pulse circles */}
              <div className="absolute -inset-10 rounded-full border border-indigo-500/40 animate-ping opacity-75" />
              <div className="absolute -inset-16 rounded-full border border-indigo-500/20" />
              <div className="w-6 h-6 rounded-full border-2 border-indigo-400 bg-indigo-500/30 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </div>
              <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/85 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-mono font-bold text-indigo-300 border border-indigo-500/40 shadow-lg">
                🎯 ({targetCoords.x.toFixed(1)}, {targetCoords.y.toFixed(1)})
              </div>
            </div>

            {/* SVG Connecting lines from target to 3 nearest ratholes */}
            {showRadarLines && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                {nearest.map((item, idx) => (
                  <g key={item.rathole.id}>
                    <line
                      x1={`${targetCoords.x}%`}
                      y1={`${targetCoords.y}%`}
                      x2={`${item.rathole.coords.x}%`}
                      y2={`${item.rathole.coords.y}%`}
                      stroke={idx === 0 ? '#6366f1' : '#4f46e5'}
                      strokeWidth={idx === 0 ? '2' : '1.2'}
                      strokeDasharray="4 4"
                      className="animate-pulse"
                      strokeOpacity={idx === 0 ? '0.9' : '0.5'}
                    />
                    {/* Distance label midpoint */}
                    <text
                      x={`${(targetCoords.x + item.rathole.coords.x) / 2}%`}
                      y={`${(targetCoords.y + item.rathole.coords.y) / 2}%`}
                      fill="#a5b4fc"
                      fontSize="10"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="select-none bg-black"
                    >
                      {item.distance.toFixed(1)}m
                    </text>
                  </g>
                ))}
              </svg>
            )}

            {/* Rathole Pins */}
            {filteredRatholes.map((rh) => {
              const isSelected = activePin?.id === rh.id;
              const isHighlighted = highlightedIds.includes(rh.id);
              const isTopNearest = nearest[0]?.rathole.id === rh.id;
              const color = getStatusColor(rh.status);

              return (
                <div
                  key={rh.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePin(rh);
                    setTargetCoords({ x: rh.coords.x, y: rh.coords.y });
                    onSelectRathole(rh);
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-15 group transition-transform hover:scale-125 ${
                    isSelected ? 'scale-125 z-30' : ''
                  }`}
                  style={{ left: `${rh.coords.x}%`, top: `${rh.coords.y}%` }}
                >
                  {/* Outer pulse if in raid or highlighted */}
                  {(rh.status === 'em_raid' || isHighlighted || isTopNearest) && (
                    <div
                      className="absolute -inset-2 rounded-full animate-ping opacity-60"
                      style={{ backgroundColor: color }}
                    />
                  )}

                  {/* Pin badge */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shadow-lg transition border ${
                      isSelected
                        ? 'ring-2 ring-white scale-110'
                        : 'border-white/20'
                    }`}
                    style={{
                      backgroundColor: color,
                      color: '#ffffff',
                    }}
                    title={`#${rh.numero} ${rh.name} (${rh.coords.x}, ${rh.coords.y})`}
                  >
                    #{rh.numero}
                  </div>

                  {/* Pin label tooltip */}
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-950/95 border border-zinc-700/80 px-2 py-0.5 rounded shadow-xl text-[10px] text-zinc-300 opacity-0 group-hover:opacity-100 transition pointer-events-none z-30 font-medium">
                    <span className="font-bold text-white">#{rh.numero}</span> {rh.name}
                    <div className="text-[9px] text-zinc-400 font-mono">
                      👑 {rh.owner} • TP: {rh.tp}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map bottom toolbar */}
          <div className="absolute bottom-3 left-3 z-30 flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 px-3 py-1.5 rounded-xl text-xs text-zinc-300 shadow-xl">
            <span className="text-[11px] font-mono text-zinc-400">
              Alvo Atual: <strong className="text-white">({targetCoords.x.toFixed(1)}, {targetCoords.y.toFixed(1)})</strong>
            </span>
            <span className="text-zinc-600">|</span>
            <label className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showRadarLines}
                onChange={(e) => setShowRadarLines(e.target.checked)}
                className="rounded accent-indigo-600"
              />
              Linhas de Proximidade
            </label>
          </div>
        </div>
      </div>

      {/* Right Radar HUD / Intel Panel */}
      <div className="w-full lg:w-96 bg-zinc-900/95 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col p-4 md:p-6 overflow-y-auto">
        {/* HUD Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Painel de Proximidade
            </h3>
          </div>
          <button
            onClick={() => {
              onAskInDiscord(`Qual os ratholes próximo de ${targetCoords.x}, ${targetCoords.y}?`);
            }}
            className="px-2.5 py-1 text-[11px] bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-lg flex items-center gap-1.5 transition font-medium"
            title="Envia esta pergunta automaticamente para o TEKOli no simulador de Discord"
          >
            <MessageSquare className="w-3 h-3" />
            Perguntar ao TEKOli
          </button>
        </div>

        {/* Selected or Nearest Summary */}
        <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl mb-4">
          <div className="text-[11px] font-semibold text-zinc-400 mb-1 flex items-center justify-between">
            <span>Coordenada de Referência:</span>
            <span className="font-mono text-indigo-400 font-bold">
              ({targetCoords.x.toFixed(1)}, {targetCoords.y.toFixed(1)})
            </span>
          </div>
          <p className="text-xs text-zinc-300">
            {nearest.length > 0 ? (
              <>
                O rathole mais próximo é o <strong className="text-white">#{nearest[0].rathole.numero}</strong> a{' '}
                <strong className="text-emerald-400">{nearest[0].distance.toFixed(1)}m</strong> de distância.
              </>
            ) : (
              'Nenhum rathole encontrado.'
            )}
          </p>
        </div>

        {/* Nearest Ratholes Cards */}
        <div className="space-y-3 flex-1">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Mais Próximos do Ponto</span>
            <span className="text-[10px] text-zinc-500 font-normal">Calculado via Euclidian 2D</span>
          </h4>

          {nearest.map((item, index) => {
            const rh = item.rathole;
            const isSelected = activePin?.id === rh.id;
            const color = getStatusColor(rh.status);

            return (
              <div
                key={rh.id}
                onClick={() => {
                  setActivePin(rh);
                  onSelectRathole(rh);
                }}
                className={`p-3.5 rounded-xl border transition cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-zinc-800 border-indigo-500 shadow-lg ring-1 ring-indigo-500/50'
                    : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {/* Status indicator bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: color }}
                />

                <div className="flex items-start justify-between gap-2 pl-1 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      #{rh.numero}
                    </span>
                    <span className="text-xs font-bold text-white truncate max-w-[170px]">
                      {rh.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-indigo-300 shrink-0 font-bold">
                    {item.distance.toFixed(1)}m
                  </span>
                </div>

                <div className="pl-1 text-xs space-y-1 text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-[11px]">👑 Owner:</span>
                    <strong className="text-white text-[11px]">{rh.owner}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-[11px]">🛡️ Co-Owner:</span>
                    <span className="text-zinc-300 text-[11px]">{rh.coOwner}</span>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-zinc-500 text-[11px]">📍 Coordenadas:</span>
                    <span className="text-emerald-400 text-[11px]">
                      ({rh.coords.x.toFixed(1)}, {rh.coords.y.toFixed(1)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono pt-1">
                    <span className="text-zinc-500 text-[11px]">⚡ TP:</span>
                    <button
                      onClick={(e) => handleCopyTp(rh.tp, e)}
                      className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] flex items-center gap-1 transition"
                      title="Copiar comando de TP"
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
                  </div>
                </div>

                {/* Quick ask button */}
                <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between pl-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAskInDiscord(`A quem pertence o rathole ${rh.numero}?`);
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline font-medium"
                  >
                    💬 Perguntar: "A quem pertence o rathole {rh.numero}?"
                  </button>
                  <span className="text-[10px] text-zinc-500 font-mono uppercase">
                    {rh.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <div className="text-[11px] font-semibold text-zinc-400 mb-2">Legenda de Cores:</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-zinc-300">Ocupado (Ativo)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-zinc-300">Livre (Disponível)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-zinc-300">Em Raid (Perigo)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              <span className="text-zinc-300">Aliado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <span className="text-zinc-300">Builded</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
