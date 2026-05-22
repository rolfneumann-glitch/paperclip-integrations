# Fundgrube MCP Bridge Tools

## Status

Die Fundgrube-MCP-Bridge läuft als lokaler Docker-Service und leitet einfache HTTP-Endpunkte an den MCP-Server weiter.

Aktuell verifizierte lokale Base URL auf dem Server:

```text
http://fundgrube-mcp-bridge:8792
```

Wichtig:

Der öffentliche Traefik-Pfad `/fundgrube` ist noch nicht als funktionierend verifiziert und soll vom Agenten derzeit nicht verwendet werden.

***

# Address-Endpunkte

## POST /address/search

Sucht bestehende Adressdatensätze.

Vor jeder Neuanlage zwingend zuerst verwenden.

### Request Body

```json
{
  "q": "Max Mustermann"
}
```

***

## POST /address/find

Lädt einen konkreten Datensatz anhand der ID.

### Request Body

```json
{
  "id": 3
}
```

***

## POST /address/create

Legt einen neuen Adressdatensatz an.

Nur verwenden wenn:

* vorher `/address/search` keinen plausiblen Treffer ergeben hat
* die Daten ausreichend konkret sind

### Mindestfelder

* `street`
* `postal_code`
* `city`

Zusätzlich möglichst:

* `person_name` oder `company_name`

### Request Body

```json
{
  "person_name": "Max Mustermann",
  "street": "Hauptstraße 12",
  "postal_code": "71638",
  "city": "Ludwigsburg",
  "phone": "07141 123456",
  "email": "max@example.com"
}
```

***

## POST /address/update

Aktualisiert bestehende Adressdatensätze.

Nur ergänzen oder verbessern.

Keine Verschlechterung bestehender Daten.

### Request Body

```json
{
  "id": 3,
  "phone": "07141 123456"
}
```

***

# Arbeitsregeln

* Vor jeder Neuanlage immer zuerst `/address/search` verwenden
* Keine ungeprüften Dubletten erzeugen
* Unvollständige Adressen nicht neu anlegen
* Teilinformationen nur zur Aktualisierung bestehender Datensätze verwenden
* Bei unklaren Mehrfachtreffern Rückfrage erforderlich
* Nur belastbare Fakten speichern

***

# Nicht verfügbar

## address.delete

`address.delete` ist nicht verfügbar und darf niemals verwendet werden.

## address.upsert

`address.upsert` ist aktuell nicht freigegeben.# Fundgrube MCP Bridge Tools

\## Status

Die Fundgrube-MCP-Bridge läuft als lokaler Docker-Service und leitet einfache HTTP-Endpunkte an den MCP-Server weiter.

Aktuell verifizierte lokale Base URL auf dem Server:

\`\`\`text

[http://127.0.0.1:8792](http://127.0.0.1:8792)

\`\`\`

Wichtig:

Der öffentliche Traefik-Pfad \`/fundgrube\` ist noch nicht als funktionierend verifiziert und soll vom Agenten derzeit nicht verwendet werden.

\---

\# Address-Endpunkte

\## POST /address/search

Sucht bestehende Adressdatensätze.

Vor jeder Neuanlage zwingend zuerst verwenden.

\### Request Body

\`\`\`json

{

&#x20; "q": "Max Mustermann"

}

\`\`\`

\---

\## POST /address/find

Lädt einen konkreten Datensatz anhand der ID.

\### Request Body

\`\`\`json

{

&#x20; "id": 3

}

\`\`\`

\---

\## POST /address/create

Legt einen neuen Adressdatensatz an.

Nur verwenden wenn:

\- vorher \`/address/search\` keinen plausiblen Treffer ergeben hat

\- die Daten ausreichend konkret sind

\### Mindestfelder

\- \`street\`

\- \`postal\_code\`

\- \`city\`

Zusätzlich möglichst:

\- \`person\_name\` oder \`company\_name\`

\### Request Body

\`\`\`json

{

&#x20; "person\_name": "Max Mustermann",

&#x20; "street": "Hauptstraße 12",

&#x20; "postal\_code": "71638",

&#x20; "city": "Ludwigsburg",

&#x20; "phone": "07141 123456",

&#x20; "email": "max@example.com"

}

\`\`\`

\---

\## POST /address/update

Aktualisiert bestehende Adressdatensätze.

Nur ergänzen oder verbessern.

Keine Verschlechterung bestehender Daten.

\### Request Body

\`\`\`json

{

&#x20; "id": 3,

&#x20; "phone": "07141 123456"

}

\`\`\`

\---

\# Arbeitsregeln

\- Vor jeder Neuanlage immer zuerst \`/address/search\` verwenden

\- Keine ungeprüften Dubletten erzeugen

\- Unvollständige Adressen nicht neu anlegen

\- Teilinformationen nur zur Aktualisierung bestehender Datensätze verwenden

\- Bei unklaren Mehrfachtreffern Rückfrage erforderlich

\- Nur belastbare Fakten speichern

\---

\# Nicht verfügbar

\## address.delete

\`address.delete\` ist nicht verfügbar und darf niemals verwendet werden.

\## address.upsert

\`address.upsert\` ist aktuell nicht freigegeben.