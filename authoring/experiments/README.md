# Authoring experiments

Raw material behind [`docs/authoring-art-with-ai.md`](../docs/authoring-art-with-ai.md).
None of this is part of a shipped scheme.

- `agy/`: Google Antigravity CLI runs. Sprite rows, drawing code, the image
  generator's output before and after cleanup, and a seven-model comparison.
- `pxl/`: [claude-pxl](https://github.com/crsolver/claude-pxl) art files, the
  sprites they build, a PNG round-trip check, and `variant/`, a Halcyon build
  that uses the claude-pxl sprites (`npm run author -- authoring/experiments/pxl/variant`).
