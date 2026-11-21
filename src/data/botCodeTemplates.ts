// Code templates for Discord.js v14 & Mongoose bot

export const BOT_INDEX_JS = `// ============================================================================
// TEKOli Discord Bot - Main Entry Point (index.js)
// Discord.js v14 + MongoDB (Mongoose)
// ============================================================================

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const mongoose = require('mongoose');
const Rathole = require('./models/Rathole');

// 1. Initialize Discord Client with necessary Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Ativar no Discord Developer Portal
  ],
});

// Euclidean distance calculation: sqrt((x2-x1)^2 + (y2-y1)^2)
function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function isMemberAdmin(member) {
  if (!member) return false;
  const hasAdminRole = member.roles.cache.some((r) => {
    const name = r.name.trim().toLowerCase();
    return name === 'admin' || name === '@admin' || name === 'admins' || name === 'administrator';
  });
  const hasAdminPerm = member.permissions.has(PermissionFlagsBits.Administrator);
  return hasAdminRole || hasAdminPerm;
}

function normalizeStatus(rawStatus) {
  const trimmed = rawStatus.trim();
  const lower = trimmed.toLowerCase();
  if (['ocupado', 'livre', 'aliado', 'em_raid', 'reserva'].includes(lower)) return lower;
  if (lower === 'em raid') return 'em_raid';
  return trimmed
    .split(/\\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseAdminUpdateCommand(query) {
  const hasVerb = /\\b(update|set|change|edit|modify|atualizar|atualize|alterar|altere|mudar|mude|definir)\\b/i.test(query);
  if (!hasVerb) return null;
  const numMatch = query.match(/(?:rathole|rh|base|#)\\s*(?:numero|number|n[º°]|num)?\\s*(\\d+)/i);
  if (!numMatch) return null;
  const numero = parseInt(numMatch[1], 10);

  let field = null;
  if (/\\b(?:co-?owner|co\\s+owner|coowner)\\b/i.test(query)) field = 'coOwner';
  else if (/\\b(?:owner|dono|besitzer)\\b/i.test(query)) field = 'owner';
  else if (/\\b(?:tp|teleport)\\b/i.test(query)) field = 'tp';
  else if (/\\b(?:notes?|notas?|obs)\\b/i.test(query)) field = 'notes';
  else if (/\\b(?:name|nome)\\b/i.test(query)) field = 'name';
  else if (/\\b(?:status|estado)\\b/i.test(query)) field = 'status';
  if (!field) return null;

  let rawValue = '';
  const quoted = query.match(/["'“”]([^"'“”]+)["'“”]/);
  if (quoted) {
    rawValue = quoted[1].trim();
  } else {
    const toMatch = query.match(/(?:to|para|as|zu|auf|=|:)\\s+(.+?)(?=\\s+(?:for|of|in|on|no|na|do|da|bei|fur)\\s+(?:rathole|rh|base|#)|$)/i);
    if (toMatch) rawValue = toMatch[1].trim();
  }
  if (!rawValue) return null;

  return {
    numero,
    field,
    value: field === 'status' ? normalizeStatus(rawValue) : rawValue,
  };
}

// 2. Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('🍃 [TEKOli] Conectado com sucesso ao MongoDB!'))
  .catch((err) => console.error('❌ [TEKOli] Erro de conexão MongoDB:', err));

// 3. Bot Ready Event
client.once('ready', () => {
  console.log(\`🤖 [TEKOli] Bot online como \${client.user.tag}!\`);
  client.user.setActivity('ARK / Rust • Radar de Ratholes', { type: 0 });
});

// 4. Natural Language Questions Listener (ONLY responds when @mentioned!)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!client.user || !message.mentions.has(client.user, { ignoreEveryone: true, ignoreRoles: true })) return;

  let content = message.content.replace(new RegExp(\`<@!?\${client.user.id}>\`, 'g'), '').trim();
  if (!content) {
    return message.reply('👋 **TEKOli online!** Ask me anything — or \`@admin\` can run \`update status to "builded" for rathole 59\`!');
  }

  // Check Admin DB Update Command first
  const adminCmd = parseAdminUpdateCommand(content);
  if (adminCmd) {
    const member = message.member || (message.guild ? await message.guild.members.fetch(message.author.id).catch(() => null) : null);
    if (!isMemberAdmin(member)) {
      return message.reply('⛔ **Access Denied:** Only members with the **@admin** role can update the rathole database.');
    }
    try {
      const existing = await Rathole.findOne({ numero: adminCmd.numero });
      if (!existing) return message.reply(\`🔍 **Rathole #\${adminCmd.numero}** not found in MongoDB.\`);
      const prevVal = existing[adminCmd.field] || '';
      const updated = await Rathole.findOneAndUpdate(
        { numero: adminCmd.numero },
        { $set: { [adminCmd.field]: adminCmd.value } },
        { new: true }
      );
      return message.reply(\`✅ **MongoDB Updated!** **Rathole #\${updated.numero}** \${adminCmd.field} changed from \\\`\${prevVal}\\\` to **\\\`\${adminCmd.value}\\\`**.\`);
    } catch (err) {
      console.error(err);
      return message.reply('❌ Error updating rathole in MongoDB.');
    }
  }

  // Resolve real Discord user mentions <@123456789> to @Username / @DisplayName
  content = content.replace(/<@!?(\d+)>/g, (fullMatch, userId) => {
    const member = message.mentions.members?.get(userId);
    const user = message.mentions.users.get(userId);
    const name = member?.nickname || member?.displayName || user?.globalName || user?.username;
    return name ? \`@\${name.replace(/\\s+/g, '')}\` : fullMatch;
  });

  const lower = content.toLowerCase();

  // --------------------------------------------------------------------------
  // CONVERSAÇÃO / GREETINGS: "good morning", "bom dia", "guten morgen", "how are you"
  // --------------------------------------------------------------------------
  if (lower === 'good morning' || lower === 'gm' || lower.startsWith('good morning') || lower === 'bom dia' || lower.startsWith('bom dia') || lower === 'guten morgen' || lower.startsWith('guten morgen')) {
    const isPt = lower.includes('bom dia');
    const isDe = lower.includes('guten morgen');
    try {
      const count = await Rathole.countDocuments();
      const reply = isPt
        ? \`☀️ **Bom dia, guerreiro!** TEKOli pronto e em prontidão de combate! Todos os **\${count} ratholes** do clã estão monitorados no MongoDB. Defesas ativas. O que você precisa hoje?\`
        : isDe
        ? \`☀️ **Guten Morgen, Krieger!** TEKOli ist einsatzbereit! Alle **\${count} Clan-Ratholes** werden überwacht. Was brauchst du heute?\`
        : \`☀️ **Good morning, warrior!** TEKOli standing by on high alert. All **\${count} clan ratholes** are monitored on our tactical radar. Perimeters are secure. What coordinates or TP do you need today?\`;
      return message.reply(reply);
    } catch (e) {
      return message.reply('☀️ **Good morning, warrior!** TEKOli standing by. How can I assist the tribe today?');
    }
  }

  if (lower.includes('how are you') || lower.includes('tudo bem') || lower.includes('como vai') || lower.includes('wie geht')) {
    const isPt = lower.includes('tudo bem') || lower.includes('como vai');
    return message.reply(isPt
      ? '🛡️ **100% de Prontidão Operacional!** Conexão com MongoDB ativa e radar em tempo real. Pronto para apoiar o clã.'
      : '🛡️ **100% Combat Operational!** MongoDB connected, radar active. Ready to assist the tribe.');
  }

  if (lower === 'hello' || lower === 'hi' || lower === 'hey' || lower === 'yo' || lower === 'ola' || lower === 'oi' || lower === 'salve' || lower === 'hallo') {
    const isPt = ['ola', 'oi', 'salve'].includes(lower);
    return message.reply(isPt
      ? '👋 **Salve, guerreiro!** Sou o **TEKOli**, o bot tático do clã. Pode me perguntar sobre ratholes, donos, coordenadas ou teleports!'
      : '👋 **Hey there, clanmate!** I am **TEKOli**, the tactical rathole bot. Ask me: *"Who owns rathole 3?"*, *"Nearest ratholes to 12, 20"*, or *"welche ratholes hat @MisSy"*!');
  }

  // --------------------------------------------------------------------------
  // PERGUNTA 1: "Qual os ratholes próximo de 12,20?" / "near 12,20" / "/rathole proximo 12 20"
  // --------------------------------------------------------------------------
  const proximityRegex = /(?:near|nearest|close|closest|proximo|proximos|perto|vizinho|nahe|nah)[\\s\\w]*?(?:to|at|de|a|von|bei)?\\s*\\(?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:,|[ ]|e|and|und)\\s*(\\d+(?:[.,]\\d+)?)\\s*\\)?/i;
  const proxMatch = content.match(proximityRegex);

  if (proxMatch || lower.startsWith('/rathole proximo') || lower.startsWith('/rathole near')) {
    let targetX, targetY;
    if (proxMatch) {
      targetX = parseFloat(proxMatch[1].replace(',', '.'));
      targetY = parseFloat(proxMatch[2].replace(',', '.'));
    } else {
      const parts = content.split(/\\s+/);
      targetX = parseFloat(parts[2]);
      targetY = parseFloat(parts[3]);
    }

    if (!isNaN(targetX) && !isNaN(targetY)) {
      try {
        const allRatholes = await Rathole.find({});
        if (allRatholes.length === 0) {
          return message.reply('❌ Nenhum rathole cadastrado na base MongoDB.');
        }

        // Rank by distance
        const ranked = allRatholes
          .map((rh) => ({
            rathole: rh,
            dist: calculateDistance(targetX, targetY, rh.coords.x, rh.coords.y),
          }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3);

        const nearest = ranked[0].rathole;

        const embed = new EmbedBuilder()
          .setTitle(\`🎯 TEKOli Radar • Ratholes Near (\${targetX.toFixed(1)}, \${targetY.toFixed(1)})\`)
          .setDescription('Nearest ratholes to the tactical coordinates:')
          .setColor(0x5865f2)
          .setFooter({ text: 'TEKOli Bot • MongoDB' })
          .setTimestamp();

        ranked.forEach((item, index) => {
          const r = item.rathole;
          embed.addFields({
            name: \`\${index === 0 ? '⭐ Closest: ' : ''}#\${r.numero} - \${r.name} [\${item.dist.toFixed(1)}m]\`,
            value: \`👑 **Owner:** \${r.owner}\\n🛡️ **Co-Owner:** \${r.coOwner}\\n📍 **Coords:** (\${r.coords.x.toFixed(1)}, \${r.coords.y.toFixed(1)})\\n⚡ **TP:** \` + r.tp + \`  *(Console: /tp \${r.coords.x.toFixed(1)} \${r.coords.y.toFixed(1)})*\\n🏷️ **Status:** \${r.status.toUpperCase()}\`,
          });
        });

        return message.reply({
          content: \`📡 **TEKOli Radar:** Nearest ratholes to **(\${targetX.toFixed(1)}, \${targetY.toFixed(1)})** located! Closest is **Rathole #\${nearest.numero}** (\${nearest.name}) at **\${ranked[0].dist.toFixed(1)}m**, owned by **\${nearest.owner}** (TP: \` + nearest.tp + ').',
          embeds: [embed],
        });
      } catch (err) {
        console.error(err);
        return message.reply('❌ Error querying nearest ratholes in MongoDB.');
      }
    }
  }

  // --------------------------------------------------------------------------
  // PERGUNTA 2: "A quem pertence o rathole 3?" / "who owns rathole 3" / "wem gehört rathole 3"
  // --------------------------------------------------------------------------
  const numRegex = /(?:rathole|base|buraco|rh|#)\\s*(?:numero|number|n[º°]|num)?\\s*(\\d+)/i;
  const numMatch = content.match(numRegex);

  if (numMatch) {
    const targetNumero = parseInt(numMatch[1], 10);
    try {
      const rh = await Rathole.findOne({ numero: targetNumero });

      if (!rh) {
        return message.reply(\`🔍 **Rathole #\${targetNumero}** not found in MongoDB.\`);
      }

      const color = rh.status === 'ocupado' ? 0x5865f2 : rh.status === 'livre' ? 0x57f287 : 0xed4245;

      const embed = new EmbedBuilder()
        .setTitle(\`🏰 Rathole #\${rh.numero} • \${rh.name}\`)
        .setDescription(\`Complete tactical report for **Rathole #\${rh.numero}**:\`)
        .setColor(color)
        .addFields(
          { name: '👑 Primary Owner', value: \`**\${rh.owner}**\`, inline: true },
          { name: '🛡️ Co-Owner', value: \`**\${rh.coOwner}**\`, inline: true },
          { name: '🏷️ Status', value: rh.status.toUpperCase(), inline: true },
          { name: '📍 Coords', value: \`(\${rh.coords.x.toFixed(1)}, \${rh.coords.y.toFixed(1)})\`, inline: true },
          { name: '⚡ Teleport (TP)', value: \`\${rh.tp}\\n*(Console: /tp \${rh.coords.x.toFixed(1)} \${rh.coords.y.toFixed(1)})*\`, inline: true },
          { name: '🗺️ Server', value: rh.server || 'The Island', inline: true }
        )
        .setFooter({ text: 'TEKOli Bot • Tactical System' })
        .setTimestamp();

      if (rh.notes) {
        embed.addFields({ name: '📝 Tactical Notes', value: rh.notes, inline: false });
      }

      const responseText = \`🏰 **Rathole #\${rh.numero}** belongs to **\${rh.owner}** (Co-Owner: **\${rh.coOwner}**)!\\n📍 Coords: (\${rh.coords.x.toFixed(1)}, \${rh.coords.y.toFixed(1)}) | ⚡ TP: \${rh.tp}\`;

      return message.reply({ content: responseText, embeds: [embed] });
    } catch (err) {
      console.error(err);
      return message.reply('❌ Error fetching rathole from MongoDB.');
    }
  }

  // --------------------------------------------------------------------------
  // PERGUNTA 3: Member search (EN/PT/DE + @mentions)
  // e.g. "owner Clutch", "welche ratholes hat @MisSy", "co-owner MisSy", "responsible Joey"
  // REGRA: se não especificar, filtra por OWNER e pergunta se quer ver como Co-Owner!
  // --------------------------------------------------------------------------
  const isRespCmd =
    lower.includes('responsavel') ||
    lower.includes('responsável') ||
    lower.includes('responsible') ||
    lower.includes('verantwortlich');

  const isCoOwnerCmd =
    !isRespCmd &&
    (lower.includes('co-owner') ||
      lower.includes('coowner') ||
      lower.includes('co owner') ||
      lower.includes('mitbesitzer'));

  const stopWords = new Set([
    'list', 'listar', 'free', 'livre', 'frei', 'all', 'todos', 'alle', 'hat', 'haben',
    'has', 'have', 'tem', 'which', 'welche', 'quais', 'who', 'quem', 'wer', 'wem', 'sind', 'ist'
  ]);

  let nameTarget = '';
  const mentionMatch = content.match(/@([a-zA-Z0-9_.-]{2,32})/);
  if (mentionMatch && !['tekoli', 'everyone', 'here'].includes(mentionMatch[1].toLowerCase())) {
    nameTarget = mentionMatch[1].trim();
  } else {
    const explicitMatch = content.match(/(?:co-?owner|co\\s+owner|dono|owner|besitzer|responsavel|responsável|responsible|verantwortlich)\\s*(?:do|da|de|of|for|pelo|por|von)?\\s*[:\\-]?\\s*@?([a-zA-Z0-9_.-]{2,25})/i);
    if (explicitMatch && !stopWords.has(explicitMatch[1].toLowerCase())) {
      nameTarget = explicitMatch[1].trim();
    } else {
      const natMatch = content.match(/(?:ratholes?|bases?)\\s*(?:de|do|da|of|for|von|hat|haben|has|have|tem)\\s+@?([a-zA-Z0-9_.-]{2,25})/i);
      if (natMatch && !stopWords.has(natMatch[1].toLowerCase())) {
        nameTarget = natMatch[1].trim();
      }
    }
  }

  if (nameTarget.length >= 2 && !lower.includes('livre') && !lower.includes('free') && !/\\bfrei\\b/.test(lower)) {
    try {
      const regex = new RegExp(nameTarget, 'i');
      const filterMode = isRespCmd ? 'responsible' : isCoOwnerCmd ? 'co_owner' : 'owner';

      const query =
        filterMode === 'owner'
          ? { owner: regex }
          : filterMode === 'co_owner'
          ? { coOwner: regex }
          : { $or: [{ owner: regex }, { coOwner: regex }] };

      const matches = await Rathole.find(query).sort({ numero: 1 });
      const coOwnerExtras =
        filterMode === 'owner'
          ? await Rathole.countDocuments({ coOwner: regex, owner: { $not: regex } })
          : 0;

      const filterTitle =
        filterMode === 'owner'
          ? '👑 Owner (Primary Only)'
          : filterMode === 'co_owner'
          ? '🛡️ Co-Owner Only'
          : '👥 Responsible (Owner & Co-Owner)';

      if (matches.length === 0) {
        if (filterMode === 'owner' && coOwnerExtras > 0) {
          return message.reply(
            \`🔍 **\${nameTarget}** is not the Primary Owner of any rathole, **but is Co-Owner on \${coOwnerExtras} rathole(s)**.\\n💡 Would you like to see them? Ask \`co-owner \${nameTarget}\` or \`responsible \${nameTarget}\`!\`
          );
        }
        return message.reply(\`🔍 No ratholes found for **"\${nameTarget}"** with filter **\${filterTitle}**.\`);
      }

      const embed = new EmbedBuilder()
        .setTitle(\`\${filterTitle}: Ratholes for "\${nameTarget}" (\${matches.length})\`)
        .setColor(filterMode === 'owner' ? 0xf59e0b : filterMode === 'co_owner' ? 0x10b981 : 0x5865f2)
        .setFooter({ text: \`TEKOli Bot • Filter: \${filterTitle}\` })
        .setTimestamp();

      matches.slice(0, 24).forEach((rh) => {
        embed.addFields({
          name: \`#\${rh.numero} - \${rh.name}\`,
          value: \`👑 **Owner:** \${rh.owner}\\n🛡️ **Co-Owner:** \${rh.coOwner}\\n📍 **Coords:** (\${rh.coords.x.toFixed(1)}, \${rh.coords.y.toFixed(1)})\\n⚡ **TP:** \` + rh.tp,
        });
      });

      let replySummary =
        filterMode === 'owner'
          ? \`👑 **Owner Filter:** Found **\${matches.length} rathole(s)** where **\${nameTarget}** is the **Primary Owner**!\`
          : filterMode === 'co_owner'
          ? \`🛡️ **Co-Owner Filter:** Found **\${matches.length} rathole(s)** where **\${nameTarget}** is **Co-Owner**!\`
          : \`👥 **Responsible Filter:** Found **\${matches.length} rathole(s)** where **\${nameTarget}** is **Responsible (Owner or Co-Owner)**!\`;

      if (filterMode === 'owner' && coOwnerExtras > 0) {
        replySummary += \`\\n💡 *Also Co-Owner on **\${coOwnerExtras}** more rathole(s). Want to see them too? Ask \`co-owner \${nameTarget}\` or \`responsible \${nameTarget}\`!*\`;
      }

      return message.reply({ content: replySummary, embeds: [embed] });
    } catch (err) {
      console.error(err);
      return message.reply('❌ Error querying ratholes in MongoDB.');
    }
  }

  // --------------------------------------------------------------------------
  // PERGUNTA 4: "Quais ratholes estão livres?"
  // --------------------------------------------------------------------------
  if (lower.includes('livre') || lower.includes('disponivel') || lower.includes('vago') || lower.includes('free') || lower.includes('available') || lower.includes('vacant')) {
    try {
      const free = await Rathole.find({ status: 'livre' });
      if (free.length === 0) {
        return message.reply('🛡️ No ratholes currently free. All are occupied or on reserve.');
      }

      const embed = new EmbedBuilder()
        .setTitle(\`🟢 Available / Free Ratholes (\${free.length})\`)
        .setColor(0x57f287)
        .setDescription('Open positions available for clan members or expansion:');

      free.slice(0, 24).forEach((r) => {
        embed.addFields({
          name: \`#\${r.numero} - \${r.name}\`,
          value: \`📍 Coords: (\${r.coords.x}, \${r.coords.y}) | ⚡ TP: \${r.tp}\`,
        });
      });

      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
    }
  }

  // --------------------------------------------------------------------------
  // AJUDA / HELP
  // --------------------------------------------------------------------------
  if (lower === '!ajuda' || lower === '/ajuda' || lower === '!help' || lower === '/help' || lower.includes('help tekoli') || lower.includes('ajuda tekoli')) {
    const helpEmbed = new EmbedBuilder()
      .setTitle('🤖 TEKOli • Commands & Help (Bilingual)')
      .setColor(0x5865f2)
      .setDescription('You can ask in English (preferred) or Portuguese:')
      .addFields(
        { name: 'Common Queries / Perguntas Comuns', value: '• "Who owns rathole 3?" / "A quem pertence o rathole 3?"\\n• "Nearest ratholes to 14.9, 85.8" / "Próximo de 14.9, 85.8"\\n• "owner Clutch" / "dono Clutch" (Owner only)\\n• "co-owner Joey" (Co-Owner only)\\n• "responsible Joey" / "responsavel Joey" (Owner + Co-Owner)\\n• "What is the TP for rathole 1?"' },
        { name: 'Slash Commands', value: '/rathole info <number>\\n/rathole owner <player>\\n/rathole coowner <player>\\n/rathole responsible <player>\\n/rathole near <x> <y>\\n/rathole list' }
      );
    return message.reply({ embeds: [helpEmbed] });
  }
});

// 4B. Slash Commands Handler (interactionCreate)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'help' || interaction.commandName === 'ajuda') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('🤖 TEKOli • Slash Commands')
      .setColor(0x5865f2)
      .setDescription('Available commands in English & Portuguese:')
      .addFields(
        { name: 'Commands', value: '/rathole info <numero>\\n/rathole near <x> <y>\\n/rathole owner <player>\\n/rathole coowner <player>\\n/rathole responsible <player>\\n/rathole list' }
      );
    return interaction.reply({ embeds: [helpEmbed] });
  }

  if (interaction.commandName === 'rathole') {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'info') {
        const num = interaction.options.getInteger('numero', true);
        const rh = await Rathole.findOne({ numero: num });
        if (!rh) return interaction.reply(\`🔍 Rathole #\${num} not found in MongoDB.\`);
        const embed = new EmbedBuilder()
          .setTitle(\`🏰 Rathole #\${rh.numero} • \${rh.name}\`)
          .setColor(0x5865f2)
          .addFields(
            { name: '👑 Owner', value: rh.owner, inline: true },
            { name: '🛡️ Co-Owner', value: rh.coOwner, inline: true },
            { name: '📍 Coords', value: \`(\${rh.coords.x}, \${rh.coords.y})\`, inline: true },
            { name: '⚡ TP', value: rh.tp, inline: true }
          );
        return interaction.reply({ content: \`🏰 **Rathole #\${rh.numero}** belongs to **\${rh.owner}** (Co: **\${rh.coOwner}**)\`, embeds: [embed] });
      }

      if (sub === 'near' || sub === 'proximo') {
        const x = interaction.options.getNumber('x', true);
        const y = interaction.options.getNumber('y', true);
        const all = await Rathole.find({});
        const ranked = all
          .map((rh) => ({ rh, dist: calculateDistance(x, y, rh.coords.x, rh.coords.y) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3);
        const embed = new EmbedBuilder()
          .setTitle(\`🎯 Nearest Ratholes to (\${x}, \${y})\`)
          .setColor(0x5865f2);
        ranked.forEach((item, idx) => {
          embed.addFields({
            name: \`\${idx === 0 ? '⭐ ' : ''}#\${item.rh.numero} - \${item.rh.name} [\${item.dist.toFixed(1)}m]\`,
            value: \`👑 \${item.rh.owner} (Co: \${item.rh.coOwner}) | 📍 (\${item.rh.coords.x}, \${item.rh.coords.y}) | ⚡ \${item.rh.tp}\`,
          });
        });
        return interaction.reply({ embeds: [embed] });
      }

      if (sub === 'owner' || sub === 'dono' || sub === 'coowner' || sub === 'responsible' || sub === 'responsavel') {
        const player = interaction.options.getString('player') || interaction.options.getString('jogador') || '';
        const regex = new RegExp(player, 'i');
        const isResp = sub === 'responsible' || sub === 'responsavel';
        const isCo = sub === 'coowner';
        const query = isResp ? { $or: [{ owner: regex }, { coOwner: regex }] } : isCo ? { coOwner: regex } : { owner: regex };
        const matches = await Rathole.find(query).sort({ numero: 1 });
        if (matches.length === 0) return interaction.reply(\`🔍 No ratholes found for **\${player}**.\`);
        const embed = new EmbedBuilder()
          .setTitle(\`🏰 Ratholes for "\${player}" (\${matches.length})\`)
          .setColor(isResp ? 0x5865f2 : isCo ? 0x10b981 : 0xf59e0b);
        matches.slice(0, 24).forEach((rh) => {
          embed.addFields({
            name: \`#\${rh.numero} - \${rh.name}\`,
            value: \`👑 \${rh.owner} | 🛡️ \${rh.coOwner} | 📍 (\${rh.coords.x}, \${rh.coords.y}) | ⚡ \${rh.tp}\`,
          });
        });
        return interaction.reply({ embeds: [embed] });
      }

      if (sub === 'update') {
        const member = interaction.member || (interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null);
        if (!isMemberAdmin(member)) {
          return interaction.reply({ content: '⛔ **Access Denied:** Only **@admin** can update the database.', ephemeral: true });
        }
        const num = interaction.options.getInteger('number', true);
        const updates = {};
        const status = interaction.options.getString('status');
        const owner = interaction.options.getString('owner');
        const coOwner = interaction.options.getString('coowner');
        const tp = interaction.options.getString('tp');
        const notes = interaction.options.getString('notes');
        if (status) updates.status = normalizeStatus(status);
        if (owner) updates.owner = owner.trim();
        if (coOwner) updates.coOwner = coOwner.trim();
        if (tp) updates.tp = tp.trim();
        if (notes !== null) updates.notes = notes.trim();
        const updated = await Rathole.findOneAndUpdate({ numero: num }, { $set: updates }, { new: true });
        if (!updated) return interaction.reply(\`🔍 **Rathole #\${num}** not found in MongoDB.\`);
        return interaction.reply(\`✅ **Rathole #\${updated.numero}** updated in MongoDB! Status: \\\`\${updated.status}\\\`\`);
      }

      if (sub === 'list' || sub === 'listar') {
        const all = await Rathole.find({}).sort({ numero: 1 }).limit(15);
        const embed = new EmbedBuilder()
          .setTitle(\`📋 Clan Ratholes (Showing \${all.length})\`)
          .setColor(0x5865f2);
        all.forEach((rh) => {
          embed.addFields({ name: \`#\${rh.numero} - \${rh.name}\`, value: \`👑 \${rh.owner} | ⚡ \${rh.tp}\`, inline: true });
        });
        return interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error(err);
      return interaction.reply('❌ Error executing slash command.');
    }
  }
});

// 5. Login
client.login(process.env.DISCORD_TOKEN);
`;

export const BOT_MODEL_JS = `// ============================================================================
// models/Rathole.js - Mongoose Schema for MongoDB
// ============================================================================

const mongoose = require('mongoose');

const RatholeSchema = new mongoose.Schema(
  {
    numero: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    coords: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    owner: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    coOwner: {
      type: String,
      default: 'Nenhum',
      trim: true,
    },
    tp: {
      type: String,
      required: true,
      trim: true,
    },
    server: {
      type: String,
      default: 'The Island #104',
      trim: true,
    },
    status: {
      type: String,
      default: 'ocupado',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
    },
    turretsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

RatholeSchema.index({ 'coords.x': 1, 'coords.y': 1 });

module.exports = mongoose.model('Rathole', RatholeSchema);
`;

export const BOT_DEPLOY_JS = `// ============================================================================
// deploy-commands.js - Register Discord Slash Commands
// ============================================================================

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('rathole')
    .setDescription('Comandos de gestão e consulta de Ratholes')
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Exibe dono, co-owner, coordenadas e TP do rathole')
        .addIntegerOption((opt) =>
          opt.setName('numero').setDescription('Número do Rathole').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('proximo')
        .setDescription('Busca os ratholes mais próximos das coordenadas dadas')
        .addNumberOption((opt) =>
          opt.setName('x').setDescription('Coordenada X (0 a 100)').setRequired(true)
        )
        .addNumberOption((opt) =>
          opt.setName('y').setDescription('Coordenada Y (0 a 100)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('dono')
        .setDescription('Filtra ratholes onde o jogador é Dono (Owner Principal)')
        .addStringOption((opt) =>
          opt.setName('jogador').setDescription('Nome do jogador').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('owner')
        .setDescription('Filter ratholes where player is primary Owner')
        .addStringOption((opt) =>
          opt.setName('player').setDescription('Player name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('coowner')
        .setDescription('Filter ratholes where player is Co-Owner')
        .addStringOption((opt) =>
          opt.setName('player').setDescription('Player name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('responsavel')
        .setDescription('Filtra ratholes onde o jogador é Responsável (Owner ou Co-Owner)')
        .addStringOption((opt) =>
          opt.setName('jogador').setDescription('Nome do jogador').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('responsible')
        .setDescription('Filter ratholes where player is Responsible (Owner or Co-Owner)')
        .addStringOption((opt) =>
          opt.setName('player').setDescription('Player name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('near')
        .setDescription('Find ratholes nearest to given coordinates (x, y)')
        .addNumberOption((opt) =>
          opt.setName('x').setDescription('Coordinate X').setRequired(true)
        )
        .addNumberOption((opt) =>
          opt.setName('y').setDescription('Coordinate Y').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('update')
        .setDescription('Admin only: update rathole status, owner, co-owner, TP, or notes')
        .addIntegerOption((opt) => opt.setName('number').setDescription('Rathole number').setRequired(true))
        .addStringOption((opt) => opt.setName('status').setDescription('New status (e.g. Builded, ocupado, livre)'))
        .addStringOption((opt) => opt.setName('owner').setDescription('New Owner'))
        .addStringOption((opt) => opt.setName('coowner').setDescription('New Co-Owner'))
        .addStringOption((opt) => opt.setName('tp').setDescription('New TP'))
        .addStringOption((opt) => opt.setName('notes').setDescription('New notes'))
    )
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista todos os ratholes e status')
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all registered ratholes and status')
    ),
  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Mostra todos os comandos do bot TEKOli'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all TEKOli bot commands (English & Portuguese)'),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registrando slash commands no Discord...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
})();
`;

export const BOT_ENV_EXAMPLE = `# ============================================================================
# .env - Variáveis de Ambiente do TEKOli
# ============================================================================

# Token do seu Bot no Discord Developer Portal
DISCORD_TOKEN="COLE_AQUI_SEU_DISCORD_BOT_TOKEN"

# ID da Aplicação (Client ID no Discord Developer Portal)
CLIENT_ID="COLE_AQUI_O_APPLICATION_ID"

# URI de Conexão do MongoDB (ex: MongoDB Atlas Free Tier)
MONGODB_URI="mongodb+srv://usuario:senha@cluster0.abcde.mongodb.net/tekoli_db?retryWrites=true&w=majority"
`;

export const BOT_PACKAGE_JSON = `{
  "name": "tekoli-discord-bot",
  "version": "1.0.0",
  "description": "Bot de Discord TEKOli com banco MongoDB para gestão de Ratholes e teleports táticos",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "deploy-commands": "node deploy-commands.js"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "mongoose": "^8.2.1",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
`;

export const BOT_README_MD = `# 🤖 TEKOli • Bot de Discord & MongoDB para Ratholes

Bot de Discord desenvolvido para clãs competitivos em jogos como ARK: Survival Evolved e Rust. Ele responde perguntas em linguagem natural e slash commands sobre donos, co-owners, coordenadas e teleports (TPs).

---

## ⚡ Exemplos de Perguntas que o TEKOli Responde:
- **"A quem pertence o rathole 3?"** 
  *(Responde: Owner Beno, Co-Owner Joey, Coordenadas (14.9, 85.8) e TP-RH-03!)*
- **"Qual os ratholes próximo de 14.9, 85.8?"** 
  *(Calcula a distância euclidiana e lista os mais próximos ordenados por proximidade!)*
- **"Qual o TP do rathole 1?"** *(Flat Rock Pillar - DAB / Bird)*
- **"Ratholes do Clutch"**
- **"Quais ratholes estão livres?"**
- **"/rathole proximo 14.9 85.8"**

---

## 🚀 Como Rodar o Bot em 3 Passos:

### 1. Criar o Bot no Discord Developer Portal:
1. Acesse https://discord.com/developers/applications e clique em **New Application**.
2. Dê o nome de **TEKOli**.
3. Vá na aba **Bot**:
   - Clique em **Reset Token** e copie o token.
   - Ative a opção **MESSAGE CONTENT INTENT** (obrigatório para o bot ler mensagens normais).
4. Em **OAuth2 > URL Generator**:
   - Marque os scopes 'bot' e 'applications.commands'.
   - Em Bot Permissions marque 'Send Messages', 'Embed Links', 'Read Message History'.
   - Copie o link gerado e convide o bot para seu servidor!

### 2. Configurar o .env:
Preencha o arquivo .env com seu token e sua URI do MongoDB:
\`\`\`env
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=seu_client_id_aqui
MONGODB_URI=mongodb+srv://...
\`\`\`

### 3. Instalar e Iniciar:
\`\`\`bash
npm install
npm run deploy-commands
npm start
\`\`\`
`;
