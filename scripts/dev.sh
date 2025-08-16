#!/usr/bin/env bash
set -euo pipefail

# Ensure we kill vercel dev when this script exits
cleanup() {
  if [[ -n "${VC_PID-}" ]]; then
    kill "$VC_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# 1) run the serverless functions locally on 3000
npx vercel dev --port 3000 & VC_PID=$!

# 2) build your JSON index + start Vite on 5173
node scripts/build.cjs --skip-vite && npx vite