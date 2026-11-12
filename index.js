// ============================================================================
// TEKOli Discord Bot - Main Entry Point (index.js)
// Discord.js v14 + MongoDB (Mongoose)
// ============================================================================

require('dotenv').config();
const http = require('http');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
} = require('discord.js');
const mongoose = require('mongoose');
const Rathole = require('./models/Rathole');
const {
  DONO_KEYWORDS,
  RESP_KEYWORDS,
  matchesKeyword,
  stripCommandPrefix,
  escapeRegex,
  parseOwnerQuestion,
} = require('./lib/text-commands');
const {
  ownerFromDiscordUser,
  canonicalOwnerName,
  linkDiscordUser,
  ensureKnownPeople,
} = require('./lib/people');

const EMBED_FIELD_LIMIT = 25;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Ativar no Discord Developer Portal
  ],
});

function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildHelpEmbed() {
  return new EmbedBuilder()
    .setTitle('🤖 TEKOli • Commands & Help (Bilingual)')
    .setColor(0x5865f2)
    .setDescription('You can ask in English (preferred) or Portuguese:')
    .addFields(
      { name: 'Common Queries / Perguntas Comuns', value: '• "Who owns rathole 3?" / "A quem pertence o rathole 3?"\n• "Nearest ratholes to 14.9, 85.8" / "Próximo de 14.9, 85.8"\n• "what is Oli ratholes?" / "quais os ratholes do Oli"\n• "quais os ratholes do @Olimpikus" (usa o nome ligado à conta)\n• "owner Clutch" / "dono Clutch"\n• /rathole vincular para ligar sua conta Discord ao nome de owner\n• "responsible Joey" / "responsavel Joey"\n• "What is the TP for rathole 1?" / "Qual o TP do rathole 1?"' },
      { name: 'Slash Commands', value: '/rathole info <number>\n/rathole owner <player> (or /rathole dono)\n/rathole responsible <player> (or /rathole responsavel)\n/rathole near <x> <y> (or /rathole proximo)\n/rathole list (or /rathole listar)\n/rathole vincular <nome> (or /rathole link)' }
    );
}

function addLimitedFields(embed, items, toField) {
  const shown = items.slice(0, EMBED_FIELD_LIMIT);
  shown.forEach((item, index) => embed.addFields(toField(item, index)));
  if (items.length > shown.length) {
    const note = `Mostrando ${shown.length} de ${items.length}.`;
    const current = embed.data.description;
    embed.setDescription(current ? `${current}\n${note}` : note);
  }
  return embed;
}

async function buildNumeroPayload(targetNumero) {
  const rh = await Rathole.findOne({ numero: targetNumero });

  if (!rh) {
    return { content: `🔍 O **Rathole #${targetNumero}** não foi encontrado na base de dados MongoDB.` };
  }

  const color = rh.status === 'ocupado' ? 0x5865f2 : rh.status === 'livre' ? 0x57f287 : 0xed4245;

  const embed = new EmbedBuilder()
    .setTitle(`🏰 Informações do Rathole #${rh.numero} • ${rh.name}`)
    .setDescription(`Aqui estão os dados completos do **Rathole #${rh.numero}**:`)
    .setColor(color)
    .addFields(
      { name: '👑 Owner Principal', value: `**${rh.owner}**`, inline: true },
      { name: '🛡️ Co-Owner', value: `**${rh.coOwner}**`, inline: true },
      { name: '🏷️ Status', value: rh.status.toUpperCase(), inline: true },
      { name: '📍 Coordenadas', value: `(${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})`, inline: true },
      { name: '⚡ Teleport (TP)', value: `${rh.tp}\n*(Comando: /tp ${rh.coords.x.toFixed(1)} ${rh.coords.y.toFixed(1)})*`, inline: true },
      { name: '🗺️ Servidor', value: rh.server || 'The Island', inline: true }
    )
    .setFooter({ text: 'TEKOli Bot • Sistema Tático' })
    .setTimestamp();

  if (rh.notes) {
    embed.addFields({ name: '📝 Notas Táticas', value: rh.notes, inline: false });
  }

  const responseText = `🏰 O **Rathole #${rh.numero}** pertence a **${rh.owner}** (Co-Owner: **${rh.coOwner}**)!\n📍 Coordenadas: (${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)}) | ⚡ TP: ${rh.tp}`;

  return { content: responseText, embeds: [embed] };
}

async function buildProximityPayload(targetX, targetY) {
  const allRatholes = await Rathole.find({});
  if (allRatholes.length === 0) {
    return { content: '❌ Nenhum rathole cadastrado na base MongoDB.' };
  }

  const ranked = allRatholes
    .map((rh) => ({
      rathole: rh,
      dist: calculateDistance(targetX, targetY, rh.coords.x, rh.coords.y),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);

  const nearest = ranked[0].rathole;

  const embed = new EmbedBuilder()
    .setTitle(`🎯 Radar TEKOli • Ratholes Próximos de (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`)
    .setDescription('Identifiquei os ratholes mais próximos deste ponto tático:')
    .setColor(0x5865f2)
    .setFooter({ text: 'TEKOli Bot • Suporte MongoDB' })
    .setTimestamp();

  ranked.forEach((item, index) => {
    const r = item.rathole;
    embed.addFields({
      name: `${index === 0 ? '⭐ Mais Próximo: ' : ''}#${r.numero} - ${r.name} [${item.dist.toFixed(1)}m]`,
      value: `👑 **Owner:** ${r.owner}\n🛡️ **Co-Owner:** ${r.coOwner}\n📍 **Coordenadas:** (${r.coords.x.toFixed(1)}, ${r.coords.y.toFixed(1)})\n⚡ **TP:** ${r.tp}  *(Console: /tp ${r.coords.x.toFixed(1)} ${r.coords.y.toFixed(1)})*\n🏷️ **Status:** ${r.status.toUpperCase()}`,
    });
  });

  return {
    content: `📡 **Radar TEKOli:** Os ratholes mais próximos de **(${targetX.toFixed(1)}, ${targetY.toFixed(1)})** foram localizados! O mais próximo é o **Rathole #${nearest.numero}** (${nearest.name}) a **${ranked[0].dist.toFixed(1)}m**, pertencente a **${nearest.owner}** com TP ${nearest.tp}.`,
    embeds: [embed],
  };
}

async function buildPersonPayload(nameTarget, ownerOnly) {
  const trimmed = (nameTarget || '').trim().slice(0, 64);
  if (trimmed.length < 2) {
    return { content: 'Informe o nome do jogador com pelo menos 2 caracteres.' };
  }

  const regex = new RegExp(escapeRegex(trimmed), 'i');
  const query = ownerOnly
    ? { owner: regex }
    : { $or: [{ owner: regex }, { coOwner: regex }] };

  const matches = await Rathole.find(query).sort({ numero: 1 });
  const filterTitle = ownerOnly ? '👑 Dono (Owner Principal)' : '👥 Responsável (Owner e Co-Owner)';

  if (matches.length === 0) {
    return { content: `🔍 Nenhum rathole encontrado para **"${trimmed}"** filtrando por **${filterTitle}**.` };
  }

  const embed = new EmbedBuilder()
    .setTitle(`${filterTitle}: Ratholes de "${trimmed}" (${matches.length})`)
    .setColor(ownerOnly ? 0xf59e0b : 0x5865f2)
    .setFooter({ text: `TEKOli Bot • Filtro: ${filterTitle}` })
    .setTimestamp();

  addLimitedFields(embed, matches, (rh) => ({
    name: `#${rh.numero} - ${rh.name}`,
    value: `👑 **Owner:** ${rh.owner}\n🛡️ **Co-Owner:** ${rh.coOwner}\n📍 **Coords:** (${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\n⚡ **TP:** ${rh.tp}`,
  }));

  const replySummary = ownerOnly
    ? `👑 **Filtro por Dono:** Encontrei **${matches.length} rathole(s)** onde **${trimmed}** é o **Owner Principal**!`
    : `👥 **Filtro por Responsável:** Encontrei **${matches.length} rathole(s)** onde **${trimmed}** é **Responsável (Owner ou Co-Owner)**!`;

  return { content: replySummary, embeds: [embed] };
}

async function buildFreePayload() {
  const free = await Rathole.find({ status: 'livre' });
  if (free.length === 0) {
    return { content: '🛡️ No ratholes currently free. All are occupied or on reserve.' };
  }

  const embed = new EmbedBuilder()
    .setTitle(`🟢 Available / Free Ratholes (${free.length})`)
    .setColor(0x57f287)
    .setDescription('Open positions available for clan members or expansion:');

  addLimitedFields(embed, free, (r) => ({
    name: `#${r.numero} - ${r.name}`,
    value: `📍 Coords: (${r.coords.x}, ${r.coords.y}) | ⚡ TP: ${r.tp}`,
  }));

  return { embeds: [embed] };
}

async function buildListPayload() {
  const all = await Rathole.find({}).sort({ numero: 1 });
  if (all.length === 0) {
    return { content: '❌ Nenhum rathole cadastrado na base MongoDB.' };
  }

  const embed = new EmbedBuilder()
    .setTitle(`📋 Ratholes cadastrados (${all.length})`)
    .setColor(0x5865f2)
    .setTimestamp();

  addLimitedFields(embed, all, (rh) => ({
    name: `#${rh.numero} - ${rh.name}`,
    value: `👑 **Owner:** ${rh.owner}\n🛡️ **Co-Owner:** ${rh.coOwner}\n📍 (${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\n⚡ **TP:** ${rh.tp}\n🏷️ **Status:** ${rh.status.toUpperCase()}`,
  }));

  return { embeds: [embed] };
}

function databaseNameFromUri(uri) {
  try {
    const normalized = uri.replace(/^mongodb(\+srv)?:\/\//, 'http://');
    const name = decodeURIComponent(new URL(normalized).pathname.replace(/^\//, '').split('/')[0] || '');
    return name || null;
  } catch (err) {
    return null;
  }
}

function envFlag(name) {
  const value = process.env[name];
  if (value == null || value.trim() === '') return 'AUSENTE';
  return 'definido';
}

function cleanEnv(name) {
  const raw = process.env[name] || '';
  const trimmed = raw.trim();
  const unquoted = trimmed.replace(/^['"]|['"]$/g, '');
  if (trimmed !== unquoted) {
    console.warn(`[TEKOli] ${name} estava entre aspas. As aspas foram removidas.`);
  }
  return unquoted;
}

function startHealthServer() {
  const port = Number(process.env.PORT) || 8080;
  const server = http.createServer((req, res) => {
    const mongoStates = ['desconectado', 'conectado', 'conectando', 'desconectando'];
    const payload = {
      ok: true,
      discord: client.isReady() ? 'online' : 'offline',
      user: client.user ? client.user.tag : null,
      mongo: mongoStates[mongoose.connection.readyState] || String(mongoose.connection.readyState),
      database: mongoose.connection.name || null,
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  });

  server.listen(port, () => {
    console.log(`[TEKOli] Health check na porta ${port}. O App Service usa essa porta para manter o processo no ar.`);
  });
  server.on('error', (err) => {
    console.error(`[TEKOli] Não foi possível abrir a porta ${port}: ${err.message}`);
  });
}

function logStartup() {
  console.log(`[TEKOli] Processo iniciado. Node ${process.version}. PORT=${process.env.PORT || '(não definido, usando 8080)'}`);
  console.log(`[TEKOli] DISCORD_TOKEN: ${envFlag('DISCORD_TOKEN')} | CLIENT_ID: ${envFlag('CLIENT_ID')} | MONGODB_URI: ${envFlag('MONGODB_URI')}`);
}

async function logMongoInventory() {
  const db = mongoose.connection;
  const collections = await db.db.listCollections().toArray();
  const names = collections.map((item) => item.name);
  const count = names.includes('ratholes') ? await Rathole.estimatedDocumentCount() : 0;
  console.log(`[TEKOli] Mongo host=${db.host} banco="${db.name}" coleção ratholes=${count}`);
  console.log(`[TEKOli] Coleções neste banco: ${names.join(', ') || '(nenhuma)'}`);
  if (count === 0 && names.length > 0) {
    console.warn('[TEKOli] A coleção "ratholes" está vazia ou não existe. O bot só lê essa coleção, neste banco.');
  }
}

function startMongo() {
  const uri = cleanEnv('MONGODB_URI');
  if (!uri) {
    console.error('[TEKOli] MONGODB_URI ausente. O bot sobe no Discord, mas as consultas vão falhar.');
    return;
  }

  let connectUri = uri;
  const databaseName = databaseNameFromUri(uri);
  if (!databaseName) {
    const queryIndex = uri.indexOf('?');
    const base = queryIndex === -1 ? uri : uri.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : uri.slice(queryIndex);
    const withSlash = base.endsWith('/') ? base : `${base}/`;
    connectUri = `${withSlash}tekoli_db${query}`;
    console.warn('[TEKOli] MONGODB_URI sem nome de banco. Usando tekoli_db.');
  } else {
    console.log(`[TEKOli] Banco pedido na URI: "${databaseName}"`);
  }

  mongoose.connection.on('disconnected', () => console.warn('[TEKOli] MongoDB desconectou.'));
  mongoose.connection.on('reconnected', () => console.log('[TEKOli] MongoDB reconectou.'));
  mongoose.connection.on('error', (err) => console.error('[TEKOli] Erro do MongoDB:', err.message));

  mongoose.connect(connectUri)
    .then(async () => {
      console.log('[TEKOli] Conectado ao MongoDB.');
      await logMongoInventory();
      await ensureKnownPeople();
    })
    .catch((err) => console.error('[TEKOli] Erro de conexão MongoDB:', err.message));
}

function startDiscord() {
  const token = cleanEnv('DISCORD_TOKEN');
  if (!token) {
    console.error('[TEKOli] DISCORD_TOKEN ausente. O bot permanece offline.');
    return;
  }

  client.once('ready', () => {
    const guilds = [...client.guilds.cache.values()].map((guild) => `${guild.name} (${guild.id})`);
    console.log(`[TEKOli] Bot online como ${client.user.tag}. Servidores: ${guilds.join(', ') || '(nenhum — o bot não foi convidado)'}`);
    client.user.setActivity('ARK / Rust • Radar de Ratholes', { type: 0 });
  });

  client.on('error', (err) => console.error('[TEKOli] Erro do cliente Discord:', err.message));
  client.on('warn', (message) => console.warn('[TEKOli] Aviso do Discord:', message));
  client.on('shardError', (err) => console.error('[TEKOli] Erro de conexão com o gateway:', err.message));
  client.on('shardDisconnect', (event, shardId) => {
    console.warn(`[TEKOli] Gateway desconectou. shard=${shardId} code=${event?.code} reason=${event?.reason || ''}`);
  });
  client.on('shardReconnecting', (shardId) => console.warn(`[TEKOli] Gateway reconectando. shard=${shardId}`));
  client.on('shardResume', (shardId, replayed) => console.log(`[TEKOli] Gateway retomou. shard=${shardId} eventos=${replayed}`));

  console.log('[TEKOli] Pedindo login no Discord...');
  client.login(token).catch((err) => {
    console.error('[TEKOli] Falha no login do Discord:', err.message);
    if (/disallowed intent/i.test(err.message)) {
      console.error('[TEKOli] Ligue Message Content Intent em Discord Developer Portal → Bot → Privileged Gateway Intents.');
    }
  });
}

process.on('unhandledRejection', (err) => {
  console.error('[TEKOli] Promise rejeitada:', err instanceof Error ? err.message : err);
});
process.on('uncaughtException', (err) => {
  console.error('[TEKOli] Exceção não tratada:', err.message);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!client.user || !message.mentions.users.has(client.user.id)) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();
  console.log(`[TEKOli] Mensagem de ${message.author.tag} em #${message.channel?.name || message.channelId}: ${content.slice(0, 80)}`);

  if (content.length < 2) return;

  if (lower === 'good morning' || lower === 'gm' || lower.startsWith('good morning') || lower === 'bom dia' || lower.startsWith('bom dia')) {
    const isEn = !lower.includes('bom dia');
    try {
      const count = await Rathole.countDocuments();
      const reply = isEn
        ? `☀️ **Good morning, warrior!** TEKOli standing by on high alert. All **${count} clan ratholes** are monitored on our tactical radar. Perimeters are secure. What coordinates or TP do you need today?`
        : `☀️ **Bom dia, guerreiro!** TEKOli pronto e em prontidão de combate! Todos os **${count} ratholes** do clã estão monitorados no MongoDB. Defesas ativas. O que você precisa hoje?`;
      return message.reply(reply);
    } catch (e) {
      return message.reply('☀️ **Good morning, warrior!** TEKOli standing by. How can I assist the tribe today?');
    }
  }

  if (lower.includes('how are you') || lower.includes('tudo bem') || lower.includes('como vai')) {
    const isEn = lower.includes('how are you');
    return message.reply(isEn
      ? '🛡️ **100% Combat Operational!** MongoDB connected, radar active. Ready to assist the tribe.'
      : '🛡️ **100% de Prontidão Operacional!** Conexão com MongoDB ativa e radar em tempo real. Pronto para apoiar o clã.');
  }

  if (lower === 'hello' || lower === 'hi' || lower === 'hey' || lower === 'yo' || lower === 'ola' || lower === 'oi' || lower === 'salve') {
    const isEn = !['ola', 'oi', 'salve'].includes(lower);
    return message.reply(isEn
      ? '👋 **Hey there, clanmate!** I am **TEKOli**, the tactical rathole bot. Ask me: *"Who owns rathole 3?"*, *"Nearest ratholes to 12, 20"*, or *"owner Clutch"*!'
      : '👋 **Salve, guerreiro!** Sou o **TEKOli**, o bot tático do clã. Pode me perguntar sobre ratholes, donos, coordenadas ou teleports!');
  }

  const proximityRegex = /(?:proximo|proximos|perto|vizinho)[\s\w]*?(?:de|a)?\s*\(?\s*(\d+(?:[.,]\d+)?)\s*(?:,|[ ]|e)\s*(\d+(?:[.,]\d+)?)\s*\)?/i;
  const proxMatch = content.match(proximityRegex);
  const isProximityCommand = lower.startsWith('/rathole proximo') || lower.startsWith('/rathole near');

  if (proxMatch || isProximityCommand) {
    let targetX;
    let targetY;
    if (proxMatch) {
      targetX = parseFloat(proxMatch[1].replace(',', '.'));
      targetY = parseFloat(proxMatch[2].replace(',', '.'));
    } else {
      const parts = content.split(/\s+/);
      targetX = parseFloat(parts[2]);
      targetY = parseFloat(parts[3]);
    }

    if (!isNaN(targetX) && !isNaN(targetY)) {
      try {
        return message.reply(await buildProximityPayload(targetX, targetY));
      } catch (err) {
        console.error(err);
        return message.reply('❌ Erro ao consultar ratholes próximos no MongoDB.');
      }
    }
  }

  const numRegex = /(?:rathole|base|buraco|rh|#)\s*(?:numero|n[º°]|num)?\s*(\d+)/i;
  const numMatch = content.match(numRegex);

  if (numMatch) {
    const targetNumero = parseInt(numMatch[1], 10);
    try {
      return message.reply(await buildNumeroPayload(targetNumero));
    } catch (err) {
      console.error(err);
      return message.reply('❌ Erro ao buscar informações do rathole no MongoDB.');
    }
  }

  const mentioned = [...message.mentions.users.values()].filter((user) => user.id !== client.user.id);
  if (mentioned.length === 1 && /rathole/i.test(content)) {
    const member = message.mentions.members?.get(mentioned[0].id);
    const linkedOwner = await ownerFromDiscordUser(mentioned[0], member);
    console.log(`[TEKOli] Menção ${mentioned[0].username} → owner ${linkedOwner || '(sem vínculo)'}`);
    if (!linkedOwner) {
      return message.reply(`Não sei qual owner corresponde a **${mentioned[0].username}**. A pessoa pode ligar a conta com \`/rathole vincular\`.`);
    }
    try {
      return message.reply(await buildPersonPayload(linkedOwner, true));
    } catch (err) {
      console.error(err);
      return message.reply('❌ Erro ao consultar ratholes no MongoDB.');
    }
  }

  const ownerFromQuestion = parseOwnerQuestion(content);
  if (ownerFromQuestion) {
    const linkedOwner = await canonicalOwnerName(ownerFromQuestion);
    console.log(`[TEKOli] Pergunta lida como owner: ${ownerFromQuestion} → ${linkedOwner}`);
    try {
      return message.reply(await buildPersonPayload(linkedOwner, true));
    } catch (err) {
      console.error(err);
      return message.reply('❌ Erro ao consultar ratholes no MongoDB.');
    }
  }

  const isDonoCmd = matchesKeyword(lower, DONO_KEYWORDS);
  const isRespCmd = matchesKeyword(lower, RESP_KEYWORDS);

  if (isDonoCmd || isRespCmd) {
    const nameTarget = await canonicalOwnerName(stripCommandPrefix(content, isDonoCmd ? DONO_KEYWORDS : RESP_KEYWORDS));
    try {
      return message.reply(await buildPersonPayload(nameTarget, isDonoCmd));
    } catch (err) {
      console.error(err);
      return message.reply('❌ Erro ao consultar ratholes no MongoDB.');
    }
  }

  if (lower.includes('livre') || lower.includes('disponivel') || lower.includes('vago') || lower.includes('free') || lower.includes('available') || lower.includes('vacant')) {
    try {
      return message.reply(await buildFreePayload());
    } catch (err) {
      console.error(err);
      return message.reply('❌ Erro ao consultar ratholes livres no MongoDB.');
    }
  }

  if (lower === '!ajuda' || lower === '/ajuda' || lower === '!help' || lower === '/help' || lower.includes('help tekoli') || lower.includes('ajuda tekoli')) {
    return message.reply({ embeds: [buildHelpEmbed()] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const subcommand = interaction.options.getSubcommand(false);
  console.log(`[TEKOli] Slash /${interaction.commandName}${subcommand ? ` ${subcommand}` : ''} por ${interaction.user.tag} em ${interaction.guild?.name || 'DM'}`);

  try {
    if (interaction.commandName === 'ajuda' || interaction.commandName === 'help') {
      return interaction.reply({ embeds: [buildHelpEmbed()] });
    }

    if (interaction.commandName !== 'rathole') return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'info') {
      return interaction.reply(await buildNumeroPayload(interaction.options.getInteger('numero', true)));
    }

    if (sub === 'proximo' || sub === 'near') {
      return interaction.reply(await buildProximityPayload(
        interaction.options.getNumber('x', true),
        interaction.options.getNumber('y', true)
      ));
    }

    if (sub === 'dono' || sub === 'owner') {
      const name = await canonicalOwnerName(interaction.options.getString('jogador') || interaction.options.getString('player'));
      return interaction.reply(await buildPersonPayload(name, true));
    }

    if (sub === 'vincular' || sub === 'link') {
      const ownerName = interaction.options.getString('nome') || interaction.options.getString('name');
      const person = await linkDiscordUser(interaction.user, ownerName);
      return interaction.reply(`Liguei **${interaction.user.username}** ao owner **${person.ownerName}**. Uma menção a essa conta passa a buscar os ratholes desse nome.`);
    }

    if (sub === 'responsavel' || sub === 'responsible') {
      const name = await canonicalOwnerName(interaction.options.getString('jogador') || interaction.options.getString('player'));
      return interaction.reply(await buildPersonPayload(name, false));
    }

    if (sub === 'listar' || sub === 'list') {
      return interaction.reply(await buildListPayload());
    }

    return interaction.reply({ content: 'Subcomando não reconhecido.', ephemeral: true });
  } catch (err) {
    console.error(err);
    const content = '❌ Erro ao consultar ratholes no MongoDB.';
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content, ephemeral: true });
    }
    return interaction.reply({ content, ephemeral: true });
  }
});

logStartup();
startHealthServer();
startMongo();
startDiscord();
