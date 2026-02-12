.PHONY: help check-env build run run-only clean distclean

FUTHARK ?= futhark
NODE    ?= node

OUT_PREFIX := test1
FUT_FILE   := test1.fut

# Files produced by: futhark webgpu --library -o test1 test1.fut
OUT_FILES := \
  $(OUT_PREFIX).js \
  $(OUT_PREFIX).wasm \
  $(OUT_PREFIX).json \
  $(OUT_PREFIX).c \
  $(OUT_PREFIX).wrapper.js

help:
	@echo "Targets:"
	@echo "  make check-env   - check tools exist (futhark, node, playwright)"
	@echo "  make build       - compile test1.fut to WebGPU outputs"
	@echo "  make run         - build + run headless test"
	@echo "  make run-only    - run headless test (no rebuild)"
	@echo "  make clean       - remove generated outputs"
	@echo "  make distclean   - clean + remove cabal/emscripten temp dirs (if any)"

check-env:
	@command -v $(FUTHARK) >/dev/null || (echo "ERROR: futhark not in PATH" && exit 1)
	@command -v $(NODE) >/dev/null || (echo "ERROR: node not in PATH" && exit 1)
	@test -d ../node_modules/playwright || (echo "ERROR: playwright not installed in ../node_modules (run: cd ../ && npm install)" && exit 1)

build: $(OUT_FILES)

$(OUT_FILES): $(FUT_FILE)
	$(FUTHARK) webgpu --library -o $(OUT_PREFIX) $(FUT_FILE)

run: build
	$(NODE) run_test1.mjs "$(CURDIR)"

run-only:
	$(NODE) run_test1.mjs "$(CURDIR)"

clean:
	rm -f $(OUT_FILES)

distclean: clean
	rm -rf dist-newstyle