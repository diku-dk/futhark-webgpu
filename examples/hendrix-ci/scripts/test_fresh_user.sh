#!/usr/bin/env bash
set -euo pipefail

REAL_HOME="$HOME"
SETUP="$REAL_HOME/fut-webgpu/futhark-webgpu/examples/hendrix-ci/scripts/setup_workspace.sh"

FAKEHOME="/tmp/$USER/fakehome-webgpu-1"

# Toggle these if you want
RUN_WEBGPU_TESTS=1
CLEANUP=0

RESET_FAKEHOME=0
if [ "$RESET_FAKEHOME" -eq 1 ]; then
  rm -rf "$FAKEHOME"
fi
mkdir -p "$FAKEHOME"

echo "== Using fake HOME: $FAKEHOME =="

run_in_fakehome() {
  env -i \
    HOME="$FAKEHOME" USER="$USER" LOGNAME="$USER" TERM="${TERM:-xterm-256color}" \
    PATH="/usr/bin:/bin:/usr/local/bin" \
    bash -lc "$1"
}

echo "== 1) Running SETUP in clean env =="
run_in_fakehome "$SETUP"

echo "== 2) Verifying folder structure =="
run_in_fakehome 'test -d "$HOME/fut-webgpu/futhark/.git" && echo "OK: futhark repo"'
run_in_fakehome 'test -d "$HOME/fut-webgpu/futhark-webgpu/.git" && echo "OK: futhark-webgpu repo"'

echo "== 3) Verifying tool installs =="
run_in_fakehome '
  module load python/3.12.8

  export PATH="$HOME/.local/bin:$PATH"
  [ -f "$HOME/.ghcup/env" ] && source "$HOME/.ghcup/env"
  [ -f "$HOME/opt/emsdk/emsdk_env.sh" ] && source "$HOME/opt/emsdk/emsdk_env.sh"

  echo "futhark: $(command -v futhark)"
  futhark --version | head -n 2

  python3 --version

  echo "emcc: $(command -v emcc)"
  emcc -v | head -n 2
'


if [ "$RUN_WEBGPU_TESTS" -eq 1 ]; then
  echo "== 4) Running WebGPU checks/tests =="
  run_in_fakehome '
    module load python/3.12.8
    export PATH="$HOME/.local/bin:$PATH"
    source "$HOME/.ghcup/env"
    source "$HOME/opt/emsdk/emsdk_env.sh"

    cd "$HOME/fut-webgpu/futhark-webgpu/examples/hendrix-ci"
    npm init -y
    npm i playwright
    npx playwright install chromium
    node check-headless/check_webgpu.mjs
    make -C test1 run
  '
fi

echo "== DONE =="
echo "Fake HOME left at: $FAKEHOME"

if [ "$CLEANUP" -eq 1 ]; then
  rm -rf "$FAKEHOME"
  echo "Cleaned up fake HOME."
fi