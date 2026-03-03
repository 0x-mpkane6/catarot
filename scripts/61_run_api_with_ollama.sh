#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  cp .env.example .env
fi

set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf "%s=%s\n" "$key" "$value" >> .env
  fi
}

if ! command -v ollama >/dev/null 2>&1; then
  echo "[ERROR] 'ollama' is not installed."
  echo "Install with: curl -fsSL https://ollama.com/install.sh | sh"
  exit 1
fi

set_env_value "OLLAMA_ENABLED" "true"

OLLAMA_MODEL_VALUE="$(grep '^OLLAMA_MODEL=' .env | cut -d= -f2- || true)"
if [ -z "$OLLAMA_MODEL_VALUE" ]; then
  OLLAMA_MODEL_VALUE="qwen2.5:3b-instruct"
  set_env_value "OLLAMA_MODEL" "$OLLAMA_MODEL_VALUE"
fi

if ! curl -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
  echo "[INFO] Starting Ollama server..."
  nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
fi

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
  echo "[ERROR] Ollama server is not reachable at 127.0.0.1:11434"
  echo "Check logs: /tmp/ollama-serve.log"
  exit 1
fi

if ! ollama list | awk '{print $1}' | grep -Fxq "$OLLAMA_MODEL_VALUE"; then
  echo "[INFO] Pulling model: $OLLAMA_MODEL_VALUE"
  ollama pull "$OLLAMA_MODEL_VALUE"
fi

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
if ! python -c "import uvicorn" >/dev/null 2>&1; then
  pip install -r requirements.txt
fi

echo "[INFO] Running backend with Ollama model: $OLLAMA_MODEL_VALUE"
exec python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
