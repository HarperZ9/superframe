# The Studio

Paint the game's portraits by hand over our own renders. The Studio renders a sitter, lays the portrait
painter's underpainting as the first layer, and gives you oil brushes, a knife, a smudge, liquify and a
lasso to paint and reshape over it. Everything you do is recorded, so the painting rebuilds exactly from
its record and follows the sitter to another age, era, camera or light.

## Start

```
node tools/studio/serve.mjs            # port 8810 (the Studio keeps to 8810 to 8819)
```

Open `http://127.0.0.1:8810/tools/studio/`. Add `?who=will` for another sitter, `?load=ned@e2` to open a
saved painting, or `?plate=content/office/late.png` to paint over a place or prop.

## A first portrait

1. Pick the person under **Sitter**. **Turn** sets which way they face (negative is the viewer's right,
   as the talk panel wants); **Key around** and **Key height** move the light. Press **New sitting**.
2. The canvas shows the underpainting. Its strokes are the light side's character; keep what you like.
3. Paint on the **paint** layer. Start with the eyes, the mouth and the shadow side's big shape.
4. Use **Underpainting and paint** to choose, per region, how much of your paint shows over the
   underpainting's own strokes.
5. To fix a proportion, use **liquify** (push, pull, pinch, bloat) or **lasso** a part and move, scale or
   rotate it. Both reshape every layer, the underpainting too.
6. **Add mood override** gives a mood its own region to repaint; the rest of the face stays your one base.
7. **Export portraits** writes the set the game reads, and saves the source.

## Keys

| Key | Does |
| --- | --- |
| b, k, s, e | brush, knife, smudge, eraser |
| l, a, i | liquify, lasso, eyedropper (Alt-click picks with any brush) |
| [ and ] | brush size (or liquify radius) |
| g | greyscale, to check values |
| r, Shift+r, x, 0 | rotate the view, back, mirror it, reset it (the painting does not change) |
| Space-drag or middle drag | pan; the wheel zooms |
| Ctrl+Z, Ctrl+Shift+Z | undo, redo |

## Brushes

The presets are a starting point: **bristle round** (streaky, loaded), **soft blender** (wet into the
layers below), **rigger** (thin lines), **light stroke** (loads with the colour already on the canvas,
lifted toward the lamp's colour, with broken edges, the way the underpainting lays its lights),
**palette knife** and **glaze wash**. Set a brush the way you like it and **Save as** keeps it with this
sitter. A glaze layer has three modes: glaze (changes hue, keeps value), multiply (darkens), screen
(lifts). A new mask shows all of its layer; paint it with the eraser to hide, the brush to show again.

## Testing with a pen tablet (for the author)

The Studio reads the pen through the browser's Pointer Events; nothing to install. It has been tested
with synthetic pen events and a mouse only, so these are the checks to make with a real pen:

1. **Pressure reaches the Studio.** The top bar shows `pen pressure 0.00` to `1.00` while you hover and
   draw. If it says `mouse`, the tablet driver is sending mouse events: in the driver, turn on Windows Ink
   (Wacom) or the equivalent, and use Chrome or Edge.
2. **Pressure changes the stroke.** Draw one line pressing lightly and one pressing hard with the bristle
   round preset. The hard line should be about two and a half times as wide and more opaque. The brush ring on the
   canvas grows with pressure as you draw.
3. **No lag at speed.** Draw fast circles. The stroke should follow without corners; if it lags, lower
   **Size** or **Bristles** and tell us the canvas size and machine.
4. **The pen's side button.** Many drivers map it to right-click; the Studio ignores right-click, so map
   it to Alt (eyedropper) or Space (pan) in the driver if you want those on the pen.
5. **Rotated view.** Press `r` twice and draw: the paint must land under the pen tip, as without rotation.
6. **Palm and touch.** If the tablet has touch, turn touch off in the driver while painting; a palm
   counts as a pointer.

Write down what felt wrong (too thin at light pressure, too slow to load, edges too hard) with the preset
name; each is a number we can change.

## For developers

The core (`core/`) runs in Node and the browser; the app is `ui/`; scripted paint-overs are `script/`;
command-line runs are `bin/` (run them under the heavy-cpu lock, see the header of each). Tests:
`node --test tools/studio/tests/*.test.mjs`. The release build rebuilds every portrait from its source
and can check the images: `node tools/studio/bin/build.mjs --check`.
