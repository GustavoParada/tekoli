const Rathole = require('../models/Rathole');

const STATUS_TO_ENGLISH = {
  ocupado: 'occupied',
  livre: 'free',
  aliado: 'ally',
  em_raid: 'raiding',
  reserva: 'reserved',
};

async function migrateRatholeEnglishNames() {
  const collection = Rathole.collection;
  const renamed = await collection.updateMany(
    { numero: { $exists: true } },
    [{ $set: { number: { $ifNull: ['$number', '$numero'] } } }]
  );

  let statusUpdates = 0;
  for (const [from, to] of Object.entries(STATUS_TO_ENGLISH)) {
    const result = await collection.updateMany({ status: from }, { $set: { status: to } });
    statusUpdates += result.modifiedCount || 0;
  }

  const coOwners = await collection.updateMany({ coOwner: 'Nenhum' }, { $set: { coOwner: 'None' } });
  await Rathole.syncIndexes();
  const removed = await collection.updateMany({ numero: { $exists: true } }, { $unset: { numero: '' } });

  const numberCount = renamed.modifiedCount || 0;
  const coOwnerCount = coOwners.modifiedCount || 0;
  const removedCount = removed.modifiedCount || 0;
  if (numberCount || statusUpdates || coOwnerCount || removedCount) {
    console.log(`[TEKOli] English MongoDB names: number=${numberCount}, status=${statusUpdates}, coOwner None=${coOwnerCount}, removed numero=${removedCount}.`);
  }
}

module.exports = {
  migrateRatholeEnglishNames,
};
