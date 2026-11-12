// ============================================================================
// models/Rathole.js - Mongoose Schema for MongoDB
// ============================================================================

const mongoose = require('mongoose');

const RatholeSchema = new mongoose.Schema(
  {
    number: {
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
      default: 'None',
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
      enum: ['occupied', 'free', 'ally', 'raiding', 'reserved'],
      default: 'occupied',
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
