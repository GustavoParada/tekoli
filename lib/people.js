const Person = require('../models/Person');
const { escapeRegex } = require('./text-commands');

function exact(name) {
  return new RegExp(`^${escapeRegex(name.trim())}$`, 'i');
}

function labelsFor(user, member) {
  return [...new Set([
    user?.username,
    user?.globalName,
    member?.displayName,
    member?.nickname,
  ].filter(Boolean))];
}

async function findByLabels(labels) {
  const clauses = labels.flatMap((label) => [
    { discordName: exact(label) },
    { aliases: exact(label) },
  ]);
  if (clauses.length === 0) return null;
  return Person.findOne({ $or: clauses });
}

async function ownerFromDiscordUser(user, member) {
  let person = await Person.findOne({ discordId: user.id });
  if (!person) person = await findByLabels(labelsFor(user, member));
  if (!person) return null;

  if (person.discordId !== user.id) {
    person.discordId = user.id;
    await person.save();
  }
  return person.ownerName;
}

async function canonicalOwnerName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return trimmed;
  const person = await findByLabels([trimmed]);
  return person ? person.ownerName : trimmed;
}

async function linkDiscordUser(user, ownerName) {
  const discordName = user.globalName || user.username;
  let person = await Person.findOne({
    $or: [
      { discordId: user.id },
      { discordName: exact(discordName) },
      { discordName: exact(user.username) },
    ],
  });

  if (!person) {
    person = new Person({ discordId: user.id, discordName, ownerName: ownerName.trim() });
  } else {
    person.discordId = user.id;
    person.discordName = discordName;
    person.ownerName = ownerName.trim();
  }

  await person.save();
  return person;
}

async function ensureKnownPeople() {
  const existing = await Person.findOne({ discordName: exact('Olimpikus') });
  if (existing) return;
  await Person.create({ discordName: 'Olimpikus', ownerName: 'Oli', aliases: [] });
  console.log('[TEKOli] Vínculo criado: Discord Olimpikus → owner Oli');
}

module.exports = {
  ownerFromDiscordUser,
  canonicalOwnerName,
  linkDiscordUser,
  ensureKnownPeople,
};
