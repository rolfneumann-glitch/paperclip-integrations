# TOOLS.md

## Google Calendar Bridge

Base URL:

`http://google-calendar-bridge:8791/google-calendar`

Authentication:

`Authorization: Bearer $GOOGLE_CALENDAR_BRIDGE_TOKEN`

Agent calendar:

`$GOOGLE_CALENDAR_AGENT_TERMINMANAGER_ID`

This agent must only use this calendar. Do not use `primary`.

## Healthcheck

GET:

`/health`

## Kalender prüfen

GET:

`/calendars`

Purpose:
Verify that the configured calendar exists and has write permission.

## Termine lesen

GET:

`/events?timeMin=...&timeMax=...`

Always use:

* explicit `timeMin`
* explicit `timeMax`
* timezone `Europe/Berlin`

## Freie Zeiten finden

1. Read events for the requested time window.
2. Treat confirmed busy events as blocked.
3. Treat transparent events as non-blocking but mention them.
4. Return only realistic slots.

## Termin erstellen

POST:

`/events`

Body:

```json
{
  "summary": "Terminname",
  "description": "Beschreibung",
  "location": "Ort",
  "start": {
    "dateTime": "2026-05-15T10:00:00+02:00",
    "timeZone": "Europe/Berlin"
  },
  "end": {
    "dateTime": "2026-05-15T10:30:00+02:00",
    "timeZone": "Europe/Berlin"
  }
}
```

\# TOOLS.md



\## Google Calendar Bridge



Base URL:



\`http://google-calendar-bridge:8791/google-calendar\`



Authentication:



\`Authorization: Bearer $GOOGLE\_CALENDAR\_BRIDGE\_TOKEN\`



Agent calendar:



\`$GOOGLE\_CALENDAR\_AGENT\_TERMINMANAGER\_ID\`



This agent must only use this calendar.



\## Healthcheck



GET:



\`/health\`



\## Kalender prüfen



GET:



\`/calendars\`



Purpose:

Verify that the configured calendar exists and has write permission.



\## Termine lesen



GET:



\`/events?timeMin\=...\&timeMax\=...\`



Always use:

\- explicit \`timeMin\`

\- explicit \`timeMax\`

\- timezone \`Europe/Berlin\`



\## Freie Zeiten finden



1\. Read events for the requested time window.

2\. Treat confirmed busy events as blocked.

3\. Treat transparent events as non-blocking but mention them.

4\. Return only realistic slots.



\## Termin erstellen



POST:



\`/events\`



Body:



\`\`\`json

{

&#x20; "summary": "Terminname",

&#x20; "description": "Beschreibung",

&#x20; "location": "Ort",

&#x20; "start": {

&#x20;   "dateTime": "2026-05-15T10:00:00+02:00",

&#x20;   "timeZone": "Europe/Berlin"

&#x20; },

&#x20; "end": {

&#x20;   "dateTime": "2026-05-15T10:30:00+02:00",

&#x20;   "timeZone": "Europe/Berlin"

&#x20; }

}