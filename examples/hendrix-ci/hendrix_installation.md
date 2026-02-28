# Hendrix installation & build guide (Futhark WebGPU)

This document describes a **repeatable, per-user** setup for building a WebGPU-enabled Futhark compiler on DIKU’s Hendrix cluster (e.g. `hendrixfut03fl`).


## 0) Connect and log in (every time)

1. Connect to **KU-VPN**.
2. SSH into a Hendrix Futhark machine (example):

```bash
ssh futhark03
```

(Optional) If you use an SSH config entry (Windows/Linux), you can keep it simple:

```ssh-config
Host futhark03
    HostName hendrixfut03fl
    User <KU-id>
    StrictHostKeyChecking no
    CheckHostIP no
    UserKnownHostsFile=/dev/null
```

## 1) Clone repositories (one-time)

Pick a place in your home directory (examples below use `~/fut-webgpu`):

```bash
mkdir -p ~/fut-webgpu
cd ~/fut-webgpu
```

### 1.1 Clone the compiler repo (Futhark)
You need this to build the WebGPU-enabled compiler:

```bash
git clone https://github.com/diku-dk/futhark.git
cd futhark
git checkout webgpu
```

### 1.2 Clone the examples repo (futhark-webgpu)
This contains docs/examples for running WebGPU output:

```bash
cd ~/fut-webgpu
git clone https://github.com/diku-dk/futhark-webgpu.git
```

## 2) Load required modules (every new shell)

On Hendrix, use modules for toolchain components that exist system-wide:

```bash
module load gcc/11.2.0
module load gmp/6.2.1
module load perl/5.38.0
module load python   # needed for emcc (emscripten uses modern Python)
```

Verify:

```bash
gcc --version | head -n 1
perl --version | head -n 2
```


## 3) Install GHC + Cabal via GHCup (one-time)

### 3.1 Install GHCup
GHCup installs into `~/.ghcup` (your user only):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh
```

### 3.2 Install a GHC version
Futhark's webgpu implementation should work with **GHC 9.10.3** without errors. If you need to install/switch:

```bash
source ~/.ghcup/env

ghcup install ghc 9.10.3
ghcup set ghc 9.10.3
```

(You can also use `ghcup tui` to install/set versions interactively.)

Check:

```bash
ghc --version
cabal --version
```

## 4) Install Emscripten (emsdk) (one-time)

Emscripten is needed for compiling/running WebGPU-related browser output. On Hendrix, `emcc` requires a modern Python, so make sure the `python` module is loaded before running it.

### 4.1 Install emsdk

```bash
mkdir -p ~/opt
cd ~/opt
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
```

### 4.2 Load emsdk in the current shell

```bash
export EMSDK_QUIET=1
source ~/opt/emsdk/emsdk_env.sh
```

In order to verify `emcc` is available:

```bash
which emcc
emcc -v
```

### 4.3 Common failure: `SyntaxError: invalid syntax` in `emcc.py`

If you see a `SyntaxError` like `:=` not supported, it usually means `emcc` is being run with an older Python. Fix by loading the Hendrix python module and re-sourcing emsdk:

```bash
module load python
source "$HOME/opt/emsdk/emsdk_env.sh"
```


## 5) Build Futhark with Cabal

From your compiler repo checkout:

```bash
cd ~/fut-webgpu/futhark
rm -rf dist-newstyle
make configure
make build
```

To find the produced binary:

```bash
cabal list-bin exe:futhark
```

To install it into your personal bin directory:

```bash
make install
```

Make sure `~/.local/bin` is on your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
which futhark
futhark --version
```

# Troubleshooting

## A) Linker error: `/usr/bin/ld: cannot find -lgmp`

Symptom:

```
/usr/bin/ld: cannot find -lgmp
`gcc' failed in phase `Linker'
```

Cause:
- The system has the **runtime** `libgmp.so.10`, but not the **development** symlink `libgmp.so`.
- Without sudo, you can create a **user-local** symlink that satisfies `-lgmp`.

Fix (user-local `libgmp.so`):

```bash
mkdir -p ~/.local/lib

# pick the exact file you have; common is libgmp.so.10 on EL8
ls -l /usr/lib64/libgmp.so*

# example:
ln -sf /usr/lib64/libgmp.so.10 ~/.local/lib/libgmp.so

export LIBRARY_PATH="$HOME/.local/lib:$LIBRARY_PATH"
export LD_LIBRARY_PATH="$HOME/.local/lib:$LD_LIBRARY_PATH"

cd ~/fut-webgpu/futhark
rm -rf dist-newstyle
cabal build
```

Verify linking works:

```bash
echo 'int main(){}' | gcc -x c - -lgmp -o /tmp/test_gmp_link && echo "OK: -lgmp works"
```

To make the environment persistent, add to `~/.bashrc`:

```bash
export LIBRARY_PATH="$HOME/.local/lib:$LIBRARY_PATH"
export LD_LIBRARY_PATH="$HOME/.local/lib:$LD_LIBRARY_PATH"
```


## B) Cabal failure: `removeDirectoryRecursive ... Directory not empty`

Symptom:

```
removeDirectoryRecursive:unlinkat: unsatisfied constraints (Directory not empty)
```

This usually happens during Cabal’s package registration cleanup under `dist-newstyle/tmp/...`, and is **very common on NFS home directories**.

### Reliable fix: build from local scratch (`/tmp`) + single-threaded build

```bash
# 0) load environment
source ~/.ghcup/env
module load gcc/11.2.0
module load gmp/6.2.1
module load perl/5.38.0

# 1) kill stray build processes that might keep files open
pkill -u "$USER" -f 'cabal|ghc|hsc2hs|happy|alex' || true

# 2) copy the repo to local scratch (not your NFS home)
WORK=/tmp/$USER/futhark-webgpu
mkdir -p "$WORK"
rsync -a --delete ~/fut-webgpu/futhark/ "$WORK"/
cd "$WORK"

# 3) use local tmp as well
export TMPDIR=/tmp/$USER/tmp
mkdir -p "$TMPDIR"

# 4) clean and build (single job avoids racey temp cleanup)
rm -rf dist-newstyle
cabal build -j1
```

Then install the resulting binary back into your home:

```bash
make install
export PATH="$HOME/.local/bin:$PATH"
```


## C) Where things end up (paths)
- GHCup installs to: `~/.ghcup/`
- Your installed `futhark` binary: `~/.local/bin/futhark`
- User-local GMP symlink workaround: `~/.local/lib/libgmp.so`
- Scratch build directory: `/tmp/$USER/futhark-webgpu/`



## Appendix: Recommended `~/.bashrc` additions

If you want modules/ghcup/emsdk to load automatically on every login, add the following lines to `~/.bashrc`:

```bash
# User specific aliases and functions

[ -f "/home/szh252/.ghcup/env" ] && . "/home/szh252/.ghcup/env" # ghcup-env

# ---- Hendrix modules (needed for building Futhark etc.)
module load gcc/11.2.0
module load gmp/6.2.1
module load perl/5.38.0
module load python 

# ---- Emscripten SDK (emsdk) - sets PATH for emcc and related tools
export EMSDK_QUIET=1
[ -f "$HOME/opt/emsdk/emsdk_env.sh" ] && source "$HOME/opt/emsdk/emsdk_env.sh"
```


