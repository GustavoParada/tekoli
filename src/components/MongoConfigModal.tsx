import React, { useState } from 'react';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw, Upload, Download, Key, Server, HelpCircle } from 'lucide-react';
import { Rathole } from '../types/rathole';

interface MongoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  mongoUri: string;
  setMongoUri: (uri: string) => void;
  dbName: string;
  setDbName: (name: string) => void;
  collectionName: string;
  setCollectionName: (name: string) => void;
  ratholes: Rathole[];
  onRatholesUpdate: (newRatholes: Rathole[]) => void;
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;
}

export const MongoConfigModal: React.FC<MongoConfigModalProps> = ({
  isOpen,
  onClose,
  mongoUri,
  setMongoUri,
  dbName,
  setDbName,
  collectionName,
  setCollectionName,
  ratholes,
  onRatholesUpdate,
  webhookUrl,
  setWebhookUrl,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    docCount?: number;
  } | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!mongoUri.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor, insira a URI de conexão do MongoDB (ex: mongodb+srv://...).',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/mongodb/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri: mongoUri.trim(),
          dbName: dbName.trim() || 'tekoli_db',
          collectionName: collectionName.trim() || 'ratholes',
        }),
      });
      const data = await res.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: `Conexão bem sucedida! Banco: "${data.database}", Coleção: "${data.collection}"`,
          docCount: data.documentCount,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Falha ao conectar no MongoDB. Verifique credenciais e IP Whitelist.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Erro na requisição: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handlePushToMongo = async () => {
    if (!mongoUri.trim()) {
      setSyncStatus('⚠️ Configure a URI do MongoDB primeiro antes de sincronizar.');
      return;
    }

    setSyncing(true);
    setSyncStatus('Enviando dados para o MongoDB...');

    try {
      const res = await fetch('/api/mongodb/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri: mongoUri.trim(),
          dbName: dbName.trim() || 'tekoli_db',
          collectionName: collectionName.trim() || 'ratholes',
          ratholes,
          action: 'push',
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSyncStatus(`✅ ${ratholes.length} ratholes sincronizados no MongoDB com sucesso!`);
      } else {
        setSyncStatus(`❌ Erro ao enviar: ${data.error}`);
      }
    } catch (err: any) {
      setSyncStatus(`❌ Erro: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handlePullFromMongo = async () => {
    if (!mongoUri.trim()) {
      setSyncStatus('⚠️ Configure a URI do MongoDB primeiro antes de baixar.');
      return;
    }

    setSyncing(true);
    setSyncStatus('Buscando ratholes do MongoDB...');

    try {
      const res = await fetch('/api/mongodb/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri: mongoUri.trim(),
          dbName: dbName.trim() || 'tekoli_db',
          collectionName: collectionName.trim() || 'ratholes',
          action: 'pull',
        }),
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.ratholes)) {
        if (data.ratholes.length === 0) {
          setSyncStatus('⚠️ Coleção vazia no MongoDB. Use "Enviar para o MongoDB" para popular.');
        } else {
          // Normalize ids
          const normalized = data.ratholes.map((r: any) => ({
            id: r.id || r._id || `rh-${r.numero}`,
            numero: r.numero,
            name: r.name || `Rathole #${r.numero}`,
            coords: r.coords || { x: 0, y: 0 },
            owner: r.owner || 'Sem Dono',
            coOwner: r.coOwner || 'Nenhum',
            tp: r.tp || `TP-RH-${r.numero}`,
            server: r.server || 'The Island',
            status: r.status || 'ocupado',
            notes: r.notes || '',
            turretsCount: r.turretsCount || 0,
            updatedAt: r.updatedAt || new Date().toISOString(),
          }));
          onRatholesUpdate(normalized);
          setSyncStatus(`✅ ${normalized.length} ratholes importados do MongoDB para o painel!`);
        }
      } else {
        setSyncStatus(`❌ Erro: ${data.error || 'Nenhum dado retornado'}`);
      }
    } catch (err: any) {
      setSyncStatus(`❌ Erro ao buscar: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Conexão MongoDB • TEKOli Bot
              </h3>
              <p className="text-xs text-zinc-400">
                Conecte a base de dados real do seu bot para persistência e consultas ao vivo
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status banner */}
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-start gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 animate-pulse" />
            <div className="text-xs text-zinc-300">
              <span className="font-semibold text-emerald-400">Modo Híbrido Ativo: </span>
              Se nenhuma URI for fornecida, o painel roda com o banco local persistido em memória/localStorage com 10 ratholes prontos. Ao inserir sua URI do MongoDB Atlas, você pode testar e sincronizar diretamente!
            </div>
          </div>

          {/* URI input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                MongoDB Connection String (URI)
              </span>
              <button
                type="button"
                onClick={() => setShowTutorial(!showTutorial)}
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                {showTutorial ? 'Ocultar Tutorial' : 'Como obter URI grátis?'}
              </button>
            </label>
            <input
              type="password"
              placeholder="mongodb+srv://usuario:senha@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority"
              value={mongoUri}
              onChange={(e) => {
                setMongoUri(e.target.value);
                setTestResult(null);
              }}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500 placeholder-zinc-600"
            />
            <p className="text-[11px] text-zinc-500">
              Sua senha e credenciais permanecem salvas apenas no seu navegador ou enviadas com segurança ao testar a conexão.
            </p>
          </div>

          {/* IP Whitelist Info Card */}
          <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                🌐 Qual IP liberar no MongoDB Atlas (Network Access)?
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                Recomendado
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Como este painel e o bot de Discord rodam em ambiente de nuvem (Google Cloud) com IPs dinâmicos, o IP correto e padrão para colocar no MongoDB Atlas é:
            </p>

            <div className="flex items-center gap-2 pt-1">
              <code className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-amber-300 font-mono text-xs rounded-lg font-bold">
                0.0.0.0/0
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText('0.0.0.0/0');
                  setSyncStatus('📋 "0.0.0.0/0" copiado! Cole em Network Access no MongoDB Atlas.');
                  setTimeout(() => setSyncStatus(null), 3000);
                }}
                className="px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-lg text-xs transition font-medium"
              >
                Copiar 0.0.0.0/0
              </button>
              <span className="text-[11px] text-zinc-500">
                (Opção <em>"Allow Access from Anywhere"</em> no Atlas)
              </span>
            </div>

            <div className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/80">
              🔒 <strong>Segurança:</strong> O acesso ao banco continua 100% protegido pelo seu usuário, senha forte do MongoDB e criptografia TLS/SSL.
            </div>
          </div>

          {showTutorial && (
            <div className="p-4 bg-zinc-950 border border-indigo-500/30 rounded-xl text-xs text-zinc-300 space-y-2">
              <h4 className="font-bold text-indigo-400 flex items-center gap-1.5">
                📖 Como criar um MongoDB Atlas Grátis (M0 Free Tier):
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                <li>Acesse <strong>mongodb.com/atlas</strong> e crie uma conta gratuita.</li>
                <li>Crie um cluster <strong>M0 (Free)</strong> selecionando qualquer região próxima (ex: São Paulo ou Virgínia).</li>
                <li>Em <strong>Database Access</strong>, crie um usuário com senha simples.</li>
                <li>Em <strong>Network Access</strong>, adicione <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-300">0.0.0.0/0</code> (Allow Access from Anywhere).</li>
                <li>Clique em <strong>Connect &gt; Drivers (Node.js)</strong> e copie a connection string!</li>
              </ol>
            </div>
          )}

          {/* Database & Collection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-zinc-400" />
                Nome do Banco (Database)
              </label>
              <input
                type="text"
                placeholder="tekoli_db"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-zinc-400" />
                Nome da Coleção (Collection)
              </label>
              <input
                type="text"
                placeholder="ratholes"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Discord Webhook (optional) */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <span className="text-indigo-400">#</span>
              Discord Webhook URL (Opcional - para enviar pings reais no seu servidor Discord)
            </label>
            <input
              type="text"
              placeholder="https://discord.com/api/webhooks/1234567890/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500 placeholder-zinc-600"
            />
          </div>

          {/* Test & Sync Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-emerald-600/20"
              >
                {testing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {testing ? 'Testando Conexão...' : 'Testar Conexão MongoDB'}
              </button>

              <button
                type="button"
                onClick={handlePushToMongo}
                disabled={syncing || !mongoUri}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-zinc-700"
                title="Salva os ratholes atuais nesta tela dentro da coleção MongoDB"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                Enviar Ratholes para MongoDB ({ratholes.length})
              </button>

              <button
                type="button"
                onClick={handlePullFromMongo}
                disabled={syncing || !mongoUri}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-zinc-700"
                title="Substitui os ratholes do painel pelos que estão salvos no MongoDB"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Carregar do MongoDB
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{testResult.message}</p>
                  {testResult.docCount !== undefined && (
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Total de documentos na coleção: <strong className="text-white">{testResult.docCount}</strong>
                    </p>
                  )}
                </div>
              </div>
            )}

            {syncStatus && (
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
                {syncStatus}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md transition"
          >
            Concluir & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
