// Options / Pause menu — toggle with Escape key
// Pauses gameplay, provides audio sliders for Master, SFX, Voice, and Music.

const OptionsMenu = {
    visible: false,
    _overlay: null,
    _panel:   null,

    // ── init ─────────────────────────────────────────────────────────────────

    init(gs) {
        this._buildDOM();
    },

    toggle(gs) {
        this.visible = !this.visible;
        this._overlay.style.display = this.visible ? 'flex' : 'none';
        if (this.visible) this._rebuildPanel(gs);
    },

    close(gs) {
        this.visible = false;
        this._overlay.style.display = 'none';
    },

    // ── DOM ───────────────────────────────────────────────────────────────────

    _buildDOM() {
        // Full-screen semi-transparent backdrop
        const overlay = document.createElement('div');
        overlay.id = 'options-overlay';
        Object.assign(overlay.style, {
            display:         'none',
            position:        'fixed',
            inset:           '0',
            background:      'rgba(0,5,12,0.82)',
            zIndex:          '8000',
            alignItems:      'center',
            justifyContent:  'center',
            fontFamily:      "'Courier New', monospace",
        });
        document.body.appendChild(overlay);
        this._overlay = overlay;

        const panel = document.createElement('div');
        Object.assign(panel.style, {
            background:     'rgba(5,10,20,0.98)',
            border:         '1px solid #40c0ff',
            color:          '#40c0ff',
            fontFamily:     "'Courier New', monospace",
            fontSize:       '13px',
            padding:        '28px 32px',
            width:          '340px',
            display:        'flex',
            flexDirection:  'column',
            gap:            '0px',
        });
        overlay.appendChild(panel);
        this._panel = panel;
    },

    _rebuildPanel(gs) {
        const p = this._panel;
        p.innerHTML = '';

        // Header
        const hdr = document.createElement('div');
        hdr.textContent = gs && !gs.atTitleScreen ? 'PAUSED' : 'OPTIONS';
        Object.assign(hdr.style, {
            color:         '#80e0ff',
            fontSize:      '18px',
            letterSpacing: '0.15em',
            marginBottom:  '20px',
            borderBottom:  '1px solid #204060',
            paddingBottom: '10px',
        });
        p.appendChild(hdr);

        if (!gs) {
            const note = document.createElement('div');
            note.textContent = 'Start the game first.';
            note.style.color = '#305870';
            p.appendChild(note);
            return;
        }

        const s = gs._settings;

        // Audio section label
        this._sectionLabel(p, 'AUDIO');

        // Master Volume
        this._slider(p, 'Master', s.masterVolume, 0, 1, 0.05, (v) => {
            s.masterVolume = v;
            this._saveSettings(gs);
        });

        // SFX Volume
        this._slider(p, 'SFX', s.sfxVolume, 0, 1, 0.05, (v) => {
            s.sfxVolume = v;
            this._saveSettings(gs);
        });

        // Voice Volume
        this._slider(p, 'Voice', s.voiceVolume, 0, 1, 0.05, (v) => {
            s.voiceVolume = v;
            this._saveSettings(gs);
        });

        // Music Volume
        this._slider(p, 'Music', s.musicVolume, 0, 1, 0.05, (v) => {
            s.musicVolume = v;
            // Apply immediately to live music
            if (gs.currentMusic && gs.currentMusic.obj) {
                gs.currentMusic.obj.volume = gs.currentMusic.volume * v;
            }
            this._saveSettings(gs);
        });

        // Buttons
        this._sectionLabel(p, '');

        if (!gs.atTitleScreen) {
            const resumeBtn = this._makeBtn('Resume  [Esc]', true);
            resumeBtn.style.marginBottom = '8px';
            resumeBtn.addEventListener('click', () => this.close(gs));
            p.appendChild(resumeBtn);
        }

        const restartBtn = this._makeBtn(gs.atTitleScreen ? 'Close  [Esc]' : 'Restart', false);
        restartBtn.addEventListener('click', () => {
            this.close(gs);
            if (!gs.atTitleScreen) gs.scene.restart();
        });
        p.appendChild(restartBtn);
    },

    _saveSettings(gs) {
        try {
            localStorage.setItem('ghostTacticsSettings', JSON.stringify(gs._settings));
        } catch(e) {}
    },

    // ── UI helpers ────────────────────────────────────────────────────────────

    _sectionLabel(parent, text) {
        const d = document.createElement('div');
        d.textContent = text;
        Object.assign(d.style, {
            color:         '#305870',
            fontSize:      '10px',
            letterSpacing: '0.08em',
            marginTop:     '12px',
            marginBottom:  '6px',
        });
        parent.appendChild(d);
    },

    _slider(parent, label, value, min, max, step, onChange) {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            display:       'flex',
            alignItems:    'center',
            gap:           '10px',
            marginBottom:  '10px',
        });

        const lbl = document.createElement('div');
        lbl.textContent = label;
        Object.assign(lbl.style, {
            width:      '50px',
            flexShrink: '0',
            color:      '#80c0e0',
            fontSize:   '12px',
        });
        wrap.appendChild(lbl);

        const input = document.createElement('input');
        input.type  = 'range';
        input.min   = min;
        input.max   = max;
        input.step  = step;
        input.value = value;
        Object.assign(input.style, {
            flex:         '1',
            accentColor:  '#40c0ff',
            cursor:       'pointer',
            height:       '16px',
        });

        const pct = document.createElement('div');
        pct.textContent = Math.round(value * 100) + '%';
        Object.assign(pct.style, {
            width:     '36px',
            textAlign: 'right',
            color:     '#40c0ff',
            fontSize:  '12px',
            flexShrink: '0',
        });

        input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            pct.textContent = Math.round(v * 100) + '%';
            onChange(v);
        });

        wrap.appendChild(input);
        wrap.appendChild(pct);
        parent.appendChild(wrap);
    },

    _makeBtn(text, primary) {
        const b = document.createElement('button');
        b.textContent = text;
        Object.assign(b.style, {
            display:     'block',
            width:       '100%',
            padding:     '8px 12px',
            background:  primary ? 'rgba(64,192,255,0.14)' : 'transparent',
            border:      `1px solid ${primary ? '#40c0ff' : '#204060'}`,
            color:       primary ? '#80e0ff' : '#40c0ff',
            fontFamily:  "'Courier New', monospace",
            fontSize:    '12px',
            letterSpacing: '0.05em',
            cursor:      'pointer',
            textAlign:   'left',
            marginBottom: '6px',
        });
        b.addEventListener('mouseenter', () => { b.style.background = 'rgba(64,192,255,0.22)'; });
        b.addEventListener('mouseleave', () => { b.style.background = primary ? 'rgba(64,192,255,0.14)' : 'transparent'; });
        return b;
    },
};
