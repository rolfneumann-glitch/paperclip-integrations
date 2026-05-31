# Fundgrube MCP Bridge Tools

## Base URL

```text
http://fundgrube-mcp-bridge:8792
```

Alternative lokal:

```text
http://127.0.0.1:8792
```

***

# Connectivity-Test

```http
GET /health
```

Beispiel:

```http
GET http://fundgrube-mcp-bridge:8792/health
```

***

# Address Search

```http
POST /address/search
Content-Type: application/json
```

Request:

```json
{
  "q": "Max Mustermann"
}
```

Beispiel:

```http
POST http://fundgrube-mcp-bridge:8792/address/search
Content-Type: application/json

{
  "q": "Max Mustermann"
}
```

***

# Address Find

```http
POST /address/find
Content-Type: application/json
```

Request:

```json
{
  "id": 3
}
```

Beispiel:

```http
POST http://fundgrube-mcp-bridge:8792/address/find
Content-Type: application/json

{
  "id": 3
}
```

***

# Address Create

```http
POST /address/create
Content-Type: application/json
```

Mindestfelder:

* `street`
* `postal_code`
* `city`

Request:

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

Beispiel:

```http
POST http://fundgrube-mcp-bridge:8792/address/create
Content-Type: application/json

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

# Address Update

```http
POST /address/update
Content-Type: application/json
```

Request:

```json
{
  "id": 3,
  "phone": "07141 123456"
}
```

Beispiel:

```http
POST http://fundgrube-mcp-bridge:8792/address/update
Content-Type: application/json

{
  "id": 3,
  "phone": "07141 123456"
}
```

***

# Regeln

* Vor `address/create` immer zuerst `address/search`
* Keine ungeprüften Dubletten anlegen
* Nur dokumentierte Endpunkte verwenden
* Keine `/api/...` Varianten verwenden
* Keine alternativen URL-Strukturen raten

***

# Nicht verfügbar

* `address.delete`
* `address.upsert`

\# Fundgrube MCP Bridge Tools



\## Base URL



\`\`\`text

http://fundgrube-mcp-bridge:8792

\`\`\`



Alternative lokal:



\`\`\`text

[http://127.0.0.1:8792](http://127.0.0.1:8792)

\`\`\`



\---



\# Connectivity-Test



\`\`\`http

GET /health

\`\`\`



Beispiel:



\`\`\`http

GET http://fundgrube-mcp-bridge:8792/health

\`\`\`



\---



\# Address Search



\`\`\`http

POST /address/search

Content-Type: application/json

\`\`\`



Request:



\`\`\`json

{

&#x20; "q": "Max Mustermann"

}

\`\`\`



Beispiel:



\`\`\`http

POST http://fundgrube-mcp-bridge:8792/address/search

Content-Type: application/json



{

&#x20; "q": "Max Mustermann"

}

\`\`\`



\---



\# Address Find



\`\`\`http

POST /address/find

Content-Type: application/json

\`\`\`



Request:



\`\`\`json

{

&#x20; "id": 3

}

\`\`\`



Beispiel:



\`\`\`http

POST http://fundgrube-mcp-bridge:8792/address/find

Content-Type: application/json



{

&#x20; "id": 3

}

\`\`\`



\---



\# Address Create



\`\`\`http

POST /address/create

Content-Type: application/json

\`\`\`



Mindestfelder:



\- \`street\`

\- \`postal\_code\`

\- \`city\`



Request:



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



Beispiel:



\`\`\`http

POST http://fundgrube-mcp-bridge:8792/address/create

Content-Type: application/json



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



\# Address Update



\`\`\`http

POST /address/update

Content-Type: application/json

\`\`\`



Request:



\`\`\`json

{

&#x20; "id": 3,

&#x20; "phone": "07141 123456"

}

\`\`\`



Beispiel:



\`\`\`http

POST http://fundgrube-mcp-bridge:8792/address/update

Content-Type: application/json



{

&#x20; "id": 3,

&#x20; "phone": "07141 123456"

}

\`\`\`



\---



\# Regeln



\- Vor \`address/create\` immer zuerst \`address/search\`

\- Keine ungeprüften Dubletten anlegen

\- Nur dokumentierte Endpunkte verwenden

\- Keine \`/api/...\` Varianten verwenden

\- Keine alternativen URL-Strukturen raten



\---



\# Nicht verfügbar



\- \`address.delete\`