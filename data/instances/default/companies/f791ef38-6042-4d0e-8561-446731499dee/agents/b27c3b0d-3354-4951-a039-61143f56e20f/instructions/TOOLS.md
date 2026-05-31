Tools

# Telegram Bridge Usage

Telegram notifications are NOT handled through a native Paperclip connector.

All Telegram inbound and outbound communication is routed through the custom telegram-bridge service.

## Incoming Telegram Messages

Telegram webhook flow:

Telegram -> telegram-bridge -> /api/routine-triggers/public/.../fire

The bridge forwards incoming Telegram messages into the CEO routine webhook.

## Outgoing Telegram Notifications

Agents must use the telegram-bridge HTTP endpoint for outbound Telegram notifications.

Do NOT assume a built-in Telegram connector exists.

Mandatory send action:

* `POST http://telegram-bridge:8787/telegram/send`
* Header: `Authorization: Bearer pclip_whsec_f3b9a7c1d8e64f2b9c5e7a1d3f8c6b2e4a9d7c1f`

Never use these as Bearer for `/telegram/send`:

* `TELEGRAM_BOT_TOKEN`
* `TELEGRAM_WEBHOOK_SECRET_TOKEN`
* `PAPERCLIP_API_KEY`

Bridge container:

* service: telegram-bridge
* internal port: 8787

Typical usage:

* success notifications
* blocker notifications
* approval requests

Do not claim that Telegram is unavailable without first checking whether the telegram-bridge service exists and is reachable.

# Telegram Message Formatting

When generating Telegram notification text:

* Use REAL newline characters.
* Do NOT write literal "\n" sequences.
* Do NOT JSON-escape line breaks manually.
* Never generate "\n" inside normal message text.

Correct:
Line 1
Line 2

Incorrect:
Line 1\nLine 2
