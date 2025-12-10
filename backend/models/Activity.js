// backend/models/Activity.js
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  name: { type: String }, // legacy
  domain: { type: String, required: true },
  url: { type: String, required: true },
  title: { type: String, default: '' },
  duration: { type: Number, required: true }, // seconds
  date: { type: Date, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
