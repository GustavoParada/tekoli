import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  Hash,
  Volume2,
  VolumeX,
  Sparkles,
  Copy,
  Check,
  MapPin,
  Compass,
  Smile,
  PlusCircle,
  HelpCircle,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { DiscordEmbed, DiscordMessage, Rathole } from '../types/rathole';
import { parseAdminUpdateCommand, parseLocalRatholeQuery } from '../utils/ratholeQuery';
import { playDiscordPingSound } from '../utils/sound';

interface DiscordSimulatorProps {
  ratholes: Rathole[];
  messages: DiscordMessage[];
  setMessages: React.Dispatch<React.SetStateAction<DiscordMessage[]>>;
  onNavigateToRadar: (coords?: { x: number; y: number }) => void;
  onSelectRathole: (rathole: Rathole) => void;
  onUpdateRathole?: (updated: Rathole) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  webhookUrl: string;
}

export const DiscordSimulator: React.FC<DiscordSimulatorProps> = ({
  ratholes,
  messages,
  setMessages,
  onNavigateToRadar,
  onSelectRathole,
  onUpdateRathole,
  soundEnabled,
  setSoundEnabled,
  webhookUrl,
}) => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedTp, setCopiedTp] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<'ratholes-intel' | 'general' | 'bot-commands'>('ratholes-intel');
  const [showMembers, setShowMembers] = useState(true);
  const [botLanguage, setBotLanguage] = useState<'auto' | 'en' | 'pt' | 'fr'>('en');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping) return;

    setInputText('');

    // 1. Add user message
    const userMsg: DiscordMessage = {
      id: `msg-${Date.now()}`,
      author: {
        name: 'Gustavo Parada',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        isBot: false,
        role: 'Clan Leader',
        color: '#f59e0b',
      },
      content: text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // 2. Check for @admin database update command (e.g. @TekOli update status to "builded" for rathole 59)
    let botContent = '';
    let botEmbed: DiscordEmbed | undefined = undefined;
    const adminCmd = parseAdminUpdateCommand(text);

    if (adminCmd) {
      try {
        const res = await fetch('/api/ratholes/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero: adminCmd.numero,
            updates: { [adminCmd.field]: adminCmd.value },
          }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.rathole) {
          const updated: Rathole = data.rathole;
          onUpdateRathole?.(updated);
          botContent = `✅ **Rathole #${updated.numero}** updated successfully! Field \`${adminCmd.field}\` is now \`${adminCmd.value}\`.${data.persistedToMongo ? ' *(Persisted to MongoDB)*' : ''}`;
          botEmbed = {
            title: `🛠️ Admin Database Update • Rathole #${updated.numero}`,
            description: `**${updated.name}** updated in real time.`,
            color: '#10b981',
            fields: [
              { name: '🏷️ Status', value: `\`${updated.status}\``, inline: true },
              { name: '👑 Owner', value: updated.owner, inline: true },
              { name: '🛡️ Co-Owner', value: updated.coOwner, inline: true },
              { name: '📍 Coords', value: `(${updated.coords.x}, ${updated.coords.y})`, inline: true },
              { name: '⚡ TP', value: `\`${updated.tp}\``, inline: true },
            ],
            footer: { text: 'TEKOli Admin Control • MongoDB Synced' },
          };
        } else {
          botContent = `🔍 **Rathole #${adminCmd.numero}** was not found in the database.`;
        }
      } catch (err) {
        console.warn('Admin update error:', err);
        botContent = `⚠️ Failed to update **Rathole #${adminCmd.numero}**.`;
      }
    } else {
      // 3. Query processing: First try local high-precision multilingual parser
      const localResult = parseLocalRatholeQuery(text, ratholes, botLanguage);
      botContent = localResult.content;
      botEmbed = localResult.embed;

      const isDeterministicNotFound =
        localResult.type === 'not_found' &&
        (/\bco-owner\b/i.test(localResult.content) || /Rathole #\d+/i.test(localResult.content));

      if (localResult.type === 'general' || (localResult.type === 'not_found' && !isDeterministicNotFound)) {
        try {
          const history = messages.slice(-12).map((m) => ({
            role: m.author.isBot ? 'model' : 'user',
            text: m.content,
          }));
          const response = await fetch('/api/gemini/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: text.replace(/^@tekoli[\s,:-]*/i, '').trim() || text,
              ratholes,
              language: botLanguage,
              history,
            }),
          });

          const data = await response.json();
          if (response.ok && data && data.text && !data.useFallback) {
            botContent = data.text;
            if (!botEmbed && text.match(/\d+/)) {
              botEmbed = localResult.embed;
            }
          } else if (!response.ok && data?.error) {
            botContent = `⚠️ **TEKOli Chatbot Error:** ${data.error}`;
          }
        } catch (err: any) {
          console.warn('Gemini query error:', err);
          botContent = `⚠️ **TEKOli Chatbot Connection Error:** ${err?.message || 'Unable to reach AI service.'}`;
        }
      }
    }

    // Simulate realistic Discord bot response latency (350ms - 600ms)
    setTimeout(() => {
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
        content: botContent,
        embed: botEmbed,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      playDiscordPingSound(soundEnabled);

      // If user provided a real Discord Webhook, forward it
      if (webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        fetch('/api/discord/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl,
            message: botContent,
            embed: botEmbed,
          }),
        }).catch((e) => console.error('Webhook forward error:', e));
      }
    }, 450);
  };

  const handleCopyTp = (tp: string) => {
    navigator.clipboard.writeText(tp);
    setCopiedTp(tp);
    setTimeout(() => setCopiedTp(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'msg-welcome',
        author: {
          name: 'TEKOli',
          avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
          isBot: true,
          tag: 'BOT',
          role: 'Official Bot',
          color: '#5865F2',
        },
        content:
          '👋 Greetings warriors! I am **TEKOli**, your official tactical clan bot connected to MongoDB.\n\nI speak fluent **English** (preferred), **Português**, and other languages! Ask me anything about our ratholes: who owns them, TPs, exact coordinates, or nearest ratholes to any point (xx,yy)!',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const quickPrompts = [
    '@TekOli How should we defend rathole 3?',
    '@TekOli Who owns rathole 3?',
    '@TekOli Which ratholes are underwater?',
    '@TekOli update status to "builded" for rathole 59',
    '@TekOli Nearest ratholes to 12, 20',
    '@TekOli Good morning!',
    'Hello!',
    'Joey',
    'co-owner Joey',
    'responsible Joey',
    'owner Clutch',
    'What is the TP for rathole 1?',
    'Free ratholes',
    'Who is the co-owner of rathole 3?',
    '/help',
  ];

  return (
    <div className="flex h-full w-full bg-[#313338] text-zinc-100 overflow-hidden font-sans select-none">
      {/* Discord Left Channels Sidebar */}
      <div className="w-60 bg-[#2b2d31] flex flex-col shrink-0 border-r border-[#1f2023]/60 hidden sm:flex">
        {/* Server Header */}
        <div className="h-12 px-4 border-b border-[#1f2023] flex items-center justify-between font-bold text-white shadow-sm hover:bg-[#35373c] transition cursor-pointer">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm font-semibold truncate">ALPHA CLAN • ARK #104</span>
          </div>
          <span className="text-xs text-zinc-400">▼</span>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          <div>
            <div className="px-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              TEXT CHANNELS
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveChannel('ratholes-intel')}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition ${
                  activeChannel === 'ratholes-intel'
                    ? 'bg-[#35373c] text-white'
                    : 'text-zinc-400 hover:bg-[#35373c]/50 hover:text-zinc-200'
                }`}
              >
                <Hash className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="truncate">🏰-ratholes-intel</span>
                <span className="ml-auto text-[10px] bg-indigo-600 px-1.5 py-0.2 rounded-full text-white font-bold">
                  {ratholes.length}
                </span>
              </button>

              <button
                onClick={() => setActiveChannel('bot-commands')}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition ${
                  activeChannel === 'bot-commands'
                    ? 'bg-[#35373c] text-white'
                    : 'text-zinc-400 hover:bg-[#35373c]/50 hover:text-zinc-200'
                }`}
              >
                <Hash className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="truncate">🤖-bot-commands</span>
              </button>

              <button
                onClick={() => setActiveChannel('general')}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition ${
                  activeChannel === 'general'
                    ? 'bg-[#35373c] text-white'
                    : 'text-zinc-400 hover:bg-[#35373c]/50 hover:text-zinc-200'
                }`}
              >
                <Hash className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="truncate">💬-general</span>
              </button>
            </div>
          </div>

          <div>
            <div className="px-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              MONGODB STATUS
            </div>
            <div className="px-3 py-2.5 bg-[#1e1f22]/70 rounded-lg text-xs space-y-1.5 border border-zinc-800/60">
              <div className="flex items-center justify-between text-zinc-300">
                <span>Active ratholes:</span>
                <strong className="text-emerald-400 font-mono">{ratholes.length}</strong>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span>Collection:</span>
                <code className="text-indigo-300 font-mono text-[11px]">ratholes</code>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 pt-1 border-t border-zinc-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                TEKOli online and watching
              </div>
            </div>
          </div>
        </div>

        {/* User bar at bottom */}
        <div className="h-14 bg-[#232428] px-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80"
                alt="Gustavo Parada"
                className="w-8 h-8 rounded-full border border-zinc-700 object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#232428]" />
            </div>
            <div className="text-xs">
              <div className="font-semibold text-white truncate max-w-[90px]">Gustavo Parada</div>
              <div className="text-[10px] text-amber-400">#0001 • Leader</div>
            </div>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-[#35373c] transition"
            title={soundEnabled ? 'Mute Discord sound' : 'Enable Discord sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#313338]">
        {/* Channel Header Bar */}
        <div className="h-12 px-4 border-b border-[#1f2023] flex items-center justify-between bg-[#313338] shadow-sm shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="w-5 h-5 text-zinc-400 shrink-0" />
            <h3 className="font-bold text-white text-sm sm:text-base truncate">
              {activeChannel}
            </h3>
            <span className="text-zinc-600 hidden md:inline">|</span>
            <p className="text-xs text-zinc-400 truncate hidden md:inline">
              Ask @TEKOli about owners, TPs, coordinates, and nearby ratholes (x, y)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-[#232428] px-2.5 py-1 rounded-md border border-zinc-700/60 text-xs shadow-sm">
              <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <select
                value={botLanguage}
                onChange={(e) => setBotLanguage(e.target.value as any)}
                className="bg-transparent text-[11px] font-semibold text-zinc-200 hover:text-white focus:outline-none cursor-pointer"
                title="TEKOli preferred language"
              >
                <option value="auto" className="bg-[#232428] text-white">🌐 Auto-Detect (EN Default)</option>
                <option value="en" className="bg-[#232428] text-white">🇬🇧 English (Preferred)</option>
                <option value="fr" className="bg-[#232428] text-white">🇫🇷 Français</option>
                <option value="pt" className="bg-[#232428] text-white">🇧🇷 Português</option>
              </select>
            </div>

            <button
              onClick={() => onNavigateToRadar({ x: 12.0, y: 20.0 })}
              className="px-2.5 py-1 text-xs bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-md flex items-center gap-1.5 transition border border-indigo-500/40"
              title="Open the tactical coordinate map"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tactical Radar</span>
            </button>

            <button
              onClick={handleClearChat}
              className="p-1.5 text-zinc-400 hover:text-rose-400 rounded hover:bg-[#35373c] transition"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-4 py-2 bg-[#2b2d31]/80 border-b border-[#1f2023]/60 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 no-scrollbar">
          <span className="text-[11px] font-bold text-zinc-400 shrink-0 flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Quick prompts:
          </span>
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-full bg-[#383a40] hover:bg-indigo-600 hover:text-white text-zinc-300 border border-zinc-700/60 transition whitespace-nowrap text-[11px] font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => {
            const isBot = msg.author.isBot;

            return (
              <div
                key={msg.id}
                className="group flex items-start gap-3.5 hover:bg-[#2b2d31]/40 -mx-4 px-4 py-1.5 rounded-lg transition"
              >
                {/* Avatar */}
                <div className="relative shrink-0 mt-0.5">
                  <img
                    src={msg.author.avatar}
                    alt={msg.author.name}
                    className="w-10 h-10 rounded-full object-cover border border-zinc-700/60"
                  />
                  {isBot && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#313338]" />
                  )}
                </div>

                {/* Message Body */}
                <div className="flex-1 min-w-0">
                  {/* Name, Tag & Timestamp */}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="font-bold text-sm cursor-pointer hover:underline"
                      style={{ color: msg.author.color || '#ffffff' }}
                    >
                      {msg.author.name}
                    </span>

                    {isBot && (
                      <span className="px-1.5 py-0.5 rounded bg-[#5865F2] text-white text-[10px] font-extrabold uppercase tracking-wide">
                        BOT
                      </span>
                    )}

                    <span className="text-[11px] text-zinc-400 font-normal">
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Message Text Content */}
                  <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed select-text">
                    {msg.content}
                  </div>

                  {/* Rich Discord Embed */}
                  {msg.embed && (
                    <div
                      className="mt-2.5 max-w-2xl bg-[#2b2d31] border-l-4 rounded-r-lg p-3.5 shadow-md space-y-3"
                      style={{ borderLeftColor: msg.embed.color || '#5865F2' }}
                    >
                      {/* Embed Title */}
                      {msg.embed.title && (
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          {msg.embed.title}
                        </h4>
                      )}

                      {/* Embed Description */}
                      {msg.embed.description && (
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap">
                          {msg.embed.description}
                        </p>
                      )}

                      {/* Embed Fields */}
                      {msg.embed.fields && msg.embed.fields.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          {msg.embed.fields.map((field, fIdx) => (
                            <div
                              key={fIdx}
                              className={`p-2 rounded bg-[#1e1f22]/60 border border-zinc-800/80 ${
                                field.inline === false ? 'sm:col-span-2' : ''
                              }`}
                            >
                              <div className="text-[11px] font-bold text-zinc-400 mb-0.5">
                                {field.name}
                              </div>
                              <div className="text-xs text-zinc-200 whitespace-pre-wrap font-sans">
                                {field.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons on embed */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800">
                        <button
                          onClick={() => onNavigateToRadar()}
                          className="px-2.5 py-1 rounded bg-[#35373c] hover:bg-[#404249] text-xs text-zinc-200 flex items-center gap-1.5 transition font-medium"
                        >
                          <Compass className="w-3.5 h-3.5 text-indigo-400" />
                          View on radar
                        </button>

                        <button
                          onClick={() => handleSendMessage('Nearest ratholes to 12, 20')}
                          className="px-2.5 py-1 rounded bg-[#35373c] hover:bg-[#404249] text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                          Nearby (12, 20)
                        </button>
                      </div>

                      {/* Embed Footer */}
                      {msg.embed.footer && (
                        <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/60 flex items-center gap-1">
                          <Bot className="w-3 h-3 text-indigo-400" />
                          {msg.embed.footer.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 pl-2 py-1 animate-pulse">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
              </div>
              <strong className="text-white">TEKOli</strong> is checking MongoDB and typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Bar */}
        <div className="p-4 bg-[#313338] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="bg-[#383a40] rounded-xl px-4 py-2.5 flex items-center gap-3 border border-zinc-700/40 focus-within:border-indigo-500 transition shadow-inner"
          >
            <div className="w-7 h-7 rounded-full bg-[#4e5058] flex items-center justify-center text-zinc-300 shrink-0">
              <PlusCircle className="w-4 h-4" />
            </div>

            <input
              type="text"
              placeholder="Talk to @TEKOli (e.g. Who owns rathole 3? or nearest ratholes to 12, 20)..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-400 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="p-1.5 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-30 disabled:hover:bg-[#5865F2] text-white rounded-lg transition shrink-0"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 px-2 mt-1.5">
            <div>
              Tip: try <strong className="text-zinc-300">"who owns rathole 3"</strong> or{' '}
              <strong className="text-zinc-300">"nearest ratholes to 12, 20"</strong>.
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              MongoDB + Gemini AI active
            </div>
          </div>
        </div>
      </div>

      {/* Right Members Sidebar */}
      {showMembers && (
        <div className="w-60 bg-[#2b2d31] p-3 border-l border-[#1f2023]/60 hidden xl:flex flex-col shrink-0 overflow-y-auto">
          {/* Bots */}
          <div className="mb-4">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              BOTS — 1
            </div>
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#35373c] transition cursor-pointer">
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=60&auto=format&fit=crop&q=80"
                  alt="TEKOli"
                  className="w-8 h-8 rounded-full border border-indigo-500/40 object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#2b2d31]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm font-semibold text-indigo-300">
                  <span>TEKOli</span>
                  <span className="px-1 py-0.2 rounded bg-[#5865F2] text-white text-[9px] font-extrabold">
                    BOT
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  Playing <strong>ARK: Radar</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Leaders */}
          <div className="mb-4">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              LEADERS / ADMINS — 2
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#35373c] transition cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 text-xs">
                  B
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-400 truncate">Beno</div>
                  <div className="text-[10px] text-zinc-400 truncate">👑 Owner RH #3, #39, #58</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#35373c] transition cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-300 text-xs">
                  D
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-indigo-300 truncate">DAB</div>
                  <div className="text-[10px] text-zinc-400 truncate">👑 Owner RH #1, #19, #37</div>
                </div>
              </div>
            </div>
          </div>

          {/* Members */}
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              TRIBE MEMBERS — 8
            </div>
            <div className="space-y-1">
              {[
                { name: 'Joey', role: '🛡️ Co-Owner RH #3 • Owner #8, #12', status: 'online' },
                { name: 'Clutch', role: '👑 Owner RH #4, #18, #22, #32, #40', status: 'online' },
                { name: 'ASTE', role: '👑 Owner RH #2, #20, #35, #38, #56', status: 'online' },
                { name: 'Oli', role: '👑 Owner RH #11, #15, #29, #47, #75', status: 'idle' },
                { name: 'Coeus', role: '👑 Owner RH #5, #23, #41, #78', status: 'online' },
                { name: 'Prin', role: '👑 Owner RH #6, #24, #42, #60', status: 'online' },
                { name: 'Howess', role: '👑 Owner RH #16, #30, #49, #77', status: 'dnd' },
                { name: 'khacis', role: '👑 Owner RH #7, #25, #43, #61, #71', status: 'online' },
              ].map((member, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 px-2 py-1 rounded-lg hover:bg-[#35373c] transition cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                    {member.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-200 truncate">{member.name}</div>
                    <div className="text-[10px] text-zinc-400 truncate">{member.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
