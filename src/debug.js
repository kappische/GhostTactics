// In-game debug menu — toggle with backtick (`)
// Tile painter, spawning, event control, map export

const DebugMenu = {
    visible: false,
    selectedTile: 'block',
    editMapIndex: 0,
    godMode: false,
    _panel: null,
    _painting: false,

    init(gs) {
        this._buildPanel();
        // Pointer painting on the Phaser canvas
        gs.input.on('pointerdown', (p) => { this._painting = true;  this._tryPaint(p, gs); });
        gs.input.on('pointermove', (p) => { if (this._painting) this._tryPaint(p, gs); });
        gs.input.on('pointerup',   ()  => { this._painting = false; });
    },

    toggle() {
        this.visible = !this.visible;
        this._panel.style.display = this.visible ? 'flex' : 'none';
    },

    // Called every frame from gameScene so god mode stays active
    update(gs) {
        if (!this.godMode) return;
        for (const map of gs.maps) {
            for (const actor of map.playerActors) {
                if (!actor.isDead) actor.health = Math.max(actor.health, actor.maxHealth);
            }
        }
    },

    _tryPaint(pointer, gs) {
        if (!this.visible || gs.atTitleScreen) return;
        const worldX = pointer.x + gs.viewPos.x;
        const worldY = pointer.y + gs.viewPos.y;
        const tileX = Math.floor(worldX / TILE_SIZE);
        const tileY = Math.floor(worldY / TILE_SIZE);
        if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;
        const tileName = this.selectedTile === '(erase)' ? null : this.selectedTile;
        gs.maps[this.editMapIndex].setTile(tileX, tileY, tileName);
    },

    _buildPanel() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        Object.assign(panel.style, {
            display:        'none',
            position:       'fixed',
            top:            '10px',
            right:          '10px',
            width:          '200px',
            maxHeight:      '92vh',
            overflowY:      'auto',
            background:     'rgba(5,10,20,0.96)',
            border:         '1px solid #40c0ff',
            color:          '#40c0ff',
            fontFamily:     "'Courier New', monospace",
            fontSize:       '11px',
            flexDirection:  'column',
            gap:            '3px',
            padding:        '8px',
            zIndex:         '9999',
            userSelect:     'none',
            lineHeight:     '1.4',
        });
        document.body.appendChild(panel);
        this._panel = panel;
        this._rebuildPanel();
    },

    _rebuildPanel() {
        const p = this._panel;
        p.innerHTML = '';

        this._section(p, 'DEBUG  [` toggle]', true);

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
            const isErase = name === '(erase)';
            const tileType = isErase ? null : TILES[name];
            const ec = tileType && tileType.editColor;
            const bg = ec
                ? `rgba(${ec.r},${ec.g},${ec.b},0.25)`
                : 'rgba(60,60,60,0.2)';
            const isSelected = this.selectedTile === name;
            const btn = this._makeBtn(isErase ? '× erase' : name, isSelected);
            btn.style.background = isSelected ? 'rgba(64,192,255,0.22)' : bg;
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.style.marginBottom = '2px';
            btn.addEventListener('click', () => {
                this.selectedTile = name;
                this._rebuildPanel();
            });
            p.appendChild(btn);
        }

        // Actions
        this._label(p, 'ACTIONS');
        const actions = [
            ['Spawn Ghost',         () => this._spawnAtCenter(false)],
            ['Spawn Super Ghost',   () => this._spawnAtCenter(true)],
            ['Kill All Enemies',    () => this._killAllEnemies()],
            [this.godMode ? 'God Mode: ON ✓' : 'God Mode: OFF',
                                    () => { this.godMode = !this.godMode; this._rebuildPanel(); }],
            ['Fire Next Event',     () => this._fireNextEvent()],
            ['Export Map JSON',     () => this._exportMap()],
        ];
        for (const [label, fn] of actions) {
            const btn = this._makeBtn(label, false);
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.style.marginBottom = '2px';
            btn.addEventListener('click', fn);
            p.appendChild(btn);
        }
    },

    // ---- UI helpers ----

    _section(parent, text, bright) {
        const d = document.createElement('div');
        d.textContent = text;
        d.style.cssText = `color:${bright ? '#80e0ff' : '#305870'};border-bottom:1px solid #204060;padding-bottom:3px;margin-bottom:3px;`;
        parent.appendChild(d);
    },

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

    // ---- Actions ----

    _spawnAtCenter(isSuper) {
        if (!gameScene || gameScene.atTitleScreen) return;
        const map = gameScene.maps[this.editMapIndex];
        const cx = gameScene.viewPos.x + (GAME_WIDTH - HUD_WIDTH) / 2;
        const cy = gameScene.viewPos.y + GAME_HEIGHT / 2;
        const actor = new Actor(isSuper ? ACTORS.superGhost : ACTORS.ghost, cx, cy, map);
        map.addEnemyActor(actor);
        ImpactEffects.ghostSpawn(map, cx, cy);
    },

    _killAllEnemies() {
        if (!gameScene) return;
        for (const map of gameScene.maps) {
            for (const actor of [...map.enemyActors]) {
                actor.kill(false);
            }
        }
    },

    _fireNextEvent() {
        if (!gameScene) return;
        const event = gameScene.events.find(e => !e.triggered);
        if (event) {
            event.triggered = true;
            event.run(gameScene);
        }
    },

    _exportMap() {
        if (!gameScene) return;
        const data = gameScene.maps.map((map, i) => ({
            floor: i + 1,
            width: map.width,
            height: map.height,
            tiles: map.tileGrid,
        }));
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ghosttactics_map.json';
        a.click();
        URL.revokeObjectURL(url);
    },
};
