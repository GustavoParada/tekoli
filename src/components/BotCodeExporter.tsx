import React, { useState, useEffect } from 'react';
import {
  Code,
  Copy,
  Check,
  FileCode,
  Terminal,
  Archive,
  BookOpen,
  Radio,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Server,
  ShieldAlert,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  BOT_INDEX_JS,
  BOT_MODEL_JS,
  BOT_DEPLOY_JS,
  BOT_ENV_EXAMPLE,
  BOT_PACKAGE_JSON,
  BOT_README_MD,
} from '../data/botCodeTemplates';

export interface BotRuntimeStatus {
  configured: boolean;
  online: boolean;
  connecting: boolean;
  botTag: string | null;
  botId: string | null;
  guildsCount: number;
  guilds: Array<{ id: string; name: string; memberCount: number }>;
  lastError: string | null;
  slashCommandsRegistered: boolean;
  publicKeyConfigured?: boolean;
  mongoConnected: boolean;
  ratholesCount: number;
}

interface BotCodeExporterProps {
  botStatus?: BotRuntimeStatus | null;
  onRefreshStatus?: () => void;
}

export const BotCodeExporter: React.FC<BotCodeExporterProps> = ({
  botStatus,
  onRefreshStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'index' | 'model' | 'deploy' | 'env' | 'package' | 'readme'>('index');
  const [copied, setCopied] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const pingUrl = `${originUrl}/api/ping`;
  const interactionsUrl = `${originUrl}/api/discord/interactions`;

  const handleCopyEndpoint = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedEndpoint(key);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  useEffect(() => {
    onRefreshStatus?.();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefreshStatus?.();
    setTimeout(() => setRefreshing(false), 400);
  };

  const botCodeFiles: Record<string, string> = {
    index: BOT_INDEX_JS,
    model: BOT_MODEL_JS,
    deploy: BOT_DEPLOY_JS,
    env: BOT_ENV_EXAMPLE,
    package: BOT_PACKAGE_JSON,
    readme: BOT_README_MD,
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(botCodeFiles[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();

      zip.file('index.js', BOT_INDEX_JS);
      zip.file('models/Rathole.js', BOT_MODEL_JS);
      zip.file('deploy-commands.js', BOT_DEPLOY_JS);
      zip.file('.env.example', BOT_ENV_EXAMPLE);
      zip.file('package.json', BOT_PACKAGE_JSON);
      zip.file('README.md', BOT_README_MD);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tekoli-discord-bot.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao gerar ZIP:', err);
    } finally {
      setDownloadingZip(false);
    }
  };

  const tabs: Array<{ id: 'index' | 'model' | 'deploy' | 'env' | 'package' | 'readme'; label: string; icon: any }> = [
    { id: 'index', label: 'index.js (Bot Core)', icon: FileCode },
    { id: 'model', label: 'models/Rathole.js', icon: Code },
    { id: 'deploy', label: 'deploy-commands.js', icon: Terminal },
    { id: 'env', label: '.env.example', icon: FileCode },
    { id: 'package', label: 'package.json', icon: FileCode },
    { id: 'readme', label: 'README.md (Tutorial)', icon: BookOpen },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 p-4 md:p-6 overflow-y-auto space-y-5">
      {/* Live Discord Gateway Diagnostic Card */}
      <div className="p-4 md:p-5 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                botStatus?.online
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-400'
              }`}
            >
              <Radio className={`w-5 h-5 ${botStatus?.online ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm md:text-base font-bold text-white">
                  Status Real no Discord (Gateway)
                </h3>
                {botStatus?.online ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    🟢 ONLINE ({botStatus.botTag})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    🔴 OFFLINE NO DISCORD
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {botStatus?.online
                  ? `Conectado em ${botStatus.guildsCount} servidor(es) • ${botStatus.ratholesCount} ratholes carregados (${botStatus.mongoConnected ? 'MongoDB Atlas' : 'Memória Local'})`
                  : botStatus?.configured
                  ? 'Token detectado, aguardando conexão com Discord Gateway...'
                  : 'O servidor web está publicado, mas falta o DISCORD_TOKEN para logar o bot no Discord.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-zinc-700 shrink-0 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar Status
          </button>
        </div>

        {/* Specific Error Alert if Discord rejected login/intents */}
        {botStatus?.lastError && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-rose-300 mb-0.5">Erro reportado pelo Discord:</strong>
              {botStatus.lastError}
            </div>
          </div>
        )}

        {/* Troubleshooting / Activation Checklist */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              {botStatus?.configured ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              1. Configurar DISCORD_TOKEN nos Secrets
            </div>
            <p className="text-zinc-400 leading-relaxed">
              No painel <strong>Secrets</strong> (variáveis de ambiente) do AI Studio, crie a variável{' '}
              <code className="px-1.5 py-0.5 bg-zinc-800 text-indigo-300 rounded">DISCORD_TOKEN</code> com o token gerado em{' '}
              <em>Discord Developer Portal &rarr; Bot &rarr; Reset Token</em>. Sem esse token, o servidor não consegue logar no Discord e o bot fica offline.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              2. Ativar "Message Content Intent" no Portal
            </div>
            <p className="text-zinc-400 leading-relaxed">
              No <strong>Discord Developer Portal &rarr; Bot &rarr; Privileged Gateway Intents</strong>, ative obrigatoriamente{' '}
              <strong className="text-emerald-300">MESSAGE CONTENT INTENT</strong> e{' '}
              <strong className="text-emerald-300">SERVER MEMBERS INTENT</strong>. Sem isso, o bot não lê mensagens no chat.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400 shrink-0" />
              3. Permissões & Convite OAuth2
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Em <strong>OAuth2 &rarr; URL Generator</strong>, marque os scopes{' '}
              <code className="px-1 bg-zinc-800 text-indigo-300 rounded">bot</code> e{' '}
              <code className="px-1 bg-zinc-800 text-indigo-300 rounded">applications.commands</code>, com permissões de{' '}
              <em>View Channels, Send Messages, Embed Links, Read Message History</em>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
              4. Manter Online 24/7 ou Religar por Request
            </div>
            <p className="text-zinc-400 leading-relaxed">
              O servidor do AI Studio (Cloud Run) hiberna após ~15 min sem tráfego HTTP e fecha o WebSocket do Discord. Para evitar ou religar automaticamente:
            </p>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between gap-2 bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-emerald-400">Keep-Alive (UptimeRobot a cada 5 min)</div>
                  <div className="text-[10px] font-mono text-zinc-300 truncate">{pingUrl}</div>
                </div>
                <button
                  onClick={() => handleCopyEndpoint('ping', pingUrl)}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 shrink-0"
                >
                  {copiedEndpoint === 'ping' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-indigo-400">
                    Interactions URL (Religa ao usar /rathole){botStatus?.publicKeyConfigured ? ' ✓' : ''}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-300 truncate">{interactionsUrl}</div>
                </div>
                <button
                  onClick={() => handleCopyEndpoint('interactions', interactionsUrl)}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 shrink-0"
                >
                  {copiedEndpoint === 'interactions' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Obs.: se o link publicado exigir login Google, pings externos serão bloqueados — nesse caso, para 100% online 24/7 sem hibernação, baixe o <strong>.ZIP</strong> e rode na <em>Discloud, SquareCloud, Railway ou VPS</em>.
            </p>
          </div>
        </div>
      </div>

      {/* Header Banner for ZIP Exporter */}
      <div className="p-4 md:p-6 bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-zinc-900 border border-indigo-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
              Código Completo do Bot TEKOli (Node.js & MongoDB)
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                Discord.js v14
              </span>
            </h2>
            <p className="text-xs text-zinc-300">
              Inclui suporte a Slash Commands, inglês preferencial, filtro estrito por Owner e oferta de Co-Owner.
            </p>
          </div>
        </div>

        {/* Download Zip CTA */}
        <button
          onClick={handleDownloadZip}
          disabled={downloadingZip}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-indigo-600/30 shrink-0"
        >
          <Archive className="w-4 h-4" />
          {downloadingZip ? 'Gerando Pacote...' : 'Baixar Projeto Completo (.ZIP)'}
        </button>
      </div>

      {/* Code Viewer Container */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[460px]">
        {/* Tabs Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-950 border-b border-zinc-800 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition whitespace-nowrap ${
                    isActive
                      ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 text-indigo-400" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition border border-zinc-700 shrink-0 ml-2"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Arquivo</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content Area */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-[#0d1117] font-mono text-xs text-zinc-300 leading-relaxed select-text">
          <pre className="whitespace-pre-wrap">{botCodeFiles[activeTab]}</pre>
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Compatível com Node.js 18+ e Mongoose 8+</span>
          </div>
          <span className="text-zinc-500 text-[11px]">
            Inclui Slash Commands, cálculo euclidiano 2D e filtro padrão por Owner
          </span>
        </div>
      </div>
    </div>
  );
};
