const mongoose = require('mongoose');

const RatholeChangeSchema = new mongoose.Schema(
  {
    ratholeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rathole',
      required: true,
      index: true,
    },
    ratholeNumber: {
      type: Number,
      required: true,
      index: true,
    },
    field: {
      type: String,
      required: true,
      trim: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    changedByDiscordId: {
      type: String,
      required: true,
      index: true,
    },
    changedByName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    collection: 'rathole_changes',
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

RatholeChangeSchema.index({ ratholeId: 1, createdAt: -1 });
RatholeChangeSchema.index({ ratholeNumber: 1, createdAt: -1 });

module.exports = mongoose.model('RatholeChange', RatholeChangeSchema);
