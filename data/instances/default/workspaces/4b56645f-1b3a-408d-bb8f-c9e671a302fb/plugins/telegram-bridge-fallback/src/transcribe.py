from faster_whisper import WhisperModel
import json
import sys

if len(sys.argv) < 2:
    print(json.dumps({
        "ok": False,
        "error": "missing_audio_path"
    }))
    sys.exit(1)

audio_path = sys.argv[1]

model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

segments, info = model.transcribe(
    audio_path,
    language="de"
)

text = " ".join(
    segment.text.strip()
    for segment in segments
).strip()

print(json.dumps({
    "ok": True,
    "language": info.language,
    "duration": info.duration,
    "text": text
}, ensure_ascii=False))
