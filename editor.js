'use strict';

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  data: null,         // raw parsed JSON root object
  entityKey: null,    // e.g. "matt"
  currentAnim: null,  // animation name string
  currentFrame: 0,    // sprite index within animation
  activeColor: null,  // selected palette char
  tool: 'flood',      // 'flood' | 'pencil'
  zoom: 8,

  // undo/redo — each entry is a string[] (clone of sprite rows)
  undoStack: [],
  redoStack: [],

  // pencil drag
  isPainting: false,
  pencilSnapshot: null,

  currentTimeline: null, // active timeline name

  // preview playback
  previewPlaying: false,
  previewRafId: null,
  previewStep: 0,      // index in timeline
  previewFrame: 0,     // frame index within current anim
  previewElapsed: 0,   // ms elapsed in current timeline step
  previewLastTs: null,
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const editorCanvas  = document.getElementById('editorCanvas');
const ctx           = editorCanvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const pctx          = previewCanvas.getContext('2d');
const paletteEl     = document.getElementById('palette');
const animSelect    = document.getElementById('animSelect');
const spriteSelect  = document.getElementById('spriteSelect');
const zoomSlider    = document.getElementById('zoomSlider');
const zoomValue     = document.getElementById('zoomValue');
const hoverInfo     = document.getElementById('hover-info');
const timelineBody  = document.getElementById('timelineBody');
const loopSlider    = document.getElementById('loopSlider');
const loopMsEl      = document.getElementById('loopMs');
const canvasWrap    = document.getElementById('canvas-wrap');
const readonlyBadge = document.getElementById('readonly-badge');

// ─── Accessors ────────────────────────────────────────────────────────────────

function entity()     { return state.data[state.entityKey]; }
function colors()     { return entity().colors; }
function W()          { return entity().width; }
function H()          { return entity().height; }
function anims()      { return entity().animation; }
function timelines()  { return entity().timelines; }

function currentAnim() { return anims()[state.currentAnim]; }

function resolvedSprites(animName) {
  const anim = anims()[animName];
  if (!anim) return [];
  if (anim.type === 'sprite') return anim.sprites;
  if (anim.type === 'clone') {
    const src = anims()[anim.source];
    if (!src || src.type !== 'sprite') return [];
    if (anim.transform === 'horizontalMirror') {
      return src.sprites.map(sprite => sprite.map(row => row.split('').reverse().join('')));
    }
    return src.sprites;
  }
  return [];
}

function currentSprites() { return resolvedSprites(state.currentAnim); }

function currentSprite() {
  const sprites = currentSprites();
  if (!sprites.length) return null;
  return sprites[Math.min(state.currentFrame, sprites.length - 1)];
}

function isEditable() {
  const a = currentAnim();
  return a && a.type === 'sprite';
}

// ─── Sprite clone helpers ─────────────────────────────────────────────────────

function cloneSprite(sprite) { return sprite.slice(); }

function applySprite(sprite) {
  const a = currentAnim();
  if (!a || a.type !== 'sprite') return;
  const idx = Math.min(state.currentFrame, a.sprites.length - 1);
  a.sprites[idx] = sprite;
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

function pushUndo() {
  const sp = currentSprite();
  if (!sp) return;
  state.undoStack.push(cloneSprite(sp));
  if (state.undoStack.length > 20) state.undoStack.shift();
  state.redoStack = [];
}

document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnRedo').addEventListener('click', redo);

function undo() {
  if (!state.undoStack.length) return;
  const cur = currentSprite();
  if (cur) state.redoStack.push(cloneSprite(cur));
  applySprite(state.undoStack.pop());
  renderEditor();
}

function redo() {
  if (!state.redoStack.length) return;
  const cur = currentSprite();
  if (cur) state.undoStack.push(cloneSprite(cur));
  applySprite(state.redoStack.pop());
  renderEditor();
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
});

// ─── Flood fill ───────────────────────────────────────────────────────────────

function floodFill(grid, r0, c0, newChar) {
  const target = grid[r0][c0];
  if (target === newChar) return;
  const height = grid.length;
  const width  = grid[0].length;
  const queue   = [[r0, c0]];
  const visited = new Set();
  while (queue.length) {
    const [r, c] = queue.shift();
    const key = r + ',' + c;
    if (visited.has(key)) continue;
    if (r < 0 || r >= height || c < 0 || c >= width) continue;
    if (grid[r][c] !== target) continue;
    visited.add(key);
    grid[r][c] = newChar;
    queue.push([r-1,c],[r+1,c],[r,c-1],[r,c+1]);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function drawCheckerboard(targetCtx, x, y, size) {
  const h = size / 2;
  targetCtx.fillStyle = '#1a1a1a';
  targetCtx.fillRect(x, y, size, size);
  if (size >= 4) {
    targetCtx.fillStyle = '#111111';
    targetCtx.fillRect(x,     y,     h, h);
    targetCtx.fillRect(x + h, y + h, h, h);
  }
}

function renderSpriteToCtx(targetCtx, sprite, zoom) {
  const h = sprite.length;
  const w = sprite[0] ? sprite[0].length : W();
  targetCtx.canvas.width  = w * zoom;
  targetCtx.canvas.height = h * zoom;

  const colorMap = colors();
  for (let r = 0; r < h; r++) {
    const row = sprite[r] || '';
    for (let c = 0; c < w; c++) {
      const ch    = row[c] !== undefined ? row[c] : ' ';
      const color = colorMap[ch];
      const px    = c * zoom;
      const py    = r * zoom;
      if (color === false || color === undefined) {
        drawCheckerboard(targetCtx, px, py, zoom);
      } else {
        targetCtx.fillStyle = color;
        targetCtx.fillRect(px, py, zoom, zoom);
      }
    }
  }
}

function renderEditor() {
  const sprite = currentSprite();
  if (!sprite) return;
  renderSpriteToCtx(ctx, sprite, state.zoom);
}

function renderPreviewFrame(sprite) {
  if (!sprite) return;
  renderSpriteToCtx(pctx, sprite, 3);
}

// ─── Palette ──────────────────────────────────────────────────────────────────

function buildPalette() {
  paletteEl.innerHTML = '';
  const colorMap = colors();
  for (const [ch, hex] of Object.entries(colorMap)) {
    const btn = document.createElement('button');
    btn.className = 'palette-btn';
    btn.dataset.char = ch;

    const swatch = document.createElement('span');
    swatch.className = 'swatch' + (hex === false ? ' transparent' : '');
    if (hex !== false) swatch.style.background = hex;

    const lbl = document.createElement('span');
    lbl.textContent = ch === ' ' ? '(space)' : ch;

    btn.append(swatch, lbl);
    btn.addEventListener('click', () => selectColor(ch));
    paletteEl.appendChild(btn);
  }
  // Default: first solid color
  const first = Object.entries(colorMap).find(([, v]) => v !== false);
  if (first) selectColor(first[0]);
}

function selectColor(ch) {
  state.activeColor = ch;
  document.querySelectorAll('.palette-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.char === ch);
  });
}

// ─── Animation / sprite selects ───────────────────────────────────────────────

function buildAnimSelect() {
  animSelect.innerHTML = '';
  for (const [name, anim] of Object.entries(anims())) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name + (anim.type === 'clone' ? ' (clone)' : '');
    animSelect.appendChild(opt);
  }
  animSelect.value = state.currentAnim;
}

function buildSpriteSelect() {
  spriteSelect.innerHTML = '';
  const sprites = currentSprites();
  sprites.forEach((_, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    spriteSelect.appendChild(opt);
  });
  spriteSelect.value = Math.min(state.currentFrame, sprites.length - 1);
}

function updateReadonlyUI() {
  const editable = isEditable();
  canvasWrap.classList.toggle('readonly', !editable);
  readonlyBadge.style.display = editable ? 'none' : '';
}

animSelect.addEventListener('change', () => {
  state.currentAnim  = animSelect.value;
  state.currentFrame = 0;
  state.undoStack    = [];
  state.redoStack    = [];
  buildSpriteSelect();
  updateReadonlyUI();
  renderEditor();
});

spriteSelect.addEventListener('change', () => {
  state.currentFrame = parseInt(spriteSelect.value);
  state.undoStack    = [];
  state.redoStack    = [];
  renderEditor();
});

document.getElementById('btnPrevSprite').addEventListener('click', () => {
  if (state.currentFrame > 0) {
    state.currentFrame--;
    spriteSelect.value = state.currentFrame;
    state.undoStack = [];
    state.redoStack = [];
    renderEditor();
  }
});

document.getElementById('btnNextSprite').addEventListener('click', () => {
  const max = currentSprites().length - 1;
  if (state.currentFrame < max) {
    state.currentFrame++;
    spriteSelect.value = state.currentFrame;
    state.undoStack = [];
    state.redoStack = [];
    renderEditor();
  }
});

document.getElementById('btnNewSprite').addEventListener('click', () => {
  const a = currentAnim();
  if (!a || a.type !== 'sprite') return;
  const copy = cloneSprite(currentSprite());
  a.sprites.splice(state.currentFrame + 1, 0, copy);
  state.currentFrame++;
  buildSpriteSelect();
  renderEditor();
});

document.getElementById('btnDeleteSprite').addEventListener('click', () => {
  const a = currentAnim();
  if (!a || a.type !== 'sprite') return;
  if (a.sprites.length <= 1) return;
  a.sprites.splice(state.currentFrame, 1);
  state.currentFrame = Math.min(state.currentFrame, a.sprites.length - 1);
  buildSpriteSelect();
  state.undoStack = [];
  state.redoStack = [];
  renderEditor();
});

// ─── Canvas interaction ───────────────────────────────────────────────────────

function pixelAt(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left)  / state.zoom);
  const r = Math.floor((e.clientY - rect.top)   / state.zoom);
  return { r, c };
}

function inBounds(r, c) {
  return r >= 0 && r < H() && c >= 0 && c < W();
}

function paintPixel(r, c) {
  if (!inBounds(r, c)) return;
  const sprite = currentSprite();
  const grid   = sprite.map(row => row.split(''));
  grid[r][c]   = state.activeColor;
  applySprite(grid.map(row => row.join('')));
}

editorCanvas.addEventListener('mousemove', e => {
  const { r, c } = pixelAt(e);
  const sprite = currentSprite();
  if (!sprite || !inBounds(r, c)) {
    hoverInfo.textContent = '— , —';
    return;
  }
  const ch = (sprite[r] || '')[c] || ' ';
  hoverInfo.textContent = `r=${r}  c=${c}  "${ch === ' ' ? '(sp)' : ch}"`;

  if (state.isPainting && state.tool === 'pencil' && isEditable()) {
    paintPixel(r, c);
    renderEditor();
  }
});

editorCanvas.addEventListener('mouseleave', () => {
  hoverInfo.textContent = '— , —';
  if (state.isPainting) finishPencil();
});

editorCanvas.addEventListener('mousedown', e => {
  if (!isEditable()) return;
  const { r, c } = pixelAt(e);
  if (!inBounds(r, c)) return;

  if (state.tool === 'flood') {
    pushUndo();
    const sprite = currentSprite();
    const grid   = sprite.map(row => row.split(''));
    floodFill(grid, r, c, state.activeColor);
    applySprite(grid.map(row => row.join('')));
    renderEditor();
  } else if (state.tool === 'pencil') {
    state.isPainting     = true;
    state.pencilSnapshot = cloneSprite(currentSprite());
    paintPixel(r, c);
    renderEditor();
  }
});

editorCanvas.addEventListener('mouseup', () => {
  if (state.isPainting) finishPencil();
});

function finishPencil() {
  if (state.pencilSnapshot) {
    state.undoStack.push(state.pencilSnapshot);
    if (state.undoStack.length > 20) state.undoStack.shift();
    state.redoStack     = [];
    state.pencilSnapshot = null;
  }
  state.isPainting = false;
}

// ─── Tool radio ───────────────────────────────────────────────────────────────

document.querySelectorAll('input[name="tool"]').forEach(r => {
  r.addEventListener('change', () => { state.tool = r.value; });
});

// ─── Shift ────────────────────────────────────────────────────────────────────

document.getElementById('btnShiftLeft').addEventListener('click', () => {
  if (!isEditable()) return;
  pushUndo();
  const shifted = currentSprite().map(row => row.slice(1) + row[0]);
  applySprite(shifted);
  renderEditor();
});

document.getElementById('btnShiftRight').addEventListener('click', () => {
  if (!isEditable()) return;
  pushUndo();
  const shifted = currentSprite().map(row => row[row.length - 1] + row.slice(0, -1));
  applySprite(shifted);
  renderEditor();
});

// ─── Zoom ─────────────────────────────────────────────────────────────────────

zoomSlider.addEventListener('input', () => {
  state.zoom = parseInt(zoomSlider.value);
  zoomValue.textContent = state.zoom;
  renderEditor();
});

// ─── Preview animation ────────────────────────────────────────────────────────

loopSlider.addEventListener('input', () => {
  loopMsEl.textContent = loopSlider.value;
});

document.getElementById('btnPlay').addEventListener('click',  startPreview);
document.getElementById('btnPause').addEventListener('click', stopPreview);

function startPreview() {
  if (state.previewPlaying) return;
  state.previewPlaying  = true;
  state.previewLastTs   = null;
  state.previewRafId    = requestAnimationFrame(previewTick);
}

function stopPreview() {
  state.previewPlaying = false;
  if (state.previewRafId) { cancelAnimationFrame(state.previewRafId); state.previewRafId = null; }
}

function previewTick(ts) {
  if (!state.previewPlaying) return;

  if (state.previewLastTs === null) state.previewLastTs = ts;
  const delta = ts - state.previewLastTs;
  state.previewLastTs = ts;

  const timeline      = getTimeline();
  const frameDuration = parseInt(loopSlider.value) || 70;

  if (!timeline.length) {
    state.previewRafId = requestAnimationFrame(previewTick);
    return;
  }

  // Clamp step index
  if (state.previewStep >= timeline.length) state.previewStep = 0;

  const step    = timeline[state.previewStep];
  const sprites = resolvedSprites(step.animName);

  if (sprites.length) {
    // Which frame to show?
    const frameIdx = Math.floor(state.previewElapsed / frameDuration) % sprites.length;
    renderPreviewFrame(sprites[frameIdx]);
    state.previewFrame = frameIdx;
  }

  // Highlight active timeline row
  document.querySelectorAll('#timelineBody tr').forEach((tr, i) => {
    tr.classList.toggle('active-step', i === state.previewStep);
  });

  state.previewElapsed += delta;

  // Advance to next step when duration exhausted
  if (state.previewElapsed >= step.duration) {
    state.previewElapsed = 0;
    state.previewFrame   = 0;
    state.previewStep++;
    if (state.previewStep >= timeline.length) {
      if (document.getElementById('timelineLoop').checked) {
        state.previewStep = 0;
      } else {
        stopPreview();
        return;
      }
    }
  }

  state.previewRafId = requestAnimationFrame(previewTick);
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function saveCurrentTimeline() {
  if (!state.currentTimeline) return;
  timelines()[state.currentTimeline] = getTimeline();
}

// timeline lives in the DOM; getTimeline() reads it fresh each time
function getTimeline() {
  const rows = [];
  document.querySelectorAll('#timelineBody tr').forEach(tr => {
    const sel = tr.querySelector('select');
    const inp = tr.querySelector('input[type="number"]');
    if (sel && inp) rows.push({ animName: sel.value, duration: parseInt(inp.value) || 70 });
  });
  return rows;
}

function buildTimelineSelect() {
  const sel = document.getElementById('timelineSelect');
  sel.innerHTML = '';
  for (const name of Object.keys(timelines())) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  }
  sel.value = state.currentTimeline;
  document.getElementById('btnDeleteTimeline').disabled = Object.keys(timelines()).length <= 1;
}

function loadCurrentTimeline() {
  const available = new Set(Object.keys(anims()));
  const steps = (timelines()[state.currentTimeline] || []).filter(s => available.has(s.animName));
  buildTimeline(steps);
}

function buildTimeline(steps) {
  timelineBody.innerHTML = '';
  steps.forEach((step, i) => addTimelineRow(step, i));
}

function rebuildIndices() {
  document.querySelectorAll('#timelineBody tr').forEach((tr, i) => {
    tr.querySelector('.step-num').textContent = i + 1;
  });
}

function addTimelineRow(step, i) {
  const tr  = document.createElement('tr');

  const tdN = document.createElement('td');
  tdN.className = 'step-num';
  tdN.textContent = (i !== undefined ? i : timelineBody.children.length) + 1;

  const tdA = document.createElement('td');
  const sel = document.createElement('select');
  for (const name of Object.keys(anims())) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  }
  sel.value = step.animName;
  tdA.appendChild(sel);

  const tdD = document.createElement('td');
  const inp = document.createElement('input');
  inp.type  = 'number'; inp.min = 10; inp.value = step.duration;
  tdD.appendChild(inp);

  const tdX = document.createElement('td');
  const btnUp  = document.createElement('button'); btnUp.textContent  = '↑';
  const btnDn  = document.createElement('button'); btnDn.textContent  = '↓';
  const btnDel = document.createElement('button'); btnDel.textContent = '✕';

  btnUp.addEventListener('click', () => {
    if (!tr.previousElementSibling) return;
    timelineBody.insertBefore(tr, tr.previousElementSibling);
    rebuildIndices();
    saveCurrentTimeline();
  });
  btnDn.addEventListener('click', () => {
    if (!tr.nextElementSibling) return;
    timelineBody.insertBefore(tr.nextElementSibling, tr);
    rebuildIndices();
    saveCurrentTimeline();
  });
  btnDel.addEventListener('click', () => {
    if (timelineBody.children.length <= 1) return;
    tr.remove();
    rebuildIndices();
    saveCurrentTimeline();
  });
  sel.addEventListener('change', saveCurrentTimeline);
  inp.addEventListener('change', saveCurrentTimeline);

  tdX.append(btnUp, btnDn, btnDel);
  tr.append(tdN, tdA, tdD, tdX);
  timelineBody.appendChild(tr);
}

document.getElementById('btnAddStep').addEventListener('click', () => {
  const firstAnim = Object.keys(anims())[0];
  addTimelineRow({ animName: firstAnim, duration: 70 });
  rebuildIndices();
  saveCurrentTimeline();
});

document.getElementById('timelineSelect').addEventListener('change', e => {
  state.currentTimeline = e.target.value;
  state.previewStep = 0;
  state.previewElapsed = 0;
  loadCurrentTimeline();
});

document.getElementById('btnNewTimeline').addEventListener('click', () => {
  const name = prompt('Timeline name:');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (timelines()[trimmed]) { alert('Timeline "' + trimmed + '" already exists.'); return; }
  timelines()[trimmed] = [];
  state.currentTimeline = trimmed;
  state.previewStep = 0;
  state.previewElapsed = 0;
  buildTimelineSelect();
  loadCurrentTimeline();
});

document.getElementById('btnDeleteTimeline').addEventListener('click', () => {
  const tl = timelines();
  const names = Object.keys(tl);
  if (names.length <= 1) return;
  if (!confirm('Delete timeline "' + state.currentTimeline + '"?')) return;
  delete tl[state.currentTimeline];
  state.currentTimeline = Object.keys(tl)[0];
  state.previewStep = 0;
  state.previewElapsed = 0;
  buildTimelineSelect();
  loadCurrentTimeline();
});

function defaultTimeline() {
  if (!entity().timelines) entity().timelines = {};
  const tl = timelines();
  if (!Object.keys(tl).length) {
    const available = new Set(Object.keys(anims()));
    const seed = [
      { animName: 'walkRight',  duration: 2000 },
      { animName: 'rotateLeft', duration: 70   },
      { animName: 'frontView',  duration: 70   },
      { animName: 'rotateRight',duration: 70   },
      { animName: 'walkLeft',   duration: 2000 },
      { animName: 'rotateRight',duration: 70   },
      { animName: 'frontView',  duration: 70   },
      { animName: 'rotateLeft', duration: 70   },
    ].filter(s => available.has(s.animName));
    tl['default'] = seed;
  }
  state.currentTimeline = Object.keys(tl)[0];
  buildTimelineSelect();
  loadCurrentTimeline();
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function openDialog(id) { document.getElementById(id).style.display = 'flex'; }
function closeDialog(id) { document.getElementById(id).style.display = 'none'; }

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeDialog(btn.dataset.close));
});

document.querySelectorAll('.dialog-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeDialog(overlay.id);
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.dialog-overlay').forEach(d => {
      if (d.style.display !== 'none') closeDialog(d.id);
    });
  }
});

// ─── Import dialog ────────────────────────────────────────────────────────────

const importArea  = document.getElementById('importArea');
const importDrop  = document.getElementById('importDrop');
const importError = document.getElementById('importError');

document.getElementById('btnImport').addEventListener('click', () => {
  importArea.value = '';
  importError.style.display = 'none';
  openDialog('dlgImport');
  importArea.focus();
});

// File picker inside import dialog
document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  readFileIntoArea(file);
  e.target.value = '';
});

// Drag & drop onto the drop zone
importDrop.addEventListener('dragover', e => {
  e.preventDefault();
  importDrop.classList.add('dragging');
});
importDrop.addEventListener('dragleave', e => {
  if (!importDrop.contains(e.relatedTarget)) importDrop.classList.remove('dragging');
});
importDrop.addEventListener('drop', e => {
  e.preventDefault();
  importDrop.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) readFileIntoArea(file);
});

function readFileIntoArea(file) {
  const reader = new FileReader();
  reader.onload = ev => { importArea.value = ev.target.result; };
  reader.readAsText(file);
}

document.getElementById('btnImportLoad').addEventListener('click', () => {
  const text = importArea.value.trim();
  if (!text) return;
  try {
    const data = JSON.parse(text);
    loadData(data);
    closeDialog('dlgImport');
  } catch (err) {
    importError.textContent = 'Error: ' + err.message;
    importError.style.display = '';
  }
});

// ─── Export dialog ────────────────────────────────────────────────────────────

const exportArea = document.getElementById('exportArea');

document.getElementById('btnExport').addEventListener('click', () => {
  exportArea.value = JSON.stringify(state.data, null, 2);
  openDialog('dlgExport');
  exportArea.select();
});

document.getElementById('btnExportDownload').addEventListener('click', () => {
  const blob = new Blob([exportArea.value], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'global.json'; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btnExportCopy').addEventListener('click', () => {
  navigator.clipboard.writeText(exportArea.value).then(() => {
    const btn = document.getElementById('btnExportCopy');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(data) {
  const errors = [];
  for (const [eKey, ent] of Object.entries(data)) {
    if (!ent.colors || !ent.animation) continue;
    const w    = ent.width;
    const h    = ent.height;
    const keys = new Set(Object.keys(ent.colors));
    for (const [animName, anim] of Object.entries(ent.animation)) {
      if (anim.type !== 'sprite') continue;
      anim.sprites.forEach((sprite, si) => {
        if (sprite.length !== h) {
          errors.push(`${eKey}/${animName}[${si}]: got ${sprite.length} rows, expected ${h}`);
        }
        sprite.forEach((row, ri) => {
          if (row.length !== w) {
            errors.push(`${eKey}/${animName}[${si}]/r${ri}: length ${row.length}, expected ${w}`);
          }
          for (let ci = 0; ci < row.length; ci++) {
            if (!keys.has(row[ci])) {
              errors.push(`${eKey}/${animName}[${si}]/r${ri}/c${ci}: unknown char '${row[ci]}'`);
            }
          }
        });
      });
    }
  }
  return errors;
}

// ─── Load ─────────────────────────────────────────────────────────────────────

function loadData(data) {
  const errors = validate(data);
  if (errors.length) {
    const msg = `Warnings (${errors.length}):\n` + errors.slice(0, 15).join('\n') +
      (errors.length > 15 ? `\n...and ${errors.length - 15} more` : '');
    if (!confirm(msg + '\n\nLoad anyway?')) return;
  }

  stopPreview();

  state.data       = data;
  state.entityKey  = Object.keys(data)[0];
  state.currentAnim  = Object.keys(anims())[0];
  state.currentFrame = 0;
  state.undoStack  = [];
  state.redoStack  = [];

  // Reset preview
  state.previewStep    = 0;
  state.previewFrame   = 0;
  state.previewElapsed = 0;
  state.previewLastTs  = null;

  buildPalette();
  buildAnimSelect();
  buildSpriteSelect();
  updateReadonlyUI();
  defaultTimeline();
  renderEditor();

  // Show first frame in preview without playing
  const sprites = resolvedSprites(state.currentAnim);
  if (sprites.length) renderPreviewFrame(sprites[0]);

  startPreview();
}

// ─── Boot: auto-load from remote ─────────────────────────────────────────────

fetch('https://willy2.shipard.pro:34444/endlessuniverse/data/moon01/global.json?t=' + Date.now(), { cache: 'no-store' })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(loadData)
  .catch(() => {
    // No auto-load — user must import
  });
