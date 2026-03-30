// In-game debug menu — toggle with backtick (`)
// MAP tab: tile painter, spawn/kill controls, map export
// EVENTS tab: view/fire/reset existing events, compose new dialogue events

const DebugMenu = {
    visible:      false,
    activeTab:    'map',     // 'map' | 'events'

    // MAP state
    selectedTile: 'block',
    editMapIndex: 0,
    godMode:      false,
    _painting:    false,

    // EVENTS state
    _draft: {
        condition: 'manual',
        elements:  [],       // [{ speakerKey: 'playerInfo_0', text: '' }, ...]
    },
    _customEvents: [],       // saved custom events (same shape as _draft + triggered flag)

    // ------------------------------------------------------------------ init

    init(gs) {
        this._buildPanel();
        gs.input.on('pointerdown', (p) => { this._painting = true;  this._tryPaint(p, gs); });
        gs.input.on('pointermove', (p) => { if (this._painting) this._tryPaint(p, gs); });
        gs.input.on('pointerup',   ()  => { this._painting = false; });
    },

    toggle() {
        this.visible = !this.visible;
        this._panel.style.display = this.visible ? 'flex' : 'none';
    },

    // Called every frame from gameScene
    update(gs) {
        // God mode
        if (this.godMode) {
            for (const map of gs.maps) {
                for (const actor of map.playerActors) {
                    if (!actor.isDead) actor.health = Math.max(actor.health, actor.maxHealth);
                }
            }
        }
        // Fire auto-condition custom events
        for (const ev of this._customEvents) {
            if (!ev.triggered && this._evalCondition(ev.condition, gs)) {
                ev.triggered = true;
                this._runCustomEvent(ev, gs);
            }
        }
    },

    // ------------------------------------------------------------------ MAP painting

    _tryPaint(pointer, gs) {
        if (!this.visible || gs.atTitleScreen || this.activeTab !== 'map') return;
        const worldX = pointer.x + gs.viewPos.x;
        const worldY = pointer.y + gs.viewPos.y;
        const tileX = Math.floor(worldX / TILE_SIZE);
        const tileY = Math.floor(worldY / TILE_SIZE);
        if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;
        const tileName = this.selectedTile === '(erase)' ? null : this.selectedTile;
        gs.maps[this.editMapIndex].setTile(tileX, tileY, tileName);
    },

    // ------------------------------------------------------------------ panel build

    _buildPanel() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        Object.assign(panel.style, {
            display:       'none',
            position:      'fixed',
            top:           '10px',
            right:         '10px',
            width:         '240px',
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

        // Header
        const hdr = document.createElement('div');
        hdr.style.cssText = 'color:#80e0ff;border-bottom:1px solid #204060;padding-bottom:3px;margin-bottom:4px;';
        hdr.textContent = 'DEBUG  [` toggle]';
        p.appendChild(hdr);

        // Tabs
        const tabRow = this._row(p);
        tabRow.style.marginBottom = '5px';
        this._btn(tabRow, 'MAP',    this.activeTab === 'map',    () => { this.activeTab = 'map';    this._rebuildPanel(); });
        this._btn(tabRow, 'EVENTS', this.activeTab === 'events', () => { this.activeTab = 'events'; this._rebuildPanel(); });

        if (this.activeTab === 'map') {
            this._buildMapTab(p);
        } else {
            this._buildEventsTab(p);
        }
    },

    // ------------------------------------------------------------------ MAP tab

    _buildMapTab(p) {
        // Floor selector
        this._label(p, 'FLOOR');
        const floorRow = this._row(p);
        for (let i = 0; i < NUM_MAPS; i++) {
            this._btn(floorRow, `F${i + 1}`, i === this.editMapIndex, () => {
                this.editMapIndex = i;
                this._rebuildPanel();
            });
        }

        // Tile palette
        this._label(p, 'PAINT TILE');
        const tileNames = ['(erase)', ...Object.keys(TILES)];
        for (const name of tileNames) {
            const isErase  = name === '(erase)';
            const tileType = isErase ? null : TILES[name];
            const ec       = tileType && tileType.editColor;
            const bg       = ec ? `rgba(${ec.r},${ec.g},${ec.b},0.25)` : 'rgba(60,60,60,0.2)';
            const selected = this.selectedTile === name;
            const btn      = this._makeBtn(isErase ? '× erase' : name, selected);
            btn.style.background    = selected ? 'rgba(64,192,255,0.22)' : bg;
            btn.style.display       = 'block';
            btn.style.width         = '100%';
            btn.style.textAlign     = 'left';
            btn.style.marginBottom  = '2px';
            btn.addEventListener('click', () => { this.selectedTile = name; this._rebuildPanel(); });
            p.appendChild(btn);
        }

        // Actions
        this._label(p, 'ACTIONS');
        const actions = [
            ['Spawn Ghost',       () => this._spawnAtCenter(false)],
            ['Spawn Super Ghost', () => this._spawnAtCenter(true)],
            ['Kill All Enemies',  () => this._killAllEnemies()],
            [this.godMode ? 'God Mode: ON ✓' : 'God Mode: OFF',
                                  () => { this.godMode = !this.godMode; this._rebuildPanel(); }],
            ['Export Map JSON',   () => this._exportMap()],
        ];
        for (const [label, fn] of actions) {
            const btn = this._makeBtn(label, false);
            btn.style.cssText += ';display:block;width:100%;text-align:left;margin-bottom:2px;';
            btn.addEventListener('click', fn);
            p.appendChild(btn);
        }
    },

    // ------------------------------------------------------------------ EVENTS tab

    _buildEventsTab(p) {
        // ---- Existing events (from events.js) ----
        this._label(p, 'STORY EVENTS');
        if (!gameScene) {
            const note = document.createElement('div');
            note.style.color = '#305870';
            note.textContent = 'Start the game first.';
            p.appendChild(note);
        } else {
            gameScene.events.forEach((ev, i) => {
                // First dialogue line as preview
                const firstLine = ev.run.toString().match(/"([^"]{1,40})"/);
                const preview   = firstLine ? firstLine[1] : `Event ${i + 1}`;
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:3px;margin-bottom:3px;';

                const indicator = document.createElement('span');
                indicator.textContent = ev.triggered ? '✓' : '○';
                indicator.style.cssText = `color:${ev.triggered ? '#305870' : '#40c0ff'};min-width:12px;`;
                row.appendChild(indicator);

                const lbl = document.createElement('span');
                lbl.textContent = preview.length > 22 ? preview.slice(0, 22) + '…' : preview;
                lbl.style.cssText = `flex:1;overflow:hidden;color:${ev.triggered ? '#305870' : '#40c0ff'};`;
                lbl.title = preview;
                row.appendChild(lbl);

                const fireBtn = this._makeBtn('▶', false);
                fireBtn.title = 'Fire now';
                fireBtn.addEventListener('click', () => {
                    ev.triggered = true;
                    ev.run(gameScene);
                    this._rebuildPanel();
                });
                row.appendChild(fireBtn);

                const resetBtn = this._makeBtn('↺', ev.triggered);
                resetBtn.title = 'Reset (allow re-fire)';
                resetBtn.addEventListener('click', () => {
                    ev.triggered = false;
                    this._rebuildPanel();
                });
                row.appendChild(resetBtn);

                p.appendChild(row);
            });
        }

        // ---- Compose new event ----
        this._label(p, 'COMPOSE NEW EVENT');

        // Condition picker
        const condRow = document.createElement('div');
        condRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:4px;';
        const condLbl = document.createElement('span');
        condLbl.textContent = 'Trigger:';
        condLbl.style.color = '#305870';
        condRow.appendChild(condLbl);

        const condSelect = document.createElement('select');
        condSelect.style.cssText = `
            flex:1; background:#080e18; border:1px solid #204060;
            color:#40c0ff; font-family:'Courier New',monospace; font-size:11px; padding:1px;
        `;
        const condOptions = [
            ['manual',  'Manual only'],
            ['floor0',  'Floor 1 entered'],
            ['floor1',  'Floor 2 entered'],
            ['floor2',  'Floor 3 entered'],
            ['floor3',  'Floor 4 entered'],
            ['floor4',  'Floor 5 entered'],
        ];
        for (const [val, text] of condOptions) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = text;
            if (val === this._draft.condition) opt.selected = true;
            condSelect.appendChild(opt);
        }
        condSelect.addEventListener('change', () => { this._draft.condition = condSelect.value; });
        condRow.appendChild(condSelect);
        p.appendChild(condRow);

        // Dialogue lines
        const linesContainer = document.createElement('div');
        linesContainer.id = 'debug-lines';
        p.appendChild(linesContainer);
        this._renderDraftLines(linesContainer);

        // Add line button
        const addLineBtn = this._makeBtn('+ Add Line', false);
        addLineBtn.style.cssText += ';display:block;width:100%;text-align:left;margin-bottom:4px;';
        addLineBtn.addEventListener('click', () => {
            this._draft.elements.push({ speakerKey: 'playerInfo_0', text: '' });
            this._renderDraftLines(linesContainer);
        });
        p.appendChild(addLineBtn);

        // Save event button
        const saveBtn = this._makeBtn('Save Event', false);
        saveBtn.style.cssText += ';display:block;width:100%;text-align:left;margin-bottom:4px;border-color:#40c0ff;';
        saveBtn.addEventListener('click', () => {
            if (this._draft.elements.length === 0) return;
            this._customEvents.push({
                condition: this._draft.condition,
                elements:  this._draft.elements.map(e => ({ ...e })),
                triggered: false,
            });
            this._draft = { condition: 'manual', elements: [] };
            this._rebuildPanel();
        });
        p.appendChild(saveBtn);

        // ---- Custom events list ----
        if (this._customEvents.length > 0) {
            this._label(p, 'CUSTOM EVENTS');
            this._customEvents.forEach((ev, i) => {
                const firstText = ev.elements[0] ? ev.elements[0].text : '(empty)';
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:3px;margin-bottom:3px;';

                const indicator = document.createElement('span');
                indicator.textContent = ev.triggered ? '✓' : '○';
                indicator.style.cssText = `color:${ev.triggered ? '#305870' : '#40c0ff'};min-width:12px;`;
                row.appendChild(indicator);

                const lbl = document.createElement('span');
                const preview = firstText.length > 18 ? firstText.slice(0, 18) + '…' : firstText;
                lbl.textContent = preview;
                lbl.style.cssText = 'flex:1;overflow:hidden;';
                lbl.title = firstText;
                row.appendChild(lbl);

                const fireBtn = this._makeBtn('▶', false);
                fireBtn.title = 'Fire now';
                fireBtn.addEventListener('click', () => {
                    ev.triggered = true;
                    this._runCustomEvent(ev, gameScene);
                    this._rebuildPanel();
                });
                row.appendChild(fireBtn);

                const resetBtn = this._makeBtn('↺', ev.triggered);
                resetBtn.title = 'Reset';
                resetBtn.addEventListener('click', () => { ev.triggered = false; this._rebuildPanel(); });
                row.appendChild(resetBtn);

                const delBtn = this._makeBtn('×', false);
                delBtn.title = 'Delete';
                delBtn.addEventListener('click', () => {
                    this._customEvents.splice(i, 1);
                    this._rebuildPanel();
                });
                row.appendChild(delBtn);

                p.appendChild(row);
            });

            // Export JS
            const exportBtn = this._makeBtn('Export Events JS', false);
            exportBtn.style.cssText += ';display:block;width:100%;text-align:left;margin-top:4px;';
            exportBtn.addEventListener('click', () => this._exportEventsJS());
            p.appendChild(exportBtn);
        }
    },

    // Render the editable lines inside the compose form
    _renderDraftLines(container) {
        container.innerHTML = '';
        const speakers = this._getSpeakers();

        this._draft.elements.forEach((line, i) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'border:1px solid #204060;padding:4px;margin-bottom:3px;';

            // Speaker dropdown
            const sel = document.createElement('select');
            sel.style.cssText = `
                display:block;width:100%;background:#080e18;border:1px solid #204060;
                color:#40c0ff;font-family:'Courier New',monospace;font-size:11px;
                padding:1px;margin-bottom:3px;
            `;
            for (const [key, name] of speakers) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = name;
                if (key === line.speakerKey) opt.selected = true;
                sel.appendChild(opt);
            }
            sel.addEventListener('change', () => { line.speakerKey = sel.value; });
            wrap.appendChild(sel);

            // Text input
            const txt = document.createElement('textarea');
            txt.value = line.text;
            txt.rows = 2;
            txt.style.cssText = `
                display:block;width:100%;background:#080e18;border:1px solid #204060;
                color:#80e0ff;font-family:'Courier New',monospace;font-size:11px;
                padding:2px;resize:vertical;box-sizing:border-box;
            `;
            txt.addEventListener('input', () => { line.text = txt.value; });
            wrap.appendChild(txt);

            // Remove line
            const del = this._makeBtn('× remove line', false);
            del.style.cssText += ';margin-top:2px;font-size:10px;';
            del.addEventListener('click', () => {
                this._draft.elements.splice(i, 1);
                this._renderDraftLines(container);
            });
            wrap.appendChild(del);

            container.appendChild(wrap);
        });
    },

    // ------------------------------------------------------------------ helpers

    _getSpeakers() {
        // Returns [[key, displayName], ...]
        const list = [];
        if (gameScene && gameScene.playerInfo) {
            gameScene.playerInfo.forEach((info, i) => {
                if (info) list.push([`playerInfo_${i}`, `[${i}] ${info.rank} ${info.fName}`]);
            });
            if (gameScene.extraPlayerInfo && gameScene.extraPlayerInfo[0]) {
                list.push(['extraPlayerInfo_0', '[HQ] HQ']);
            }
        } else {
            // Fallback before game starts
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
        const floorMatch = condition.match(/^floor(\d)$/);
        if (floorMatch) return gs.maps[parseInt(floorMatch[1])].playerCounter > 0;
        return false;
    },

    _runCustomEvent(ev, gs) {
        if (!gs) return;
        const elements = ev.elements
            .filter(e => e.text.trim() !== '')
            .map(e => ({ text: e.text, info: this._resolveSpeaker(e.speakerKey, gs) }))
            .filter(e => e.info);
        if (elements.length > 0) gs.addStory({ elements });
    },

    _exportEventsJS() {
        const gs = gameScene;
        const lines = ['// Custom events — paste into createEvents() in src/events.js\n'];
        this._customEvents.forEach((ev, i) => {
            const condStr = ev.condition === 'manual'
                ? 'false /* manual — replace with your condition */'
                : `gs.maps[${ev.condition.replace('floor', '')}].playerCounter > 0`;
            const elements = ev.elements
                .filter(e => e.text.trim() !== '')
                .map(e => {
                    const [obj, idx] = e.speakerKey.split('_');
                    return `            { text: ${JSON.stringify(e.text)}, info: gs.${obj}[${idx}] },`;
                }).join('\n');
            lines.push(`{
    triggered: false,
    condition(gs) { return ${condStr}; },
    run(gs) {
        gs.addStory({ elements: [
${elements}
        ]});
    }
},`);
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/javascript' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'custom_events.js';
        a.click();
        URL.revokeObjectURL(url);
    },

    // ------------------------------------------------------------------ MAP actions

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
        for (const map of gameScene.maps) {
            for (const actor of [...map.enemyActors]) actor.kill(false);
        }
    },

    _exportMap() {
        if (!gameScene) return;
        const data = gameScene.maps.map((map, i) => ({
            floor: i + 1, width: map.width, height: map.height, tiles: map.tileGrid,
        }));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'ghosttactics_map.json';
        a.click();
        URL.revokeObjectURL(url);
    },

    // ------------------------------------------------------------------ UI helpers

    _label(parent, text) {
        const d = document.createElement('div');
        d.textContent = text;
        d.style.cssText = 'color:#305870;margin-top:5px;margin-bottom:2px;';
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
        b.style.cssText = `
            padding: 2px 6px;
            background: ${active ? 'rgba(64,192,255,0.18)' : 'transparent'};
            border: 1px solid ${active ? '#40c0ff' : '#204060'};
            color: ${active ? '#80e0ff' : '#40c0ff'};
            font-family: 'Courier New', monospace;
            font-size: 11px;
            cursor: pointer;
        `;
        return b;
    },
};
