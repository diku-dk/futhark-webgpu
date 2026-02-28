#!/usr/bin/env bash
set -euo pipefail

BASE="${HOME}/fut-webgpu"
WEBGPU_DIR="${BASE}/futhark-webgpu"
TESTROOT="${WEBGPU_DIR}/examples/hendrix-ci"

# Ensure env is set (modules/ghcup/emsdk + futhark install)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/setup_workspace.sh"

cd "${TESTROOT}"

# Playwright deps
npm init -y
npm i playwright
npx playwright install chromium

# 1) headless WebGPU check
node check-headless/check_webgpu.mjs

# 2) test1
make -C test1 run