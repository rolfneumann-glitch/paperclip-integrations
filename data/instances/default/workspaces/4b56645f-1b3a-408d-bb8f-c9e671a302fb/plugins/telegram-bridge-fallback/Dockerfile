FROM node:18

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ffmpeg \
     python3 \
     python3-pip \
  && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --no-cache-dir faster-whisper

WORKDIR /app

CMD ["node", "plugins/telegram-bridge-fallback/src/server.js"]
