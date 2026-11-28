import React, { useLayoutEffect, useState, useRef } from 'react';
import {
  Crosshair,
  Compass,
  Copy,
  Check,
  MessageSquare,
} from 'lucide-react';
import { Rathole, RatholeStatus } from '../types/rathole';
import { findNearestRatholes } from '../utils/ratholeQuery';
import mapBackground from '../assets/tactical-map.jpg';

/** Source image size and the fitted 0–100 grid printed on it. */
const MAP_W = 1020;
const MAP_H = 891;
const LON_ORIGIN = 112.306;
const LON_SCALE = 9.029;
const LAT_ORIGIN = 5.486;
const LAT_SCALE = 9.0325;

type MapFrame = { left: number; top: number; width: number; height: number; cw: number; ch: number };

/** First value is latitude (top → bottom). Second value is longitude (left → right). */
function videoMoments(notes?: string): { label: string; url: string }[] {
  if (!notes) return [];
  const seen = new Set<string>();
  const moments: { label: string; url: string }[] = [];
  const pattern = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\((https?:\/\/[^)\s]+)\)/g;
  for (const match of notes.matchAll(pattern)) {
    const url = match[2];
    if (seen.has(url)) continue;
    seen.add(url);
    moments.push({ label: match[1], url });
  }
  return moments;
}

function gameToPercent(lat: number, lon: number, frame: MapFrame) {
  const px = LON_ORIGIN + lon * LON_SCALE;
  const py = LAT_ORIGIN + lat * LAT_SCALE;
  const absX = frame.left + (px / MAP_W) * frame.width;
  const absY = frame.top + (py / MAP_H) * frame.height;
  const left = frame.cw > 0 ? (absX / frame.cw) * 100 : 0;
  const top = frame.ch > 0 ? (absY / frame.ch) * 100 : 0;
  return { left: `${left}%`, top: `${top}%`, leftNum: left, topNum: top };
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<MapFrame>({ left: 0, top: 0, width: 1, height: 1, cw: 1, ch: 1 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const imgAspect = MAP_W / MAP_H;
      const boxAspect = width / height;
      let w: number;
      let h: number;
      let left: number;
      let top: number;
      if (boxAspect > imgAspect) {
        h = height;
        w = height * imgAspect;
        left = (width - w) / 2;
        top = 0;
      } else {
        w = width;
        h = width / imgAspect;
        left = 0;
        top = (height - h) / 2;
      }
      setFrame({ left, top, width: w, height: h, cw: width, ch: height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

    if (
      clickX < frame.left ||
      clickY < frame.top ||
      clickX > frame.left + frame.width ||
      clickY > frame.top + frame.height
    ) {
      return;
    }

    const px = ((clickX - frame.left) / frame.width) * MAP_W;
    const py = ((clickY - frame.top) / frame.height) * MAP_H;
    const lon = (px - LON_ORIGIN) / LON_SCALE;
    const lat = (py - LAT_ORIGIN) / LAT_SCALE;

    setTargetCoords({
      x: parseFloat(Math.max(0, Math.min(100, lat)).toFixed(1)),
      y: parseFloat(Math.max(0, Math.min(100, lon)).toFixed(1)),
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
    <div className="flex flex-col lg:flex-row h-full w-full bg-zinc-950 overflow-y-auto lg:overflow-hidden">
      {/* Left / Top Radar Controls & Map View */}
      <div className="flex-1 flex flex-col p-3 min-h-[78vh] lg:min-h-0 lg:h-full min-w-0">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0 bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Crosshair className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                Tactical Coordinate Radar (0 to 100)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {ratholes.length} Bases Tracked
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Click the map. First number is latitude (left side), second is longitude (top).
              </p>
            </div>
          </div>

            {/* Quick presets */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-500 text-[11px] mr-1 hidden sm:inline">Quick points:</span>
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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0 px-1">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <input
              type="text"
              placeholder={
                radarMemberFilter === 'owner'
                  ? '👑 Filtering the map by OWNER (default)... e.g. Clutch, Joey'
                  : radarMemberFilter === 'co_owner'
                  ? '🛡️ Filtering the map by CO-OWNER only... e.g. Joey'
                  : '👥 Filtering the map by OWNER + CO-OWNER... e.g. Joey'
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
              title="Default: only where they are the owner"
            >
              👑 Owner (Default)
            </button>
            <button
              onClick={() => setRadarMemberFilter('co_owner')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                radarMemberFilter === 'co_owner'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-400/80 hover:text-emerald-300'
              }`}
              title="Only where they are the co-owner"
            >
              🛡️ Co-Owner only
            </button>
            <button
              onClick={() => setRadarMemberFilter('responsible')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                radarMemberFilter === 'responsible'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-400/80 hover:text-indigo-300'
              }`}
              title="Where they are owner or co-owner"
            >
              👥 Owner + Co-Owner
            </button>
          </div>
        </div>

        {/* Co-Owner Prompt Banner */}
        {radarMemberFilter === 'owner' && searchQuery.trim() && coOwnerExtraCount > 0 && (
          <div className="mb-3 px-3.5 py-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-emerald-200">
              🛡️ <strong>{searchQuery}</strong> is also Co-Owner on <strong>{coOwnerExtraCount}</strong> more rathole(s). Show those too?
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRadarMemberFilter('co_owner')}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
              >
                Co-Owner only ({coOwnerExtraCount})
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
        <div className="relative flex-1 min-h-[68vh] lg:min-h-0 bg-[#071820] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          <div
            ref={containerRef}
            onClick={handleMapClick}
            className="relative w-full h-full cursor-crosshair select-none"
          >
            <div
              className="absolute pointer-events-none"
              style={{
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
                backgroundImage: `url(${mapBackground})`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
              }}
            />

            {/* Target Crosshair / Radar Center */}
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: gameToPercent(targetCoords.x, targetCoords.y, frame).left, top: gameToPercent(targetCoords.x, targetCoords.y, frame).top }}
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
                {nearest.map((item, idx) => {
                  const from = gameToPercent(targetCoords.x, targetCoords.y, frame);
                  const to = gameToPercent(item.rathole.coords.x, item.rathole.coords.y, frame);
                  return (
                  <g key={item.rathole.id}>
                    <line
                      x1={`${from.leftNum}%`}
                      y1={`${from.topNum}%`}
                      x2={`${to.leftNum}%`}
                      y2={`${to.topNum}%`}
                      stroke={idx === 0 ? '#6366f1' : '#4f46e5'}
                      strokeWidth={idx === 0 ? '2' : '1.2'}
                      strokeDasharray="4 4"
                      className="animate-pulse"
                      strokeOpacity={idx === 0 ? '0.9' : '0.5'}
                    />
                    {/* Distance label midpoint */}
                    <text
                      x={`${(from.leftNum + to.leftNum) / 2}%`}
                      y={`${(from.topNum + to.topNum) / 2}%`}
                      fill="#a5b4fc"
                      fontSize="10"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="select-none bg-black"
                    >
                      {item.distance.toFixed(1)}m
                    </text>
                  </g>
                  );
                })}
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
                  style={{ left: gameToPercent(rh.coords.x, rh.coords.y, frame).left, top: gameToPercent(rh.coords.x, rh.coords.y, frame).top }}
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
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[9px] leading-none shadow-lg transition border ${
                      isSelected
                        ? 'ring-2 ring-white scale-110'
                        : 'border-white/40'
                    }`}
                    style={{
                      backgroundColor: color,
                      color: '#ffffff',
                    }}
                    title={`#${rh.numero} ${rh.name} (${rh.coords.x}, ${rh.coords.y})`}
                  >
                    {rh.numero}
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
              Target: <strong className="text-white">({targetCoords.x.toFixed(1)}, {targetCoords.y.toFixed(1)})</strong>
            </span>
            <span className="text-zinc-600">|</span>
            <label className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={showRadarLines}
                onChange={(e) => setShowRadarLines(e.target.checked)}
                className="rounded accent-indigo-600"
              />
              Proximity lines
            </label>
          </div>
        </div>
      </div>

      {/* Right Radar HUD / Intel Panel */}
      <div className="w-full lg:w-80 xl:w-96 shrink-0 max-h-[46vh] lg:max-h-none lg:h-full bg-zinc-900/95 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col p-4 overflow-y-auto">
        {/* HUD Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Proximity Panel
            </h3>
          </div>
          <button
            onClick={() => {
              onAskInDiscord(`What are the nearest ratholes to ${targetCoords.x}, ${targetCoords.y}?`);
            }}
            className="px-2.5 py-1 text-[11px] bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-lg flex items-center gap-1.5 transition font-medium"
            title="Sends this question to TEKOli in the Discord simulator"
          >
            <MessageSquare className="w-3 h-3" />
            Ask TEKOli
          </button>
        </div>

        {/* Selected or Nearest Summary */}
        <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl mb-4">
          <div className="text-[11px] font-semibold text-zinc-400 mb-1 flex items-center justify-between">
            <span>Reference coordinate:</span>
            <span className="font-mono text-indigo-400 font-bold">
              ({targetCoords.x.toFixed(1)}, {targetCoords.y.toFixed(1)})
            </span>
          </div>
          <p className="text-xs text-zinc-300">
            {nearest.length > 0 ? (
              <>
                The nearest rathole is <strong className="text-white">#{nearest[0].rathole.numero}</strong>,{' '}
                <strong className="text-emerald-400">{nearest[0].distance.toFixed(1)}m</strong> away.
              </>
            ) : (
              'No ratholes found.'
            )}
          </p>
        </div>

        {/* Nearest Ratholes Cards */}
        <div className="space-y-3 flex-1">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Nearest to this point</span>
            <span className="text-[10px] text-zinc-500 font-normal">2D Euclidean distance</span>
          </h4>

          {nearest.map((item) => {
            const rh = item.rathole;
            const isSelected = activePin?.id === rh.id;
            const color = getStatusColor(rh.status);
            const moments = videoMoments(rh.notes);

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
                    <span className="text-zinc-500 text-[11px]">📍 Coordinates:</span>
                    <span className="text-emerald-400 text-[11px]">
                      ({rh.coords.x.toFixed(1)}, {rh.coords.y.toFixed(1)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono pt-1">
                    <span className="text-zinc-500 text-[11px]">⚡ TP:</span>
                    <button
                      onClick={(e) => handleCopyTp(rh.tp, e)}
                      className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] flex items-center gap-1 transition"
                      title="Copy TP command"
                    >
                      {copiedTp === rh.tp ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{rh.tp}</span>
                        </>
                      )}
                    </button>
                  </div>
                  {moments.length > 0 && (
                    <div className="flex items-start justify-between gap-2 pt-1">
                      <span className="text-zinc-500 text-[11px] shrink-0">▶ Video:</span>
                      <span className="flex flex-wrap justify-end gap-1">
                        {moments.map((moment) => (
                          <a
                            key={moment.url}
                            href={moment.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-mono"
                            title={`Open the video at ${moment.label}`}
                          >
                            {moment.label}
                          </a>
                        ))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick ask button */}
                <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between pl-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAskInDiscord(`Who owns rathole ${rh.numero}?`);
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline font-medium"
                  >
                    💬 Ask: "Who owns rathole {rh.numero}?"
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
          <div className="text-[11px] font-semibold text-zinc-400 mb-2">Color legend:</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-zinc-300">Occupied</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-zinc-300">Open</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-zinc-300">Under raid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              <span className="text-zinc-300">Ally</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <span className="text-zinc-300">Built</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
