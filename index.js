// ============================================================================
// TEKOli Discord Bot - Main Entry Point (index.js)
// Discord.js v14 + MongoDB (Mongoose)
// ============================================================================

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

// 2. Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('🍃 [TEKOli] Conectado com sucesso ao MongoDB!'))
  .catch((err) => console.error('❌ [TEKOli] Erro de conexão MongoDB:', err));

// 3. Bot Ready Event
client.once('ready', () => {
  console.log(`🤖 [TEKOli] Bot online como ${client.user.tag}!`);
  client.user.setActivity('ARK / Rust • Radar de Ratholes', { type: 0 });
});

// 4. Natural Language Questions & Prefix Queries Listener
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  if (content.length < 2) return;

  // --------------------------------------------------------------------------
  // CONVERSAÇÃO / GREETINGS: "good morning", "bom dia", "how are you", etc.
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // PERGUNTA 1: "Qual os ratholes próximo de 12,20?" / "/rathole proximo 12 20"
  // --------------------------------------------------------------------------
  const proximityRegex = /(?:proximo|proximos|perto|vizinho)[\s\w]*?(?:de|a)?\s*\(?\s*(\d+(?:[.,]\d+)?)\s*(?:,|[ ]|e)\s*(\d+(?:[.,]\d+)?)\s*\)?/i;
  const proxMatch = content.match(proximityRegex);

  if (proxMatch || lower.startsWith('/rathole proximo')) {
    let targetX, targetY;
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
          .setTitle(`🎯 Radar TEKOli • Ratholes Próximos de (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`)
          .setDescription('Identifiquei os ratholes mais próximos deste ponto tático:')
          .setColor(0x5865f2)
          .setFooter({ text: 'TEKOli Bot • Suporte MongoDB' })
          .setTimestamp();

        ranked.forEach((item, index) => {
          const r = item.rathole;
          embed.addFields({
            name: `${index === 0 ? '⭐ Mais Próximo: ' : ''}#${r.numero} - ${r.name} [${item.dist.toFixed(1)}m]`,
            value: `👑 **Owner:** ${r.owner}\n🛡️ **Co-Owner:** ${r.coOwner}\n📍 **Coordenadas:** (${r.coords.x.toFixed(1)}, ${r.coords.y.toFixed(1)})\n⚡ **TP:** ` + r.tp + `  *(Console: /tp ${r.coords.x.toFixed(1)} ${r.coords.y.toFixed(1)})*\n🏷️ **Status:** ${r.status.toUpperCase()}`,
          });
        });

        return message.reply({
          content: `📡 **Radar TEKOli:** Os ratholes mais próximos de **(${targetX.toFixed(1)}, ${targetY.toFixed(1)})** foram localizados! O mais próximo é o **Rathole #${nearest.numero}** (${nearest.name}) a **${ranked[0].dist.toFixed(1)}m**, pertencente a **${nearest.owner}** com TP ` + nearest.tp + '.',
          embeds: [embed],
        });
      } catch (err) {
        console.error(err);
        return message.reply('❌ Erro ao consultar ratholes próximos no MongoDB.');
      }
    }
  }

  // --------------------------------------------------------------------------
  // PERGUNTA 2: "A quem pertence o rathole 3?" / "dono do rathole 3" / "tp do rathole 3"
  // --------------------------------------------------------------------------
  const numRegex = /(?:rathole|base|buraco|rh|#)\s*(?:numero|n[º°]|num)?\s*(\d+)/i;
  const numMatch = content.match(numRegex);

  if (numMatch) {
    const targetNumero = parseInt(numMatch[1], 10);
    try {
      const rh = await Rathole.findOne({ numero: targetNumero });

      if (!rh) {
        return message.reply(`🔍 O **Rathole #${targetNumero}** não foi encontrado na base de dados MongoDB.`);
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

      return message.reply({ content: responseText, embeds: [embed] });
    } catch (err) {
      console.error(err);
      return message.reply('❌ Erro ao buscar informações do rathole no MongoDB.');
    }
  }

  // --------------------------------------------------------------------------
  // PERGUNTA 3: "dono <nome>" vs "responsavel <nome>"
  // REGRA: dono filtra por owner, responsavel filtra pelo owner e co:owner
  // --------------------------------------------------------------------------
  const isDonoCmd = lower.startsWith('dono') || lower.startsWith('owner') || lower.startsWith('/rathole dono') || lower.startsWith('/rathole owner');
  const isRespCmd = lower.startsWith('responsavel') || lower.startsWith('responsável') || lower.startsWith('responsible') || lower.startsWith('/rathole responsavel') || lower.startsWith('/rathole responsible');

  if (isDonoCmd || isRespCmd) {
    let nameTarget = '';
    if (isDonoCmd) {
      nameTarget = content.replace(/^(/ratholes+dono|/ratholes+owner|dono|owner)s*(?:do|da|de|of|for|:)?s*/i, '').trim();
    } else {
      nameTarget = content.replace(/^(/ratholes+responsavel|/ratholes+responsible|responsavel|responsável|responsible)s*(?:do|da|de|pelo|por|for|:)?s*/i, '').trim();
    }

    if (nameTarget.length >= 2) {
      try {
        const regex = new RegExp(nameTarget, 'i');
        const query = isDonoCmd
          ? { owner: regex } // DONO filtra apenas por owner
          : { $or: [{ owner: regex }, { coOwner: regex }] }; // RESPONSAVEL filtra por owner E co-owner

        const matches = await Rathole.find(query).sort({ numero: 1 });

        const filterTitle = isDonoCmd ? '👑 Dono (Owner Principal)' : '👥 Responsável (Owner e Co-Owner)';
        const embed = new EmbedBuilder()
          .setTitle(`${filterTitle}: Ratholes de "${nameTarget}" (${matches.length})`)
          .setColor(isDonoCmd ? 0xf59e0b : 0x5865f2)
          .setFooter({ text: `TEKOli Bot • Filtro: ${filterTitle}` })
          .setTimestamp();

        if (matches.length === 0) {
          return message.reply(`🔍 Nenhum rathole encontrado para **"${nameTarget}"** filtrando por **${filterTitle}**.`);
        }

        matches.forEach((rh) => {
          embed.addFields({
            name: `#${rh.numero} - ${rh.name}`,
            value: `👑 **Owner:** ${rh.owner}\n🛡️ **Co-Owner:** ${rh.coOwner}\n📍 **Coords:** (${rh.coords.x.toFixed(1)}, ${rh.coords.y.toFixed(1)})\n⚡ **TP:** ` + rh.tp,
          });
        });

        const replySummary = isDonoCmd
          ? `👑 **Filtro por Dono:** Encontrei **${matches.length} rathole(s)** onde **${nameTarget}** é o **Owner Principal**!`
          : `👥 **Filtro por Responsável:** Encontrei **${matches.length} rathole(s)** onde **${nameTarget}** é **Responsável (Owner ou Co-Owner)**!`;

        return message.reply({ content: replySummary, embeds: [embed] });
      } catch (err) {
        console.error(err);
        return message.reply('❌ Erro ao consultar ratholes no MongoDB.');
      }
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
        .setTitle(`🟢 Available / Free Ratholes (${free.length})`)
        .setColor(0x57f287)
        .setDescription('Open positions available for clan members or expansion:');

      free.forEach((r) => {
        embed.addFields({
          name: `#${r.numero} - ${r.name}`,
          value: `📍 Coords: (${r.coords.x}, ${r.coords.y}) | ⚡ TP: ${r.tp}`,
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
        { name: 'Common Queries / Perguntas Comuns', value: '• "Who owns rathole 3?" / "A quem pertence o rathole 3?"\n• "Nearest ratholes to 14.9, 85.8" / "Próximo de 14.9, 85.8"\n• "owner Clutch" / "dono Clutch"\n• "responsible Joey" / "responsavel Joey"\n• "What is the TP for rathole 1?" / "Qual o TP do rathole 1?"' },
        { name: 'Slash Commands', value: '/rathole info <number>\n/rathole owner <player> (or /rathole dono)\n/rathole responsible <player> (or /rathole responsavel)\n/rathole near <x> <y> (or /rathole proximo)\n/rathole list (or /rathole listar)' }
      );
    return message.reply({ embeds: [helpEmbed] });
  }
});

// 5. Login
client.login(process.env.DISCORD_TOKEN);
