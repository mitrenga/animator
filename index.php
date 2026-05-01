<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ANIMATOR — sprite editor</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <div class="header-left">
      <button id="btnImport" title="Import JSON">Import JSON</button>
      <button id="btnExport" title="Export JSON">Export JSON</button>
    </div>
    <div class="header-title">ANIMATOR — sprite editor</div>
  </header>

  <main>
    <!-- Left panel: palette + tools -->
    <aside id="panel-left">
      <section id="palette-section">
        <h3>Palette</h3>
        <div id="palette"></div>
      </section>
      <section id="tools-section">
        <h3>Tools</h3>
        <label><input type="radio" name="tool" value="flood" checked> Flood fill</label>
        <label><input type="radio" name="tool" value="pencil"> Pencil</label>
        <div class="shift-btns">
          <button id="btnShiftLeft">&larr; Shift</button>
          <button id="btnShiftRight">Shift &rarr;</button>
        </div>
        <div class="undo-btns">
          <button id="btnUndo">&#8617; Undo</button>
          <button id="btnRedo">&#8618; Redo</button>
        </div>
      </section>
      <section id="zoom-section">
        <label>Zoom: <span id="zoomValue">8</span>x</label>
        <input type="range" id="zoomSlider" min="2" max="16" value="8" step="1">
      </section>
    </aside>

    <!-- Center: canvas editor -->
    <div id="panel-center">
      <div id="canvas-wrap">
        <canvas id="editorCanvas"></canvas>
      </div>
      <div id="hover-info">&#8212; , &#8212;</div>
      <div id="readonly-badge" style="display:none">READ ONLY (clone)</div>
    </div>

    <!-- Right panel: animation preview + timeline -->
    <aside id="panel-right">
      <section id="preview-section">
        <h3>Animation &#8212; preview</h3>
        <div id="preview-wrap">
          <canvas id="previewCanvas"></canvas>
        </div>
        <div class="preview-controls">
          <div class="loop-row">
            <label>Frame: <strong id="loopMs">70</strong> ms</label>
            <input type="range" id="loopSlider" min="20" max="500" value="70" step="10">
          </div>
          <div class="play-btns">
            <button id="btnPlay">&#9654; Play</button>
            <button id="btnPause">&#9646;&#9646; Pause</button>
          </div>
        </div>
      </section>
      <section id="timeline-section">
        <div class="timeline-header">
          <h3>Timeline</h3>
          <label><input type="checkbox" id="timelineLoop" checked> Loop</label>
        </div>
        <div class="timeline-select-row">
          <select id="timelineSelect"></select>
          <button id="btnNewTimeline" title="New timeline">+</button>
          <button id="btnDeleteTimeline" title="Delete timeline">&#10005;</button>
        </div>
        <div id="timeline-scroll">
          <table id="timelineTable">
            <thead>
              <tr><th>#</th><th>Animation</th><th>Duration (ms)</th><th>Actions</th></tr>
            </thead>
            <tbody id="timelineBody"></tbody>
          </table>
        </div>
        <button id="btnAddStep">+ Add step</button>
      </section>
    </aside>
  </main>

  <!-- Bottom bar -->
  <footer>
    <label>Animation:
      <select id="animSelect"></select>
    </label>
    <label>Sprite:
      <select id="spriteSelect"></select>
    </label>
    <button id="btnPrevSprite">&lt;</button>
    <button id="btnNextSprite">&gt;</button>
    <button id="btnNewSprite">+ New sprite</button>
    <button id="btnDeleteSprite">&#10005; Delete sprite</button>
  </footer>

  <!-- Import dialog -->
  <div id="dlgImport" class="dialog-overlay" style="display:none">
    <div class="dialog">
      <div class="dialog-header">
        <span>Import JSON</span>
        <button class="dialog-close" data-close="dlgImport">&#10005;</button>
      </div>
      <div class="dialog-body">
        <div id="importDrop" class="drop-zone">
          <textarea id="importArea" spellcheck="false" placeholder="Paste JSON here or drop a file..."></textarea>
          <div id="importDropHint" class="drop-hint">Drop file here</div>
        </div>
        <div id="importError" class="dialog-error" style="display:none"></div>
      </div>
      <div class="dialog-footer">
        <label class="btn-file">
          From file&#8230;
          <input type="file" id="fileInput" accept=".json">
        </label>
        <button id="btnImportLoad">Load</button>
        <button data-close="dlgImport">Close</button>
      </div>
    </div>
  </div>

  <!-- Export dialog -->
  <div id="dlgExport" class="dialog-overlay" style="display:none">
    <div class="dialog">
      <div class="dialog-header">
        <span>Export JSON</span>
        <button class="dialog-close" data-close="dlgExport">&#10005;</button>
      </div>
      <div class="dialog-body">
        <textarea id="exportArea" spellcheck="false" readonly></textarea>
      </div>
      <div class="dialog-footer">
        <button id="btnExportDownload">Download global.json</button>
        <button id="btnExportCopy">Copy to clipboard</button>
        <button data-close="dlgExport">Close</button>
      </div>
    </div>
  </div>

  <script src="editor.js"></script>
</body>
</html>
