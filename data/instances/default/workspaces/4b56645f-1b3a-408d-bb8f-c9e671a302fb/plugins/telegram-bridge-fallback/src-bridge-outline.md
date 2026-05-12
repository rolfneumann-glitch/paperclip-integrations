# Bridge Outline

1. Verify request authenticity using `TELEGRAM_BOT_TOKEN`.
2. Parse Telegram `message`, `callback_query`, and metadata.
3. Normalize payload into internal event schema.
4. Forward event to CEO-centered Paperclip route handler.
5. Return Telegram-compatible ACK and optional response payload.
