// Debug overlay — Phaser Graphics layer drawn above game, below HUD
// Feature A: Ghost path + LOS visualiser
// Feature B: Direct actor drag (active on VISUALIZE tab)

const DebugOverlay = {
    _g:        null,   // Phaser Graphics at depth 9
    _dragging: null,   // actor being dragged

    init(scene) {
        this._g = scene.add.graphics();
        this._g.setDepth(9);

        // Actor drag: only active when debug visible
        scene.input.on('pointerdown', (p) => {
            if (!DebugMenu.visible || DebugMenu.activeTab !== 'visualize') return;
            const gs = scene;
            const map = gs.currentRenderMap;
            if (!map) return;
            const worldX = p.x + gs.viewPos.x;
            const worldY = p.y + gs.viewPos.y;
            const RADIUS  = 40;
            let nearest = null, nearestDist = Infinity;
            for (const actor of [...map.playerActors, ...map.enemyActors]) {
                if (actor.isDead) continue;
                const dx = actor.pos.x - worldX, dy = actor.pos.y - worldY;
                const d  = dx * dx + dy * dy;
                if (d < RADIUS * RADIUS && d < nearestDist) { nearest = actor; nearestDist = d; }
            }
            this._dragging = nearest || null;
        });

        scene.input.on('pointermove', (p) => {
            if (!this._dragging) return;
            const gs = scene;
            this._dragging.pos.x = p.x + gs.viewPos.x;
            this._dragging.pos.y = p.y + gs.viewPos.y;
        });

        scene.input.on('pointerup', () => {
            if (this._dragging) {
                this._dragging.path = null; // AI recalculates from new position
                this._dragging = null;
            }
        });
    },

    render(gs) {
        const g = this._g;
        if (!g) return;
        g.clear();
        if (!DebugMenu.visible) return;

        const map = gs.currentRenderMap;
        if (!map) return;

        const vx = gs.viewPos.x;
        const vy = gs.viewPos.y;

        // Ghost A* paths — dotted red lines (short segments spaced 8px)
        for (const actor of map.enemyActors) {
            if (actor.isDead || !actor.path || actor.path.length < 1) continue;
            g.lineStyle(1.5, 0xff4444, 0.8);
            const pts = [{ x: actor.pos.x, y: actor.pos.y }, ...actor.path];
            for (let i = 0; i < pts.length - 1; i++) {
                this._dottedLine(g, pts[i].x - vx, pts[i].y - vy, pts[i+1].x - vx, pts[i+1].y - vy);
            }
        }

        // Ghost → target lines — thin yellow
        for (const actor of map.enemyActors) {
            if (actor.isDead || !actor.target || actor.target.isDead) continue;
            g.lineStyle(1, 0xffdd44, 0.5);
            g.beginPath();
            g.moveTo(actor.pos.x - vx, actor.pos.y - vy);
            g.lineTo(actor.target.pos.x - vx, actor.target.pos.y - vy);
            g.strokePath();
        }

        // Player LOS to each enemy — green if clear, red if blocked
        for (const player of map.playerActors) {
            if (player.isDead) continue;
            for (const enemy of map.enemyActors) {
                if (enemy.isDead) continue;
                const hasLOS = raycastLOS(map, player.pos.x, player.pos.y, enemy.pos.x, enemy.pos.y);
                g.lineStyle(1, hasLOS ? 0x44ff88 : 0xff3333, 0.28);
                g.beginPath();
                g.moveTo(player.pos.x - vx, player.pos.y - vy);
                g.lineTo(enemy.pos.x - vx, enemy.pos.y - vy);
                g.strokePath();
            }
        }

        // Drag highlight — cyan circle around dragged actor
        if (this._dragging && !this._dragging.isDead) {
            g.lineStyle(2, 0x40c0ff, 0.9);
            g.strokeCircle(this._dragging.pos.x - vx, this._dragging.pos.y - vy, 18);
        }
    },

    // Draw a dotted line using alternating visible/invisible segments
    _dottedLine(g, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;
        const nx = dx / len, ny = dy / len;
        const dash = 6, gap = 5;
        let t = 0;
        while (t < len) {
            const t2 = Math.min(t + dash, len);
            g.beginPath();
            g.moveTo(x1 + nx * t,  y1 + ny * t);
            g.lineTo(x1 + nx * t2, y1 + ny * t2);
            g.strokePath();
            t += dash + gap;
        }
    },
};
