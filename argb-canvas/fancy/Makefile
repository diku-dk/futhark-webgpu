# Example: ARGB canvas fancy (Futhark WebGPU)
#
# The generated files are 'build/fancy.mjs' (the ES module exporting the
# JavaScript API) and 'build/fancy.wasm' (loaded by the module).  The
# 'build/fancy.c' and 'build/fancy.class.js' files are intermediates that are
# not needed at runtime.

PROG    := fancy
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
