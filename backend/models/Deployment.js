const mongoose = require('mongoose')

const DeploymentSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  githubId:      { type: Number, required: true },
  login:         { type: String, required: true },

  // Repo info
  owner:         { type: String, required: true },
  repo:          { type: String, required: true },
  branch:        { type: String, default: 'main' },

  // Container info
  containerName: { type: String, required: true, unique: true },
  port:          { type: Number, required: true },
  projectType:   { type: String },

  // URLs
  deployUrl:     { type: String },
  customDomain:  { type: String },  // optional: user.yourapp.com

  // Status
  status: {
    type: String,
    enum: ['building', 'running', 'stopped', 'error', 'restarting'],
    default: 'building',
  },
  error: { type: String },

  // Env vars (encrypted in production)
  envVars: { type: Map, of: String, default: {} },

  // Resource usage
  memoryLimit: { type: String, default: '512m' },
  cpuLimit:    { type: String, default: '0.5' },

  startedAt:  { type: Date },
  stoppedAt:  { type: Date },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now },
})

DeploymentSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model('Deployment', DeploymentSchema)
