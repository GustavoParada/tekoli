const mongoose = require('mongoose');

const PersonSchema = new mongoose.Schema(
  {
    discordId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    discordName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Person', PersonSchema);
