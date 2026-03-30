// Projectile objects ported from objects.lua
// Uses simple position + velocity simulation instead of Box2D

class GameObject {
    constructor(type, x, y, angle, owner, map) {
        this.pos = { x, y };
        this.angle = angle;
        this.owner = owner;
        this.map = map;
        this.type = type;
        this.category = 'object';
        this.isDead = false;
        this.vel = { x: 0, y: 0 };
        this.life = 1;

        if (type.initMethod) {
            type.initMethod(this);
        }
    }

    update(time) {
        if (this.isDead) return;

        // Move by velocity
        this.pos.x += this.vel.x * time;
        this.pos.y += this.vel.y * time;

        if (this.type.updateMethod) {
            this.type.updateMethod(this, time);
        }
    }

    render(graphics, viewPos) {
        if (this.isDead) return;
        if (this.type.renderMethod) {
            this.type.renderMethod(this, graphics, viewPos);
        }
    }
}

const OBJECTS = {
    bullet: {
        initMethod(obj) {
            const speed = 1000;
            obj.vel.x = speed * Math.cos(obj.angle);
            obj.vel.y = speed * Math.sin(obj.angle);
        },

        updateMethod(obj, time) {
            // Bullets die on collision only, but add a safety timeout
            // to prevent stray bullets living forever (5 seconds)
            obj.life -= time * 0.2;
            if (obj.life <= 0) {
                obj.isDead = true;
                return;
            }

            // Check collision with walls
            const tileX = Math.floor(obj.pos.x / TILE_SIZE);
            const tileY = Math.floor(obj.pos.y / TILE_SIZE);
            if (tileX < 0 || tileX >= obj.map.width || tileY < 0 || tileY >= obj.map.height) {
                obj.isDead = true;
                return;
            }
            if (obj.map.tileGrid && obj.map.tileGrid[tileX] && obj.map.tileGrid[tileX][tileY]) {
                const tileName = obj.map.tileGrid[tileX][tileY];
                if (tileName === 'block' || tileName === 'pushBlock') {
                    ImpactEffects.bulletHitWall(obj.map, obj.pos.x, obj.pos.y, obj.angle);
                    obj.isDead = true;
                    return;
                }
            }

            // Check collision with enemy actors
            for (const enemy of obj.map.enemyActors) {
                if (enemy.isDead) continue;
                const dist = MathUtils.distance2(obj.pos.x, obj.pos.y, enemy.pos.x, enemy.pos.y);
                if (dist < DEFAULT_ACTOR_RADIUS * DEFAULT_ACTOR_RADIUS) {
                    ImpactEffects.bulletHitGhost(obj.map, obj.pos.x, obj.pos.y, obj.angle);
                    if (enemy.onObjectHit(obj)) {
                        enemy.onObjectDamage(obj, Math.floor(Math.random() * 31) + 20); // 20-50
                    }
                    obj.isDead = true;
                    return;
                }
            }
        },

        renderMethod(obj, graphics, viewPos) {
            const cx = obj.pos.x - viewPos.x;
            const cy = obj.pos.y - viewPos.y;
            const physics = {
                shapes: [{
                    shape: 'poly',
                    x: [5, -3, -3],
                    y: [0, 3, -3]
                }]
            };
            Renderer.renderPhysicsLines(graphics, cx, cy, physics, 1, obj.angle);
        },

        physics: {
            shapes: [{ shape: 'poly', x: [5, -3, -3], y: [0, 3, -3] }]
        }
    },

    pellet: {
        initMethod(obj) {
            const speed = 800 + Math.random() * 200;
            obj.vel.x = speed * Math.cos(obj.angle);
            obj.vel.y = speed * Math.sin(obj.angle);
            obj.life = 1;
        },

        updateMethod(obj, time) {
            obj.life -= time;
            if (obj.life <= 0) {
                obj.isDead = true;
                return;
            }

            // Check wall collision
            const tileX = Math.floor(obj.pos.x / TILE_SIZE);
            const tileY = Math.floor(obj.pos.y / TILE_SIZE);
            if (tileX < 0 || tileX >= obj.map.width || tileY < 0 || tileY >= obj.map.height) {
                obj.isDead = true;
                return;
            }
            if (obj.map.tileGrid && obj.map.tileGrid[tileX] && obj.map.tileGrid[tileX][tileY]) {
                const tileName = obj.map.tileGrid[tileX][tileY];
                if (tileName === 'block' || tileName === 'pushBlock') {
                    ImpactEffects.bulletHitWall(obj.map, obj.pos.x, obj.pos.y, obj.angle);
                    obj.isDead = true;
                    return;
                }
            }

            // Check collision with enemies
            for (const enemy of obj.map.enemyActors) {
                if (enemy.isDead) continue;
                const dist = MathUtils.distance2(obj.pos.x, obj.pos.y, enemy.pos.x, enemy.pos.y);
                if (dist < DEFAULT_ACTOR_RADIUS * DEFAULT_ACTOR_RADIUS) {
                    ImpactEffects.bulletHitGhost(obj.map, obj.pos.x, obj.pos.y, obj.angle);
                    if (enemy.onObjectHit(obj)) {
                        const damage = Math.ceil(obj.life * obj.life * (Math.floor(Math.random() * 11) + 20));
                        enemy.onObjectDamage(obj, damage);
                    }
                    obj.isDead = true;
                    return;
                }
            }
        },

        renderMethod(obj, graphics, viewPos) {
            const cx = obj.pos.x - viewPos.x;
            const cy = obj.pos.y - viewPos.y;
            const alpha = obj.life;
            const color = new Color(Math.ceil(255 * alpha), 255, 255, 255);
            const physics = {
                shapes: [{ shape: 'circle', radius: 1.8, ox: 0, oy: 0 }]
            };
            Renderer.renderPhysicsLines(graphics, cx, cy, physics, 1, obj.angle, color);
        },

        physics: {
            shapes: [{ shape: 'circle', radius: 1.8, ox: 0, oy: 0 }]
        }
    }
};
