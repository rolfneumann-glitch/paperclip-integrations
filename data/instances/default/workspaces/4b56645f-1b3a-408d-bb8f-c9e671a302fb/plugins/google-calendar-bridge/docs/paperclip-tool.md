# Paperclip Tool Integration Notes

This bridge is intentionally exposed as plain HTTP so Paperclip can call it through any HTTP-capable tool/plugin path.

## Auth

Every non-OAuth API call requires:

Authorization: Bearer <BRIDGE_API_TOKEN>

OAuth browser routes do not require the bearer token:
- GET /google-calendar/oauth/start
- GET /google-calendar/oauth/callback

## Useful endpoints for Paperclip agents

- GET /google-calendar/health
- GET /google-calendar/auth/status
- GET /google-calendar/calendars
- GET /google-calendar/events?timeMin=2026-05-13T00:00:00%2B02:00&timeMax=2026-05-14T00:00:00%2B02:00&calendarId=primary
- POST /google-calendar/events
- PATCH /google-calendar/events/:eventId
- DELETE /google-calendar/events/:eventId?calendarId=primary

Start with read-only scope. POST/PATCH/DELETE will return a clear error unless Google OAuth was granted a write-capable scope.
