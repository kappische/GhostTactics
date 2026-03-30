// Death effect particle system - wireframe debris

class Particle {
    constructor(x, y, vx, vy, type, color, life, data) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type; // 'arc', 'triangle', 'line', 'dot'
        this.color = { r: color.r, g: color.g, b: color.b };
        this.life = life;
        this.maxLife = life;
        this.angle = data.angle || 0;
        this.spin = data.spin || 0;
        this.scale = data.scale || 1;
        this.data = data;
        this.isDead = false;
        this.map = null; // set when added to map
    }

    _isBlocking(px, py) {
        if (!this.map || !this.map.tileGrid) return false;
        const tx = Math.floor(px / TILE_SIZE);
        const ty = Math.floor(py / TILE_SIZE);
        if (tx < 0 || tx >= this.map.width || ty < 0 || ty >= this.map.height) return true;
        const name = this.map.tileGrid[tx] ? this.map.tileGrid[tx][ty] : null;
        return name && TILES[name] && TILES[name].isBlocking;
    }

    update(time) {
        // Shards persist as debris; other types fade out
        if (this.type === 'shard') {
            // Shards never die - they settle into static debris
            this.life -= time;
            if (this.life < 0) this.life = 0;
            // Once settled (very slow), mark as static for cheaper updates
            const speed2 = this.vx * this.vx + this.vy * this.vy;
            if (speed2 < 1 && this.life <= 0) {
                this.settled = true;
            }
        } else {
            this.life -= time;
            if (this.life <= 0) {
                this.isDead = true;
                return;
            }
        }

        // Settled debris only needs push checks, not full physics
        if (this.settled) {
            // Check if any actor is pushing this debris
            if (this.map) {
                const pushRadius = DEFAULT_ACTOR_RADIUS * 1.2;
                const allActors = [...this.map.playerActors, ...this.map.enemyActors];
                for (const actor of allActors) {
                    if (actor.isDead) continue;
                    const dx = this.x - actor.pos.x;
                    const dy = this.y - actor.pos.y;
                    const dist2 = dx * dx + dy * dy;
                    if (dist2 < pushRadius * pushRadius && dist2 > 0) {
                        const dist = Math.sqrt(dist2);
                        const push = 30 * (1 - dist / pushRadius);
                        this.vx += (dx / dist) * push;
                        this.vy += (dy / dist) * push;
                        this.spin += (Math.random() - 0.5) * 3;
                        this.settled = false;
                    }
                }
            }
            if (this.settled) return; // nothing moved it
        }

        // Wall collision with stepped movement to prevent tunneling
        if (this.map && this.map.tileGrid) {
            const dx = this.vx * time;
            const dy = this.vy * time;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const stepSize = TILE_SIZE * 0.4; // check every ~19px
            const steps = Math.max(1, Math.ceil(dist / stepSize));

            let hitWall = false;
            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                const testX = this.x + dx * t;
                const testY = this.y + dy * t;

                const blocked = this._isBlocking(testX, testY);
                if (blocked) {
                    // Back up to previous safe position
                    const prevT = (s - 1) / steps;
                    this.x = this.x + dx * prevT;
                    this.y = this.y + dy * prevT;

                    // Determine which axis hit by testing separately
                    const hitX = this._isBlocking(this.x + dx * (1 / steps), this.y);
                    const hitY = this._isBlocking(this.x, this.y + dy * (1 / steps));

                    if (hitX) this.vx *= -0.15;
                    if (hitY) this.vy *= -0.15;
                    if (!hitX && !hitY) { this.vx *= -0.15; this.vy *= -0.15; } // diagonal
                    this.vx *= 0.3;
                    this.vy *= 0.3;
                    this.spin *= 0.2;
                    hitWall = true;
                    break;
                }
            }
            if (!hitWall) {
                this.x += dx;
                this.y += dy;
            }
        } else {
            this.x += this.vx * time;
            this.y += this.vy * time;
        }

        // Heavy drag
        this.vx *= 0.92;
        this.vy *= 0.92;
        this.spin *= 0.95;
        this.angle += this.spin * time;
    }

    render(graphics, viewPos) {
        if (this.isDead) return;
        let alpha;
        if (this.type === 'shard') {
            // Shards: bright during initial burst, then dim as settled debris
            alpha = this.life > 0 ? Math.pow(this.life / this.maxLife, 0.5) : 0.3;
        } else {
            alpha = Math.pow(this.life / this.maxLife, 0.5);
        }
        const cx = this.x - viewPos.x;
        const cy = this.y - viewPos.y;
        const hex = (this.color.r << 16) | (this.color.g << 8) | this.color.b;

        if (this.type === 'shard') {
            // Irregular polygon shard - Asteroids style
            const pts = this.data.points;
            graphics.lineStyle(1, hex, alpha);
            for (let i = 0; i < pts.length; i++) {
                const p1 = VectorMath.rotate(pts[i][0], pts[i][1], this.angle);
                const p2 = VectorMath.rotate(pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], this.angle);
                graphics.lineBetween(cx + p1.x, cy + p1.y, cx + p2.x, cy + p2.y);
            }
        } else if (this.type === 'triangle') {
            // Small triangle fragment
            const size = this.data.size * this.scale;
            graphics.lineStyle(1, hex, alpha);
            const p1 = VectorMath.rotate(size, 0, this.angle);
            const p2 = VectorMath.rotate(-size * 0.5, -size * 0.7, this.angle);
            const p3 = VectorMath.rotate(-size * 0.5, size * 0.7, this.angle);
            graphics.lineBetween(cx + p1.x, cy + p1.y, cx + p2.x, cy + p2.y);
            graphics.lineBetween(cx + p2.x, cy + p2.y, cx + p3.x, cy + p3.y);
            graphics.lineBetween(cx + p3.x, cy + p3.y, cx + p1.x, cy + p1.y);
        } else if (this.type === 'line') {
            // Line fragment
            const len = this.data.length * this.scale;
            graphics.lineStyle(1, hex, alpha);
            const s = VectorMath.rotate(len * 0.5, 0, this.angle);
            const e = VectorMath.rotate(-len * 0.5, 0, this.angle);
            graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
        } else if (this.type === 'arc') {
            // Arc segment - used for marine death circle fragments
            const r = this.data.radius * this.scale;
            const startAngle = this.data.startAngle + this.angle;
            graphics.lineStyle(1.5, hex, alpha);
            graphics.beginPath();
            graphics.arc(cx, cy, r, startAngle, startAngle + this.data.arcLength);
            graphics.strokePath();
        } else if (this.type === 'dot') {
            // Fading dot/spark
            const r = this.data.radius * alpha;
            graphics.lineStyle(1, hex, alpha);
            graphics.strokeCircle(cx, cy, Math.max(0.5, r));
        }
    }
}

const DeathEffects = {
    // Generate an irregular polygon shard from a circle slice
    _makeShardPoints(innerRadius, outerRadius, startAngle, endAngle) {
        const pts = [];
        // Outer edge - 2-3 points along the circle with random jitter
        const outerSteps = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i <= outerSteps; i++) {
            const a = startAngle + (endAngle - startAngle) * (i / outerSteps);
            const r = outerRadius * (0.85 + Math.random() * 0.3);
            pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        // Inner edge - come back toward center with jitter
        const innerR = innerRadius * (0.3 + Math.random() * 0.5);
        const midAngle = (startAngle + endAngle) * 0.5 + (Math.random() - 0.5) * 0.2;
        pts.push([Math.cos(midAngle) * innerR, Math.sin(midAngle) * innerR]);
        return pts;
    },

    // Ghost death: circle shatters into polygon shards (Asteroids style)
    // angle = direction the killing bullet was traveling
    ghostDeath(map, x, y, angle) {
        const color = { r: Theme.ghost.r, g: Theme.ghost.g, b: Theme.ghost.b };
        const radius = DEFAULT_ACTOR_RADIUS;
        const particles = [];
        const impactCos = Math.cos(angle);
        const impactSin = Math.sin(angle);

        // Shatter circle into 5-7 irregular polygon shards
        // All fly primarily in the bullet's direction with some spread
        const numShards = 5 + Math.floor(Math.random() * 3);
        let currentAngle = Math.random() * Math.PI * 2;
        for (let i = 0; i < numShards; i++) {
            const sliceSize = (Math.PI * 2 / numShards) * (0.7 + Math.random() * 0.6);
            const nextAngle = currentAngle + sliceSize;

            const pts = this._makeShardPoints(0, radius, currentAngle, nextAngle);

            // Primary: fly in bullet direction with random spread
            const spread = (Math.random() - 0.5) * Math.PI * 0.7;
            const speed = 180 + Math.random() * 250;
            // Small outward push so shards fan out slightly
            const midAngle = (currentAngle + nextAngle) * 0.5;
            const outward = 30 + Math.random() * 40;
            const vx = Math.cos(angle + spread) * speed + Math.cos(midAngle) * outward;
            const vy = Math.sin(angle + spread) * speed + Math.sin(midAngle) * outward;

            particles.push(new Particle(x, y, vx, vy, 'shard', color,
                0.8 + Math.random() * 0.6, {
                    points: pts,
                    angle: 0,
                    spin: (Math.random() - 0.5) * 8,
                }
            ));
            currentAngle = nextAngle;
        }

        // Direction triangle shatters into smaller shards too
        const triPts = [
            [[7, 0], [-5, -5], [-2, 0]],
            [[-5, -5], [-5, 5], [-2, 0]],
            [[7, 0], [-2, 0], [-5, 5]],
        ];
        for (let i = 0; i < 3; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.5;
            const speed = 250 + Math.random() * 350;
            particles.push(new Particle(x, y,
                Math.cos(angle + spread) * speed,
                Math.sin(angle + spread) * speed,
                'shard', color,
                0.5 + Math.random() * 0.5, {
                    points: triPts[i],
                    angle: angle + (Math.random() - 0.5) * 0.5,
                    spin: (Math.random() - 0.5) * 14,
                }
            ));
        }

        // Line fragments - small wire debris
        const numLines = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numLines; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.8;
            const speed = 200 + Math.random() * 300;
            const dir = angle + spread;
            particles.push(new Particle(
                x + Math.cos(dir) * radius * 0.3,
                y + Math.sin(dir) * radius * 0.3,
                Math.cos(dir) * speed, Math.sin(dir) * speed,
                'line', color,
                0.3 + Math.random() * 0.4, {
                    length: 3 + Math.random() * 8,
                    angle: dir,
                    spin: (Math.random() - 0.5) * 16,
                }
            ));
        }

        // Bright sparks
        for (let i = 0; i < 5; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.4;
            const speed = 250 + Math.random() * 300;
            const sparkColor = { r: 255, g: Math.min(255, color.g + 120), b: Math.min(255, color.b + 120) };
            particles.push(new Particle(x, y,
                Math.cos(angle + spread) * speed,
                Math.sin(angle + spread) * speed,
                'dot', sparkColor,
                0.2 + Math.random() * 0.25, {
                    radius: 2 + Math.random() * 3,
                }
            ));
        }

        for (const p of particles) {
            map.addParticle(p);
        }
    },

    // SuperGhost death: bigger shards, more dramatic
    superGhostDeath(map, x, y, angle) {
        const color = { r: Theme.superGhost.r, g: Theme.superGhost.g, b: Theme.superGhost.b };
        const radius = DEFAULT_ACTOR_RADIUS * 3;
        const particles = [];
        const impactCos = Math.cos(angle);
        const impactSin = Math.sin(angle);

        // Shatter into many polygon shards - all fly in bullet direction
        const numShards = 10 + Math.floor(Math.random() * 4);
        let currentAngle = Math.random() * Math.PI * 2;
        for (let i = 0; i < numShards; i++) {
            const sliceSize = (Math.PI * 2 / numShards) * (0.7 + Math.random() * 0.6);
            const nextAngle = currentAngle + sliceSize;
            const midAngle = (currentAngle + nextAngle) * 0.5;
            const pts = this._makeShardPoints(0, radius, currentAngle, nextAngle);

            const spread = (Math.random() - 0.5) * Math.PI * 0.7;
            const speed = 200 + Math.random() * 300;
            const outward = 40 + Math.random() * 50;
            const vx = Math.cos(angle + spread) * speed + Math.cos(midAngle) * outward;
            const vy = Math.sin(angle + spread) * speed + Math.sin(midAngle) * outward;

            particles.push(new Particle(x, y, vx, vy, 'shard', color,
                1.0 + Math.random() * 0.8, {
                    points: pts,
                    angle: 0,
                    spin: (Math.random() - 0.5) * 6,
                }
            ));
            currentAngle = nextAngle;
        }

        // Extra small shards flying fast in impact direction
        for (let i = 0; i < 8; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.6;
            const speed = 300 + Math.random() * 500;
            const dir = angle + spread;
            const size = 4 + Math.random() * 8;
            const pts = [
                [size, 0],
                [-size * 0.5 + Math.random() * 2, -size * 0.7 - Math.random() * 3],
                [-size * 0.3 - Math.random() * 2, size * 0.5 + Math.random() * 3],
            ];
            particles.push(new Particle(x, y,
                Math.cos(dir) * speed, Math.sin(dir) * speed,
                'shard', color, 0.6 + Math.random() * 0.6, {
                    points: pts,
                    angle: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 14,
                }
            ));
        }

        // Line fragments
        for (let i = 0; i < 15; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.8;
            const speed = 200 + Math.random() * 400;
            const dir = angle + spread;
            particles.push(new Particle(
                x + Math.cos(dir) * radius * 0.3,
                y + Math.sin(dir) * radius * 0.3,
                Math.cos(dir) * speed, Math.sin(dir) * speed,
                'line', color, 0.4 + Math.random() * 0.5, {
                    length: 5 + Math.random() * 14,
                    angle: dir,
                    spin: (Math.random() - 0.5) * 14,
                }
            ));
        }

        // Big bright sparks
        for (let i = 0; i < 10; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.5;
            const speed = 250 + Math.random() * 350;
            const sparkColor = { r: 255, g: 180, b: 120 };
            particles.push(new Particle(x, y,
                Math.cos(angle + spread) * speed,
                Math.sin(angle + spread) * speed,
                'dot', sparkColor, 0.3 + Math.random() * 0.4, {
                    radius: 3 + Math.random() * 5,
                }
            ));
        }

        for (const p of particles) {
            map.addParticle(p);
        }
    },

    // Marine death: slower collapse
    marineDeath(map, x, y, angle) {
        const color = { r: Theme.marine.r, g: Theme.marine.g, b: Theme.marine.b };
        const radius = DEFAULT_ACTOR_RADIUS;
        const particles = [];

        // Circle breaks into fewer, slower pieces that drift down
        const numArcs = 4;
        const arcLength = (Math.PI * 2 / numArcs) * 0.9;
        for (let i = 0; i < numArcs; i++) {
            const segAngle = (i / numArcs) * Math.PI * 2;
            const speed = 20 + Math.random() * 30;
            particles.push(new Particle(x, y,
                Math.cos(segAngle) * speed,
                Math.sin(segAngle) * speed + 15, // drift down
                'arc', color, 1.0 + Math.random() * 0.5, {
                    startAngle: segAngle - arcLength * 0.5,
                    arcLength: arcLength,
                    radius: radius,
                    spin: (Math.random() - 0.5) * 1.5,
                }
            ));
        }

        // A few dim sparks
        for (let i = 0; i < 3; i++) {
            const dir = Math.random() * Math.PI * 2;
            particles.push(new Particle(x, y,
                Math.cos(dir) * 15, Math.sin(dir) * 15,
                'dot', color, 0.4 + Math.random() * 0.3, {
                    radius: 1.5,
                }
            ));
        }

        for (const p of particles) {
            map.addParticle(p);
        }
    }
};

const ImpactEffects = {
    // Red sparks when bullet hits a ghost
    bulletHitGhost(map, x, y, angle) {
        const color = { r: 255, g: 100, b: 80 };
        for (let i = 0; i < 4; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.6;
            const speed = 150 + Math.random() * 200;
            map.addParticle(new Particle(x, y,
                Math.cos(angle + spread) * speed,
                Math.sin(angle + spread) * speed,
                'dot', color, 0.15 + Math.random() * 0.15, {
                    radius: 1.5 + Math.random() * 2,
                }
            ));
        }
    },

    // Blue/wall-color sparks when bullet hits a wall
    bulletHitWall(map, x, y, angle, wallColor) {
        const color = wallColor || { r: 40, g: 80, b: 140 };
        // Bounce direction (reverse bullet)
        const bounceAngle = angle + Math.PI;
        // Sparks
        for (let i = 0; i < 3; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.8;
            const speed = 80 + Math.random() * 120;
            map.addParticle(new Particle(x, y,
                Math.cos(bounceAngle + spread) * speed,
                Math.sin(bounceAngle + spread) * speed,
                'dot', color, 0.2 + Math.random() * 0.2, {
                    radius: 1 + Math.random() * 1.5,
                }
            ));
        }
        // Small line fragments chipping off
        for (let i = 0; i < 2; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.7;
            const speed = 60 + Math.random() * 80;
            map.addParticle(new Particle(x, y,
                Math.cos(bounceAngle + spread) * speed,
                Math.sin(bounceAngle + spread) * speed,
                'line', color, 0.2 + Math.random() * 0.2, {
                    length: 2 + Math.random() * 4,
                    angle: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 10,
                }
            ));
        }
    },

    // Bright cyan flash at weapon muzzle when firing
    muzzleFlash(map, x, y, angle) {
        const color = { r: 180, g: 240, b: 255 };
        for (let i = 0; i < 2; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.3;
            const speed = 100 + Math.random() * 80;
            map.addParticle(new Particle(x, y,
                Math.cos(angle + spread) * speed,
                Math.sin(angle + spread) * speed,
                'dot', color, 0.08 + Math.random() * 0.08, {
                    radius: 2 + Math.random() * 2,
                }
            ));
        }
    },

    // Dark red particles converge inward when ghost spawns
    ghostSpawn(map, x, y) {
        const color = { r: 160, g: 30, b: 30 };
        for (let i = 0; i < 8; i++) {
            const dir = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const dist = 30 + Math.random() * 20;
            // Start at ring, fly inward
            const startX = x + Math.cos(dir) * dist;
            const startY = y + Math.sin(dir) * dist;
            const speed = 60 + Math.random() * 40;
            map.addParticle(new Particle(startX, startY,
                -Math.cos(dir) * speed,
                -Math.sin(dir) * speed,
                'dot', color, 0.3 + Math.random() * 0.2, {
                    radius: 1.5 + Math.random() * 1.5,
                }
            ));
        }
    },

    // Green sparkles rising upward when healer heals
    healEffect(map, x, y) {
        const color = { r: 80, g: 255, b: 180 };
        for (let i = 0; i < 3; i++) {
            const spreadX = (Math.random() - 0.5) * 20;
            map.addParticle(new Particle(
                x + spreadX, y,
                (Math.random() - 0.5) * 20,
                -(30 + Math.random() * 40), // float upward
                'dot', color, 0.3 + Math.random() * 0.2, {
                    radius: 1 + Math.random() * 1.5,
                }
            ));
        }
    },
};
