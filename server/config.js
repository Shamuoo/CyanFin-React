'use strict';
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '../data/config.json');

// Schema: all configurable keys with types and validation
const SCHEMA = {
  JELLYFIN_URL:           { type: 'url',    label: 'Jellyfin URL' },
  JELLYFIN_API_KEY:       { type: 'string', label: 'Jellyfin API Key', secret: true },
  JELLYFIN_BACKUP_URL:    { type: 'url',    label: 'Backup Jellyfin URL' },
  JELLYFIN_BACKUP_API_KEY:{ type: 'string', label: 'Backup API Key', secret: true },
  JELLYFIN_MODE:          { type: 'enum',   values: ['fastest','primary','backup'], default: 'fastest' },
  PLEX_URL:               { type: 'url',    label: 'Plex URL' },
  PLEX_TOKEN:             { type: 'string', label: 'Plex Token', secret: true },
  TMDB_API_KEY:           { type: 'string', label: 'TMDB API Key', secret: true },
  ANTHROPIC_API_KEY:      { type: 'string', label: 'Anthropic API Key', secret: true },
  GEMINI_API_KEY:         { type: 'string', label: 'Gemini API Key', secret: true },
  OMDB_API_KEY:           { type: 'string', label: 'OMDB API Key', secret: true },
  OLLAMA_URL:             { type: 'url',    label: 'Ollama URL' },
  OLLAMA_MODEL:           { type: 'string', label: 'Ollama Model' },
  STREAMYSTATS_URL:       { type: 'url',    label: 'Streamystats URL' },
  JELLYSEERR_URL:         { type: 'url',    label: 'Jellyseerr URL' },
  JELLYSEERR_API_KEY:     { type: 'string', label: 'Jellyseerr API Key', secret: true },
  RADARR_URL:             { type: 'url',    label: 'Radarr URL' },
  RADARR_API_KEY:         { type: 'string', label: 'Radarr API Key', secret: true },
  SONARR_URL:             { type: 'url',    label: 'Sonarr URL' },
  SONARR_API_KEY:         { type: 'string', label: 'Sonarr API Key', secret: true },
  DISCORD_WEBHOOK_URL:    { type: 'url',    label: 'Discord Webhook URL' },
  HOME_SECTIONS:          { type: 'json',   label: 'Home Sections Config' },
};

let _cfg = {};

function loadConfig() {
  // Start from env vars
  for (const key of Object.keys(SCHEMA)) {
    if (process.env[key]) _cfg[key] = process.env[key];
  }
  // Override/merge with file config
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(CONFIG_PATH)) {
      const file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      Object.assign(_cfg, file);
    }
  } catch(e) {
    console.warn('[config] Could not load config file:', e.message);
  }
}

function get(key) {
  return _cfg[key] || '';
}

function getAll() {
  return { ..._cfg };
}

// Returns config safe to send to frontend (mask secrets)
function getPublic() {
  const out = {};
  for (const [key, schema] of Object.entries(SCHEMA)) {
    const val = _cfg[key] || '';
    if (schema.secret) {
      out[key] = val ? '***' : '';
    } else {
      out[key] = val;
    }
  }
  // Add convenience booleans
  out.hasJellyfin   = !!get('JELLYFIN_URL');
  out.hasTmdb       = !!get('TMDB_API_KEY');
  out.hasAnthropic  = !!get('ANTHROPIC_API_KEY');
  out.hasGemini     = !!get('GEMINI_API_KEY');
  out.hasOllama     = !!get('OLLAMA_URL');
  out.hasPlex       = !!get('PLEX_URL');
  out.hasJellyseerr = !!(get('JELLYSEERR_URL') && get('JELLYSEERR_API_KEY'));
  out.hasRadarr     = !!(get('RADARR_URL') && get('RADARR_API_KEY'));
  out.hasSonarr     = !!(get('SONARR_URL') && get('SONARR_API_KEY'));
  out.hasDiscord    = !!get('DISCORD_WEBHOOK_URL');
  out.hasOmdb       = !!get('OMDB_API_KEY');
  return out;
}

function validate(updates) {
  const errors = [];
  for (const [key, val] of Object.entries(updates)) {
    if (!SCHEMA[key]) { errors.push(`Unknown key: ${key}`); continue; }
    const schema = SCHEMA[key];
    if (!val) continue; // empty = delete
    if (schema.type === 'url') {
      try { new URL(val); } catch {
        errors.push(`${key}: invalid URL "${val}"`);
      }
    }
    if (schema.type === 'enum' && !schema.values.includes(val)) {
      errors.push(`${key}: must be one of ${schema.values.join(', ')}`);
    }
  }
  return errors;
}

function saveConfig(updates) {
  const errors = validate(updates);
  if (errors.length) return { success: false, errors };

  const saved = [];
  for (const [key, val] of Object.entries(updates)) {
    if (!SCHEMA[key]) continue;
    if (val === '' || val === null || val === undefined) {
      delete _cfg[key];
    } else {
      _cfg[key] = String(val).trim();
    }
    saved.push(key);
  }

  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(_cfg, null, 2));
    console.log('[config] Saved:', saved.join(', '));
  } catch(e) {
    console.error('[config] Save failed:', e.message);
    return { success: false, errors: ['Could not write config file: ' + e.message] };
  }

  return { success: true, saved };
}

module.exports = { loadConfig, get, getAll, getPublic, saveConfig, SCHEMA };
