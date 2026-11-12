const Rathole = require('../models/Rathole');
const RatholeChange = require('../models/RatholeChange');

const FIELD_ALIASES = {
  number: 'number',
  numero: 'number',
  num: 'number',
  name: 'name',
  nome: 'name',
  owner: 'owner',
  dono: 'owner',
  coowner: 'coOwner',
  'co-owner': 'coOwner',
  co_owner: 'coOwner',
  x: 'coords.x',
  'coords.x': 'coords.x',
  y: 'coords.y',
  'coords.y': 'coords.y',
  coords: 'coords',
  coordinates: 'coords',
  coordenadas: 'coords',
  tp: 'tp',
  teleport: 'tp',
  server: 'server',
  servidor: 'server',
  status: 'status',
  notes: 'notes',
  note: 'notes',
  notas: 'notes',
  turrets: 'turretsCount',
  turretscount: 'turretsCount',
  turretcount: 'turretsCount',
};

const STATUS_INPUT = {
  occupied: 'occupied',
  ocupado: 'occupied',
  free: 'free',
  livre: 'free',
  available: 'free',
  vacant: 'free',
  ally: 'ally',
  aliado: 'ally',
  allied: 'ally',
  raiding: 'raiding',
  em_raid: 'raiding',
  raid: 'raiding',
  reserved: 'reserved',
  reserva: 'reserved',
  reserve: 'reserved',
};

const FIELD_HELP = 'number, name, owner, coOwner, x, y, coords, tp, server, status, notes, turretsCount';
const STATUS_HELP = 'occupied, free, ally, raiding, reserved';
const REQUIRED_STRINGS = new Set(['name', 'owner', 'tp', 'server']);

function commandText(text) {
  return String(text || '')
    .replace(/^(?:\s*<@[!&]?\d+>\s*)+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:.-]+\s*/, '');
}

function looksLikeUpdate(text) {
  return /^(?:\/rathole\s+)?(?:update|atualizar)\b/i.test(commandText(text));
}

function looksLikeHistory(text) {
  return /^(?:\/rathole\s+)?(?:history|historico|histórico)\b/i.test(commandText(text));
}

function parseUpdateText(text) {
  const match = commandText(text).match(
    /^(?:\/rathole\s+)?(?:update|atualizar)\s+(?:rathole\s+|rh\s+|#)?(\d+)\s+([a-zA-Z][\w.-]*)\s+([\s\S]+)$/i
  );
  if (!match) return null;
  return {
    number: parseInt(match[1], 10),
    field: match[2],
    value: match[3].trim(),
  };
}

function parseHistoryText(text) {
  const match = commandText(text).match(
    /^(?:\/rathole\s+)?(?:history|historico|histórico)\s+(?:rathole\s+|rh\s+|#|number\s+|numero\s+)?(\d+)\s*$/i
  );
  if (!match) return null;
  return parseInt(match[1], 10);
}

function updateUsage() {
  return [
    'Usage: `update <number> <field> <value>`',
    `Fields: ${FIELD_HELP}`,
    `Status: ${STATUS_HELP}`,
    'Example: `update 3 owner Clutch`',
    'Coords example: `update 3 coords 14.9, 85.8`',
    'Use `-` to clear notes.',
  ].join('\n');
}

function historyUsage() {
  return 'Usage: `history <number>`';
}

function hasAdminRole(member, guild) {
  if (!member || !guild) return false;
  const adminIds = new Set(
    [...guild.roles.cache.values()]
      .filter((role) => role.name.trim().toLowerCase() === 'admin')
      .map((role) => role.id)
  );
  if (adminIds.size === 0) return false;
  if (member.roles?.cache) return member.roles.cache.some((role) => adminIds.has(role.id));
  if (Array.isArray(member.roles)) return member.roles.some((roleId) => adminIds.has(roleId));
  return false;
}

function resolveField(input) {
  const key = String(input || '').trim().toLowerCase();
  return FIELD_ALIASES[key] || null;
}

function parseDecimal(raw) {
  const normalized = String(raw || '').trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseFieldValue(field, rawValue) {
  const raw = String(rawValue || '').trim();

  if (field === 'coords') {
    const match = raw.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:,|\s)\s*(-?\d+(?:[.,]\d+)?)$/);
    if (!match) return { error: 'Coords need two numbers, for example `14.9, 85.8`.' };
    return { value: { x: parseDecimal(match[1]), y: parseDecimal(match[2]) } };
  }

  if (field === 'coords.x' || field === 'coords.y') {
    const value = parseDecimal(raw);
    if (value == null) return { error: `\`${field}\` must be a number.` };
    return { value };
  }

  if (field === 'number') {
    if (!/^\d+$/.test(raw) || Number(raw) < 1) return { error: '`number` must be a positive integer.' };
    return { value: Number(raw) };
  }

  if (field === 'turretsCount') {
    if (!/^\d+$/.test(raw)) return { error: '`turretsCount` must be an integer of 0 or more.' };
    return { value: Number(raw) };
  }

  if (field === 'status') {
    const status = STATUS_INPUT[raw.toLowerCase().replace(/\s+/g, '_')];
    if (!status) return { error: `Status must be one of: ${STATUS_HELP}.` };
    return { value: status };
  }

  const cleared = raw === '-' || /^none$/i.test(raw) || /^nenhum$/i.test(raw);
  if (field === 'notes' && cleared) return { value: '' };
  if (field === 'coOwner' && cleared) return { value: 'None' };

  const limit = field === 'notes' ? 1000 : 200;
  const value = raw.slice(0, limit);
  if (!value && REQUIRED_STRINGS.has(field)) return { error: `\`${field}\` cannot be empty.` };
  return { value };
}

function formatValue(value) {
  if (value == null || value === '') return 'empty';
  const text = typeof value === 'object' ? `${value.x}, ${value.y}` : String(value);
  const safe = text.replace(/@/g, '@\u200b');
  return safe.length > 180 ? `${safe.slice(0, 177)}...` : safe;
}

function changedByName(user) {
  return user.globalName || user.username || user.tag || user.id;
}

async function applyRatholeUpdate({ number, fieldInput, rawValue, user }) {
  const field = resolveField(fieldInput);
  if (!field) return { error: `Unknown field **${fieldInput}**. Fields: ${FIELD_HELP}.` };

  const parsed = parseFieldValue(field, rawValue);
  if (parsed.error) return { error: parsed.error };

  const rathole = await Rathole.findOne({ number });
  if (!rathole) return { error: `Rathole #${number} was not found.` };

  const assignments = field === 'coords'
    ? [
      { field: 'coords.x', value: parsed.value.x },
      { field: 'coords.y', value: parsed.value.y },
    ]
    : [{ field, value: parsed.value }];

  if (field === 'number') {
    const taken = await Rathole.findOne({ number: parsed.value, _id: { $ne: rathole._id } });
    if (taken) return { error: `Rathole #${parsed.value} already exists.` };
  }

  const changes = [];
  for (const assignment of assignments) {
    const current = rathole.get(assignment.field);
    const previousValue = current == null ? null : current;
    if (Object.is(previousValue, assignment.value)) continue;
    rathole.set(assignment.field, assignment.value);
    changes.push({
      field: assignment.field,
      previousValue,
      newValue: assignment.value,
    });
  }

  if (changes.length === 0) {
    return { error: `Rathole #${number} already has that ${field}.` };
  }

  const actor = changedByName(user);
  try {
    await rathole.save();
  } catch (err) {
    if (err && err.code === 11000) return { error: 'That number is already used by another rathole.' };
    throw err;
  }

  try {
    await RatholeChange.insertMany(changes.map((change) => ({
      ratholeId: rathole._id,
      ratholeNumber: rathole.number,
      field: change.field,
      previousValue: change.previousValue,
      newValue: change.newValue,
      changedByDiscordId: user.id,
      changedByName: actor,
    })));
  } catch (err) {
    console.error('[TEKOli] Rathole updated but history insert failed:', err.message);
    return { rathole, changes, changedByName: actor, historyError: true };
  }

  return { rathole, changes, changedByName: actor };
}

async function listRatholeChanges(number, limit = 10) {
  const rathole = await Rathole.findOne({ number });
  const clauses = [
    { ratholeNumber: number },
    { field: 'number', previousValue: number },
    { field: 'number', newValue: number },
  ];
  if (rathole) clauses.push({ ratholeId: rathole._id });
  const changes = await RatholeChange.find({ $or: clauses }).sort({ createdAt: -1 }).limit(limit);
  return { rathole, changes };
}

module.exports = {
  FIELD_HELP,
  STATUS_HELP,
  looksLikeUpdate,
  looksLikeHistory,
  parseUpdateText,
  parseHistoryText,
  updateUsage,
  historyUsage,
  hasAdminRole,
  resolveField,
  parseFieldValue,
  formatValue,
  applyRatholeUpdate,
  listRatholeChanges,
};
