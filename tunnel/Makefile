# Example: tunnel (Futhark WebGPU)
#
# The generated files are 'build/tunnel.mjs' (the ES module exporting the
# JavaScript API) and 'build/tunnel.wasm' (loaded by the module).  The
# 'build/tunnel.c' and 'build/tunnel.class.js' files are intermediates that
# are not needed at runtime.

PROG    := tunnel
FUTHARK ?= futhark
BUILD   := build

.PHONY: all check clean serve run

all: $(BUILD)/$(PROG).mjs

$(BUILD)/$(PROG).mjs: $(PROG).fut
	mkdir -p $(BUILD)
	$(FUTHARK) webgpu --library -o $(BUILD)/$(PROG) $<

check:
	$(FUTHARK) check $(PROG).fut

clean:
	rm -rf $(BUILD)

serve: all
	python3 -m http.server 8000

run: serve
