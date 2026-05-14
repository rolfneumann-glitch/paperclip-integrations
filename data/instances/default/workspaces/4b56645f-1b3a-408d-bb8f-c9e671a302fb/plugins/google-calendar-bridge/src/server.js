import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const cfg = {
  port: Number(process.env.PORT || 8791),
  publicBaseUrl: required('PUBLIC_BASE_URL').replace(/\/$/, ''),
  basePath: (process.env.BRIDGE_BASE_PATH || '/google-calendar').replace(/\/$/, ''),
  apiToken: required('BRIDGE_API_TOKEN'),
  clientId: required('GOOGLE_CLIENT_ID'),
  clientSecret: required('GOOGLE_CLIENT_SECRET'),
  redirectUri: required('GOOGLE_REDIRECT_URI'),
  scopes: (process.env.GOOGLE_SCOPES || 'https://www.googleapis.com/auth/calendar.readonly')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  tokenDir: process.env.TOKEN_DIR || '/data/tokens',
  tokenFile: process.env.TOKEN_FILE || 'google-calendar-token.json',
  allowedGoogleEmail: (process.env.ALLOWED_GOOGLE_EMAIL || '').trim().toLowerCase()
};

const tokenPath = path.join(cfg.tokenDir, cfg.tokenFile);
const app = express();
app.use(express.json({ limit: '1mb' }));

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) throw new Error(`Missing required env ${name}`);
  return String(value).trim();
}

function bearerAuth(req, res, next) {
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cfg.apiToken))) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

function oauthClient() {
  return new OAuth2Client(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

async function readToken() {
  try { return JSON.parse(await fs.readFile(tokenPath, 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}

async function writeToken(tokens) {
  await fs.mkdir(cfg.tokenDir, { recursive: true, mode: 0o700 });
  await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

async function authedGoogle() {
  const token = await readToken();
  if (!token) {
    const e = new Error('not_authorized');
    e.status = 401;
    throw e;
  }
  const client = oauthClient();
  client.setCredentials(token);
  client.on('tokens', async (newTokens) => {
    const merged = { ...token, ...newTokens };
    if (!newTokens.refresh_token && token.refresh_token) merged.refresh_token = token.refresh_token;
    await writeToken(merged);
  });
  return { client, calendar: google.calendar({ version: 'v3', auth: client }) };
}

function parseBool(raw, fallback = false) {
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

function cleanEventBody(body = {}) {
  const allowed = [
    'summary', 'description', 'location', 'start', 'end', 'attendees', 'reminders',
    'transparency', 'visibility', 'colorId', 'recurrence', 'conferenceData'
  ];
  const out = {};
  for (const k of allowed) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

function apiError(res, err) {
  const status = err.status || err.code || 500;
  const message = err.errors?.[0]?.message || err.message || 'internal_error';
  return res.status(Number(status) || 500).json({ ok: false, error: message, details: err.errors || undefined });
}

app.get(`${cfg.basePath}/health`, (req, res) => {
  res.json({
    ok: true,
    service: 'google-calendar-bridge',
    basePath: cfg.basePath,
    scopes: cfg.scopes,
    mode: 'read-write'
  });
});

app.get(`${cfg.basePath}/oauth/start`, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const client = oauthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: cfg.scopes,
    state,
    include_granted_scopes: true
  });
  res.redirect(url);
});

app.get(`${cfg.basePath}/oauth/callback`, async (req, res) => {
  try {
    const code = String(req.query.code || '');
    if (!code) return res.status(400).send('Missing code');
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    if (cfg.allowedGoogleEmail) {
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const me = await oauth2.userinfo.get();
      const email = String(me.data.email || '').toLowerCase();
      if (email !== cfg.allowedGoogleEmail) return res.status(403).send('Wrong Google account');
    }

    await writeToken(tokens);
    res.type('html').send('<h1>Google Calendar connected</h1><p>You can close this tab.</p>');
  } catch (err) {
    res.status(500).send(`OAuth callback failed: ${err.message}`);
  }
});

app.use(`${cfg.basePath}`, bearerAuth);

app.get(`${cfg.basePath}/auth/status`, async (req, res) => {
  const token = await readToken();
  res.json({ ok: true, authorized: !!token, hasRefreshToken: !!token?.refresh_token, scopes: cfg.scopes });
});

app.delete(`${cfg.basePath}/auth/token`, async (req, res) => {
  try { await fs.unlink(tokenPath); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  res.json({ ok: true, authorized: false });
});

app.get(`${cfg.basePath}/calendars`, async (req, res) => {
  try {
    const { calendar } = await authedGoogle();
    const r = await calendar.calendarList.list({ minAccessRole: req.query.minAccessRole || undefined });
    res.json({ ok: true, calendars: r.data.items || [] });
  } catch (err) { apiError(res, err); }
});

app.get(`${cfg.basePath}/events`, async (req, res) => {
  try {
    const { calendar } = await authedGoogle();
    const calendarId = req.query.calendarId || 'primary';
    if (!req.query.timeMin || !req.query.timeMax) {
      return res.status(400).json({ ok: false, error: 'timeMin and timeMax are required' });
    }
    const r = await calendar.events.list({
      calendarId,
      timeMin: String(req.query.timeMin),
      timeMax: String(req.query.timeMax),
      singleEvents: parseBool(req.query.singleEvents, true),
      orderBy: req.query.orderBy || 'startTime',
      maxResults: Math.min(Number(req.query.maxResults || 50), 250),
      q: req.query.q || undefined,
      showDeleted: parseBool(req.query.showDeleted, false)
    });
    res.json({ ok: true, calendarId, events: r.data.items || [], nextPageToken: r.data.nextPageToken || null });
  } catch (err) { apiError(res, err); }
});

app.post(`${cfg.basePath}/events`, async (req, res) => {
  try {
    const { calendar } = await authedGoogle();
    const calendarId = req.query.calendarId || req.body.calendarId || 'primary';
    const requestBody = cleanEventBody(req.body.event || req.body);
    if (!requestBody.summary || !requestBody.start || !requestBody.end) {
      return res.status(400).json({ ok: false, error: 'summary, start, and end are required' });
    }
    const r = await calendar.events.insert({
      calendarId,
      requestBody,
      conferenceDataVersion: requestBody.conferenceData ? 1 : 0,
      sendUpdates: req.query.sendUpdates || 'none'
    });
    res.status(201).json({ ok: true, calendarId, event: r.data });
  } catch (err) { apiError(res, err); }
});

app.patch(`${cfg.basePath}/events/:eventId`, async (req, res) => {
  try {
    const { calendar } = await authedGoogle();
    const calendarId = req.query.calendarId || req.body.calendarId || 'primary';
    const requestBody = cleanEventBody(req.body.event || req.body);
    const r = await calendar.events.patch({
      calendarId,
      eventId: req.params.eventId,
      requestBody,
      conferenceDataVersion: requestBody.conferenceData ? 1 : 0,
      sendUpdates: req.query.sendUpdates || 'none'
    });
    res.json({ ok: true, calendarId, event: r.data });
  } catch (err) { apiError(res, err); }
});

app.delete(`${cfg.basePath}/events/:eventId`, async (req, res) => {
  try {
    const { calendar } = await authedGoogle();
    const calendarId = req.query.calendarId || 'primary';
    await calendar.events.delete({ calendarId, eventId: req.params.eventId, sendUpdates: req.query.sendUpdates || 'none' });
    res.json({ ok: true, calendarId, deleted: req.params.eventId });
  } catch (err) { apiError(res, err); }
});

app.use((req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

app.listen(cfg.port, () => {
  console.log(JSON.stringify({
    ok: true,
    service: 'google-calendar-bridge',
    port: cfg.port,
    basePath: cfg.basePath,
    redirectUri: cfg.redirectUri,
    mode: 'read-write'
  }));
});
