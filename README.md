# Animator

A browser-based sprite editor and animation timeline tool for designing pixel-art entities and chaining their animations into named, reusable sequences.

## Overview

Animator is a single-page web application for editing sprite-based animations stored in a simple JSON format. It provides:

- **Sprite editor** — flood fill and pencil tools, undo/redo, horizontal pixel shifting, palette-driven colors with transparency support
- **Multi-frame clips** — add/remove frames within a clip, navigate between them
- **Clone clips** — derive a clip from another by transformation (e.g. horizontal mirror)
- **Named timelines** — chain clips into sequences with per-step durations; create, switch, and delete multiple timelines per sprite
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
  - **`timelines`** — named playback sequences. Each entry is an array of `{ clip, duration }` steps. `duration` is the total time spent on that clip step, in ms; by default the editor cycles the clip's frames at the global frame interval until the duration is up. A step may include:
    - **`sprite`** — reference a clip from another sprite definition in the same file (e.g. `{ "sprite": "matthewFalling", "clip": "right", "duration": 70 }`). When omitted, the clip is resolved against the sprite that owns the timeline.
    - **`frame`** — pin the step to a single frame index instead of cycling all frames (e.g. `{ "clip": "right", "frame": 0, "duration": 200 }`). Frames are zero-based; out-of-range values are reported as warnings.

## Running

The project is served as static files (one PHP entry point that includes no server-side logic). Drop the directory into any web server (Apache, nginx, `php -S`, etc.) and open `index.php`.

On startup the editor fetches `data/spritesMap.json` (relative to the configured remote base URL) and uses it to populate the **sprite selector** in the header. The map groups sprites by scene; each scene lists one or more files, and each file lists the sprite keys exposed for editing:

```json
{
  "scenes": {
    "moon": {
      "files": [
        {
          "file": "data/moon01/global.json",
          "sprites": [
            "matthewWalking",
            "matthewFalling",
            "matthewJumping",
            "matthewFlipping"
          ]
        }
      ]
    }
  }
}
```

Every (scene, file, sprite) combination becomes a dropdown entry shown as `scene / file / sprite`. The first entry loads by default. Switching the dropdown reuses the in-memory data when the target sprite is already loaded (preserves edits and imports without re-fetching) and only re-fetches the file when the sprite isn't present. After **Import JSON**, the dropdown is synced to the imported entity. If the map can't be loaded, the dropdown shows the failure reason and you can fall back to **Import JSON**.

## Editor controls

- **Palette** — click a color to make it active.
- **Tools** — Flood fill or Pencil. Use Shift ← / Shift → to roll the current sprite horizontally.
- **Undo / Redo** — Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y).
- **Sprite selector** (header) — switch between sprites listed in `spritesMap.json`; selecting a different entry reloads its file.
- **Animation / Sprite** — bottom bar selects which clip and which frame within it you are editing. `+ New sprite` duplicates the current frame.
- **Timeline** — pick the active timeline from the dropdown, add new ones with `+`, delete with `✕`. Each row picks a clip, a frame, and a duration; the clip dropdown is grouped by sprite so you can reference clips from other sprite definitions in the same file. The frame dropdown defaults to **(all)** (cycle through every frame) but can be pinned to a specific frame index. Reorder rows with ↑ / ↓ and remove with ✕. Toggle **Loop** to repeat the timeline indefinitely.
- **Preview** — adjust the per-frame interval (ms), then **Play** / **Pause**. The currently active timeline step is highlighted while playing.

## Persistence

All edits — sprites, palette, timelines — live in a single in-memory JSON object. Use **Export JSON** to copy or download the result.

## Related projects

- [svision](https://github.com/mitrenga/svision) — the rendering library that consumes the JSON produced by this editor.
