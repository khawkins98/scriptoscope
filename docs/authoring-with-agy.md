# Using an AI assistant (Antigravity `agy`) to draw scheme art

*Experiment log, 2026-10-30. `agy` 1.4.10, default model Gemini 3.8 Flash
(Medium). Companion to [`authoring-a-scheme.md`](./authoring-a-scheme.md).*

**Short version:** ask `agy` for **code or ASCII sprite rows**, not images.
If you need an image model, Retro Diffusion's API is the best fit we found,
followed by a grid-recovery and palette-lock cleanup (see "If you do want an
image model").
Both drop straight into `tools/theme-author/` and come out at the exact size
you asked for. The built-in image generator makes attractive pictures, but
they are 1024×1024 JPEGs with fake transparency, so it is only useful for
mood boards.

![The three approaches side by side](../authoring/experiments/agy/comparison.png)

The raw outputs are in [`authoring/experiments/agy/`](../authoring/experiments/agy/).

## Is there an existing skill?

No. Nothing in `~/.claude/skills`, the installed Claude plugins or
`~/.gemini/skills` drives `agy` for pixel art. The only Antigravity material is
superpowers' `references/antigravity-tools.md`, which covers running
superpowers *inside* Antigravity, the opposite direction. Asking `agy` itself
(`agy -p "List the tools you can call…"`) showed it has a built-in
`image-generator` subagent and the usual file and shell tools.

## What we tried

All three runs used the same brief: a checked checkbox in Halcyon's palette
(teal `#1689a8`, border `#0f6a83`, white check), or a slider thumb for C.

| | Approach | Result | Usable? |
|---|---|---|---|
| A | `image-generator` subagent, asked for a 16×16 PNG | 1024×1024 **JPEG**, 5,033 colours (compression noise), checkerboard *painted in* as "transparency", saved to its own artifact folder instead of the requested path. Its pixel grid was ~36 cells with a 26-cell box, not 16. | Concept only. A snap step (sample each grid cell, map to the nearest brief colour, drop the checkerboard) turned it into a clean 3-colour 26×26 sprite, but at the wrong size. |
| B | text only: `--json-schema` for `{rows, legend}`, rows for `Raster.sprite()` | First try: exactly 14 rows × 14 characters, the three requested colours, a readable check. The corners came out nearly circular ("radius about 4" was not followed). | **Yes.** It encodes as a 2-bit cicn directly. Expect to fix details by hand. |
| C | text only: `--json-schema` for `{code}`, a `sliderThumb(state)` function using our `Raster` API | Correct 15×17 thumb on the first try: gradient body, outline, pointed bottom, teal or grey grip. 17 colours, so it encodes as 8-bit. | **Yes.** The best result. Review it like any generated code before running it. |

## Recipes that work

Run from a scratch directory, not the repo, so `agy` has nothing to edit:

```sh
mkdir -p /tmp/agy-lab && cd /tmp/agy-lab
# B: ASCII sprite rows (schema: authoring/experiments/agy/sprite-schema.json)
agy -p "Design pixel art as ASCII rows. Produce a 14x14 checkbox in the CHECKED state …
  Output JSON only: 'rows' is an array of exactly 14 strings, each exactly 14 characters;
  '.' means transparent; every other character must appear in 'legend' ('#rrggbb').
  Use colours: fill #1689a8, border #0f6a83, check #ffffff. Do not use tools." \
  --json-schema sprite-schema.json --output-format json --print-timeout 240s > b.json
```

Then take `response` from the JSON output and use it as
`new Raster(14, 14).sprite(0, 0, rows, legend)`.

For C, paste the toolkit's method list into the prompt, ask for
`{"code": "..."}` with a one-field schema, and write the code to a file
yourself.

## Gotchas

- **Headless mode auto-denies tools.** In `-p` mode any tool that needs
  approval (shell commands, writes) is denied, and the run can end with no
  output. In our first code run `agy` tried to run a shell command despite
  "do not run it". The fix: ask for **structured output with `--json-schema`**
  and write files yourself. No tools, no permissions needed.
- **The reply can contain the JSON twice.** Parse the first JSON value
  (Python `json.JSONDecoder().raw_decode`) instead of the whole string.
- **Print mode exits before subagents finish** unless you tell it to wait
  ("wait for it to finish before replying"). The image subagent also needed
  a session-only write allow rule (`--settings '{"permissions":{"allow":["write_file(/tmp/agy-lab/**)"]}}'`).
  It still ignored the save path and wrote a JPEG into
  `~/.gemini/antigravity-cli/brain/<conversation>/`.
- `--mode auto` is not available on every account; `agy` warns and falls back.
- The log shows "You are not logged into Antigravity" warnings while text
  turns still work. They didn't block anything we tried.

## If you do want an image model (research, 2026-10-30)

A follow-up search of the docs and the web, plus three more scratch runs, found:

- **`agy` can't be configured for sprites.** Its image tool (`generate_image`, behind the `image-generator` subagent) takes only a prompt, a name, an aspect ratio (`1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `9:16`, `16:9`) and optional reference images. There is no setting for pixel size, format, transparency or save path. That list comes from the subagent describing its own tool; the official [CLI reference](https://antigravity.google/docs/cli/reference) doesn't mention image generation at all.
  - Output always lands in `~/.gemini/antigravity-cli/brain/<conversation-id>/`. Run with `--output-format json` so you can read `conversation_id` and copy the file out.
  - Check the file's real format: we asked for PNG and got a JPEG.
  - Reference images (`ImagePaths`) are the one useful lever: give it a template sprite or a palette strip.
- **[Retro Diffusion API](https://github.com/Retro-Diffusion/api-examples)** is the only image model we found that meets the format's constraints in one call:
  - an exact `width`/`height` down to 12 px;
  - `remove_bg` for real transparency;
  - `input_palette` to lock colours.

  It's a plain REST call, roughly $0.03–$0.18 per image (the repo's prices). Untested here; we haven't confirmed the palette lock and background removal work together.
- [PixelLab](https://api.pixellab.ai/v2/llms.txt) is a pixel-art model with no-background and palette options, but its tools mostly start at 32 px. The Gemini CLI [nanobanana extension](https://github.com/gemini-cli-extensions/nanobanana) has an `/icon` command with PNG and transparent-background flags. The [Gemini image API](https://ai.google.dev/gemini-api/docs/image-generation) gives PNG and an aspect ratio, but its smallest size is about 512 px and transparency isn't documented. Both need the cleanup below.

**Cleanup for any generated image:**

1. Recover the real pixel grid with [unfake](https://github.com/painebenjamin/unfake.py) or [proper-pixel-art](https://github.com/KennethJAllen/proper-pixel-art), e.g.
   `unfake gen.png -o native.png -m dominant --transparent-background --alpha-threshold 128`.
2. Fit the size, lock the palette and make the mask 1-bit with ImageMagick:
   `magick native.png -fuzz 6% -transparent '#00FF00' -trim +repage -filter point -sample 16x16\! -dither None -remap palette.png -channel A -threshold 50% +channel PNG8:sprite.png`
   (ask the model for a flat `#00FF00` background so it can be keyed out).
3. Load it into a `Raster` and run `npm run author` as usual; `checkScheme` still applies.

None of this fixes art drawn on the wrong grid. Our "16×16" request came back drawn on a 26-cell box. That's why the text routes stay first.

## Why code and rows beat images here

Scheme art has hard constraints: exact pixel sizes, a 1-bit mask, at most 256
colours, and hidden swatch pixels at exact coordinates (see the authoring
guide, §4). An image model aims for a *picture of* pixel art; text output
lets the model commit to each pixel. Code also stays editable: changing the
palette or the size is a one-line change, not a regeneration.

## Not tried yet

- A whole frame or `windowLayout` description from a brief. Frames have the
  tightest rules, so they need the checker in the loop.
- Feeding `checkScheme` errors back to `agy` and asking for a fix.
- Other `agy` models (Gemini 4 Argon, Claude, GPT-OSS) on the same brief.
