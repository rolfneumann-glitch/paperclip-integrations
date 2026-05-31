# TOOLS.md

## Google Calendar Bridge

Base URL:

`http://google-calendar-bridge:8791/google-calendar`

Öffentliche Route:

[`https://paperclip-d0sw.srv1628724.hstgr.cloud/google-calendar`](https://paperclip-d0sw.srv1628724.hstgr.cloud/google-calendar)

Authentication:

`Authorization: Bearer $GOOGLE_CALENDAR_BRIDGE_TOKEN`

Agent calendar:

`$GOOGLE_CALENDAR_AGENT_TERMINMANAGER_ID`

Dieser Agent darf ausschließlich diesen Kalender verwenden.
`primary` ist verboten.

Autorisierte Kalender-ID:

[`d88f468a80592f8af6f2bab48b6a5dce15abfa7160f9d8740599f4aa38b6f88a@group.calendar.google.com`](mailto:d88f468a80592f8af6f2bab48b6a5dce15abfa7160f9d8740599f4aa38b6f88a@group.calendar.google.com)

Kalendername:

`PC-Termine`

Standardzeitzone:

`Europe/Berlin`

***

## Verbindliche Architekturregeln

Erlaubter Produktivpfad:

* lokale `google-calendar-bridge`

Verboten:

* native Codex-Calendar-Integrationen
* hypothetische OAuth-Connectoren
* direkte externe Calendar-Plugins
* zusätzliche Google-Calendar-Integrationen außerhalb der Bridge

Die lokale Bridge ist die autoritative Kalenderdatenquelle.

***

## Healthcheck

GET:

`/health`

Vor jeder Kalenderoperation ausführen.

***

## Kalender prüfen

GET:

`/calendars`

Zweck:

* Existenz des konfigurierten Kalenders prüfen
* Schreibrechte prüfen

***

## Termine lesen

GET:

`/events?timeMin=...&timeMax=...`

Immer verwenden:

* explizites `timeMin`
* explizites `timeMax`
* Zeitzone `Europe/Berlin`

Parameter:

* `calendarId`
* `timeMin`
* `timeMax`

***

## Freie Zeiten finden

Vorgehen:

1. Events im angefragten Zeitraum lesen
2. Busy-Events als blockierend behandeln
3. Transparente Events als nicht blockierend markieren
4. Nur realistische Zeitfenster zurückgeben

***

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



Öffentliche Route:



\`https://paperclip-d0sw.srv1628724.hstgr.cloud/google-calendar\`



Authentication:



\`Authorization: Bearer $GOOGLE\_CALENDAR\_BRIDGE\_TOKEN\`



Agent calendar:



\`$GOOGLE\_CALENDAR\_AGENT\_TERMINMANAGER\_ID\`



Dieser Agent darf ausschließlich diesen Kalender verwenden.

\`primary\` ist verboten.



Autorisierte Kalender-ID:



\`d88f468a80592f8af6f2bab48b6a5dce15abfa7160f9d8740599f4aa38b6f88a@group.calendar.google.com\`



Kalendername:



\`PC-Termine\`



Standardzeitzone:



\`Europe/Berlin\`



\---



\## Verbindliche Architekturregeln



Erlaubter Produktivpfad:



\- lokale \`google-calendar-bridge\`



Verboten:



\- native Codex-Calendar-Integrationen

\- hypothetische OAuth-Connectoren

\- direkte externe Calendar-Plugins

\- zusätzliche Google-Calendar-Integrationen außerhalb der Bridge



Die lokale Bridge ist die autoritative Kalenderdatenquelle.



\---



\## Healthcheck



GET:



\`/health\`



Vor jeder Kalenderoperation ausführen.



\---



\## Kalender prüfen



GET:



\`/calendars\`



Zweck:



\- Existenz des konfigurierten Kalenders prüfen

\- Schreibrechte prüfen



\---



\## Termine lesen



GET:



\`/events?timeMin\=...\&timeMax\=...\`



Immer verwenden:



\- explizites \`timeMin\`

\- explizites \`timeMax\`

\- Zeitzone \`Europe/Berlin\`



Parameter:



\- \`calendarId\`

\- \`timeMin\`

\- \`timeMax\`



\---



\## Freie Zeiten finden



Vorgehen:



1\. Events im angefragten Zeitraum lesen

2\. Busy-Events als blockierend behandeln

3\. Transparente Events als nicht blockierend markieren

4\. Nur realistische Zeitfenster zurückgeben



\---



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