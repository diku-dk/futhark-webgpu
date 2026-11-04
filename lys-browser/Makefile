# Lys browser PoC for futhark-webgpu
#
# Builds a WebGPU browser bundle from genlys.fut.  The generated files are
# 'build/lys.mjs' (the ES module exporting the JavaScript API) and
# 'build/lys.wasm' (loaded by the module); 'build/lys.c' and
# 'build/lys.class.js' are intermediates not needed at runtime.

PROG    := lys
WRAP    := genlys.fut
FUT     := lys.fut
FUTHARK ?= futhark
BUILD   := build
LYS_PKG := github.com/diku-dk/lys

.PHONY: all setup check clean serve

# 'setup' first, so that the Lys package is present before compiling.
all: setup $(BUILD)/$(PROG).mjs

setup:
	@if [ ! -f futhark.pkg ]; then printf 'require {\n}\n' > futhark.pkg; fi
	@if ! grep -q '$(LYS_PKG)' futhark.pkg; then $(FUTHARK) pkg add $(LYS_PKG); fi
	$(FUTHARK) pkg sync

$(BUILD)/$(PROG).mjs: $(WRAP) $(FUT)
	mkdir -p $(BUILD)
	$(FUTHARK) webgpu --library -o $(BUILD)/$(PROG) $(WRAP)

check: setup
	$(FUTHARK) check $(WRAP)

clean:
	rm -rf $(BUILD)

serve: all
	python3 -m http.server 8000
