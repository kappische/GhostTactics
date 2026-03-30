// Equipment system ported from equipment.lua

const SCANNER_RANGE = 800;
const SCANNER_ANGLE = Math.PI * 0.02;

class Equipment {
    constructor(type, actor, attachPos) {
        this.actor = actor;
        this.attachPos = { ...attachPos };
        this.type = type;
        this.data = JSON.parse(JSON.stringify(type.data));
    }

    update(time) {
        if (this.type.updateMethod) {
            this.type.updateMethod(this, time);
        }
    }

    render(graphics, viewPos) {
        if (this.type.renderMethod) {
            this.type.renderMethod(this, this.attachPos, graphics, viewPos);
        }
    }
}

const EQUIPMENT = {
    rifle: {
        data: { reloadTimer: 0 },
        updateMethod(eq, time) {
            if (eq.actor && eq.actor.target && !eq.actor.isRunning) {
                eq.data.reloadTimer -= time;
                if (eq.data.reloadTimer < 0) {
                    eq.data.reloadTimer = 0.12;

                    if (gameScene) gameScene.playGameSound('shoot');

                    const actor = eq.actor;
                    const o = VectorMath.rotate(eq.attachPos.x, eq.attachPos.y, actor.angle);
                    const cx = o.x + actor.pos.x;
                    const cy = o.y + actor.pos.y;
                    ImpactEffects.muzzleFlash(actor.map, cx, cy, actor.angle);
                    const spread = Math.PI * ((-0.5 + Math.random()) * 0.05);
                    actor.map.addObject(new GameObject(OBJECTS.bullet, cx, cy, actor.angle + spread, actor, actor.map));
                }
            }
        },
        renderMethod(eq, attachPos, graphics, viewPos) {
            if (!eq.actor.isRunning) {
                const actor = eq.actor;
                const o = VectorMath.rotate(attachPos.x, attachPos.y, actor.angle);
                const cx = o.x + actor.pos.x - viewPos.x;
                const cy = o.y + actor.pos.y - viewPos.y;

                graphics.lineStyle(1, Theme.weapon, 1);
                let s = VectorMath.rotate(5, 0, actor.angle);
                let e = VectorMath.rotate(-10, -3, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
                e = VectorMath.rotate(-10, 3, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
                s = VectorMath.rotate(-10, -3, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
            }
        }
    },

    shotgun: {
        data: { reloadTimer: 0 },
        updateMethod(eq, time) {
            eq.data.reloadTimer -= time;
            if (eq.actor && eq.actor.target && !eq.actor.isRunning) {
                if (eq.data.reloadTimer < 0) {
                    const actor = eq.actor;
                    const o = VectorMath.rotate(eq.attachPos.x, eq.attachPos.y, actor.angle);
                    const cx = o.x + actor.pos.x;
                    const cy = o.y + actor.pos.y;
                    const angleToTarget = MathUtils.angleBetweenPoints(cx, cy, actor.target.pos.x, actor.target.pos.y);
                    if (MathUtils.angleDifferenceAbs(actor.angle, angleToTarget) < Math.PI * 0.05) {
                        eq.data.reloadTimer = 0.8;
                        if (gameScene) gameScene.playGameSound('shotgun');
                        ImpactEffects.muzzleFlash(actor.map, cx, cy, actor.angle);
                        ImpactEffects.muzzleFlash(actor.map, cx, cy, actor.angle); // double for shotgun
                        for (let i = 0; i < 10; i++) {
                            const spread = Math.PI * ((-0.5 + Math.random()) * 0.15);
                            actor.map.addObject(new GameObject(OBJECTS.pellet, cx, cy, actor.angle + spread, actor, actor.map));
                        }
                    }
                }
            }
        },
        renderMethod(eq, attachPos, graphics, viewPos) {
            if (!eq.actor.isRunning) {
                const actor = eq.actor;
                const o = VectorMath.rotate(attachPos.x, attachPos.y, actor.angle);
                const cx = o.x + actor.pos.x - viewPos.x;
                const cy = o.y + actor.pos.y - viewPos.y;
                graphics.lineStyle(1, Theme.weapon, 1);

                let s = VectorMath.rotate(5, 0, actor.angle);
                let e = VectorMath.rotate(-10, 0, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
                s = VectorMath.rotate(5, -3, actor.angle);
                e = VectorMath.rotate(-10, -3, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
                s = VectorMath.rotate(5, 3, actor.angle);
                e = VectorMath.rotate(-10, 3, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
                s = VectorMath.rotate(-10, 3, actor.angle);
                e = VectorMath.rotate(-10, -3, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
            }
        }
    },

    pistol: {
        data: { reloadTimer: 0 },
        updateMethod(eq, time) {
            if (eq.actor && eq.actor.target && !eq.actor.isRunning) {
                eq.data.reloadTimer -= time;
                if (eq.data.reloadTimer < 0) {
                    eq.data.reloadTimer = 0.5;
                    if (gameScene) gameScene.playGameSound('shoot');
                    const actor = eq.actor;
                    const o = VectorMath.rotate(eq.attachPos.x, eq.attachPos.y, actor.angle);
                    const cx = o.x + actor.pos.x;
                    const cy = o.y + actor.pos.y;
                    const realAngle = MathUtils.angleBetweenPoints(cx, cy, actor.target.pos.x, actor.target.pos.y);
                    ImpactEffects.muzzleFlash(actor.map, cx, cy, realAngle);
                    actor.map.addObject(new GameObject(OBJECTS.bullet, cx, cy, realAngle, actor, actor.map));
                }
            }
        },
        renderMethod(eq, attachPos, graphics, viewPos) {
            if (!eq.actor.isRunning) {
                const actor = eq.actor;
                const o = VectorMath.rotate(attachPos.x, attachPos.y, actor.angle);
                const cx = o.x + actor.pos.x - viewPos.x;
                const cy = o.y + actor.pos.y - viewPos.y;
                graphics.lineStyle(1, Theme.weapon, 1);
                let s = VectorMath.rotate(5, 0, actor.angle);
                let e = VectorMath.rotate(-10, -3, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
                e = VectorMath.rotate(-10, 3, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
                s = VectorMath.rotate(-10, -3, actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
            }
        }
    },

    healer: {
        data: { selfHealTime: 1, otherHealTime: 1 },
        updateMethod(eq, time) {
            const owner = eq.actor;
            if (!owner) return;

            if (owner.health < owner.type.maxHealth) {
                eq.data.selfHealTime -= time;
                if (eq.data.selfHealTime <= 0) {
                    eq.data.selfHealTime += 1;
                    owner.onHeal(Math.floor(Math.random() * 11) + 5);
                    ImpactEffects.healEffect(owner.map, owner.pos.x, owner.pos.y);
                    if (gameScene) gameScene.playGameSound('heal');
                }
            }

            eq.data.otherHealTime -= time;
            if (eq.data.otherHealTime <= 0) {
                eq.data.otherHealTime += 0.5;
                for (const player of owner.map.playerActors) {
                    if (player !== owner && player.health < player.type.maxHealth) {
                        const dist = MathUtils.distance(owner.pos.x, owner.pos.y, player.pos.x, player.pos.y);
                        const angle = MathUtils.angleBetweenPoints(owner.pos.x, owner.pos.y, player.pos.x, player.pos.y);
                        if (dist < TILE_SIZE * 1.5 && MathUtils.angleDifferenceAbs(owner.angle, angle) < Math.PI * 0.2) {
                            player.onHeal(Math.floor(Math.random() * 11) + 5);
                            ImpactEffects.healEffect(player.map, player.pos.x, player.pos.y);
                            if (gameScene) gameScene.playGameSound('heal');
                        }
                    }
                }
            }
        },
        renderMethod(eq, attachPos, graphics, viewPos) {
            const actor = eq.actor;
            const o = VectorMath.rotate(attachPos.x, attachPos.y, actor.angle);
            const cx = o.x + actor.pos.x - viewPos.x;
            const cy = o.y + actor.pos.y - viewPos.y;
            graphics.lineStyle(1, Theme.weapon, 1);

            // Draw cross shape
            const crossPoints = [
                [5, 1], [5, -1], [1, -1], [1, -5], [-1, -5], [-1, -1],
                [-5, -1], [-5, 1], [-1, 1], [-1, 5], [1, 5], [1, 1], [5, 1]
            ];
            for (let i = 0; i < crossPoints.length - 1; i++) {
                const s = VectorMath.rotate(crossPoints[i][0], crossPoints[i][1], actor.angle);
                const e = VectorMath.rotate(crossPoints[i + 1][0], crossPoints[i + 1][1], actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
            }
        }
    },

    scanner: {
        data: { angle: 0 },
        updateMethod(eq, time) {
            const owner = eq.actor;
            if (!eq.data || !owner) return;

            eq.data.angle += time * Math.PI;

            const o = VectorMath.rotate(eq.attachPos.x, eq.attachPos.y, owner.angle);
            const cx = o.x + owner.pos.x;
            const cy = o.y + owner.pos.y;

            for (const ghost of owner.map.enemyActors) {
                const dist = MathUtils.distance(cx, cy, ghost.pos.x, ghost.pos.y);
                if (dist < SCANNER_RANGE) {
                    const angle = MathUtils.angleBetweenPoints(cx, cy, ghost.pos.x, ghost.pos.y);
                    if (MathUtils.angleDifferenceAbs(eq.data.angle, angle) < SCANNER_ANGLE) {
                        ghost.lastSeenTimer = 1;
                    }
                }
            }
        },
        renderMethod(eq, attachPos, graphics, viewPos) {
            const actor = eq.actor;
            const o = VectorMath.rotate(attachPos.x, attachPos.y, actor.angle);
            const cx = o.x + actor.pos.x - viewPos.x;
            const cy = o.y + actor.pos.y - viewPos.y;
            graphics.lineStyle(1, Theme.weapon, 1);

            // Rectangle
            const rectPts = [[4, 4], [-10, 4], [-10, -4], [4, -4], [4, 4]];
            for (let i = 0; i < rectPts.length - 1; i++) {
                const s = VectorMath.rotate(rectPts[i][0], rectPts[i][1], actor.angle);
                const e = VectorMath.rotate(rectPts[i + 1][0], rectPts[i + 1][1], actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
            }
            // Inner rect
            const innerPts = [[2, 2], [-2, 2], [-2, -2], [2, -2], [2, 2]];
            for (let i = 0; i < innerPts.length - 1; i++) {
                const s = VectorMath.rotate(innerPts[i][0], innerPts[i][1], actor.angle);
                const e = VectorMath.rotate(innerPts[i + 1][0], innerPts[i + 1][1], actor.angle);
                graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
            }

            // Scanner beam
            const sx = Math.cos(eq.data.angle - SCANNER_ANGLE) * SCANNER_RANGE;
            const sy = Math.sin(eq.data.angle - SCANNER_ANGLE) * SCANNER_RANGE;
            const ex = Math.cos(eq.data.angle + SCANNER_ANGLE) * SCANNER_RANGE;
            const ey = Math.sin(eq.data.angle + SCANNER_ANGLE) * SCANNER_RANGE;
            graphics.lineStyle(1, Theme.scanner, 0.25);
            graphics.lineBetween(cx, cy, cx + sx, cy + sy);
            graphics.lineBetween(cx, cy, cx + ex, cy + ey);
        }
    }
};
