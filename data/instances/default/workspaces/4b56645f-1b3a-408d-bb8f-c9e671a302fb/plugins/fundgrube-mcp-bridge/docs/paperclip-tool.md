# Address MCP Tools

## MCP Endpoint

Base URL:

https://wayati.com/fundgrube/orderman/mcp/mcp-server.php

Alle Requests erfolgen per HTTP POST mit JSON-RPC 2.0.

Header:

Content-Type: application/json

---

## Verfügbare Tools

### address.search

Sucht bestehende Adressdatensätze.

Vor jeder Neuanlage zwingend zuerst verwenden.

---

### address.get

Lädt einen konkreten Datensatz anhand der ID.

---

### address.create

Legt einen neuen Adressdatensatz an.

Nur verwenden wenn:
- kein plausibler Treffer existiert
- die Daten ausreichend konkret sind

---

### address.update

Aktualisiert bestehende Datensätze.

Nur ergänzen oder verbessern.
Keine Verschlechterung bestehender Daten.

---

### address.upsert

Optionales Kombi-Tool für create/update.

Nur verwenden falls vorhanden und stabil.

---

## Verbotene Tools

### address.delete

Darf niemals verwendet werden.
