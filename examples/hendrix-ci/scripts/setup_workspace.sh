#!/usr/bin/env bash
set -euo pipefail

BASE="${HOME}/fut-webgpu"
FUTHARK_DIR="${BASE}/futhark"
WEBGPU_DIR="${BASE}/futhark-webgpu"
export PATH="$HOME/.local/bin:$PATH"

# ---- Hendrix modules (assumes module is available in this shell)
module load gcc/11.2.0
module load gmp/6.2.1
module load perl/5.38.0
module load python   # needed for emcc in your setup

# ---- ghcup + GHC/Cabal (user-local)
if [ ! -f "${HOME}/.ghcup/env" ]; then
  curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh -s -- -y
fi
# shellcheck source=/dev/null
source "${HOME}/.ghcup/env"

if ! ghcup whereis ghc 9.10.3 >/dev/null 2>&1; then
  ghcup install ghc 9.10.3
fi

if [ "$(ghc --numeric-version 2>/dev/null || true)" != "9.10.3" ]; then
  ghcup set ghc 9.10.3
fi

# ---- emsdk (user-local)
mkdir -p "${HOME}/opt"
if [ ! -d "${HOME}/opt/emsdk" ]; then
  git clone https://github.com/emscripten-core/emsdk.git "${HOME}/opt/emsdk"
fi

# Only (re)activate if emcc isn't working in this shell
if ! command -v emcc >/dev/null 2>&1; then
  pushd "${HOME}/opt/emsdk" >/dev/null
  ./emsdk install latest
  ./emsdk activate latest
  export EMSDK_QUIET=1
  source "${HOME}/opt/emsdk/emsdk_env.sh"
  popd >/dev/null
fi

# ---- GMP symlink workaround
mkdir -p "${HOME}/.local/lib"
if [ ! -e "${HOME}/.local/lib/libgmp.so" ] && [ -e /usr/lib64/libgmp.so.10 ]; then
  ln -sf /usr/lib64/libgmp.so.10 "${HOME}/.local/lib/libgmp.so"
fi
export LIBRARY_PATH="${HOME}/.local/lib:${LIBRARY_PATH:-}"
export LD_LIBRARY_PATH="${HOME}/.local/lib:${LD_LIBRARY_PATH:-}"

# ---- Ensure workspace layout
mkdir -p "${BASE}"

# ---- Clone or update futhark (webgpu branch)
if [ ! -d "${FUTHARK_DIR}/.git" ]; then
  git clone https://github.com/diku-dk/futhark.git "${FUTHARK_DIR}"
fi

pushd "${FUTHARK_DIR}" >/dev/null
git fetch --all --prune
git checkout webgpu
git pull --ff-only || true

# Only rebuild if the installed binary doesn't match this repo HEAD.
HEAD_HASH="$(git rev-parse --short=7 HEAD)"

NEED_BUILD=1
if command -v futhark >/dev/null 2>&1; then
  if futhark --version | grep -q "git: webgpu @ ${HEAD_HASH}"; then
    NEED_BUILD=0
  fi
fi

if [ "$NEED_BUILD" -eq 1 ]; then
  make configure
  make build
  make install
fi

popd >/dev/null

# ---- Clone or update futhark-webgpu
if [ ! -d "${WEBGPU_DIR}/.git" ]; then
  git clone https://github.com/diku-dk/futhark-webgpu.git "${WEBGPU_DIR}"
fi
pushd "${WEBGPU_DIR}" >/dev/null
git fetch --all --prune
git pull --ff-only || true
popd >/dev/null

echo "OK: workspace ready at ${BASE}"
echo "OK: futhark is $(command -v futhark)"
echo "OK: emcc is $(command -v emcc)"