const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(process.env.CONFIG_PATH || '/app/data/config.json');

// Keys that can be stored in config.json
const CONFIGURABLE_KEYS = [
  'JELLYFIN_URL',
  'TMDB_API_KEY',
  'ANTHROPIC_API_KEY',
  'JELLYSEERR_URL',
  'JELLYSEERR_API_KEY',
  'RADARR_URL',
  'RADARR_API_KEY',
  'SONARR_URL',
  'SONARR_API_KEY',
  'DISCORD_WEBHOOK_URL',
  'GEMINI_API_KEY',
  'HOME_SECTIONS',
  'STREAMYSTATS_URL',
];

let _config = null;

function loadConfig() {
  // Start with env vars
  const config = {};
  CONFIGURABLE_KEYS.forEach(k => { if (process.env[k]) config[k] = process.env[k]; });

  // Overlay with config.json (env vars take priority)
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      CONFIGURABLE_KEYS.forEach(k => {
        if (!config[k] && saved[k]) config[k] = saved[k]; // only use saved if env not set
      });
    }
  } catch(e) {
    console.warn('[config] Could not read config.json:', e.message);
  }

  _config = config;
  return config;
}

function getConfig() {
  if (!_config) loadConfig();
  return _config;
}

function get(key) {
  return getConfig()[key] || '';
}

function saveConfig(updates) {
  try {
    // Read existing saved config
    let saved = {};
    try { if (fs.existsSync(CONFIG_PATH)) saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch(e) {}

    // Merge updates — only save keys we know about
    CONFIGURABLE_KEYS.forEach(k => {
      if (updates[k] !== undefined) {
        if (updates[k] === '') delete saved[k]; // empty = remove
        else saved[k] = updates[k];
      }
    });

    // Ensure data dir exists
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(saved, null, 2), 'utf8');

    // Reload in-memory config
    _config = null;
    loadConfig();

    return { success: true, saved: Object.keys(saved) };
  } catch(e) {
    console.error('[config] Save failed:', e.message);
    return { error: e.message };
  }
}

function getPublicConfig() {
  const cfg = getConfig();
  // Return which integrations are configured (not the actual keys)
  return {
    jellyfinUrl: cfg.JELLYFIN_URL || '',
    hasJellyfin: !!cfg.JELLYFIN_URL,
    hasTmdb: !!cfg.TMDB_API_KEY,
    hasAnthropic: !!cfg.ANTHROPIC_API_KEY,
    hasJellyseerr: !!(cfg.JELLYSEERR_URL && cfg.JELLYSEERR_API_KEY),
    hasRadarr: !!(cfg.RADARR_URL && cfg.RADARR_API_KEY),
    hasSonarr: !!(cfg.SONARR_URL && cfg.SONARR_API_KEY),
    hasDiscord: !!cfg.DISCORD_WEBHOOK_URL,
    // Return URLs (not keys) so frontend can show what's configured
    jellyseerrUrl: cfg.JELLYSEERR_URL || '',
    radarrUrl: cfg.RADARR_URL || '',
    sonarrUrl: cfg.SONARR_URL || '',
  };
}

// For use in routes — get a specific integration value
function getIntegration(key) {
  return get(key);
}

module.exports = { loadConfig, getConfig, get, saveConfig, getPublicConfig, getIntegration, CONFIGURABLE_KEYS };
