#!/usr/bin/env bash
set -euo pipefail

BASE="${HOME}/fut-webgpu"
WEBGPU_DIR="${BASE}/futhark-webgpu"
TESTROOT="${WEBGPU_DIR}/examples/hendrix-ci"

# Ensure env is set (modules/ghcup/emsdk + futhark install)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/setup_workspace.sh"

cd "${TESTROOT}"

# # Create Node project files on first run as they are not committed
# if [ ! -f package.json ]; then
#   npm init -y >/dev/null

#   npm pkg set type=module >/dev/null

#   # Install Playwright as a dependency so check_webgpu.mjs can import it
#   npm install --save-dev playwright >/dev/null
# fi

# Playwright deps
npm install @playwright/test 
npx playwright install chromium

# 1) headless WebGPU check
node check-headless/check_webgpu.mjs

# 2) test1
make -C test1 run