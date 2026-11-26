- **Modular `style.wgsl` parts and deterministic assembler** (`src/renderer/gpu/shaders/style/`,
  `scripts/assemble_style_wgsl.py`). Split the 4,914-line `style.wgsl` monolith along exact `//@pass`
  boundaries into eight modular WGSL source files with a zero-dependency assembler and byte-for-byte
  SHA-256 parity test (`wgsl_to_hlsl.py --check` confirms all 150 generated HLSL/header files remain
  unchanged).
