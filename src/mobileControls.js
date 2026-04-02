// Mobile touch controls — joystick + action buttons
// Dispatches real KeyboardEvents so actor.js needs no changes

const MobileControls = {
    enabled: false,
    _walkOn: false,

    init() {
        if (!('ontouchstart' in window)) return;
        this.enabled = true;
        this._buildUI();
        this._tapToStart();
    },

    _key(code, type) {
        window.dispatchEvent(new KeyboardEvent(type, {
            keyCode: code, which: code, bubbles: true, cancelable: true
        }));
    },

    // ── Joystick ────────────────────────────────────────────────────────────
    _buildJoystick() {
        const wrap = document.createElement('div');
        wrap.style.cssText = `
            position:relative; width:160px; height:160px;
            border-radius:50%;
            border:2px solid rgba(64,192,255,0.35);
            background:rgba(64,192,255,0.04);
            flex-shrink:0; touch-action:none;
        `;

        // Direction labels
        [['▲','top:6px;left:50%;transform:translateX(-50%)'],
         ['▼','bottom:6px;left:50%;transform:translateX(-50%)'],
         ['◀','left:6px;top:50%;transform:translateY(-50%)'],
         ['▶','right:6px;top:50%;transform:translateY(-50%)']
        ].forEach(([t,s]) => {
            const d = document.createElement('div');
            d.textContent = t;
            d.style.cssText = `position:absolute;${s};
                color:rgba(64,192,255,0.5);font-size:16px;pointer-events:none;`;
            wrap.appendChild(d);
        });

        // Thumb dot
        const thumb = document.createElement('div');
        thumb.style.cssText = `
            position:absolute; width:40px; height:40px; border-radius:50%;
            background:rgba(64,192,255,0.18); border:1px solid rgba(64,192,255,0.5);
            top:50%; left:50%; transform:translate(-50%,-50%);
            pointer-events:none; transition:opacity .1s;
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

            // Move thumb
            const maxR = r.width / 2 - 20;
            const clamp = Math.min(dist, maxR);
            const ang = Math.atan2(dy, dx);
            thumb.style.transform = `translate(calc(-50% + ${Math.cos(ang)*clamp}px),`
                                  + `calc(-50% + ${Math.sin(ang)*clamp}px))`;

            const next = { up: false, down: false, left: false, right: false };
            if (dist > dead) {
                if (Math.abs(dx) > dead * 0.4) next[dx > 0 ? 'right' : 'left'] = true;
                if (Math.abs(dy) > dead * 0.4) next[dy > 0 ? 'down' : 'up'] = true;
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

    // ── Action button ────────────────────────────────────────────────────────
    _buildBtn(label, onDown, onUp, extraCss) {
        const btn = document.createElement('div');
        btn.innerHTML = label;
        btn.style.cssText = `
            width:70px; height:70px;
            background:rgba(64,192,255,0.08);
            border:1px solid rgba(64,192,255,0.35);
            border-radius:10px;
            display:flex; align-items:center; justify-content:center;
            font-family:'Courier New',monospace;
            font-size:14px; color:#40c0ff;
            user-select:none; -webkit-user-select:none;
            touch-action:none; text-align:center; line-height:1.2;
            ${extraCss || ''}
        `;
        const dn = (e) => { e.preventDefault(); onDown(); btn.style.background = 'rgba(64,192,255,0.3)'; };
        const up = (e) => { e.preventDefault(); onUp();   btn.style.background = btn._bgOff || 'rgba(64,192,255,0.08)'; };
        btn.addEventListener('touchstart', dn, { passive: false });
        btn.addEventListener('touchend',   up, { passive: false });
        btn.addEventListener('touchcancel',up, { passive: false });
        btn._bgOff = 'rgba(64,192,255,0.08)';
        return btn;
    },

    // ── Full UI ──────────────────────────────────────────────────────────────
    _buildUI() {
        const bar = document.createElement('div');
        bar.id = 'mobile-controls';
        bar.style.cssText = `
            position:fixed; bottom:0; left:0; width:100%;
            display:flex; align-items:center; justify-content:space-between;
            padding:12px 20px 16px; box-sizing:border-box;
            background:rgba(5,10,20,0.75);
            border-top:1px solid rgba(64,192,255,0.18);
            z-index:9999;
        `;

        bar.appendChild(this._buildJoystick());

        // Action buttons grid
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';

        // TAB — next unit
        grid.appendChild(this._buildBtn('NEXT<br>UNIT',
            () => this._key(9, 'keydown'),
            () => this._key(9, 'keyup')));

        // ENTER — use stairs / confirm
        grid.appendChild(this._buildBtn('USE<br>STAIRS',
            () => this._key(13, 'keydown'),
            () => this._key(13, 'keyup')));

        // WALK toggle
        const walkBtn = this._buildBtn('WALK', () => {}, () => {});
        walkBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._walkOn = !this._walkOn;
            if (this._walkOn) {
                this._key(16, 'keydown');
                walkBtn.style.background = 'rgba(64,192,255,0.4)';
                walkBtn._bgOff = 'rgba(64,192,255,0.4)';
                walkBtn.style.borderColor = 'rgba(64,192,255,0.8)';
            } else {
                this._key(16, 'keyup');
                walkBtn.style.background = 'rgba(64,192,255,0.08)';
                walkBtn._bgOff = 'rgba(64,192,255,0.08)';
                walkBtn.style.borderColor = 'rgba(64,192,255,0.35)';
            }
        }, { passive: false });
        grid.appendChild(walkBtn);

        // HUSTLE (Shift+Enter at stairs)
        grid.appendChild(this._buildBtn('HUSTLE',
            () => { this._key(16, 'keydown'); this._key(13, 'keydown'); },
            () => { this._key(13, 'keyup');
                    if (!this._walkOn) this._key(16, 'keyup'); }));

        bar.appendChild(grid);
        document.body.appendChild(bar);
    },

    // ── Tap-to-start anywhere on title screen ────────────────────────────────
    _tapToStart() {
        document.body.addEventListener('touchstart', (e) => {
            if (typeof gameScene !== 'undefined' && gameScene && gameScene.atTitleScreen) {
                // Don't fire if touch is on the controls bar
                if (e.target.closest('#mobile-controls')) return;
                this._key(32, 'keydown');
                setTimeout(() => this._key(32, 'keyup'), 80);
            }
        }, { passive: true });
    },
};
