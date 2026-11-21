import express, { Request, Response } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { MongoClient } from 'mongodb';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  ActivityType,
  GuildMember,
  PermissionFlagsBits,
} from 'discord.js';
import { INITIAL_RATHOLES } from './src/data/defaultRatholes';
import {
  parseLocalRatholeQuery,
  parseAdminUpdateCommand,
  normalizeRatholeStatus,
} from './src/utils/ratholeQuery';
import { DiscordEmbed, Rathole } from './src/types/rathole';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

// ============================================================================
// Active Ratholes Store (Memory + Optional MongoDB Atlas)
// ============================================================================
let memoryRatholes: Rathole[] = [...INITIAL_RATHOLES];
let mongoConnected = false;

async function getActiveRatholes(): Promise<Rathole[]> {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    mongoConnected = false;
    return memoryRatholes;
  }

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 3500,
      connectTimeoutMS: 3500,
    });
    await client.connect();
    const db = client.db('tekoli_db');
    const col = db.collection('ratholes');
    const count = await col.countDocuments();
    if (count === 0 && memoryRatholes.length > 0) {
      await col.insertMany(memoryRatholes.map((r) => ({ ...r })));
    }
    const docs = await col.find({}).sort({ numero: 1 }).toArray();
    await client.close();
    mongoConnected = true;
    if (docs.length > 0) {
      memoryRatholes = docs as unknown as Rathole[];
    }
    return memoryRatholes;
  } catch (err) {
    mongoConnected = false;
    if (client) {
      try {
        await client.close();
      } catch (_) {}
    }
    return memoryRatholes;
  }
}

async function updateRatholeInStore(
  numero: number,
  updates: Partial<Rathole>
): Promise<{ updated: Rathole | null; persistedToMongo: boolean }> {
  const nowIso = new Date().toISOString();
  const payload = { ...updates, updatedAt: nowIso };
  const mongoUri = process.env.MONGODB_URI?.trim();

  // First ensure memoryRatholes has latest state
  await getActiveRatholes();

  let updatedItem: Rathole | null = null;
  memoryRatholes = memoryRatholes.map((rh) => {
    if (rh.numero === numero) {
      updatedItem = { ...rh, ...payload };
      return updatedItem;
    }
    return rh;
  });

  if (!updatedItem) {
    return { updated: null, persistedToMongo: false };
  }

  if (!mongoUri) {
    return { updated: updatedItem, persistedToMongo: false };
  }

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000,
    });
    await client.connect();
    const db = client.db('tekoli_db');
    const col = db.collection('ratholes');
    const count = await col.countDocuments();
    if (count === 0 && memoryRatholes.length > 0) {
      await col.insertMany(memoryRatholes.map((r) => ({ ...r })));
    } else {
      await col.updateOne({ numero }, { $set: payload });
    }
    await client.close();
    mongoConnected = true;
    return { updated: updatedItem, persistedToMongo: true };
  } catch (err) {
    console.warn('⚠️ [TEKOli MongoDB Update] Falha ao persistir no MongoDB:', err);
    if (client) {
      try {
        await client.close();
      } catch (_) {}
    }
    return { updated: updatedItem, persistedToMongo: false };
  }
}

function isMemberAdmin(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  const hasAdminRole = member.roles.cache.some((role) => {
    const name = role.name.trim().toLowerCase();
    return name === 'admin' || name === '@admin' || name === 'admins' || name === 'administrator';
  });
  const hasAdminPerm = member.permissions.has(PermissionFlagsBits.Administrator);
  return hasAdminRole || hasAdminPerm;
}

// ============================================================================
// Google GenAI Client
// ============================================================================
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize Google GenAI:', err);
  }
}

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

const channelChatHistories = new Map<string, ChatTurn[]>();

function appendChannelHistory(channelId: string, role: 'user' | 'model', text: string) {
  const clean = text.trim();
  if (!clean) return;
  const list = channelChatHistories.get(channelId) || [];
  list.push({ role, text: clean.slice(0, 1500) });
  if (list.length > 16) {
    list.splice(0, list.length - 16);
  }
  channelChatHistories.set(channelId, list);
}

function buildSystemInstruction(ratholes: Rathole[], language: string = 'auto'): string {
  const ratholesSummary = Array.isArray(ratholes)
    ? ratholes
        .map(
          (r: any) =>
            `#${r.numero}: "${r.name}" | Coords: (${r.coords.x}, ${r.coords.y}) | Owner: ${r.owner} | Co-Owner: ${r.coOwner} | TP: ${r.tp} | Status: ${r.status} | Notas: ${r.notes || 'Nenhuma'}`
        )
        .join('\n')
    : 'Nenhum rathole no momento';

  return `You are TEKOli, an interactive, witty, combat-ready Discord chatbot for a competitive gaming clan (ARK: Survival Evolved / Rust).
You hold natural multi-turn conversations with clan members whenever they mention @TekOli, AND you have live access to the clan's MongoDB Ratholes database.

Language instructions:
- You are multilingual, and your PREFERRED/DEFAULT language when neutral is ENGLISH.
- ALWAYS reply in the same language the user just wrote in! (French -> natural French; Portuguese -> natural Brazilian Portuguese; German -> natural German; Spanish -> Spanish; English -> sharp, friendly English).
- User language preference setting: ${language}.

Chatbot & Personality instructions:
- Be genuinely conversational, engaging, tactical, and helpful! You can answer follow-up questions using conversation history, give base-building/defense/raid advice for ARK/Rust ratholes, compare coordinates/spots, joke lightly with clanmates, or summarize database info (e.g. underwater spots, "Builded" status bases, Land Beds notes, Pelagornis specials, etc.).
- Keep replies concise and formatted cleanly for Discord (**bold**, \`code\`, bullet points), under ~1800 characters unless a full list is requested.
- Never invent or hallucinate rathole numbers, owners, coordinates, or TPs — always use exact facts from the database below.

Mandatory clan database rules:
1. When giving info about a specific rathole X, include Owner, Co-Owner, Coordinates \`(xx, yy)\`, Status, and Teleport \`TP\`.
2. When asked about proximity to \`(x0, y0)\`, calculate Euclidean distance \`sqrt((x-x0)^2 + (y-y0)^2)\` and rank the closest ratholes accurately.
3. Member filter rules (CRITICAL):
   - By DEFAULT (if the user does NOT explicitly specify "responsible" / "responsável" or "co-owner"), filter STRICTLY by the primary **Owner** ONLY!
   - When filtering by Owner, check if that player is also Co-Owner on other ratholes and politely ask if they want to see those too.
   - "co-owner" / "coowner" filters strictly by Co-Owner.
   - "responsible" / "responsável" filters by Owner OR Co-Owner.
4. Only members with the \`@admin\` role can modify the database (via \`@TekOli update status to "builded" for rathole 59\` or \`/rathole update\`). If a user asks to edit data conversationally without using the update command, remind them \`@admin\` can run \`@TekOli update <field> to "<value>" for rathole <number>\`.

Current live MongoDB database of clan ratholes (${Array.isArray(ratholes) ? ratholes.length : 0} total):
${ratholesSummary}`;
}

async function generateChatbotReply(params: {
  prompt: string;
  ratholes: Rathole[];
  language?: string;
  history?: ChatTurn[];
  authorName?: string;
}): Promise<string> {
  if (!aiClient || !process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const { prompt, ratholes, language = 'auto', history = [], authorName } = params;
  const systemInstruction = buildSystemInstruction(ratholes, language);

  const userTurnText = authorName ? `[${authorName}]: ${prompt}` : prompt;
  const contents = [
    ...history.slice(-14).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: userTurnText }],
    },
  ];

  const maxAttempts = 3;
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
        },
      });
      return (response.text || '').trim();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const status = Number(err?.status || 0);
      const isTransient = status === 503 || status === 429 || msg.includes('503') || msg.includes('UNAVAILABLE');
      if (isTransient && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ============================================================================
// Live Discord.js Bot Gateway Integration
// ============================================================================
interface DiscordBotRuntimeStatus {
  configured: boolean;
  online: boolean;
  connecting: boolean;
  botTag: string | null;
  botId: string | null;
  guildsCount: number;
  guilds: Array<{ id: string; name: string; memberCount: number }>;
  lastError: string | null;
  slashCommandsRegistered: boolean;
  startedAt: string | null;
}

const discordStatus: DiscordBotRuntimeStatus = {
  configured: !!process.env.DISCORD_TOKEN?.trim(),
  online: false,
  connecting: false,
  botTag: null,
  botId: null,
  guildsCount: 0,
  guilds: [],
  lastError: null,
  slashCommandsRegistered: false,
  startedAt: null,
};

let discordClient: Client | null = null;
let lastConnectAttemptAt = 0;
let watchdogStarted = false;

function ensureDiscordBotOnline() {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) return;
  if (discordClient?.isReady()) {
    discordStatus.online = true;
    discordStatus.connecting = false;
    return;
  }
  if (discordStatus.connecting) return;
  const now = Date.now();
  if (now - lastConnectAttemptAt < 15000) return;

  if (discordClient) {
    try {
      discordClient.destroy();
    } catch (_) {}
    discordClient = null;
  }
  startDiscordBot();
}

function startGatewayWatchdog() {
  if (watchdogStarted) return;
  watchdogStarted = true;
  setInterval(() => {
    const token = process.env.DISCORD_TOKEN?.trim();
    if (!token) return;
    if (!discordClient?.isReady() && !discordStatus.connecting) {
      console.log('🔄 [TEKOli Watchdog] Gateway offline detectado — tentando reconectar...');
      ensureDiscordBotOnline();
    }
  }, 60000);
}

function toDiscordEmbedBuilder(embedData?: DiscordEmbed): EmbedBuilder | undefined {
  if (!embedData) return undefined;
  const colorInt = parseInt((embedData.color || '#5865F2').replace('#', ''), 16);
  const builder = new EmbedBuilder()
    .setTitle(embedData.title.slice(0, 256))
    .setDescription((embedData.description || ' ').slice(0, 4096))
    .setColor(isNaN(colorInt) ? 0x5865f2 : colorInt);

  if (embedData.fields && embedData.fields.length > 0) {
    builder.addFields(
      embedData.fields.slice(0, 25).map((f) => ({
        name: f.name.slice(0, 256) || 'Info',
        value: f.value.slice(0, 1024) || '-',
        inline: !!f.inline,
      }))
    );
  }

  if (embedData.footer?.text) {
    builder.setFooter({ text: embedData.footer.text.slice(0, 2048) });
  }
  builder.setTimestamp();
  return builder;
}

async function registerSlashCommands(token: string, appId: string) {
  const commands = [
    new SlashCommandBuilder()
      .setName('rathole')
      .setDescription('TEKOli Rathole tactical intel & management')
      .addSubcommand((sub) =>
        sub
          .setName('info')
          .setDescription('Show owner, co-owner, coordinates, and TP for a rathole')
          .addIntegerOption((opt) =>
            opt.setName('number').setDescription('Rathole number').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('near')
          .setDescription('Find ratholes nearest to coordinates (x, y)')
          .addNumberOption((opt) => opt.setName('x').setDescription('Coordinate X (0-100)').setRequired(true))
          .addNumberOption((opt) => opt.setName('y').setDescription('Coordinate Y (0-100)').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('proximo')
          .setDescription('Busca os ratholes mais próximos das coordenadas dadas')
          .addNumberOption((opt) => opt.setName('x').setDescription('Coordenada X').setRequired(true))
          .addNumberOption((opt) => opt.setName('y').setDescription('Coordenada Y').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('owner')
          .setDescription('Filter ratholes where player is primary Owner (Default)')
          .addStringOption((opt) => opt.setName('player').setDescription('Player name').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('dono')
          .setDescription('Filtra ratholes onde o jogador é Owner Principal')
          .addStringOption((opt) => opt.setName('jogador').setDescription('Nome do jogador').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('coowner')
          .setDescription('Filter ratholes where player is Co-Owner')
          .addStringOption((opt) => opt.setName('player').setDescription('Player name').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('responsible')
          .setDescription('Filter ratholes where player is Owner OR Co-Owner')
          .addStringOption((opt) => opt.setName('player').setDescription('Player name').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('responsavel')
          .setDescription('Filtra onde o jogador é Owner ou Co-Owner')
          .addStringOption((opt) => opt.setName('jogador').setDescription('Nome do jogador').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('update')
          .setDescription('Admin only: update rathole status, owner, co-owner, TP, or notes')
          .addIntegerOption((opt) => opt.setName('number').setDescription('Rathole number').setRequired(true))
          .addStringOption((opt) => opt.setName('status').setDescription('New status (e.g. Builded, ocupado, livre, em_raid)'))
          .addStringOption((opt) => opt.setName('owner').setDescription('New primary Owner'))
          .addStringOption((opt) => opt.setName('coowner').setDescription('New Co-Owner'))
          .addStringOption((opt) => opt.setName('tp').setDescription('New TP name/command'))
          .addStringOption((opt) => opt.setName('notes').setDescription('New tactical notes'))
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List ratholes overview'))
      .addSubcommand((sub) => sub.setName('listar').setDescription('Lista geral de ratholes')),
    new SlashCommandBuilder().setName('help').setDescription('Show TEKOli bot commands (English & Portuguese)'),
    new SlashCommandBuilder().setName('ajuda').setDescription('Mostra todos os comandos do bot TEKOli'),
  ].map((c) => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  discordStatus.slashCommandsRegistered = true;
}

async function startDiscordBot() {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) {
    discordStatus.configured = false;
    discordStatus.online = false;
    discordStatus.connecting = false;
    console.log('ℹ️ [TEKOli Discord] DISCORD_TOKEN não configurado nas variáveis/Secrets. O bot aguarda token para ficar Online no Discord.');
    return;
  }

  lastConnectAttemptAt = Date.now();
  discordStatus.configured = true;
  discordStatus.connecting = true;
  discordStatus.lastError = null;
  startGatewayWatchdog();

  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    discordClient.once(Events.ClientReady, async (readyClient) => {
      discordStatus.online = true;
      discordStatus.connecting = false;
      discordStatus.botTag = readyClient.user.tag;
      discordStatus.botId = readyClient.user.id;
      discordStatus.guildsCount = readyClient.guilds.cache.size;
      discordStatus.guilds = readyClient.guilds.cache.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
      }));
      discordStatus.startedAt = new Date().toISOString();
      discordStatus.lastError = null;

      console.log(`🤖 [TEKOli Discord] ONLINE como ${readyClient.user.tag} em ${readyClient.guilds.cache.size} servidor(es)!`);

      readyClient.user.setActivity('ARK / Rust • TEKOli Radar', {
        type: ActivityType.Playing,
      });

      try {
        const appId = process.env.DISCORD_CLIENT_ID?.trim() || readyClient.user.id;
        await registerSlashCommands(token, appId);
        console.log('✅ [TEKOli Discord] Slash commands registrados com sucesso!');
      } catch (err: any) {
        console.warn('⚠️ [TEKOli Discord] Falha ao registrar slash commands:', err.message);
      }
    });

    discordClient.on(Events.ShardDisconnect, () => {
      discordStatus.online = false;
      discordStatus.connecting = false;
      console.warn('⚠️ [TEKOli Discord] Shard desconectado — aguardando reconexão automática.');
    });

    discordClient.on(Events.Error, (err) => {
      discordStatus.lastError = err.message;
      console.warn('⚠️ [TEKOli Discord] Client error:', err.message);
    });

    discordClient.on(Events.GuildCreate, () => {
      if (discordClient?.isReady()) {
        discordStatus.guildsCount = discordClient.guilds.cache.size;
        discordStatus.guilds = discordClient.guilds.cache.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
        }));
      }
    });

    discordClient.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      const raw = message.content.trim();
      if (!raw) return;

      // STRICT RULE: Only respond when the bot itself is explicitly @mentioned!
      const isMentioned = discordClient?.user
        ? message.mentions.has(discordClient.user, { ignoreEveryone: true, ignoreRoles: true })
        : false;
      if (!isMentioned) return;

      let cleanedPrompt = discordClient?.user
        ? raw.replace(new RegExp(`<@!?${discordClient.user.id}>`, 'g'), '').trim()
        : raw;

      if (!cleanedPrompt) {
        await message.reply(
          '👋 **TEKOli online!** Ask me anything — e.g. `"Who owns rathole 3?"`, `"Nearest ratholes to 12, 20"`, `"welche ratholes hat @MisSy"`, or `@admin` can run `update status to "builded" for rathole 59`!'
        );
        return;
      }

      // Check Admin Database Update Command first (e.g. "update status to 'builded' for rathole 59")
      const adminCmd = parseAdminUpdateCommand(cleanedPrompt);
      if (adminCmd) {
        const member =
          message.member ||
          (message.guild ? await message.guild.members.fetch(message.author.id).catch(() => null) : null);

        if (!isMemberAdmin(member)) {
          await message.reply(
            '⛔ **Access Denied:** Only members with the **@admin** role can update the rathole database.'
          );
          return;
        }

        const activeBefore = await getActiveRatholes();
        const existing = activeBefore.find((r) => r.numero === adminCmd.numero);
        if (!existing) {
          await message.reply(`🔍 **Rathole #${adminCmd.numero}** was not found in the database.`);
          return;
        }

        const previousValue = String((existing as any)[adminCmd.field] ?? '');
        const { updated, persistedToMongo } = await updateRatholeInStore(adminCmd.numero, {
          [adminCmd.field]: adminCmd.value,
        });

        if (!updated) {
          await message.reply(`❌ Failed to update **Rathole #${adminCmd.numero}**.`);
          return;
        }

        const fieldLabel =
          adminCmd.field === 'coOwner'
            ? 'Co-Owner'
            : adminCmd.field.charAt(0).toUpperCase() + adminCmd.field.slice(1);

        const updateEmbed = new EmbedBuilder()
          .setTitle(`✅ Rathole #${updated.numero} Updated • ${updated.name}`)
          .setColor(0x10b981)
          .setDescription(`Database updated by **${message.member?.displayName || message.author.username}** (\`@admin\`)`)
          .addFields(
            { name: '🛠️ Field', value: `**${fieldLabel}**`, inline: true },
            { name: '⬅️ Previous', value: `\`${previousValue || 'Empty'}\``, inline: true },
            { name: '➡️ New Value', value: `\`${adminCmd.value}\``, inline: true },
            { name: '👑 Owner', value: updated.owner, inline: true },
            { name: '📍 Coords', value: `(${updated.coords.x.toFixed(1)}, ${updated.coords.y.toFixed(1)})`, inline: true },
            { name: '🍃 Storage', value: persistedToMongo ? 'MongoDB Atlas Synced' : 'Memory Store', inline: true }
          )
          .setFooter({ text: 'TEKOli Bot • Admin Database Update' })
          .setTimestamp();

        await message.reply({
          content: `✅ **Database Updated!** **Rathole #${updated.numero}** ${fieldLabel} changed from \`${previousValue || 'Empty'}\` to **\`${adminCmd.value}\`**${persistedToMongo ? ' *(Saved to MongoDB)*' : ''}.`,
          embeds: [updateEmbed],
        });
        return;
      }

      const activeRatholes = await getActiveRatholes();

      // Resolve Discord user mentions like <@123456789012345678> into @PlayerName
      const knownRatholeNames = Array.from(
        new Set(
          activeRatholes
            .flatMap((rh) => [
              rh.owner.split('(')[0].trim(),
              rh.coOwner.split('(')[0].trim(),
            ])
            .flatMap((n) => n.split('/').map((part) => part.trim()))
            .filter((n) => n.length >= 2 && n.toLowerCase() !== 'nenhum' && n.toLowerCase() !== 'none')
        )
      ).sort((a, b) => b.length - a.length);

      cleanedPrompt = cleanedPrompt.replace(/<@!?(\d+)>/g, (fullMatch, userId: string) => {
        const member = message.mentions.members?.get(userId);
        const user = message.mentions.users.get(userId);
        const candidates = [
          member?.nickname,
          member?.displayName,
          user?.globalName,
          user?.username,
        ].filter((v): v is string => !!v && v.trim().length > 0);

        for (const candidate of candidates) {
          const candLower = candidate.toLowerCase();
          const matchedPlayer = knownRatholeNames.find((name) => {
            const nameLower = name.toLowerCase();
            return candLower === nameLower || candLower.includes(nameLower);
          });
          if (matchedPlayer) {
            return `@${matchedPlayer}`;
          }
        }

        if (candidates.length > 0) {
          return `@${candidates[0].replace(/\s+/g, '')}`;
        }
        return fullMatch;
      });

      const authorLabel = message.member?.displayName || message.author.username;
      const channelId = message.channelId;
      const localResult = parseLocalRatholeQuery(cleanedPrompt, activeRatholes, 'auto');

      if (localResult.type !== 'general' && localResult.type !== 'not_found') {
        appendChannelHistory(channelId, 'user', `[${authorLabel}]: ${cleanedPrompt}`);
        appendChannelHistory(channelId, 'model', localResult.content);
        const embed = toDiscordEmbedBuilder(localResult.embed);
        await message.reply({
          content: localResult.content.slice(0, 2000),
          embeds: embed ? [embed] : [],
        });
        return;
      }

      // Keep deterministic "not_found" only for explicit missing rathole # or Co-Owner follow-up hint
      const isDeterministicNotFound =
        localResult.type === 'not_found' &&
        (/\bco-owner\b/i.test(localResult.content) || /Rathole #\d+/i.test(localResult.content));

      if (isDeterministicNotFound) {
        appendChannelHistory(channelId, 'user', `[${authorLabel}]: ${cleanedPrompt}`);
        appendChannelHistory(channelId, 'model', localResult.content);
        await message.reply({ content: localResult.content.slice(0, 2000) });
        return;
      }

      // Interactive AI Chatbot powered by Gemini (with multi-turn channel memory!)
      if (aiClient && process.env.GEMINI_API_KEY) {
        try {
          if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
            await message.channel.sendTyping().catch(() => {});
          }
          const history = channelChatHistories.get(channelId) || [];
          const replyText = await generateChatbotReply({
            prompt: cleanedPrompt,
            ratholes: activeRatholes,
            language: 'auto',
            history,
            authorName: authorLabel,
          });
          if (replyText) {
            appendChannelHistory(channelId, 'user', `[${authorLabel}]: ${cleanedPrompt}`);
            appendChannelHistory(channelId, 'model', replyText);

            if (replyText.length <= 1950) {
              await message.reply(replyText);
            } else {
              const firstChunk = replyText.slice(0, 1950);
              const secondChunk = replyText.slice(1950, 3900);
              await message.reply(firstChunk);
              if (secondChunk && 'send' in message.channel && typeof message.channel.send === 'function') {
                await message.channel.send(secondChunk);
              }
            }
            return;
          }
        } catch (err: any) {
          console.error('❌ [TEKOli Chatbot] Gemini error:', err?.message || err);
        }
      }

      await message.reply({ content: localResult.content.slice(0, 2000) });
    });

    discordClient.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const activeRatholes = await getActiveRatholes();
      let syntheticQuery = '';

      if (interaction.commandName === 'help') {
        syntheticQuery = '/help';
      } else if (interaction.commandName === 'ajuda') {
        syntheticQuery = '/ajuda';
      } else if (interaction.commandName === 'rathole') {
        const sub = interaction.options.getSubcommand();
        if (sub === 'update') {
          const member =
            (interaction.member as GuildMember | null) ||
            (interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null);

          if (!isMemberAdmin(member)) {
            await interaction.reply({
              content: '⛔ **Access Denied:** Only members with the **@admin** role can update the rathole database.',
              ephemeral: true,
            });
            return;
          }

          const num = interaction.options.getInteger('number', true);
          const status = interaction.options.getString('status');
          const owner = interaction.options.getString('owner');
          const coOwner = interaction.options.getString('coowner');
          const tp = interaction.options.getString('tp');
          const notes = interaction.options.getString('notes');

          const updates: Partial<Rathole> = {};
          if (status) updates.status = normalizeRatholeStatus(status);
          if (owner) updates.owner = owner.trim();
          if (coOwner) updates.coOwner = coOwner.trim();
          if (tp) updates.tp = tp.trim();
          if (notes !== null) updates.notes = notes.trim();

          if (Object.keys(updates).length === 0) {
            await interaction.reply({
              content: '⚠️ Provide at least one field to update (`status`, `owner`, `coowner`, `tp`, or `notes`).',
              ephemeral: true,
            });
            return;
          }

          const { updated, persistedToMongo } = await updateRatholeInStore(num, updates);
          if (!updated) {
            await interaction.reply(`🔍 **Rathole #${num}** was not found in the database.`);
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle(`✅ Rathole #${updated.numero} Updated • ${updated.name}`)
            .setColor(0x10b981)
            .addFields(
              { name: '🏷️ Status', value: `\`${updated.status}\``, inline: true },
              { name: '👑 Owner', value: updated.owner, inline: true },
              { name: '🛡️ Co-Owner', value: updated.coOwner, inline: true },
              { name: '⚡ TP', value: `\`${updated.tp}\``, inline: true },
              { name: '🍃 Storage', value: persistedToMongo ? 'MongoDB Atlas Synced' : 'Memory Store', inline: true }
            )
            .setFooter({ text: 'TEKOli Bot • Admin Slash Update' })
            .setTimestamp();

          await interaction.reply({
            content: `✅ **Rathole #${updated.numero}** updated successfully!`,
            embeds: [embed],
          });
          return;
        } else if (sub === 'info') {
          const num = interaction.options.getInteger('number', true);
          syntheticQuery = `/rathole info ${num}`;
        } else if (sub === 'near' || sub === 'proximo') {
          const x = interaction.options.getNumber('x', true);
          const y = interaction.options.getNumber('y', true);
          syntheticQuery = `/rathole ${sub} ${x} ${y}`;
        } else if (sub === 'owner' || sub === 'dono') {
          const player =
            interaction.options.getString('player') ||
            interaction.options.getString('jogador') ||
            '';
          syntheticQuery = `/rathole ${sub} ${player}`;
        } else if (sub === 'coowner') {
          const player = interaction.options.getString('player', true);
          syntheticQuery = `/rathole co-owner ${player}`;
        } else if (sub === 'responsible' || sub === 'responsavel') {
          const player =
            interaction.options.getString('player') ||
            interaction.options.getString('jogador') ||
            '';
          syntheticQuery = `/rathole ${sub} ${player}`;
        } else if (sub === 'list' || sub === 'listar') {
          syntheticQuery = `/rathole ${sub}`;
        }
      }

      if (syntheticQuery) {
        const res = parseLocalRatholeQuery(syntheticQuery, activeRatholes, 'auto');
        const embed = toDiscordEmbedBuilder(res.embed);
        await interaction.reply({
          content: res.content.slice(0, 2000),
          embeds: embed ? [embed] : [],
        });
      }
    });

    await discordClient.login(token);
  } catch (err: any) {
    discordStatus.online = false;
    discordStatus.connecting = false;
    const rawMsg = err?.message || 'Erro desconhecido ao conectar ao Discord';
    if (rawMsg.toLowerCase().includes('disallowed intents')) {
      discordStatus.lastError =
        'Privileged Intent desativada! No Discord Developer Portal -> Bot, ative "MESSAGE CONTENT INTENT" e "SERVER MEMBERS INTENT".';
    } else if (rawMsg.toLowerCase().includes('invalid token')) {
      discordStatus.lastError =
        'DISCORD_TOKEN inválido! Gere um novo token no Discord Developer Portal -> Bot -> Reset Token e atualize nos Secrets.';
    } else {
      discordStatus.lastError = rawMsg;
    }
    console.error('❌ [TEKOli Discord] Falha ao conectar:', discordStatus.lastError);
  }
}

// ============================================================================
// HTTP API Routes (Auto-Wake Bot on Any Request)
// ============================================================================
app.use('/api', (_req: Request, _res: Response, next) => {
  ensureDiscordBotOnline();
  next();
});

// Lightweight Keep-Alive Ping (ideal for UptimeRobot / cron-job every 5 min)
app.get('/api/ping', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    botName: 'TEKOli',
    discordOnline: discordStatus.online,
    connecting: discordStatus.connecting,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    botName: 'TEKOli',
    geminiEnabled: !!process.env.GEMINI_API_KEY,
    discordOnline: discordStatus.online,
  });
});

// Live Discord Bot Status (no secrets exposed)
app.get('/api/bot/status', async (_req: Request, res: Response) => {
  const activeRatholes = await getActiveRatholes();
  res.json({
    ...discordStatus,
    publicKeyConfigured: !!process.env.DISCORD_PUBLIC_KEY?.trim(),
    mongoConnected,
    ratholesSource: mongoConnected ? 'mongodb' : 'default_memory',
    ratholesCount: activeRatholes.length,
    geminiEnabled: !!process.env.GEMINI_API_KEY,
  });
});

// Discord HTTP Interactions Endpoint (Serverless Slash Commands - wakes Cloud Run on demand!)
function verifyDiscordEd25519(rawBody: Buffer, signature: string, timestamp: string, publicKeyHex: string): boolean {
  try {
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const pubKeyObj = crypto.createPublicKey({
      key: Buffer.concat([spkiPrefix, Buffer.from(publicKeyHex, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(
      null,
      Buffer.concat([Buffer.from(timestamp, 'utf8'), rawBody]),
      pubKeyObj,
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

app.post('/api/discord/interactions', async (req: Request, res: Response) => {
  const publicKey = process.env.DISCORD_PUBLIC_KEY?.trim();
  const signature = req.header('X-Signature-Ed25519') || '';
  const timestamp = req.header('X-Signature-Timestamp') || '';
  const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));

  if (!publicKey) {
    res.status(503).json({ error: 'DISCORD_PUBLIC_KEY not configured in Secrets.' });
    return;
  }

  if (!signature || !timestamp || !verifyDiscordEd25519(rawBody, signature, timestamp, publicKey)) {
    res.status(401).send('Invalid request signature');
    return;
  }

  const interaction = req.body;
  // Type 1: Discord Endpoint Verification PING
  if (interaction?.type === 1) {
    res.json({ type: 1 });
    return;
  }

  // Type 2: Slash Command (APPLICATION_COMMAND)
  if (interaction?.type === 2 && interaction.data) {
    const cmdName = interaction.data.name;
    let syntheticQuery = '';

    if (cmdName === 'help') {
      syntheticQuery = '/help';
    } else if (cmdName === 'ajuda') {
      syntheticQuery = '/ajuda';
    } else if (cmdName === 'rathole' && Array.isArray(interaction.data.options)) {
      const subOpt = interaction.data.options[0];
      const sub = subOpt?.name;
      const getVal = (optName: string) =>
        subOpt?.options?.find((o: any) => o.name === optName)?.value;

      if (sub === 'update') {
        let isAdmin = false;
        const permStr = interaction.member?.permissions;
        if (permStr) {
          try {
            if ((BigInt(permStr) & BigInt(8)) !== 0n) isAdmin = true;
          } catch (_) {}
        }
        if (!isAdmin && interaction.guild_id && interaction.member?.user?.id && discordClient?.isReady()) {
          const guild = discordClient.guilds.cache.get(interaction.guild_id);
          const fetchedMember = await guild?.members.fetch(interaction.member.user.id).catch(() => null);
          if (isMemberAdmin(fetchedMember)) isAdmin = true;
        }
        if (!isAdmin) {
          res.json({
            type: 4,
            data: {
              flags: 64,
              content: '⛔ **Access Denied:** Only members with the **@admin** role can update the rathole database.',
            },
          });
          return;
        }

        const num = Number(getVal('number'));
        const updates: Partial<Rathole> = {};
        if (getVal('status')) updates.status = normalizeRatholeStatus(String(getVal('status')));
        if (getVal('owner')) updates.owner = String(getVal('owner')).trim();
        if (getVal('coowner')) updates.coOwner = String(getVal('coowner')).trim();
        if (getVal('tp')) updates.tp = String(getVal('tp')).trim();
        if (getVal('notes') !== undefined) updates.notes = String(getVal('notes')).trim();

        const { updated, persistedToMongo } = await updateRatholeInStore(num, updates);
        if (!updated) {
          res.json({
            type: 4,
            data: { content: `🔍 **Rathole #${num}** was not found in the database.` },
          });
          return;
        }
        res.json({
          type: 4,
          data: {
            content: `✅ **Rathole #${updated.numero}** updated! Status: \`${updated.status}\`${persistedToMongo ? ' *(Saved to MongoDB)*' : ''}`,
          },
        });
        return;
      } else if (sub === 'info') {
        syntheticQuery = `/rathole info ${getVal('number')}`;
      } else if (sub === 'near' || sub === 'proximo') {
        syntheticQuery = `/rathole ${sub} ${getVal('x')} ${getVal('y')}`;
      } else if (sub === 'owner' || sub === 'dono') {
        syntheticQuery = `/rathole ${sub} ${getVal('player') || getVal('jogador') || ''}`;
      } else if (sub === 'coowner') {
        syntheticQuery = `/rathole co-owner ${getVal('player') || ''}`;
      } else if (sub === 'responsible' || sub === 'responsavel') {
        syntheticQuery = `/rathole ${sub} ${getVal('player') || getVal('jogador') || ''}`;
      } else if (sub === 'list' || sub === 'listar') {
        syntheticQuery = `/rathole ${sub}`;
      }
    }

    if (syntheticQuery) {
      const activeRatholes = await getActiveRatholes();
      const result = parseLocalRatholeQuery(syntheticQuery, activeRatholes, 'auto');
      const embedBuilder = toDiscordEmbedBuilder(result.embed);
      res.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: result.content.slice(0, 2000),
          embeds: embedBuilder ? [embedBuilder.toJSON()] : [],
        },
      });
      return;
    }
  }

  res.json({
    type: 4,
    data: { content: '🤖 **TEKOli online!** Try `/help` or `/rathole info <number>`.' },
  });
});

// Get active ratholes (from MongoDB if configured, or server memory)
app.get('/api/ratholes', async (_req: Request, res: Response) => {
  const active = await getActiveRatholes();
  res.json({ success: true, mongoConnected, ratholes: active });
});

// Update a single rathole field (used by Simulator admin commands / UI)
app.post('/api/ratholes/update', async (req: Request, res: Response) => {
  const { numero, updates } = req.body || {};
  const parsedNum = Number(numero);
  if (!parsedNum || !updates || typeof updates !== 'object') {
    res.status(400).json({ success: false, error: 'numero and updates are required' });
    return;
  }
  const { updated, persistedToMongo } = await updateRatholeInStore(parsedNum, updates);
  if (!updated) {
    res.status(404).json({ success: false, error: `Rathole #${parsedNum} not found` });
    return;
  }
  res.json({ success: true, rathole: updated, persistedToMongo });
});

// Sync edited ratholes from UI into server memory (and MongoDB if configured)
app.post('/api/ratholes/sync', async (req: Request, res: Response) => {
  const { ratholes } = req.body;
  if (Array.isArray(ratholes) && ratholes.length > 0) {
    memoryRatholes = ratholes;
  }
  res.json({ success: true, count: memoryRatholes.length });
});

// AI Chatbot route for TEKOli Bot (multi-turn with Gemini)
app.post('/api/gemini/query', async (req: Request, res: Response) => {
  const { prompt, ratholes, language = 'auto', history = [] } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  if (!aiClient || !process.env.GEMINI_API_KEY) {
    res.status(503).json({
      useFallback: true,
      error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
    });
    return;
  }

  try {
    const active = Array.isArray(ratholes) && ratholes.length > 0 ? ratholes : await getActiveRatholes();
    const safeHistory: ChatTurn[] = Array.isArray(history)
      ? history
          .filter((h: any) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
          .slice(-14)
      : [];

    const replyText = await generateChatbotReply({
      prompt,
      ratholes: active,
      language,
      history: safeHistory,
    });

    res.json({
      useFallback: false,
      text: replyText,
      model: 'gemini-4-hydrogen',
    });
  } catch (error: any) {
    console.error('Error querying Gemini:', error);
    const statusCode = typeof error?.status === 'number' ? error.status : 500;
    res.status(statusCode).json({
      error: error?.message || 'Failed to process with Gemini',
      useFallback: false,
    });
  }
});

// Test MongoDB connection
app.post('/api/mongodb/test', async (req: Request, res: Response) => {
  const { uri, dbName = 'tekoli_db', collectionName = 'ratholes' } = req.body;

  if (!uri || typeof uri !== 'string') {
    res.status(400).json({ success: false, error: 'URI do MongoDB é obrigatória.' });
    return;
  }

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000,
    });

    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    const count = await db.collection(collectionName).countDocuments();

    await client.close();
    res.json({
      success: true,
      message: `Conexão estabelecida com sucesso ao MongoDB!`,
      database: dbName,
      collection: collectionName,
      documentCount: count,
      availableCollections: collections.map((c) => c.name),
    });
  } catch (error: any) {
    if (client) {
      try {
        await client.close();
      } catch (_) {}
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao conectar no MongoDB. Verifique a URI e IP Whitelist.',
    });
  }
});

// Sync data with real MongoDB if user wants
app.post('/api/mongodb/sync', async (req: Request, res: Response) => {
  const { uri, dbName = 'tekoli_db', collectionName = 'ratholes', ratholes, action } = req.body;

  if (!uri) {
    res.status(400).json({ success: false, error: 'URI não fornecida.' });
    return;
  }

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 4000,
    });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    if (action === 'push') {
      for (const rh of ratholes) {
        await col.updateOne({ numero: rh.numero }, { $set: rh }, { upsert: true });
      }
      memoryRatholes = ratholes;
      const count = await col.countDocuments();
      await client.close();
      res.json({ success: true, message: `${ratholes.length} ratholes sincronizados no MongoDB!`, count });
    } else {
      const docs = await col.find({}).sort({ numero: 1 }).toArray();
      await client.close();
      if (docs.length > 0) {
        memoryRatholes = docs as unknown as Rathole[];
      }
      res.json({ success: true, ratholes: docs });
    }
  } catch (err: any) {
    if (client) {
      try {
        await client.close();
      } catch (_) {}
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Optional Discord Webhook poster
app.post('/api/discord/webhook', async (req: Request, res: Response) => {
  const { webhookUrl, message, embed } = req.body;

  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    res.status(400).json({ error: 'URL de webhook inválida' });
    return;
  }

  try {
    const payload: any = {
      username: 'TEKOli [BOT]',
      avatar_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      content: message,
    };

    if (embed) {
      payload.embeds = [
        {
          title: embed.title,
          description: embed.description,
          color: parseInt((embed.color || '#5865F2').replace('#', ''), 16),
          fields: embed.fields,
          footer: embed.footer,
        },
      ];
    }

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (discordRes.ok) {
      res.json({ success: true, message: 'Mensagem enviada com sucesso para o canal do Discord!' });
    } else {
      const errText = await discordRes.text();
      res.status(400).json({ success: false, error: `Discord API erro: ${errText}` });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_SITE_NAME);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TEKOli Full-Stack Server running on port ${PORT}`);
    // Initialize live Discord Gateway Bot if DISCORD_TOKEN is set
    startDiscordBot();
  });
}

startServer();
