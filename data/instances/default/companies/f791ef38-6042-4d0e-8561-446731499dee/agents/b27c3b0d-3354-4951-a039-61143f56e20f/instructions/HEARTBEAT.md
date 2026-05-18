# HEARTBEAT.md -- Simplified Execution Model

## Grundprinzip

Agenten existieren, um Aufgaben auszuführen.

Der Heartbeat dient ausschließlich dazu:

* neue Arbeit zu prüfen
* aktive Arbeit fortzusetzen
* Blocker sauber zu melden
* abgeschlossene Arbeit zu dokumentieren

Nicht:

* organisatorische Selbstverwaltung
* Governance-Prozesse
* künstliche Review-Schleifen
* Meta-Kommunikation

***

# 1. Wake Context prüfen

Prüfen:

* `PAPERCLIP_TASK_ID`
* `PAPERCLIP_WAKE_REASON`

Wenn keine Aufgabe vorliegt:
→ sauber beenden.

***

# 2. Zugewiesene Aufgaben prüfen

Prüfe ausschließlich:

* eigene aktive Aufgaben
* direkt zugewiesene Aufgaben

Priorität:

1. `in_progress`
2. `todo`

Ignorieren:

* organisatorische Meta-Themen
* unzugewiesene Aufgaben
* künstliche Governance-Arbeit

***

# 3. Aufgabe bearbeiten

Wenn die Aufgabe lösbar ist:

* direkt umsetzen
* keine organisatorischen Zwischenschritte erzeugen
* keine künstlichen Subtasks erzeugen

Status:

* aktive Arbeit → `in_progress`
* abgeschlossen → `done`

***

# 4. Erfolgreicher Abschluss

Bei erfolgreicher Umsetzung MUSS der Agent:

1. Ergebnis im bestehenden Issue dokumentieren
2. Status auf `done` setzen
3. Telegram-Nachricht senden:
   * kurze Zusammenfassung
   * Ergebnis
   * ggf. relevante Hinweise

Danach:
STOP.

***

# 5. Blocker-Regel

Wenn die Aufgabe nicht fortsetzbar ist:

1. Ursache exakt dokumentieren
2. Konkrete notwendige Handlung nennen
3. Status setzen:
   * `manual_action_required`
4. Telegram-Nachricht senden
5. STOP

Wichtig:

* keine Retry-Loops
* keine Recovery-Issues
* keine Meta-Eskalationen
* keine organisatorischen Folgeprozesse

***

# 6. Delegation

Delegation nur wenn:

* echte Spezialisierung notwendig ist
* andere Fachdomäne betroffen ist
* parallele Arbeit sinnvoll ist

Nicht delegieren:

* triviale Aufgaben
* organisatorische Arbeit
* reine Formalitäten

***

# 7. Kommentare

Kommentare nur bei:

* echter Problemlösung
* Abschluss
* echten Blockern

Keine Kommentare ohne Informationsgewinn.

***

# 8. Verbotene Verhaltensweisen

Agenten dürfen NICHT:

* Governance-Issues erzeugen
* Recovery-Issues erzeugen
* künstliche Handoffs schreiben
* „missing comment“-Recoveries erzeugen
* organisatorische Selbstverwaltung betreiben
* Aufgaben wegen Formalitäten blockieren
* Retry-Schleifen erzeugen

***

# 9. Erlaubte Statuswerte

Nur:

* `todo`
* `in_progress`
* `done`
* `manual_action_required`
* optional: `cancelled`

***

# 10. Abschlussregel

Wenn:

* keine Aufgabe vorliegt
* Aufgabe abgeschlossen ist
* echter Blocker erreicht wurde

→ sofort sauber STOP.