# Animator

A browser-based sprite editor and animation timeline tool for designing pixel-art entities and chaining their animations into named, reusable sequences.

## Overview

Animator is a single-page web application for editing sprite-based animations stored in a simple JSON format. It provides:

- **Sprite editor** — flood fill and pencil tools, undo/redo, horizontal pixel shifting, palette-driven colors with transparency support
- **Multi-frame animations** — add/remove sprites within an animation, navigate between frames
- **Clone animations** — derive an animation from another by transformation (e.g. horizontal mirror)
- **Named timelines** — chain animations into sequences with per-step durations; create, switch, and delete multiple timelines per entity
- **Live preview** — animated playback of the active timeline with adjustable per-frame timing
- **Import / export** — paste JSON, drop a file, or download the result

## Data format

The JSON structure is the same one consumed by the [svision](https://github.com/mitrenga/svision) library. svision is the runtime that renders these animations in production; Animator is the authoring tool. Anything you export here can be loaded directly by svision.

A minimal file looks like this:

```json
{
  "colors": {
    " ": false,
    "#": "#ffffff",
    "*": "#d9754c"
  },
  "sprites": {
    "matthewWalking": {
      "width": 22,
      "height": 32,
      "clips": {
        "right": {
          "type": "sprite",
          "sprites": [
            ["...row 0...", "...row 1...", "..."],
            ["...row 0...", "...row 1...", "..."]
          ]
        },
        "left": {
          "type": "clone",
          "source": "right",
          "transform": "horizontalMirror"
        }
      },
      "timelines": {
        "walkCycle": [
          { "clip": "right",     "duration": 2000 },
          { "clip": "turnLeft",  "duration": 70   },
          { "clip": "frontView", "duration": 70   }
        ]
      }
    }
  }
}
```

### Fields

- **`colors`** (top-level) — character → color map shared by every sprite in the file. `false` marks transparency; any other value is a CSS color string. The space character is allowed as a key.
- **`sprites`** (top-level) — map of named sprites. Each sprite has its own dimensions, clips, and timelines.
  - **`width` / `height`** — pixel dimensions; every row in every clip frame is truncated or padded to match on load.
  - **`clips`** — named animations:
    - **`type: "sprite"`** has an array `sprites`, each frame is an array of `height` strings of length `width`. Characters reference keys in the top-level `colors` map.
    - **`type: "clone"`** has `source` (another clip name within the same sprite) and `transform` (currently `"horizontalMirror"`). Clone clips are read-only in the editor.
  - **`timelines`** — named playback sequences. Each entry is an array of `{ clip, duration }` steps. `duration` is the total time spent on that clip step, in ms; the editor cycles the clip's frames at the global frame interval until the duration is up.

## Running

The project is served as static files (one PHP entry point that includes no server-side logic). Drop the directory into any web server (Apache, nginx, `php -S`, etc.) and open `index.php`.

On startup the editor fetches `data/spritesMap.json` (relative to the configured remote base URL) and uses it to populate the **sprite selector** in the header. The map lists which file and which sprite key to load, grouped by category:

```json
{
  "moon": [
    { "file": "data/moon01/global.json", "sprite": "matthewWalking" },
    { "file": "data/moon01/global.json", "sprite": "matthewFalling" }
  ],
  "earth": [
    { "file": "data/earth01/global.json", "sprite": "matthewJumping" }
  ]
}
```

Each entry shows in the dropdown as `category / file / sprite`. The first entry loads by default; switching the dropdown re-fetches the corresponding file and focuses on the chosen sprite key. If the map can't be loaded, the dropdown shows the failure reason and you can fall back to **Import JSON**.

## Editor controls

- **Palette** — click a color to make it active.
- **Tools** — Flood fill or Pencil. Use Shift ← / Shift → to roll the current sprite horizontally.
- **Undo / Redo** — Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y).
- **Sprite selector** (header) — switch between sprites listed in `spritesMap.json`; selecting a different entry reloads its file.
- **Animation / Sprite** — bottom bar selects which clip and which frame within it you are editing. `+ New sprite` duplicates the current frame.
- **Timeline** — pick the active timeline from the dropdown, add new ones with `+`, delete with `✕`. Each row picks a clip and a duration; reorder with ↑ / ↓ and remove with ✕. Toggle **Loop** to repeat the timeline indefinitely.
- **Preview** — adjust the per-frame interval (ms), then **Play** / **Pause**. The currently active timeline step is highlighted while playing.

## Persistence

All edits — sprites, palette, timelines — live in a single in-memory JSON object. Use **Export JSON** to copy or download the result.

## Related projects

- [svision](https://github.com/mitrenga/svision) — the rendering library that consumes the JSON produced by this editor.
