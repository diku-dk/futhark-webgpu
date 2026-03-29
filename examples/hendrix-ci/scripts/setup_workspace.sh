#!/usr/bin/env bash
set -euo pipefail

BASE="${HOME}/fut-webgpu"
FUTHARK_DIR="${BASE}/futhark"
WEBGPU_DIR="${BASE}/futhark-webgpu"
export PATH="$HOME/.local/bin:$PATH"

# ---- Hendrix modules
echo "Setting up Hendrix modules..."
if ! type module >/dev/null 2>&1; then
  [ -f /etc/profile.d/modules.sh ] && source /etc/profile.d/modules.sh
  [ -f /usr/share/Modules/init/bash ] && source /usr/share/Modules/init/bash
fi

module load gcc/11.2.0
module load gmp/6.2.1
module load perl/5.38.0
module load python/3.12.8
python3 --version
which python3

# ---- ghcup + GHC/Cabal (user-local)
echo "Setting up ghcup and GHC..."
if [ ! -f "${HOME}/.ghcup/env" ]; then
  curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | \
    BOOTSTRAP_HASKELL_NONINTERACTIVE=1 \
    BOOTSTRAP_HASKELL_MINIMAL=1 \
    sh
fi
source "${HOME}/.ghcup/env"

if ! ghcup whereis ghc 9.10.3 >/dev/null 2>&1; then
  ghcup install ghc 9.10.3
fi

if [ "$(ghc --numeric-version 2>/dev/null || true)" != "9.10.3" ]; then
  ghcup set ghc 9.10.3
fi

if ! command -v cabal >/dev/null 2>&1; then
  ghcup install cabal
  ghcup set cabal
fi

# ---- emsdk (user-local)
echo "Setting up emsdk..."
mkdir -p "${HOME}/opt"
if [ ! -d "${HOME}/opt/emsdk" ]; then
  git clone https://github.com/emscripten-core/emsdk.git "${HOME}/opt/emsdk"
fi

if ! command -v emcc >/dev/null 2>&1; then
  pushd "${HOME}/opt/emsdk" >/dev/null
  ./emsdk install 5.0.0
  ./emsdk activate 5.0.0
  export EMSDK_QUIET=1
  source "${HOME}/opt/emsdk/emsdk_env.sh"
  popd >/dev/null
fi

# ---- GMP symlink workaround
echo "Setting up GMP symlink..."
mkdir -p "${HOME}/.local/lib"
if [ ! -e "${HOME}/.local/lib/libgmp.so" ] && [ -e /usr/lib64/libgmp.so.10 ]; then
  ln -sf /usr/lib64/libgmp.so.10 "${HOME}/.local/lib/libgmp.so"
fi
export LIBRARY_PATH="${HOME}/.local/lib:${LIBRARY_PATH:-}"
export LD_LIBRARY_PATH="${HOME}/.local/lib:${LD_LIBRARY_PATH:-}"

# ---- node + npm (user-local)
echo "Setting up Node.js and npm..."
NODE_VERSION="22.16.0"
NODE_DIR="${HOME}/opt/node-v${NODE_VERSION}-linux-x64"
NODE_BIN="${NODE_DIR}/bin"

mkdir -p "${HOME}/opt"

if [ ! -x "${NODE_BIN}/node" ]; then
  TARBALL="node-v${NODE_VERSION}-linux-x64.tar.xz"
  URL="https://nodejs.org/dist/v${NODE_VERSION}/${TARBALL}"
  rm -rf "${NODE_DIR}"
  curl -fsSL -o "${HOME}/opt/${TARBALL}" "${URL}"
  tar -xf "${HOME}/opt/${TARBALL}" -C "${HOME}/opt"
fi

export PATH="${NODE_BIN}:${PATH}"

# ---- Ensure workspace layout
echo "Creating workspace layout..."
mkdir -p "${BASE}"

# ---- webgpu branch
echo "Setting up futhark repository..."
if [ ! -d "${FUTHARK_DIR}/.git" ]; then
  git clone https://github.com/diku-dk/futhark.git "${FUTHARK_DIR}"
fi

pushd "${FUTHARK_DIR}" >/dev/null
git fetch --all --prune
git checkout webgpu
git pull --ff-only || true

HEAD_HASH="$(git rev-parse --short=7 HEAD)"

NEED_BUILD=1
if command -v futhark >/dev/null 2>&1; then
  if futhark --version | grep -q "git: webgpu @ ${HEAD_HASH}"; then
    NEED_BUILD=0
  fi
fi

if [ "$NEED_BUILD" -eq 1 ]; then
  echo "Building futhark..."
  make configure
  make build
  make install
else
  echo "Futhark already up-to-date"
fi

popd >/dev/null

echo "Setting up futhark-webgpu repository..."
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
echo "OK: node is $(command -v node)"
echo "OK: npm is $(command -v npm)"