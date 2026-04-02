// Mobile touch controls
// Portrait mode: overrides game dimensions, replaces side HUD with horizontal HTML strip

const MobileControls = {
    enabled: false,
    isPortrait: false,
    _walkOn: false,
    _cards: [],       // DOM elements, one per playerInfo slot
    _ctrlH: 175,      // controls bar height px
    _hudH:  120,      // squad strip height px

    // ── Called from gameScene.parseAndInit ──────────────────────────────────
    init() {
        if (!('ontouchstart' in window)) return;
        this.enabled = true;
        this._buildControls();
        this._tapToStart();
        if (this.isPortrait) this._buildHUDStrip();
    },

    // ── Keyboard event helper ────────────────────────────────────────────────
    _key(code, type) {
        window.dispatchEvent(new KeyboardEvent(type, {
            keyCode: code, which: code, bubbles: true, cancelable: true
        }));
    },

    // ── Joystick ─────────────────────────────────────────────────────────────
    _buildJoystick() {
        const wrap = document.createElement('div');
        wrap.style.cssText = `
            position:relative; width:150px; height:150px; flex-shrink:0;
            border-radius:50%;
            border:2px solid rgba(64,192,255,0.3);
            background:rgba(64,192,255,0.04);
            touch-action:none;
        `;
        [['▲','top:7px;left:50%;transform:translateX(-50%)'],
         ['▼','bottom:7px;left:50%;transform:translateX(-50%)'],
         ['◀','left:7px;top:50%;transform:translateY(-50%)'],
         ['▶','right:7px;top:50%;transform:translateY(-50%)']
        ].forEach(([t, s]) => {
            const d = document.createElement('div');
            d.textContent = t;
            d.style.cssText = `position:absolute;${s};
                color:rgba(64,192,255,0.45);font-size:15px;pointer-events:none;`;
            wrap.appendChild(d);
        });

        const thumb = document.createElement('div');
        thumb.style.cssText = `
            position:absolute; width:40px; height:40px; border-radius:50%;
            background:rgba(64,192,255,0.15); border:1px solid rgba(64,192,255,0.5);
            top:50%; left:50%; transform:translate(-50%,-50%);
            pointer-events:none;
        `;
        wrap.appendChild(thumb);

        const DIR = { up: 38, down: 40, left: 37, right: 39 };
        let active = { up: false, down: false, left: false, right: false };

        const update = (e) => {
            e.preventDefault();
            if (!e.touches.length) return release();
            const t = e.touches[0];
            const r = wrap.getBoundingClientRect();
            const dx = t.clientX - (r.left + r.width / 2);
            const dy = t.clientY - (r.top + r.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const dead = 18;
            const maxR = r.width / 2 - 22;
            const ang = Math.atan2(dy, dx);
            const cl = Math.min(dist, maxR);
            thumb.style.transform =
                `translate(calc(-50% + ${Math.cos(ang)*cl}px),calc(-50% + ${Math.sin(ang)*cl}px))`;

            const next = { up: false, down: false, left: false, right: false };
            if (dist > dead) {
                if (Math.abs(dx) > dead * 0.4) next[dx > 0 ? 'right' : 'left'] = true;
                if (Math.abs(dy) > dead * 0.4) next[dy > 0 ? 'down' : 'up']   = true;
            }
            for (const k in DIR) {
                if (next[k] !== active[k]) {
                    this._key(DIR[k], next[k] ? 'keydown' : 'keyup');
                    active[k] = next[k];
                }
            }
        };
        const release = () => {
            thumb.style.transform = 'translate(-50%,-50%)';
            for (const k in DIR) {
                if (active[k]) { this._key(DIR[k], 'keyup'); active[k] = false; }
            }
        };
        const end = (e) => { e.preventDefault(); release(); };
        wrap.addEventListener('touchstart', update, { passive: false });
        wrap.addEventListener('touchmove',  update, { passive: false });
        wrap.addEventListener('touchend',   end,    { passive: false });
        wrap.addEventListener('touchcancel',end,    { passive: false });
        return wrap;
    },

    // ── Generic action button ────────────────────────────────────────────────
    _buildBtn(label, onDown, onUp, extraCss) {
        const btn = document.createElement('div');
        btn.innerHTML = label;
        btn.style.cssText = `
            width:66px; height:66px;
            background:rgba(64,192,255,0.07);
            border:1px solid rgba(64,192,255,0.32);
            border-radius:10px;
            display:flex; align-items:center; justify-content:center;
            flex-direction:column; gap:2px;
            font-family:'Courier New',monospace;
            font-size:11px; color:#40c0ff;
            user-select:none; -webkit-user-select:none;
            touch-action:none; text-align:center; line-height:1.25;
            ${extraCss || ''}
        `;
        const dn = (e) => { e.preventDefault(); onDown(); btn.style.background = 'rgba(64,192,255,0.28)'; };
        const up = (e) => { e.preventDefault(); onUp();   btn.style.background = btn._bgOff; };
        btn._bgOff = 'rgba(64,192,255,0.07)';
        btn.addEventListener('touchstart', dn, { passive: false });
        btn.addEventListener('touchend',   up, { passive: false });
        btn.addEventListener('touchcancel',up, { passive: false });
        return btn;
    },

    // ── Controls bar ─────────────────────────────────────────────────────────
    _buildControls() {
        const bar = document.createElement('div');
        bar.id = 'mc-controls';
        bar.style.cssText = `
            position:fixed; bottom:0; left:0; width:100%;
            height:${this._ctrlH}px;
            display:flex; align-items:center; justify-content:space-between;
            padding:10px 18px 16px; box-sizing:border-box;
            background:rgba(5,10,20,0.92);
            border-top:1px solid rgba(64,192,255,0.15);
            z-index:9999;
        `;
        bar.appendChild(this._buildJoystick());

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:7px;';

        grid.appendChild(this._buildBtn('NEXT<br>UNIT',
            () => this._key(9,  'keydown'), () => this._key(9,  'keyup')));
        grid.appendChild(this._buildBtn('USE<br>STAIRS',
            () => this._key(13, 'keydown'), () => this._key(13, 'keyup')));

        // WALK — toggle
        const walkBtn = this._buildBtn('WALK', () => {}, () => {});
        walkBtn.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopImmediatePropagation();
            this._walkOn = !this._walkOn;
            if (this._walkOn) {
                this._key(16, 'keydown');
                walkBtn.style.background = 'rgba(64,192,255,0.35)';
                walkBtn._bgOff = 'rgba(64,192,255,0.35)';
                walkBtn.style.borderColor = 'rgba(64,192,255,0.75)';
            } else {
                this._key(16, 'keyup');
                walkBtn.style.background = 'rgba(64,192,255,0.07)';
                walkBtn._bgOff = 'rgba(64,192,255,0.07)';
                walkBtn.style.borderColor = 'rgba(64,192,255,0.32)';
            }
        }, { passive: false });
        grid.appendChild(walkBtn);

        grid.appendChild(this._buildBtn('HUSTLE',
            () => { this._key(16, 'keydown'); this._key(13, 'keydown'); },
            () => { this._key(13, 'keyup'); if (!this._walkOn) this._key(16, 'keyup'); }));

        bar.appendChild(grid);
        document.body.appendChild(bar);
    },

    // ── HUD strip (portrait only) ─────────────────────────────────────────────
    _buildHUDStrip() {
        const strip = document.createElement('div');
        strip.id = 'mc-hud';
        strip.style.cssText = `
            position:fixed;
            bottom:${this._ctrlH}px; left:0; width:100%;
            height:${this._hudH}px;
            display:flex; align-items:stretch;
            padding:5px 5px;
            gap:4px;
            box-sizing:border-box;
            overflow-x:auto; overflow-y:hidden;
            background:#050a14;
            border-top:1px solid rgba(64,192,255,0.22);
            border-bottom:1px solid rgba(64,192,255,0.1);
            z-index:9998;
            -webkit-overflow-scrolling:touch;
            scrollbar-width:none;
        `;
        strip.style.cssText += '::-webkit-scrollbar{display:none}';

        // Create 8 cards (one per player slot)
        for (let i = 0; i < 8; i++) {
            const card = this._buildCard(i);
            strip.appendChild(card.el);
            this._cards.push(card);
        }
        document.body.appendChild(strip);
    },

    _buildCard(idx) {
        const el = document.createElement('div');
        el.style.cssText = `
            flex-shrink:0; width:80px;
            border:1px solid rgba(64,192,255,0.18);
            border-radius:5px;
            background:rgba(64,192,255,0.03);
            display:flex; flex-direction:column;
            padding:4px 4px 3px;
            gap:2px;
            cursor:pointer;
            touch-action:manipulation;
            font-family:'Courier New',monospace;
        `;

        // Tap to select unit
        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (typeof gameScene !== 'undefined' && gameScene) {
                gameScene.selectPlayerActor(idx);
            }
        }, { passive: false });

        // Top row: portrait + name/rank
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex;gap:3px;align-items:flex-start;';

        const portrait = document.createElement('div');
        portrait.style.cssText = `
            width:28px; height:32px; flex-shrink:0;
            border:1px solid rgba(64,192,255,0.3);
            background:#030d1a; border-radius:2px;
            position:relative; overflow:hidden;
        `;
        // Simple CSS face
        portrait.innerHTML = `
            <div style="position:absolute;width:14px;height:16px;
                border-radius:50% 50% 40% 40%;background:rgba(64,192,255,0.2);
                top:5px;left:6px;"></div>
            <div style="position:absolute;width:5px;height:2px;
                border-radius:50%;background:rgba(64,192,255,0.28);
                bottom:5px;left:11px;"></div>
        `;

        const nameBlock = document.createElement('div');
        nameBlock.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;overflow:hidden;';

        const idxName = document.createElement('div');
        idxName.style.cssText = `
            font-size:10px; font-weight:bold; color:#80e0ff;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        `;

        const rank = document.createElement('div');
        rank.style.cssText = `
            font-size:8.5px; color:#305870;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
            line-height:1.2;
        `;

        nameBlock.appendChild(idxName);
        nameBlock.appendChild(rank);
        topRow.appendChild(portrait);
        topRow.appendChild(nameBlock);

        // Health row
        const healthRow = document.createElement('div');
        healthRow.style.cssText = 'display:flex;align-items:center;gap:3px;';

        const bar = document.createElement('div');
        bar.style.cssText = `flex:1;height:4px;background:rgba(64,192,255,0.12);border-radius:2px;overflow:hidden;`;
        const fill = document.createElement('div');
        fill.style.cssText = 'height:100%;border-radius:2px;width:100%;background:#40c0a0;transition:width .2s;';
        bar.appendChild(fill);

        const hpNum = document.createElement('div');
        hpNum.style.cssText = 'font-size:9px;color:#406070;min-width:20px;text-align:right;';

        healthRow.appendChild(bar);
        healthRow.appendChild(hpNum);

        // Bottom row: kills + status
        const bottomRow = document.createElement('div');
        bottomRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';

        const kills = document.createElement('div');
        kills.style.cssText = 'font-size:9px;color:#304858;';

        const status = document.createElement('div');
        status.style.cssText = 'font-size:9px;';

        bottomRow.appendChild(kills);
        bottomRow.appendChild(status);

        el.appendChild(topRow);
        el.appendChild(healthRow);
        el.appendChild(bottomRow);

        return { el, idxName, rank, fill, hpNum, kills, status };
    },

    // ── Called each frame from gameScene.gameRender ──────────────────────────
    updateHUD(scene) {
        for (let i = 0; i < this._cards.length; i++) {
            const c = this._cards[i];
            const info = scene.playerInfo[i];
            if (!info) { c.el.style.display = 'none'; continue; }

            const isActive = (i === scene.currentControlPlayer);
            const actor = info.actor;
            const dead = !actor || actor.isDead || info.status === 'DEAD';

            // Active highlight
            c.el.style.borderColor  = isActive ? 'rgba(128,224,255,0.75)' : 'rgba(64,192,255,0.18)';
            c.el.style.background   = isActive ? 'rgba(64,192,255,0.09)'  : 'rgba(64,192,255,0.03)';
            c.el.style.opacity      = dead ? '0.38' : '1';

            c.idxName.textContent   = `${i+1}· ${info.fName}`;
            c.rank.textContent      = info.rank;
            c.kills.textContent     = `K:${info.kills}`;

            if (dead) {
                c.fill.style.width      = '0%';
                c.fill.style.background = '#804040';
                c.hpNum.style.color     = '#804040';
                c.hpNum.textContent     = '0';
                c.status.textContent    = '✕ DEAD';
                c.status.style.color    = '#804040';
            } else {
                const hp    = Math.ceil(actor.health);
                const maxHp = actor.type.maxHealth;
                const pct   = Math.max(0, Math.min(100, hp / maxHp * 100));
                let color   = '#40c0a0';
                let statusTxt = '● OK';
                let statusCol = '#40c080';
                if (pct < 33) {
                    color = '#ff4040'; statusTxt = '▲ LOW'; statusCol = '#ff4040';
                } else if (pct < 66) {
                    color = '#c0a040'; statusTxt = '● MID'; statusCol = '#c0a040';
                }
                c.fill.style.width      = pct + '%';
                c.fill.style.background = color;
                c.hpNum.style.color     = color;
                c.hpNum.textContent     = hp;
                c.status.textContent    = statusTxt;
                c.status.style.color    = statusCol;
            }
        }
    },

    // ── Tap anywhere on title screen to start ────────────────────────────────
    _tapToStart() {
        document.body.addEventListener('touchstart', (e) => {
            if (typeof gameScene === 'undefined' || !gameScene || !gameScene.atTitleScreen) return;
            if (e.target.closest('#mc-controls') || e.target.closest('#mc-hud')) return;
            this._key(32, 'keydown');
            setTimeout(() => this._key(32, 'keyup'), 80);
        }, { passive: true });
    },
};

// ── Portrait dimension override — runs at script load, before Phaser starts ──
(function () {
    if (!('ontouchstart' in window)) return;
    if (window.innerHeight <= window.innerWidth) return;  // not portrait

    MobileControls.isPortrait = true;
    const ctrlH = MobileControls._ctrlH;
    const hudH  = MobileControls._hudH;

    GAME_WIDTH      = Math.round(window.innerWidth);
    GAME_HEIGHT     = Math.round(window.innerHeight - ctrlH - hudH);
    HUD_WIDTH       = 0;
    HUD_CHAT_HEIGHT = Math.round(GAME_HEIGHT * 0.22);

    // Game canvas container — Phaser will render into this
    const wrap = document.createElement('div');
    wrap.id = 'mc-game-wrap';
    wrap.style.cssText = `
        position:fixed; top:0; left:0;
        width:${GAME_WIDTH}px; height:${GAME_HEIGHT}px;
        overflow:hidden;
    `;
    document.body.appendChild(wrap);
})();
