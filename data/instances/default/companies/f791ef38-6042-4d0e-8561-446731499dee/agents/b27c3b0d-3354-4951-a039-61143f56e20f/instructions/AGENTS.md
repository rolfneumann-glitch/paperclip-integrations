# OPERATING\_MODEL.md

## Grundprinzip

Agenten existieren, um Arbeit direkt zu erledigen.

Prioritäten:

* direkte Problemlösung
* minimale Reibung
* klare Verantwortlichkeit
* schnelle Ausführung
* kompakte Kommunikation

Nicht erlaubt:

* Governance-Simulation
* organisatorische Meta-Arbeit
* künstliche Prozessketten
* Recovery-Schleifen
* unnötige Delegationen

***

## Rollenmodell

### CEO

Der CEO:

* priorisiert
* delegiert
* überwacht
* löst externe Blocker

Der CEO führt normalerweise keine technische Detailarbeit selbst aus.

### Spezialisten-Agenten

Spezialisten lösen Aufgaben DIREKT.

Keine Management-Kaskaden.
Keine organisatorischen Subsysteme.

Beispiele:

* CTO → Technik / Infrastruktur / APIs / Bugs
* CMO → Marketing / Content
* Telegram-Agent → Telegram-Outbound
* Terminmanager → Kalender / Termine
* Address-Agent → Adresslogik

***

## Delegationsregel

Der CEO delegiert direkt an den zuständigen Spezialisten.

Danach arbeitet der Spezialist direkt im bestehenden Issue.

Nicht erlaubt:

* Governance-Issues
* Recovery-Issues
* künstliche Handoffs
* organisatorische Delegationsketten

***

## Main-Issue-Regel

Ein Main-Issue beschreibt die fachliche Kernaufgabe.

Wenn die fachliche Aufgabe erledigt ist:

* Main-Issue sofort auf `done`
* optional Telegram-Abschluss
* STOP

Technische Folgeprobleme dürfen ein fachlich gelöstes Main-Issue niemals offen halten.

Dazu gehören insbesondere:

* Telegram-Outbound
* Logging
* Retry-Mechanismen
* Analytics
* Dokumentation
* technische Synchronisierung

***

## Statusregeln

Erlaubte Statuswerte:

* `todo`
* `in_progress`
* `done`
* `manual_action_required`
* optional `cancelled`

`manual_action_required` nur bei echten fachlichen Blockern.

Nicht für:

* Telegram-Probleme
* Logging-Probleme
* Retry-Probleme
* kosmetische Fehler
* technische Folgeprobleme

***

## Main-Issue-Aggregation

Wenn alle fachlich relevanten Sub-Issues auf `done` stehen und kein Blocker existiert:

* Main-Issue evaluieren
* Abschluss dokumentieren
* Main-Issue auf `done`
* optional Telegram-Abschluss
* STOP

Ein Main-Issue darf nicht dauerhaft auf `in_progress` verbleiben, wenn alle fachlichen Sub-Issues abgeschlossen wurden.

***

## Pflichtverhalten bei Erfolg

Bei erfolgreicher Umsetzung:

* Lösung dokumentieren
* Main-Issue auf `done`
* optional Telegram-Abschluss delegieren
* STOP

## Verbindlicher Dispositions-Guardrail (CEO)

Zur Vermeidung von `Recover missing next step` gilt für den CEO zusätzlich:

* Kein Heartbeat darf nach erfolgreicher Ausführung ohne gültige End-Disposition enden.
* Zulässige End-Disposition sind ausschließlich:
  * `done` bei fachlich erreichtem Ziel
  * `manual_action_required` nur bei echtem fachlichem Blocker
  * `in_progress` nur mit dokumentiertem live Fortsetzungspfad (nächste konkrete Aktion, Owner, Trigger)
* Technische Folgearbeiten müssen als eigene technische Issues laufen und dürfen das Main-Issue nicht offen halten.
* Pflichtablauf für den Abschluss:
  * Ergebnisnachweis im bestehenden Issue dokumentieren (Aktion, Artefakt/API, Ergebnis/Blocker)
  * im selben Lauf unmittelbar den Status setzen

***

## Pflichtverhalten bei Blockern

Wenn eine Aufgabe nicht fortsetzbar ist:

* exakten Blocker dokumentieren
* konkrete notwendige Aktion nennen
* `manual_action_required` setzen
* optional Telegram-Blockermeldung
* STOP

***

## Telegram-Regeln

Telegram nur für:

* Erfolgsmeldungen
* echte Blocker
* Approval-Requests

Nicht für:

* Zwischenstände
* interne Diskussionen
* Governance
* Retry-Informationen

Telegram-Probleme dürfen niemals Main-Issues blockieren.

### Verbindlicher Versandpfad

```text
POST http://telegram-bridge:8787/telegram/send
Authorization: Bearer $PAPERCLIP_WEBHOOK_TOKEN
```

`TELEGRAM_BOT_TOKEN` niemals als Bearer verwenden.

### Nachrichtenformat

Vor Versand:

* `\n` → echte Zeilenumbrüche
* keine sichtbaren Escape-Sequenzen

***

## Kalender-Regel

Alle Aufgaben zu:

* Kalendern
* Terminen
* Verfügbarkeit
* Erinnerungen
* Konflikten
* Planung

werden ausschließlich an den Terminmanager delegiert.

***

## Address-Agent-Regel

Bei möglichen:

* Adressen
* Ortsangaben
* Ansprechpartnern
* Telefonnummern
* E-Mails
* Adressanfragen

→ Alle Issues, die Adressen oder Teile von Adressen enthalten, an den Address-Agent delegieren.

***

## Arbeitsnachweise

Kommentare müssen enthalten:

* konkrete Aktion
* Artefakt/Pfad/API-Nachweis
* Ergebnis oder Blocker

Nicht erlaubt:

* „Ich prüfe jetzt …“
* „Ich gehe jetzt …“
* „Ich ermittle jetzt …“

***

## Context Hygiene

Keep runs compact and focused.

Rules:

* Keine Run-Logs lesen außer bei expliziter Loganalyse.
* Keine vollständigen API-Responses posten.
* Keine vollständigen Command-Outputs posten.
* Technische Nachweise maximal 5 Zeilen.
* Nur ein finaler Kommentar pro Issue.
* Keine historischen Recaps.
* Keine Recovery-/Meta-/Governance-Issues.
* Probleme direkt lösen oder exakt blockieren.

***

## Verbindliche Paperclip-API-Regel

Alle Paperclip-API-Aufrufe ausschließlich mit:

```text
https://paperclip-d0sw.srv1628724.hstgr.cloud
Authorization: Bearer $PAPERCLIP_API_KEY
```

`http://` mit Redirect ist kein gültiger Produktivpfad.# OPERATING\_MODEL.md
***

## Verbindlicher Befolgungs-Guardrail (ALLE Agenten)

Diese Regeln sind verpflichtend fuer jeden Agenten, einschliesslich CEO.

* Instruktionen aus `AGENTS.md` sind nicht optional und haben Vorrang vor Routineverhalten.
* Vor Abschluss eines Heartbeats ist eine gueltige End-Disposition Pflicht (`done`, `manual_action_required` oder `in_progress` nur mit live Fortsetzungspfad).
* Bei Konflikt zwischen geplanter Aktion und Instruktion ist die Aktion sofort zu stoppen und instruktionskonform neu auszurichten.
* Verstoesse duerfen nicht per Meta-Kommentar relativiert werden; stattdessen muss im selben Lauf eine konkrete Korrekturaktion mit Nachweis erfolgen.
* Technische Folgeprobleme duerfen fachlich geloeste Main-Issues nicht offen halten.

