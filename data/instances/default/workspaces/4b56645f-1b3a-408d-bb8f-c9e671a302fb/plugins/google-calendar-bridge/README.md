# Google Calendar Bridge for Paperclip

Small standalone Node.js HTTP service for connecting Paperclip to Google Calendar via OAuth2.

## What it provides

- Browser OAuth start/callback
- Persistent refresh-token storage
- Calendar list
- Bounded event search
- Create, patch, delete events when write scope is granted
- Bearer-token protection for API routes
- Docker-friendly deployment next to the existing Telegram bridge

## Required Google redirect URI

Add this URI to the OAuth Web Client in Google Cloud:

```text
https://paperclip-d0sw.srv1628724.hstgr.cloud/google-calendar/oauth/callback
```

## First deployment

Recommended host path:

```bash
cd /docker/paperclip-d0sw
mkdir -p plugins/google-calendar-bridge
cp -a /path/to/google-calendar-bridge/* plugins/google-calendar-bridge/
mkdir -p data/google-calendar-bridge/tokens
chmod 700 data/google-calendar-bridge/tokens
```

Add the service from `docker-compose.service.yml` to your existing compose file.

Add env values to your `.env` or compose environment:

```bash
GOOGLE_CALENDAR_BRIDGE_TOKEN='long-random-token'
GOOGLE_CALENDAR_CLIENT_ID='...apps.googleusercontent.com'
GOOGLE_CALENDAR_CLIENT_SECRET='...'
```

Start:

```bash
docker compose up -d google-calendar-bridge
```

## OAuth connect

Open in browser:

```text
https://paperclip-d0sw.srv1628724.hstgr.cloud/google-calendar/oauth/start
```

Grant access with the test user added in Google Cloud.

## Verification

```bash
TOKEN='long-random-token'
BASE='https://paperclip-d0sw.srv1628724.hstgr.cloud/google-calendar'

curl -sS "$BASE/health" | jq .
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/auth/status" | jq .
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/calendars" | jq .
```

Read events:

```bash
curl -sS -G \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "timeMin=2026-05-13T00:00:00+02:00" \
  --data-urlencode "timeMax=2026-05-14T00:00:00+02:00" \
  "$BASE/events" | jq .
```

## Scopes

Read-only:

```text
https://www.googleapis.com/auth/calendar.readonly
```

Write events:

```text
https://www.googleapis.com/auth/calendar.events
```

Change `GOOGLE_SCOPES`, restart the bridge, and re-open `/oauth/start` to grant the new scope.

## Paperclip integration approach

This service is a bridge endpoint. Paperclip can call it via any HTTP-capable plugin/tool/adapter. Keep agent instructions strict:

- Always use bounded `timeMin` and `timeMax`.
- Read before proposing writes.
- For writes, send exact title, start/end, timezone, attendees, reminders.
- Use `Authorization: Bearer <BRIDGE_API_TOKEN>`.

## Security notes

- Never paste Google client secret or bridge token into issues or chat.
- Mount `TOKEN_DIR` on persistent storage.
- Keep read-only scope until writes are required.
- If compromised: delete token file, rotate Google client secret, rotate bridge token.
