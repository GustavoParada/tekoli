import React, { useState, useEffect } from 'react';
import {
  Bot,
  Compass,
  Database,
  Volume2,
  VolumeX,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { Rathole, DiscordMessage } from './types/rathole';
import { INITIAL_RATHOLES } from './data/defaultRatholes';
import { DiscordSimulator } from './components/DiscordSimulator';
import { TacticalRadarMap } from './components/TacticalRadarMap';
import { BotRuntimeStatus } from './components/BotCodeExporter';
import { RatholeModal } from './components/RatholeModal';
import { MongoConfigModal } from './components/MongoConfigModal';

export default function App() {
  // Ratholes State with LocalStorage persistence
  const [ratholes, setRatholes] = useState<Rathole[]>(() => {
    try {
      const saved = localStorage.getItem('tekoli_ratholes_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 50) return parsed;
      }
    } catch (_) {}
    return INITIAL_RATHOLES;
  });

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'discord' | 'radar'>('radar');

  // Audio Notification Toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // MongoDB Settings
  const [mongoUri, setMongoUri] = useState<string>(() => {
    return localStorage.getItem('tekoli_mongo_uri') || '';
  });
  const [dbName, setDbName] = useState<string>('tekoli_db');
  const [collectionName, setCollectionName] = useState<string>('ratholes');
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    return localStorage.getItem('tekoli_webhook_url') || '';
  });

  // Modals
  const [isMongoModalOpen, setIsMongoModalOpen] = useState(false);
  const [isRatholeModalOpen, setIsRatholeModalOpen] = useState(false);
  const [editingRathole, setEditingRathole] = useState<Rathole | null>(null);

  // Highlighted Ratholes on radar
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);

  // Discord Messages State
  const [messages, setMessages] = useState<DiscordMessage[]>([
    {
      id: 'welcome-1',
      author: {
        name: 'TEKOli',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
        isBot: true,
        tag: 'BOT',
        role: 'Official Bot',
        color: '#5865F2',
      },
      content:
        '👋 Hey warriors! I am **TEKOli**, the clan\'s official bot connected to MongoDB.\n\nThe tribe **rathole database** is loaded. Ask me things like:\n• *"Who owns rathole 3?"*\n• *"Nearest ratholes to 14.9, 85.8"*\n• *"Clutch\'s ratholes"*\n• *"What is the TP for rathole 1?"*',
      embed: {
        title: '🏰 TEKOli Tactical System • Tribe List Loaded',
        description: 'Every tribe rathole is catalogued in MongoDB with a number, GPS coordinates (x, y), owner, co-owner, and TP command.',
        color: '#5865F2',
        fields: [
          { name: '👑 Rathole #3', value: 'Owned by **Beno** (Co: **Joey**)\nCoords: `(14.9, 85.8)`\nTP: `TP-RH-03`', inline: true },
          { name: '📍 Proximity example', value: 'Near (14.9, 85.8): #3, #2 (ASTE), #1 (DAB), #4 (Clutch)', inline: true },
          { name: '🛡️ Registered members', value: 'DAB, Beno, Joey, Clutch, Oli, ASTE, Coeus, Prin, Howess, khacis, and others.', inline: true },
        ],
        footer: { text: 'TEKOli Bot • Consolidated tribe list' },
      },
      timestamp: 'Today at 11:00',
    },
  ]);

  const [botStatus, setBotStatus] = useState<BotRuntimeStatus | null>(null);

  const fetchServerRatholes = async () => {
    try {
      const res = await fetch('/api/ratholes');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.ratholes) && data.ratholes.length > 0) {
          setRatholes((prev) => {
            const serverMap = new Map<number, Rathole>(
              data.ratholes.map((r: Rathole) => [r.numero, r])
            );
            const prevMap = new Map<number, Rathole>(prev.map((r) => [r.numero, r]));
            const merged: Rathole[] = [];
            for (const sRh of data.ratholes as Rathole[]) {
              const localRh = prevMap.get(sRh.numero);
              if (localRh && localRh.updatedAt && sRh.updatedAt && localRh.updatedAt > sRh.updatedAt) {
                merged.push(localRh);
              } else {
                merged.push(sRh);
              }
            }
            for (const lRh of prev) {
              if (!serverMap.has(lRh.numero)) {
                merged.push(lRh);
              }
            }
            return merged.sort((a, b) => a.numero - b.numero);
          });
        }
      }
    } catch (_) {}
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      if (res.ok) {
        const data = await res.json();
        setBotStatus(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchBotStatus();
    fetchServerRatholes();
    const timer = setInterval(() => {
      fetchBotStatus();
      fetchServerRatholes();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Persist ratholes locally in LocalStorage (never overwrite server MongoDB blindly on mount)
  useEffect(() => {
    try {
      localStorage.setItem('tekoli_ratholes_v2', JSON.stringify(ratholes));
    } catch (_) {}
  }, [ratholes]);

  const syncListToServer = (list: Rathole[]) => {
    fetch('/api/ratholes/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ratholes: list }),
    }).catch(() => {});
  };

  // Save mongoUri & webhookUrl to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('tekoli_mongo_uri', mongoUri);
      localStorage.setItem('tekoli_webhook_url', webhookUrl);
    } catch (_) {}
  }, [mongoUri, webhookUrl]);

  // Handle saving new or edited rathole
  const handleSaveRathole = (savedRh: Rathole) => {
    setRatholes((prev) => {
      const exists = prev.some((r) => r.id === savedRh.id || r.numero === savedRh.numero);
      const next = exists
        ? prev.map((r) => (r.id === savedRh.id || r.numero === savedRh.numero ? savedRh : r))
        : [...prev, savedRh].sort((a, b) => a.numero - b.numero);
      if (exists) {
        fetch('/api/ratholes/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numero: savedRh.numero, updates: savedRh }),
        }).catch(() => {});
      } else {
        syncListToServer(next);
      }
      return next;
    });
  };

  // Quick navigation helper
  const handleNavigateToRadar = (coords?: { x: number; y: number }) => {
    setActiveTab('radar');
  };

  const handleAskInDiscord = (question: string) => {
    setActiveTab('discord');
    // Dispatch query to simulator after short delay
    setTimeout(() => {
      const userMsg: DiscordMessage = {
        id: `msg-${Date.now()}`,
        author: {
          name: 'Gustavo Parada',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
          isBot: false,
          role: 'Clan Leader',
          color: '#f59e0b',
        },
        content: question,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Automatically trigger TEKOli's answer
      setTimeout(async () => {
        const { parseLocalRatholeQuery } = await import('./utils/ratholeQuery');
        const res = parseLocalRatholeQuery(question, ratholes);

        const botMsg: DiscordMessage = {
          id: `bot-${Date.now()}`,
          author: {
            name: 'TEKOli',
            avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
            isBot: true,
            tag: 'BOT',
            role: 'Official Bot',
            color: '#5865F2',
          },
          content: res.content,
          embed: res.embed,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
      }, 400);
    }, 150);
  };

  const nextSuggestedNumber =
    ratholes.length > 0 ? Math.max(...ratholes.map((r) => r.numero)) + 1 : 1;

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-white overflow-hidden select-none">
      {/* Global Application Header */}
      <header className="h-14 bg-zinc-950 border-b border-zinc-800 px-4 md:px-6 flex items-center justify-between shrink-0 z-40">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm md:text-base tracking-tight text-white flex items-center gap-1.5">
                TEKOli
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  DISCORD BOT
                </span>
              </h1>
            </div>
            <div className="text-[11px] text-zinc-400 flex items-center gap-2">
              <span>Ratholes Intel Hub</span>
              <span className="text-zinc-600">•</span>
              <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {mongoUri ? 'MongoDB Connected' : 'Local MongoDB Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('radar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'radar'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tactical Radar</span>
          </button>

          <button
            onClick={() => setActiveTab('discord')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'discord'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Discord Simulator</span>
          </button>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* Real Discord Gateway Status Button */}
          <div
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border ${
              botStatus?.online
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
            title={
              botStatus?.online
                ? `TEKOli is online on Discord (${botStatus.botTag})`
                : 'Bot is offline on Discord'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                botStatus?.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="hidden xl:inline">
              {botStatus?.online ? `Discord Online (${botStatus.guildsCount})` : 'Discord Offline'}
            </span>
          </div>

          <button
            onClick={() => {
              setEditingRathole(null);
              setIsRatholeModalOpen(true);
            }}
            className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            title="Add a new rathole to the database"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">New Rathole</span>
          </button>

          <button
            onClick={() => setIsMongoModalOpen(true)}
            className={`p-2 rounded-lg border transition ${
              mongoUri
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Configure MongoDB connection"
          >
            <Database className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
            title={soundEnabled ? 'Mute sound alerts' : 'Enable ping sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab === 'discord' && (
          <DiscordSimulator
            ratholes={ratholes}
            messages={messages}
            setMessages={setMessages}
            onNavigateToRadar={handleNavigateToRadar}
            onSelectRathole={(rh) => {
              setHighlightedIds([rh.id]);
              setActiveTab('radar');
            }}
            onUpdateRathole={handleSaveRathole}
            soundEnabled={soundEnabled}
            setSoundEnabled={setSoundEnabled}
            webhookUrl={webhookUrl}
          />
        )}

        {activeTab === 'radar' && (
          <TacticalRadarMap
            ratholes={ratholes}
            onSelectRathole={(rh) => {
              setHighlightedIds([rh.id]);
            }}
            onAskInDiscord={handleAskInDiscord}
            highlightedIds={highlightedIds}
          />
        )}

      </main>

      {/* Modal: New / Edit Rathole */}
      <RatholeModal
        isOpen={isRatholeModalOpen}
        onClose={() => setIsRatholeModalOpen(false)}
        onSave={handleSaveRathole}
        initialData={editingRathole}
        suggestedNumber={nextSuggestedNumber}
      />

      {/* Modal: MongoDB Settings */}
      <MongoConfigModal
        isOpen={isMongoModalOpen}
        onClose={() => setIsMongoModalOpen(false)}
        mongoUri={mongoUri}
        setMongoUri={setMongoUri}
        dbName={dbName}
        setDbName={setDbName}
        collectionName={collectionName}
        setCollectionName={setCollectionName}
        ratholes={ratholes}
        onRatholesUpdate={(newRhs) => setRatholes(newRhs)}
        webhookUrl={webhookUrl}
        setWebhookUrl={setWebhookUrl}
      />
    </div>
  );
}
