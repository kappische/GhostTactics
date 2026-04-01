// In-game debug menu — toggle with backtick (`)
// Tabs: MAP | EVENTS | TRIGGERS

// All story-state globals (module-level lets are on window in non-module scripts)
const _TRIGGER_DEFS = [
    { name: '_playerHasDied',        label: 'Player died',              reset: 0 },
    { name: '_superGhostKilled',     label: 'Super ghost killed',       reset: false },
    { name: '_spawnBlockedByPlayer', label: 'Spawn blocked',            reset: 0 },
    { name: '_stairsSpottedByPlayer',label: 'Stairs spotted',           reset: 0 },
    { name: '_s1SpottedByPlayer',    label: 'Survivor 1 spotted',       reset: 0 },
    { name: '_s1SpottedByMedic',     label: 'Survivor 1 → medic',       reset: false },
    { name: '_s1GetBackMarker',      label: 'Get-back marker',          reset: 0 },
    { name: '_storyMarkerLvl2',      label: 'Story marker lvl 2',       reset: 0 },
    { name: '_storyMarkerLvl3',      label: 'Story marker lvl 3',       reset: 0 },
    { name: '_secondLevelStairs',    label: '2nd level stairs',         reset: 0 },
    { name: '_s2SpottedByPlayer',    label: 'Survivor 2 spotted',       reset: 0 },
    { name: '_s2Tile',               label: 'Survivor 2 tile ref',      reset: null },
];

const DebugMenu = {
    visible:      false,
    activeTab:    'map',

    // MAP state
    selectedTile: 'block',
    editMapIndex: 0,
    godMode:      false,
    _painting:    false,
    _undoStack:   [],

    // EVENTS state
    _draft:         { condition: 'manual', elements: [] },
    _customEvents:  [],

    // Feature D: minimap cache
    _minimapCache: null,   // WeakMap<map, OffscreenCanvas>

    // Actor inspector tooltip element
    _tooltip: null,

    // ── init ──────────────────────────────────────────────────────────────────

    init(gs) {
        // Load persisted custom events
        try {
            const saved = localStorage.getItem('ghostTacticsDebugEvents');
            if (saved) this._customEvents = JSON.parse(saved);
        } catch(e) {}

        this._buildPanel();
        this._buildTooltip();

        // Tile painting
        gs.input.on('pointerdown', (p) => { this._painting = true;  this._tryPaint(p, gs); });
        gs.input.on('pointermove', (p) => {
            if (this._painting) this._tryPaint(p, gs);
            this._updateInspector(p, gs);
        });
        gs.input.on('pointerup', () => { this._painting = false; });
    },

    toggle() {
        this.visible = !this.visible;
        this._panel.style.display = this.visible ? 'flex' : 'none';
        if (!this.visible && this._tooltip) this._tooltip.style.display = 'none';
    },

    // Called every frame from gameScene
    update(gs) {
        // God mode — uses actor.type.maxHealth (not actor.maxHealth)
        if (this.godMode) {
            for (const map of gs.maps) {
                for (const actor of map.playerActors) {
                    if (!actor.isDead) actor.health = actor.type.maxHealth;
                }
            }
        }
        // Auto-fire custom events by condition
        for (const ev of this._customEvents) {
            if (!ev.triggered && this._evalCondition(ev.condition, gs)) {
                ev.triggered = true;
                this._runCustomEvent(ev, gs);
                this._saveCustomEvents();
            }
        }
        // Feature D: update minimap when panel is open
        if (this.visible && (this.activeTab === 'map' || this.activeTab === 'visualize')) {
            this._updateMinimap(gs);
        }
    },

    // ── tile painting ─────────────────────────────────────────────────────────

    _tryPaint(pointer, gs) {
        if (!this.visible || gs.atTitleScreen || this.activeTab !== 'map') return;
        const worldX = pointer.x + gs.viewPos.x;
        const worldY = pointer.y + gs.viewPos.y;
        const tileX  = Math.floor(worldX / TILE_SIZE);
        const tileY  = Math.floor(worldY / TILE_SIZE);
        if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;
        const map      = gs.maps[this.editMapIndex];
        const tileName = this.selectedTile === '(erase)' ? null : this.selectedTile;
        // Push undo entry
        const prev = map.getTileNameAt(tileX, tileY);
        if (prev !== tileName) {
            this._undoStack.push({ mapIndex: this.editMapIndex, tileX, tileY, tileName: prev });
            if (this._undoStack.length > 20) this._undoStack.shift();
            map.setTile(tileX, tileY, tileName);
        }
    },

    _undo() {
        if (!gameScene) return;
        const op = this._undoStack.pop();
        if (!op) return;
        gameScene.maps[op.mapIndex].setTile(op.tileX, op.tileY, op.tileName);
    },

    // ── actor inspector ───────────────────────────────────────────────────────

    _buildTooltip() {
        const t = document.createElement('div');
        t.id = 'debug-tooltip';
        Object.assign(t.style, {
            display:    'none',
            position:   'fixed',
            background: 'rgba(5,10,20,0.92)',
            border:     '1px solid #40c0ff',
            color:      '#80e0ff',
            fontFamily: "'Courier New', monospace",
            fontSize:   '11px',
            padding:    '5px 8px',
            lineHeight: '1.6',
            zIndex:     '10000',
            pointerEvents: 'none',
            whiteSpace: 'pre',
        });
        document.body.appendChild(t);
        this._tooltip = t;
    },

    _updateInspector(pointer, gs) {
        if (!this.visible || !this._tooltip) return;
        const map = gs.currentRenderMap;
        if (!map) { this._tooltip.style.display = 'none'; return; }

        const worldX = pointer.x + gs.viewPos.x;
        const worldY = pointer.y + gs.viewPos.y;
        const RADIUS = 40;
        let nearest = null, nearestDist = Infinity;

        for (const actor of [...map.playerActors, ...map.enemyActors]) {
            if (actor.isDead) continue;
            const dx = actor.pos.x - worldX, dy = actor.pos.y - worldY;
            const d = dx * dx + dy * dy;
            if (d < RADIUS * RADIUS && d < nearestDist) { nearest = actor; nearestDist = d; }
        }

        if (!nearest) { this._tooltip.style.display = 'none'; return; }

        const isPlayer = !!nearest.playerInfo;
        const name  = isPlayer ? nearest.playerInfo.name : 'Ghost';
        const hp    = Math.ceil(nearest.health);
        const maxHp = nearest.type.maxHealth > 1e8 ? '∞' : nearest.type.maxHealth;
        const tgt   = nearest.target ? (nearest.target.playerInfo ? nearest.target.playerInfo.fName : 'Ghost') : '—';
        const path  = nearest.path ? nearest.path.length + ' nodes' : '—';

        this._tooltip.textContent = `${name}\nHP: ${hp} / ${maxHp}\nTarget: ${tgt}\nPath: ${path}`;
        const ev = pointer.event;
        if (ev) {
            this._tooltip.style.left = (ev.clientX + 14) + 'px';
            this._tooltip.style.top  = (ev.clientY - 10) + 'px';
        }
        this._tooltip.style.display = 'block';
    },

    // ── panel skeleton ────────────────────────────────────────────────────────

    _buildPanel() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        Object.assign(panel.style, {
            display:       'none',
            position:      'fixed',
            top:           '10px',
            right:         '10px',
            width:         '220px',
            maxHeight:     '92vh',
            overflowY:     'auto',
            background:    'rgba(5,10,20,0.96)',
            border:        '1px solid #40c0ff',
            color:         '#40c0ff',
            fontFamily:    "'Courier New', monospace",
            fontSize:      '11px',
            flexDirection: 'column',
            gap:           '3px',
            padding:       '8px',
            zIndex:        '9999',
            userSelect:    'none',
            lineHeight:    '1.4',
        });
        document.body.appendChild(panel);
        this._panel = panel;
        this._rebuildPanel();
    },

    _rebuildPanel() {
        const p = this._panel;
        p.innerHTML = '';

        const hdr = document.createElement('div');
        hdr.textContent = 'DEBUG  [` toggle]';
        hdr.style.cssText = 'color:#80e0ff;border-bottom:1px solid #204060;padding-bottom:3px;margin-bottom:4px;';
        p.appendChild(hdr);

        const tabRow = this._row(p);
        tabRow.style.marginBottom = '5px';
        for (const [id, label] of [['map','MAP'],['events','EVENTS'],['triggers','TRIGGERS'],['visualize','VIZ']]) {
            this._btn(tabRow, label, this.activeTab === id, () => {
                this.activeTab = id;
                this._rebuildPanel();
            });
        }

        if      (this.activeTab === 'map')       this._buildMapTab(p);
        else if (this.activeTab === 'events')    this._buildEventsTab(p);
        else if (this.activeTab === 'triggers')  this._buildTriggersTab(p);
        else if (this.activeTab === 'visualize') this._buildVisualizeTab(p);
    },

    // ── MAP tab ───────────────────────────────────────────────────────────────

    _buildMapTab(p) {
        // Floor + undo row
        this._label(p, 'FLOOR');
        const floorRow = this._row(p);
        for (let i = 0; i < NUM_MAPS; i++) {
            this._btn(floorRow, `F${i+1}`, i === this.editMapIndex, () => {
                this.editMapIndex = i; this._rebuildPanel();
            });
        }
        const undoBtn = this._makeBtn(`Undo (${this._undoStack.length})`, false);
        undoBtn.style.marginTop = '3px';
        undoBtn.addEventListener('click', () => { this._undo(); this._rebuildPanel(); });
        p.appendChild(undoBtn);

        // Tile palette
        this._label(p, 'PAINT TILE');
        for (const name of ['(erase)', ...Object.keys(TILES)]) {
            const isErase  = name === '(erase)';
            const tileType = isErase ? null : TILES[name];
            const ec       = tileType && tileType.editColor;
            const bg       = ec ? `rgba(${ec.r},${ec.g},${ec.b},0.25)` : 'rgba(60,60,60,0.2)';
            const selected = this.selectedTile === name;
            const btn      = this._makeBtn(isErase ? '× erase' : name, selected);
            btn.style.background   = selected ? 'rgba(64,192,255,0.22)' : bg;
            btn.style.display      = 'block';
            btn.style.width        = '100%';
            btn.style.textAlign    = 'left';
            btn.style.marginBottom = '2px';
            btn.addEventListener('click', () => { this.selectedTile = name; this._rebuildPanel(); });
            p.appendChild(btn);
        }

        // Actions
        this._label(p, 'ACTIONS');
        for (const [label, fn] of [
            ['Spawn Ghost',       () => this._spawnAtCenter(false)],
            ['Spawn Super Ghost', () => this._spawnAtCenter(true)],
            ['Kill All Enemies',  () => this._killAllEnemies()],
            [this.godMode ? 'God Mode: ON ✓' : 'God Mode: OFF',
                                  () => { this.godMode = !this.godMode; this._rebuildPanel(); }],
            ['Export Map JSON',   () => this._exportMap()],
        ]) {
            const btn = this._makeBtn(label, false);
            btn.style.cssText += ';display:block;width:100%;text-align:left;margin-bottom:2px;';
            btn.addEventListener('click', fn);
            p.appendChild(btn);
        }

        // Spawn rate sliders
        this._label(p, 'SPAWN RATE  (this floor)');
        const gs = gameScene;
        if (gs) {
            const map = gs.maps[this.editMapIndex];
            const curOverride = map.spawnIntervalOverride;
            this._makeSlider(p, 'Map interval (s)', 0.5, 10, 0.5,
                curOverride != null ? curOverride : 2,
                (v) => {
                    map.spawnIntervalOverride = v;
                    map.nextSpawnTimer = Math.min(map.nextSpawnTimer, v);
                },
                () => { map.spawnIntervalOverride = null; }
            );
            const indieVal = window._debugIndieSpawnInterval;
            this._makeSlider(p, 'IndieSpawn interval (s)', 0.5, 15, 0.5,
                indieVal != null ? indieVal : 5.5,
                (v) => { window._debugIndieSpawnInterval = v; },
                () => { window._debugIndieSpawnInterval = null; }
            );
        }

        // Settings
        this._label(p, 'SETTINGS');
        if (gs) {
            this._makeSlider(p, `Text delay: ${gs._settings.textDelay}ms`, 5, 120, 5,
                gs._settings.textDelay,
                (v) => { gs._settings.textDelay = v; this._rebuildPanel(); }
            );
            this._makeSlider(p, `Master vol: ${Math.round(gs._settings.masterVolume*100)}%`, 0, 1, 0.05,
                gs._settings.masterVolume,
                (v) => { gs._settings.masterVolume = v; this._rebuildPanel(); }
            );
            this._makeSlider(p, `Music vol: ${Math.round(gs._settings.musicVolume*100)}%`, 0, 1, 0.05,
                gs._settings.musicVolume,
                (v) => {
                    gs._settings.musicVolume = v;
                    if (gs.currentMusic) gs.currentMusic.volume = v * gs._settings.masterVolume;
                    this._rebuildPanel();
                }
            );
        }

        // Feature D: all-floors mini-map
        this._label(p, 'ALL FLOORS  (2px/tile)');
        const mmCanvas = document.createElement('canvas');
        mmCanvas.id = 'dbg-minimap';
        mmCanvas.width  = MAP_WIDTH * 2 * NUM_MAPS + (NUM_MAPS - 1);  // 5 floors side-by-side with 1px gap
        mmCanvas.height = MAP_HEIGHT * 2;
        Object.assign(mmCanvas.style, {
            display: 'block', marginTop: '4px',
            border: '1px solid #204060',
            imageRendering: 'pixelated',
        });
        p.appendChild(mmCanvas);
    },

    // ── EVENTS tab ────────────────────────────────────────────────────────────

    _buildEventsTab(p) {
        this._label(p, 'STORY EVENTS');

        if (!gameScene) {
            const note = document.createElement('div');
            note.style.color = '#305870';
            note.textContent = 'Start the game first.';
            p.appendChild(note);
        } else {
            gameScene.events.forEach((ev, i) => {
                // Condition trace
                let condResult = '?';
                try { condResult = ev.condition(gameScene) ? '▶ true' : '✕ false'; } catch(e) { condResult = 'ERR'; }
                const condColor = condResult.startsWith('▶') ? '#40ff80' : '#305870';

                const wrap = document.createElement('div');
                wrap.style.cssText = 'border:1px solid #152030;padding:3px 4px;margin-bottom:3px;';

                // Top row: index + condition result + fire + reset
                const topRow = this._row(wrap);
                topRow.style.alignItems = 'center';
                topRow.style.marginBottom = '2px';

                const idxSpan = document.createElement('span');
                idxSpan.textContent = `#${i+1}`;
                idxSpan.style.cssText = `color:${ev.triggered ? '#305870' : '#40c0ff'};min-width:22px;`;
                topRow.appendChild(idxSpan);

                const condSpan = document.createElement('span');
                condSpan.textContent = condResult;
                condSpan.style.cssText = `color:${condColor};flex:1;font-size:10px;`;
                topRow.appendChild(condSpan);

                const fireBtn = this._makeBtn('▶', false);
                fireBtn.title = 'Fire now';
                fireBtn.addEventListener('click', () => {
                    ev.triggered = true; ev.run(gameScene); this._rebuildPanel();
                });
                topRow.appendChild(fireBtn);

                const resetBtn = this._makeBtn('↺', ev.triggered);
                resetBtn.title = 'Reset';
                resetBtn.addEventListener('click', () => { ev.triggered = false; this._rebuildPanel(); });
                topRow.appendChild(resetBtn);

                // Preview line
                const firstLine = ev.run.toString().match(/"([^"]{1,50})"/);
                if (firstLine) {
                    const prev = document.createElement('div');
                    prev.style.cssText = `color:${ev.triggered ? '#203040' : '#305870'};font-size:10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;`;
                    prev.textContent = firstLine[1];
                    prev.title = firstLine[1];
                    wrap.appendChild(prev);
                }
                p.appendChild(wrap);
            });
        }

        // Compose
        this._label(p, 'COMPOSE NEW EVENT');

        const condRow = document.createElement('div');
        condRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:4px;';
        const condLbl = document.createElement('span');
        condLbl.textContent = 'Trigger:';
        condLbl.style.color = '#305870';
        condRow.appendChild(condLbl);

        const condSel = document.createElement('select');
        condSel.style.cssText = 'flex:1;background:#080e18;border:1px solid #204060;color:#40c0ff;font-family:\'Courier New\',monospace;font-size:11px;padding:1px;';
        for (const [val, txt] of [
            ['manual','Manual only'],['floor0','Floor 1 entered'],['floor1','Floor 2 entered'],
            ['floor2','Floor 3 entered'],['floor3','Floor 4 entered'],['floor4','Floor 5 entered'],
        ]) {
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = txt;
            if (val === this._draft.condition) opt.selected = true;
            condSel.appendChild(opt);
        }
        condSel.addEventListener('change', () => { this._draft.condition = condSel.value; });
        condRow.appendChild(condSel);
        p.appendChild(condRow);

        const linesContainer = document.createElement('div');
        p.appendChild(linesContainer);
        this._renderDraftLines(linesContainer);

        const addLineBtn = this._makeBtn('+ Add Line', false);
        addLineBtn.style.cssText += ';display:block;width:100%;text-align:left;margin-bottom:4px;';
        addLineBtn.addEventListener('click', () => {
            this._draft.elements.push({ speakerKey: 'playerInfo_0', text: '' });
            this._renderDraftLines(linesContainer);
        });
        p.appendChild(addLineBtn);

        // Feature E: live dialogue preview
        this._label(p, 'PREVIEW');
        const previewDiv = document.createElement('div');
        previewDiv.id = 'dbg-dialogue-preview';
        Object.assign(previewDiv.style, {
            background: '#060d16', border: '1px solid #204060',
            color: '#80e0ff', fontFamily: "'Courier New', monospace",
            fontSize: '11px', padding: '5px 7px',
            marginBottom: '5px', minHeight: '32px',
            whiteSpace: 'pre-wrap', lineHeight: '1.5',
        });
        previewDiv.textContent = '(type dialogue above to preview)';
        p.appendChild(previewDiv);

        const saveBtn = this._makeBtn('Save Event', false);
        saveBtn.style.cssText += ';display:block;width:100%;text-align:left;margin-bottom:4px;border-color:#40c0ff;';
        saveBtn.addEventListener('click', () => {
            if (!this._draft.elements.length) return;
            this._customEvents.push({
                condition: this._draft.condition,
                elements:  this._draft.elements.map(e => ({ ...e })),
                triggered: false,
            });
            this._saveCustomEvents();
            this._draft = { condition: 'manual', elements: [] };
            this._rebuildPanel();
        });
        p.appendChild(saveBtn);

        if (this._customEvents.length > 0) {
            this._label(p, 'CUSTOM EVENTS');
            this._customEvents.forEach((ev, i) => {
                const row = this._row(p);
                row.style.cssText += ';align-items:center;margin-bottom:3px;';

                const ind = document.createElement('span');
                ind.textContent = ev.triggered ? '✓' : '○';
                ind.style.cssText = `color:${ev.triggered ? '#305870' : '#40c0ff'};min-width:12px;`;
                row.appendChild(ind);

                const lbl = document.createElement('span');
                const txt = ev.elements[0] ? ev.elements[0].text : '(empty)';
                lbl.textContent = txt.length > 16 ? txt.slice(0,16)+'…' : txt;
                lbl.style.cssText = 'flex:1;overflow:hidden;';
                lbl.title = txt;
                row.appendChild(lbl);

                for (const [btnTxt, title, fn] of [
                    ['▶', 'Fire', () => { ev.triggered = true; this._runCustomEvent(ev, gameScene); this._saveCustomEvents(); this._rebuildPanel(); }],
                    ['↺', 'Reset', () => { ev.triggered = false; this._saveCustomEvents(); this._rebuildPanel(); }],
                    ['×', 'Delete', () => { this._customEvents.splice(i,1); this._saveCustomEvents(); this._rebuildPanel(); }],
                ]) {
                    const b = this._makeBtn(btnTxt, false);
                    b.title = title;
                    b.addEventListener('click', fn);
                    row.appendChild(b);
                }
            });

            const expBtn = this._makeBtn('Export Events JS', false);
            expBtn.style.cssText += ';display:block;width:100%;text-align:left;margin-top:4px;';
            expBtn.addEventListener('click', () => this._exportEventsJS());
            p.appendChild(expBtn);
        }
    },

    _renderDraftLines(container) {
        container.innerHTML = '';
        const speakers = this._getSpeakers();
        this._draft.elements.forEach((line, i) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'border:1px solid #204060;padding:4px;margin-bottom:3px;';

            const sel = document.createElement('select');
            sel.style.cssText = 'display:block;width:100%;background:#080e18;border:1px solid #204060;color:#40c0ff;font-family:\'Courier New\',monospace;font-size:11px;padding:1px;margin-bottom:3px;';
            for (const [key, name] of speakers) {
                const opt = document.createElement('option');
                opt.value = key; opt.textContent = name;
                if (key === line.speakerKey) opt.selected = true;
                sel.appendChild(opt);
            }
            sel.addEventListener('change', () => { line.speakerKey = sel.value; });
            wrap.appendChild(sel);

            const txt = document.createElement('textarea');
            txt.value = line.text;
            txt.rows = 2;
            txt.style.cssText = 'display:block;width:100%;background:#080e18;border:1px solid #204060;color:#80e0ff;font-family:\'Courier New\',monospace;font-size:11px;padding:2px;resize:vertical;box-sizing:border-box;';
            txt.addEventListener('input', () => {
                line.text = txt.value;
                DebugMenu._updateLivePreview();
            });
            wrap.appendChild(txt);

            const del = this._makeBtn('× remove', false);
            del.style.cssText += ';margin-top:2px;font-size:10px;';
            del.addEventListener('click', () => {
                this._draft.elements.splice(i, 1);
                this._renderDraftLines(container);
            });
            wrap.appendChild(del);
            container.appendChild(wrap);
        });
    },

    // ── TRIGGERS tab ──────────────────────────────────────────────────────────

    _buildTriggersTab(p) {
        this._label(p, 'STORY TRIGGER GLOBALS');

        const gs = gameScene;
        for (const def of _TRIGGER_DEFS) {
            const val = window[def.name];
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:4px;';

            const lbl = document.createElement('span');
            lbl.style.cssText = 'flex:1;color:#305870;font-size:10px;';
            lbl.textContent = def.label;
            row.appendChild(lbl);

            const valSpan = document.createElement('span');
            const isSet = val !== def.reset && val !== null && val !== undefined && val !== false && val !== 0;
            valSpan.textContent = (val === null || val === undefined) ? 'null'
                : (typeof val === 'object' ? '(tile)' : String(val));
            valSpan.style.cssText = `color:${isSet ? '#40ff80' : '#305870'};min-width:30px;text-align:right;font-size:10px;`;
            row.appendChild(valSpan);

            const resetBtn = this._makeBtn('↺', false);
            resetBtn.title = `Reset to ${def.reset}`;
            resetBtn.addEventListener('click', () => {
                window[def.name] = def.reset;
                this._rebuildPanel();
            });
            row.appendChild(resetBtn);
            p.appendChild(row);
        }

        const resetAllBtn = this._makeBtn('Reset All Triggers', false);
        resetAllBtn.style.cssText += ';display:block;width:100%;text-align:left;margin-top:4px;margin-bottom:8px;';
        resetAllBtn.addEventListener('click', () => {
            for (const def of _TRIGGER_DEFS) window[def.name] = def.reset;
            this._rebuildPanel();
        });
        p.appendChild(resetAllBtn);

        // Checkpoint jumper
        this._label(p, 'CHECKPOINT');
        const cpNote = document.createElement('div');
        cpNote.textContent = 'Ctrl+R to apply';
        cpNote.style.cssText = 'color:#305870;font-size:10px;margin-bottom:3px;';
        p.appendChild(cpNote);

        const cpRow = this._row(p);
        const curCp = gs ? gs._settings.checkpoint : 0;
        for (let i = 0; i <= 6; i++) {
            this._btn(cpRow, String(i), i === curCp, () => {
                window._useCheckpoint = i;
                if (gs) gs._settings.checkpoint = i;
                this._rebuildPanel();
            });
        }

        // Also reset event triggered flags when checkpoint jumps
        const cpResetBtn = this._makeBtn('Reset Event Flags', false);
        cpResetBtn.style.cssText += ';display:block;width:100%;text-align:left;margin-top:4px;';
        cpResetBtn.title = 'Marks all story events as un-triggered';
        cpResetBtn.addEventListener('click', () => {
            if (gs) gs.events.forEach(ev => ev.triggered = false);
            this._rebuildPanel();
        });
        p.appendChild(cpResetBtn);
    },

    // ── VISUALIZE tab ─────────────────────────────────────────────────────────

    _buildVisualizeTab(p) {
        this._label(p, 'LOS + PATH OVERLAY');
        const note = document.createElement('div');
        note.textContent = 'Overlays are always visible when debug is open.\n· Red dotted = ghost A* path\n· Yellow = ghost→target\n· Green/Red = player LOS';
        note.style.cssText = 'color:#305870;font-size:10px;white-space:pre-line;margin-bottom:6px;';
        p.appendChild(note);

        this._label(p, 'DRAG ACTORS');
        const dragNote = document.createElement('div');
        dragNote.textContent = 'Click & drag any actor while on this tab. AI re-routes on drop.';
        dragNote.style.cssText = 'color:#305870;font-size:10px;margin-bottom:6px;';
        p.appendChild(dragNote);

        // Mini-map repeated here too for quick access
        this._label(p, 'ALL FLOORS MINI-MAP');
        const mmCanvas = document.createElement('canvas');
        mmCanvas.id = 'dbg-minimap-viz';
        mmCanvas.width  = MAP_WIDTH * 2 * NUM_MAPS + (NUM_MAPS - 1);
        mmCanvas.height = MAP_HEIGHT * 2;
        Object.assign(mmCanvas.style, {
            display: 'block', marginTop: '4px',
            border: '1px solid #204060',
            imageRendering: 'pixelated',
        });
        p.appendChild(mmCanvas);
    },

    // Feature E: live preview of typed dialogue
    _updateLivePreview() {
        const el = document.getElementById('dbg-dialogue-preview');
        if (!el) return;
        const lines = this._draft.elements
            .map(e => e.text.trim())
            .filter(Boolean);
        if (!lines.length) {
            el.textContent = '(type dialogue above to preview)';
            return;
        }
        el.textContent = lines.map(l => `▶ ${l}`).join('\n');
    },

    // Feature D: draw all-floors mini-map onto #dbg-minimap and #dbg-minimap-viz
    _updateMinimap(gs) {
        const ids = ['dbg-minimap', 'dbg-minimap-viz'];
        for (const id of ids) {
            const canvas = document.getElementById(id);
            if (!canvas) continue;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            const S = 2; // scale: pixels per tile
            const W = MAP_WIDTH * S, H = MAP_HEIGHT * S;

            // Initialise cache map once
            if (!this._minimapCache) this._minimapCache = new WeakMap();

            for (let fi = 0; fi < NUM_MAPS; fi++) {
                const map = gs.maps[fi];
                if (!map) continue;
                const ox = fi * (W + 1); // x offset for this floor (1px gap)

                // Rebuild wall cache if dirty
                if (map._minimapDirty || !this._minimapCache.has(map)) {
                    const offscreen = new OffscreenCanvas(W, H);
                    const oc = offscreen.getContext('2d');
                    oc.fillStyle = '#0a1520';
                    oc.fillRect(0, 0, W, H);
                    for (let tx = 0; tx < MAP_WIDTH; tx++) {
                        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
                            const name = map.tileGrid && map.tileGrid[tx] ? map.tileGrid[tx][ty] : null;
                            if (!name) continue;
                            const tile = TILES[name];
                            if (!tile) continue;
                            oc.fillStyle = tile.isBlocking ? '#4a6080' : '#1a2a3a';
                            if (name === 'spawn' || name === 'startTile') oc.fillStyle = '#204830';
                            oc.fillRect(tx * S, ty * S, S, S);
                        }
                    }
                    this._minimapCache.set(map, offscreen);
                    map._minimapDirty = false;
                }

                // Blit wall cache
                const offscreen = this._minimapCache.get(map);
                if (offscreen) ctx.drawImage(offscreen, ox, 0);

                // Draw actor dots
                for (const actor of map.playerActors) {
                    if (actor.isDead) continue;
                    ctx.fillStyle = '#4488ff';
                    const ax = Math.floor(actor.pos.x / TILE_SIZE) * S + ox;
                    const ay = Math.floor(actor.pos.y / TILE_SIZE) * S;
                    ctx.fillRect(ax, ay, S, S);
                }
                for (const actor of map.enemyActors) {
                    if (actor.isDead) continue;
                    ctx.fillStyle = '#ff4444';
                    const ax = Math.floor(actor.pos.x / TILE_SIZE) * S + ox;
                    const ay = Math.floor(actor.pos.y / TILE_SIZE) * S;
                    ctx.fillRect(ax, ay, S, S);
                }
            }
        }
    },

    // ── helpers ───────────────────────────────────────────────────────────────

    _getSpeakers() {
        const list = [];
        if (gameScene && gameScene.playerInfo) {
            gameScene.playerInfo.forEach((info, i) => {
                if (info) list.push([`playerInfo_${i}`, `[${i}] ${info.rank} ${info.fName}`]);
            });
            if (gameScene.extraPlayerInfo && gameScene.extraPlayerInfo[0])
                list.push(['extraPlayerInfo_0', '[HQ] HQ']);
        } else {
            for (let i = 0; i < 8; i++) list.push([`playerInfo_${i}`, `Player ${i}`]);
            list.push(['extraPlayerInfo_0', 'HQ']);
        }
        return list;
    },

    _resolveSpeaker(key, gs) {
        const [obj, idx] = key.split('_');
        return gs[obj] && gs[obj][parseInt(idx)];
    },

    _evalCondition(condition, gs) {
        if (condition === 'manual') return false;
        const m = condition.match(/^floor(\d)$/);
        if (m) return gs.maps[parseInt(m[1])].playerCounter > 0;
        return false;
    },

    _runCustomEvent(ev, gs) {
        if (!gs) return;
        const elements = ev.elements
            .filter(e => e.text.trim() !== '')
            .map(e => ({ text: e.text, info: this._resolveSpeaker(e.speakerKey, gs) }))
            .filter(e => e.info);
        if (elements.length) gs.addStory({ elements });
    },

    _saveCustomEvents() {
        try {
            localStorage.setItem('ghostTacticsDebugEvents', JSON.stringify(this._customEvents));
        } catch(e) {}
    },

    _exportEventsJS() {
        const lines = ['// Custom events — paste into createEvents() in src/events.js\n'];
        this._customEvents.forEach(ev => {
            const condStr = ev.condition === 'manual'
                ? 'false /* replace with your condition */'
                : `gs.maps[${ev.condition.replace('floor','')}].playerCounter > 0`;
            const els = ev.elements.filter(e => e.text.trim() !== '').map(e => {
                const [obj, idx] = e.speakerKey.split('_');
                return `            { text: ${JSON.stringify(e.text)}, info: gs.${obj}[${idx}] },`;
            }).join('\n');
            lines.push(`{\n    triggered: false,\n    condition(gs) { return ${condStr}; },\n    run(gs) {\n        gs.addStory({ elements: [\n${els}\n        ]});\n    }\n},`);
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'custom_events.js'; a.click();
        URL.revokeObjectURL(url);
    },

    // ── MAP actions ───────────────────────────────────────────────────────────

    _spawnAtCenter(isSuper) {
        if (!gameScene || gameScene.atTitleScreen) return;
        const map = gameScene.maps[this.editMapIndex];
        const cx  = gameScene.viewPos.x + (GAME_WIDTH - HUD_WIDTH) / 2;
        const cy  = gameScene.viewPos.y + GAME_HEIGHT / 2;
        map.addEnemyActor(new Actor(isSuper ? ACTORS.superGhost : ACTORS.ghost, cx, cy, map));
        ImpactEffects.ghostSpawn(map, cx, cy);
    },

    _killAllEnemies() {
        if (!gameScene) return;
        for (const map of gameScene.maps)
            for (const actor of [...map.enemyActors]) actor.kill(false);
    },

    _exportMap() {
        if (!gameScene) return;
        const data = gameScene.maps.map((map, i) => ({
            floor: i+1, width: map.width, height: map.height, tiles: map.tileGrid,
        }));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'ghosttactics_map.json'; a.click();
        URL.revokeObjectURL(url);
    },

    // ── UI helpers ────────────────────────────────────────────────────────────

    _label(parent, text) {
        const d = document.createElement('div');
        d.textContent = text;
        d.style.cssText = 'color:#305870;margin-top:5px;margin-bottom:2px;font-size:10px;letter-spacing:0.05em;';
        parent.appendChild(d);
    },

    _row(parent) {
        const d = document.createElement('div');
        d.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap;';
        parent.appendChild(d);
        return d;
    },

    _btn(parent, text, active, fn) {
        const b = this._makeBtn(text, active);
        b.addEventListener('click', fn);
        parent.appendChild(b);
        return b;
    },

    _makeBtn(text, active) {
        const b = document.createElement('button');
        b.textContent = text;
        b.style.cssText = `padding:2px 6px;background:${active?'rgba(64,192,255,0.18)':'transparent'};border:1px solid ${active?'#40c0ff':'#204060'};color:${active?'#80e0ff':'#40c0ff'};font-family:'Courier New',monospace;font-size:11px;cursor:pointer;`;
        return b;
    },

    _makeSlider(parent, labelText, min, max, step, value, onChange, onReset) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-bottom:5px;';

        const lbl = document.createElement('div');
        lbl.textContent = labelText;
        lbl.style.cssText = 'color:#40c0ff;font-size:10px;margin-bottom:1px;';
        wrap.appendChild(lbl);

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:4px;';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min; slider.max = max; slider.step = step; slider.value = value;
        slider.style.cssText = 'flex:1;accent-color:#40c0ff;cursor:pointer;height:14px;';
        slider.addEventListener('input', () => onChange(parseFloat(slider.value)));
        row.appendChild(slider);

        if (onReset) {
            const rst = this._makeBtn('↺', false);
            rst.title = 'Reset to default';
            rst.addEventListener('click', () => { onReset(); this._rebuildPanel(); });
            row.appendChild(rst);
        }

        wrap.appendChild(row);
        parent.appendChild(wrap);
    },
};
