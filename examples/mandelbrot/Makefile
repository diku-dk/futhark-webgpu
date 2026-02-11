# Example: Mandelbrot (Futhark WebGPU)
# Generates the JS/WASM wrapper bundle using:
#   futhark webgpu --library -o mandelbrot mandelbrot.fut

PROG := mandelbrot
FUT  := $(PROG).fut

GEN  := $(PROG).js \
        $(PROG).wasm \
        $(PROG).json \
        $(PROG).c \
        $(PROG).wrapper.js

.PHONY: all build clean serve run check

all: build

# Build all generated artifacts (one invocation generates all of them)
build: $(GEN)

$(GEN): $(FUT)
	futhark webgpu --library -o $(PROG) $(FUT)

check:
	futhark check $(FUT)

clean:
	rm -f $(GEN)

# Serve the folder so the browser can fetch the wasm/js
serve: build
	python3 -m http.server 8000

# Convenience alias
run: serve
