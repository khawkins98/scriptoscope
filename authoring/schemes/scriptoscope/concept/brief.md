# Scriptoscope Reference — concept brief

Scriptoscope Studio is a compact editorial instrument: a charcoal enamel bezel,
flat warm-paper title plaque, quiet rule lines and the site's six-tile maker
mark. Light comes from the upper left. The mark and segmented progress provide
colour; functional chrome stays ink, paper and restrained brass. Branding is
visible through the maker mark and About, leaving live window titles prominent.

## Geometry before illustration

The runnable skeleton preceded concept generation. `parts/frames.mjs` owns all
measurements and recipes. Geometry sheet: `node scripts/authoring-concept.mjs
 authoring/schemes/scriptoscope --out /tmp/scriptoscope-geometry.html`.

| Feature | Behavior | Narrow-window outcome |
|---|---|---|
| Six-tile maker mark | Fixed cell independent of close | Remains complete |
| Close / zoom / collapse | Fixed 18px controls | Stay separate from title |
| Title and caps | Uniform plate, two fixed caps | Title truncates first |
| Header material | Two matching growers | Repeats without surface motifs |
| Footer | One 8px repeating calibration period | Ends at fixed corners |

Target content is 380×210. Header, side and footer allocations follow the compact
site direction. Representative title reservation is 90px; see source layout's
`minWidthForTitle(90)` rather than duplicating its measurements here.

## Concept and translation

Selected image: `concept.png`; exact generation prompt: `prompt.txt`. The defining
forms are geometric: extract any distinctive illustration before rebuilding,
while frame surfaces, glyphs and repeating periods remain procedural. The original
picker icon uses the geometric site-mark source directly, with its exact six
tile colours, order and spacing; the -8° turn uses whole-pixel sampling and a
binary mask. No pixels are extracted from the AI rendering of that logo. No inherited artwork is included.

## Native validation

Browser and 8-bit simulation are review aids. Native checks and their exact-byte
scopes are recorded in [classic/README.md](../classic/README.md).
