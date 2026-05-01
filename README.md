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

A minimal entity looks like this:

```json
{
  "matt": {
    "width": 22,
    "height": 32,
    "colors": {
      " ": false,
      "#": "#ffffff",
      "*": "#d9754c"
    },
    "animation": {
      "walkRight": {
        "type": "sprite",
        "sprites": [
          ["...row 0...", "...row 1...", "..."],
          ["...row 0...", "...row 1...", "..."]
        ]
      },
      "walkLeft": {
        "type": "clone",
        "source": "walkRight",
        "transform": "horizontalMirror"
      }
    },
    "timelines": {
      "walk cycle": [
        { "animName": "walkRight",  "duration": 2000 },
        { "animName": "rotateLeft", "duration": 70   },
        { "animName": "frontView",  "duration": 70   }
      ]
    }
  }
}
```

### Fields

- **`width` / `height`** — sprite dimensions in pixels; every row in every sprite must match.
- **`colors`** — character → color map. `false` marks transparency; any other value is a CSS color string. The space character is allowed as a key.
- **`animation`** — named animations:
  - **`type: "sprite"`** has an array `sprites`, each sprite is an array of `height` strings, each of length `width`. Characters reference keys in `colors`.
  - **`type: "clone"`** has `source` (another animation name) and `transform` (currently `"horizontalMirror"`). Clone animations are read-only in the editor.
- **`timelines`** — named playback sequences. Each entry is an array of `{ animName, duration }` steps. `duration` is the total time spent on that animation step, in ms; the editor cycles its sprites at the global frame interval until the duration is up.

## Running

The project is served as static files (one PHP entry point that includes no server-side logic). Drop the directory into any web server (Apache, nginx, `php -S`, etc.) and open `index.php`.

On startup the editor attempts to auto-load a JSON file from a configured remote URL. If that fails, use **Import JSON** to paste content or load a file.

## Editor controls

- **Palette** — click a color to make it active.
- **Tools** — Flood fill or Pencil. Use Shift ← / Shift → to roll the current sprite horizontally.
- **Undo / Redo** — Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y).
- **Animation / Sprite** — bottom bar selects which animation and which frame within it you are editing. `+ New sprite` duplicates the current frame.
- **Timeline** — pick the active timeline from the dropdown, add new ones with `+`, delete with `✕`. Each row picks an animation and a duration; reorder with ↑ / ↓ and remove with ✕. Toggle **Loop** to repeat the timeline indefinitely.
- **Preview** — adjust the per-frame interval (ms), then **Play** / **Pause**. The currently active timeline step is highlighted while playing.

## Persistence

All edits — sprites, palette, timelines — live in a single in-memory JSON object. Use **Export JSON** to copy or download the result.

## Related projects

- [svision](https://github.com/mitrenga/svision) — the rendering library that consumes the JSON produced by this editor.
