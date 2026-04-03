// Mobile touch controls
// Portrait mode: overrides game dimensions, replaces side HUD with horizontal HTML strip

const MobileControls = {
    enabled: false,
    isPortrait: false,
    _walkOn: false,
    _cards: [],       // DOM elements, one per playerInfo slot
    _ctrlH: 175,      // controls bar height px
    _hudH:  128,      // squad strip height px

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
            flex-shrink:0; width:86px;
            position:relative; overflow:hidden;
            border-radius:6px;
            background:#040c18;
            border:1px solid rgba(40,100,160,0.35);
            cursor:pointer;
            touch-action:manipulation;
        `;

        // Tap to select — passive so horizontal scroll still works
        let _tapStartX = 0, _tapStartY = 0;
        el.addEventListener('touchstart', (e) => {
            _tapStartX = e.touches[0].clientX;
            _tapStartY = e.touches[0].clientY;
        }, { passive: true });
        el.addEventListener('touchend', (e) => {
            const dx = Math.abs(e.changedTouches[0].clientX - _tapStartX);
            const dy = Math.abs(e.changedTouches[0].clientY - _tapStartY);
            if (dx < 10 && dy < 10 && typeof gameScene !== 'undefined' && gameScene) {
                gameScene.selectPlayerActor(idx);
            }
        }, { passive: true });

        // Portrait canvas — fills the full card
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        el.appendChild(canvas);

        // Index — top left
        const idxEl = document.createElement('div');
        idxEl.style.cssText = `
            position:absolute;top:5px;left:6px;z-index:2;
            font-family:'Courier New',monospace;
            font-size:11px;font-weight:bold;color:#b0d8f8;
            text-shadow:0 1px 4px rgba(0,0,0,0.9),0 0 8px rgba(0,0,0,0.8);
            line-height:1;pointer-events:none;
        `;
        idxEl.textContent = String(idx + 1);
        el.appendChild(idxEl);

        // HP% — top right
        const hpEl = document.createElement('div');
        hpEl.style.cssText = `
            position:absolute;top:5px;right:6px;z-index:2;
            font-family:'Courier New',monospace;
            font-size:10px;font-weight:bold;
            text-shadow:0 1px 4px rgba(0,0,0,0.9),0 0 8px rgba(0,0,0,0.8);
            text-align:right;line-height:1;pointer-events:none;
        `;
        el.appendChild(hpEl);

        // Name + title block — bottom overlay with gradient
        const nameBlock = document.createElement('div');
        nameBlock.style.cssText = `
            position:absolute;bottom:0;left:0;right:0;z-index:2;
            padding:16px 4px 5px;
            background:linear-gradient(transparent,rgba(3,8,18,0.72) 40%);
            display:flex;flex-direction:column;align-items:center;gap:1px;
            pointer-events:none;
        `;
        const nameEl = document.createElement('div');
        nameEl.style.cssText = `
            font-family:'Courier New',monospace;
            font-size:10px;font-weight:bold;color:#c8e8ff;
            text-shadow:0 1px 5px rgba(0,0,0,1),0 0 10px rgba(0,0,0,0.9);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            max-width:78px;text-align:center;line-height:1.2;
        `;
        const titleEl = document.createElement('div');
        titleEl.style.cssText = `
            font-family:'Courier New',monospace;
            font-size:7.5px;color:rgba(140,210,240,0.9);
            text-shadow:0 1px 4px rgba(0,0,0,0.9);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            max-width:78px;text-align:center;line-height:1.2;
        `;
        nameBlock.appendChild(nameEl);
        nameBlock.appendChild(titleEl);
        el.appendChild(nameBlock);

        return { el, canvas, hpEl, nameEl, titleEl, drawn: false };
    },

    // ── Canvas 2D portrait renderer (mirrors portrait.js for HTML overlay) ───
    _drawPortrait(canvas, pInfo) {
        const W = canvas.width, H = canvas.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, H);

        const cx = W * 0.5;
        const cy = H * 0.36; // shifted up — forehead clips at top, more face visible

        let fWidth  = (H * 0.72) / pInfo.headRatio;
        let fHeight = H * 0.72;
        if (fWidth > W * 0.88) { fWidth = W * 0.88; fHeight = W * 0.88 * pInfo.headRatio; }

        ctx.strokeStyle = '#40a0c0';
        ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(40,120,160,0.4)';
        ctx.shadowBlur = 2;

        const sgn = x => x >= 0 ? 1 : -1;
        const cheekFn = a => {
            const x = Math.cos(a), y = Math.sin(a);
            if (y > 0) return {
                x: (x + Math.sin(y*Math.PI)*sgn(x)*-pInfo.cheekStrength + Math.sin(y*Math.PI*-2)*-pInfo.cheekWaveStrength*sgn(x)) * fWidth*0.5,
                y: y * fHeight*0.5
            };
            return { x: x*fWidth*0.5, y: y*fHeight*0.5 };
        };
        const L = (x1,y1,x2,y2) => { ctx.beginPath(); ctx.moveTo(cx+x1,cy+y1); ctx.lineTo(cx+x2,cy+y2); ctx.stroke(); };

        // Eyes
        const N = 18, eyeOff = fWidth*0.2*pInfo.eyeSpacing;
        const eyeW = fWidth*0.2*pInfo.eyeWidth, eyeH = eyeW*0.33*pInfo.eyeHeight;
        if (pInfo.eyeStyle < 0) {
            for (let i=0;i<N;i++) {
                const a1=i*Math.PI*2/N, a2=(i+1)*Math.PI*2/N;
                L( eyeOff+Math.cos(a1)*eyeW*.5, Math.sin(a1)*eyeH*.5,  eyeOff+Math.cos(a2)*eyeW*.5, Math.sin(a2)*eyeH*.5);
                L(-eyeOff+Math.cos(a1)*eyeW*.5, Math.sin(a1)*eyeH*.5, -eyeOff+Math.cos(a2)*eyeW*.5, Math.sin(a2)*eyeH*.5);
            }
        } else if (pInfo.eyeStyle === 0) {
            const iW = eyeW*0.8;
            for (let i=0;i<N;i++) {
                const a1=i*Math.PI*2/N, a2=(i+1)*Math.PI*2/N;
                L( eyeOff+Math.cos(a1)*eyeW*.5, Math.sin(a1)*eyeW*.5,  eyeOff+Math.cos(a2)*eyeW*.5, Math.sin(a2)*eyeW*.5);
                L(-eyeOff+Math.cos(a1)*eyeW*.5, Math.sin(a1)*eyeW*.5, -eyeOff+Math.cos(a2)*eyeW*.5, Math.sin(a2)*eyeW*.5);
                L( eyeOff+Math.cos(a1)*iW*.5, Math.sin(a1)*iW*.5,  eyeOff+Math.cos(a2)*iW*.5, Math.sin(a2)*iW*.5);
                L(-eyeOff+Math.cos(a1)*iW*.5, Math.sin(a1)*iW*.5, -eyeOff+Math.cos(a2)*iW*.5, Math.sin(a2)*iW*.5);
            }
        } else {
            const pts=[[eyeW*.5,eyeH*.5],[-eyeW*.5,eyeH*.5],[-eyeW*.5,-eyeH*.5],[eyeW*.5,-eyeH*.5]];
            for (let i=0;i<4;i++) { const [sx,sy]=pts[i],[ex,ey]=pts[(i+1)%4]; L(eyeOff+sx,sy,eyeOff+ex,ey); L(-eyeOff+sx,sy,-eyeOff+ex,ey); }
        }

        // Mouth
        const mP=fHeight*0.3*pInfo.mouthOffset, mM=mP-mP*pInfo.mouthPout, mW=fWidth*0.1*pInfo.mouthWidth;
        L(-mW,mP,0,mM); L(mW,mP,0,mM);

        // Nose + nostrils
        const nH=mP*0.75*pInfo.noseHeight, nSW=(eyeOff-eyeW*.5)*.4*pInfo.noseWidth, nEW=nSW*1.8;
        L(-nSW,0,-nEW,nH); L(nSW,0,nEW,nH);
        for (let i=0;i<6;i++) {
            const a1=Math.PI*-.4+i*Math.PI*.8/6, a2=Math.PI*-.4+(i+1)*Math.PI*.8/6;
            L( nEW+Math.cos(a1)*nSW, nH+Math.sin(a1)*nSW*1.2,  nEW+Math.cos(a2)*nSW, nH+Math.sin(a2)*nSW*1.2);
            L(-nEW-Math.cos(a1)*nSW, nH+Math.sin(a1)*nSW*1.2, -nEW-Math.cos(a2)*nSW, nH+Math.sin(a2)*nSW*1.2);
        }

        // Head outline
        for (let i=0;i<32;i++) { const p1=cheekFn(i*Math.PI*2/32),p2=cheekFn((i+1)*Math.PI*2/32); L(p1.x,p1.y,p2.x,p2.y); }

        // Hair
        if (pInfo.hairStyle===0) {
            for (let i=0;i<=14;i++) { const a=i*Math.PI*-1/15,p=cheekFn(a); L(p.x,p.y,Math.cos(a)*fWidth*.5,Math.sin(a)*fHeight*.2); }
        } else if (pInfo.hairStyle===1) {
            for (let i=0;i<=14;i++) { const a=i*Math.PI*-1/15,p=cheekFn(a); let ya=a+Math.PI*.25; if(ya>0)ya-=Math.PI; L(p.x,p.y,Math.cos(a)*fWidth*.5,Math.max(p.y,Math.sin(ya)*fHeight*.2)); }
        } else if (pInfo.hairStyle===2) {
            for (let i=0;i<=14;i++) { const a=i*Math.PI*-1/15,p=cheekFn(a); const ny=fHeight*-.5+Math.sin(a+Math.PI)*fHeight*.2; L(p.x,Math.max(p.y,ny),Math.cos(a)*fWidth*.5,Math.sin(a)*fHeight*.2); }
        }

        // Beard
        if (pInfo.beardStyle===0) {
            for (let i=0;i<=14;i++) { const a=i*Math.PI/15,p=cheekFn(a); L(p.x,p.y,Math.cos(a)*fWidth*.5,Math.sin(a)*nH*1.3); }
        } else if (pInfo.beardStyle===1) {
            for (let i=0;i<=14;i++) { const a=i*Math.PI/15,p=cheekFn(a); let tx=Math.cos(a)*fWidth*.5; const ty=Math.sin(a)*fHeight*.4; if(p.x<0)tx=Math.max(p.x,tx);else tx=Math.min(p.x,tx); L(p.x,p.y,tx,Math.min(p.y,ty)); }
        }
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

            // Draw portrait once when dimensions are known
            if (!c.drawn && info.portrait) {
                const cw = c.el.offsetWidth  || 86;
                const ch = c.el.offsetHeight || (this._hudH - 10);
                c.canvas.width  = cw;
                c.canvas.height = ch;
                this._drawPortrait(c.canvas, info.portrait);
                c.drawn = true;
            }

            // Active highlight
            c.el.style.borderColor = isActive ? 'rgba(128,200,255,0.75)' : 'rgba(40,100,160,0.35)';
            c.el.style.opacity     = dead ? '0.38' : '1';

            // Name + title
            c.nameEl.textContent  = info.fName;
            c.titleEl.textContent = info.rank;

            // HP%
            if (dead) {
                c.hpEl.textContent = '0%';
                c.hpEl.style.color = 'rgba(100,60,60,0.7)';
            } else {
                const hp    = Math.ceil(actor.health);
                const maxHp = actor.type.maxHealth;
                const pct   = Math.max(0, Math.min(100, Math.round(hp / maxHp * 100)));
                let color = '#40c0a0';
                if (pct < 33) color = '#ff5555';
                else if (pct < 66) color = '#d4a020';
                c.hpEl.textContent = pct + '%';
                c.hpEl.style.color = color;
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
