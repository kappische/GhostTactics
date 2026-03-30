// Actor system ported from actor.lua
// Marines and ghosts with simplified physics (no Box2D - uses velocity + collision)

let _playerHasDied = 0;
let _superGhostKilled = false;

const RUN_SPEED = 200;
const WALK_SPEED = 75;
const GHOST_MOVE_SPEED = 50;
const GHOST_JUMP_PUSH = 40;
const GHOST_JUMP_DELAY = 0.6;

class Actor {
    constructor(type, x, y, map) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.scale = 1;
        this.angle = 0;
        this.wantedAngle = 0;
        this.lastSelectedAngle = 0;
        this.type = type;
        this.map = map;
        this.category = 'actor';
        this.renderColor = new Color(255, 255, 255, 255);
        this.isRunning = false;
        this.footstepTimer = 0;
        this.target = null;
        this.nextScanTimer = 0;
        this.targetInSightTimer = 0;
        this.isDead = false;
        this.health = type.maxHealth;
        this.lastSeenTimer = 0;
        this.attackTimer = 0;
        this.equipment = [];
        this.hasControl = false;
        this.playerIndex = null;
        this.playerInfo = null;
        this.hustleTarget = null;
        this.pushAnimTimer = 0;
        this.targetOutOfSightCounter = 0;
        this.path = null;
        this.jumpTimer = 0;
    }

    addEquipment(eq) {
        this.equipment.push(eq);
    }

    update(time) {
        if (this.isDead) return;

        // Apply velocity with damping (Box2D-style linear damping)
        const damping = this.type === ACTORS.superGhost ? 10 : 20;
        const dampFactor = 1 / (1 + damping * time);
        this.vel.x *= dampFactor;
        this.vel.y *= dampFactor;
        this.pos.x += this.vel.x * time;
        this.pos.y += this.vel.y * time;

        // Simple wall collision
        this.resolveWallCollisions();
        // Actor-actor collision (all actors on same map push each other)
        this.resolveActorCollisions();

        this.lastSeenTimer -= time;

        if (this.type.updateMethod) {
            this.type.updateMethod(this, time);
        }

        for (const eq of this.equipment) {
            eq.update(time);
        }
    }

    resolveWallCollisions() {
        if (!this.map || !this.map.tileGrid) return;
        const radius = DEFAULT_ACTOR_RADIUS;
        const grid = this.map.tileGrid;

        // Check surrounding tiles
        const tileX = Math.floor(this.pos.x / TILE_SIZE);
        const tileY = Math.floor(this.pos.y / TILE_SIZE);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const tx = tileX + dx;
                const ty = tileY + dy;
                if (tx < 0 || tx >= this.map.width || ty < 0 || ty >= this.map.height) {
                    // Push away from map edges
                    this.pos.x = MathUtils.clamp(this.pos.x, radius, this.map.width * TILE_SIZE - radius);
                    this.pos.y = MathUtils.clamp(this.pos.y, radius, this.map.height * TILE_SIZE - radius);
                    continue;
                }
                if (!grid[tx] || !grid[tx][ty]) continue;
                const tileName = grid[tx][ty];
                if (!TILES[tileName] || !TILES[tileName].isBlocking) continue;

                // AABB collision with tile
                const tileCX = (tx + 0.5) * TILE_SIZE;
                const tileCY = (ty + 0.5) * TILE_SIZE;
                const halfTile = TILE_SIZE * 0.5;

                const closestX = MathUtils.clamp(this.pos.x, tileCX - halfTile, tileCX + halfTile);
                const closestY = MathUtils.clamp(this.pos.y, tileCY - halfTile, tileCY + halfTile);

                const distX = this.pos.x - closestX;
                const distY = this.pos.y - closestY;
                const dist2 = distX * distX + distY * distY;

                if (dist2 < radius * radius && dist2 > 0) {
                    const dist = Math.sqrt(dist2);
                    const overlap = radius - dist;
                    this.pos.x += (distX / dist) * overlap;
                    this.pos.y += (distY / dist) * overlap;
                }
            }
        }
    }

    resolveActorCollisions() {
        if (!this.map) return;
        const radius = this.type === ACTORS.superGhost ? DEFAULT_ACTOR_RADIUS * 3 : DEFAULT_ACTOR_RADIUS;
        // Collide with all actors on this map (players + enemies)
        const allActors = [...this.map.playerActors, ...this.map.enemyActors];
        for (const other of allActors) {
            if (other === this || other.isDead) continue;
            const otherRadius = other.type === ACTORS.superGhost ? DEFAULT_ACTOR_RADIUS * 3 : DEFAULT_ACTOR_RADIUS;
            const minDist = radius + otherRadius;
            const dx = this.pos.x - other.pos.x;
            const dy = this.pos.y - other.pos.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < minDist * minDist && dist2 > 0) {
                const dist = Math.sqrt(dist2);
                const overlap = minDist - dist;
                const pushX = (dx / dist) * overlap * 0.5;
                const pushY = (dy / dist) * overlap * 0.5;
                this.pos.x += pushX;
                this.pos.y += pushY;
                other.pos.x -= pushX;
                other.pos.y -= pushY;
            }
        }
    }

    kill(silently) {
        if (!silently && !this.isDead && this.type === ACTORS.ghost) {
            if (gameScene) gameScene.playGameSound('ghostDie');
        }
        if (!this.isDead) {
            // Spawn death particles - use bullet impact angle if available
            const hitAngle = this._lastHitAngle !== undefined ? this._lastHitAngle : this.angle;
            if (this.type === ACTORS.ghost) {
                DeathEffects.ghostDeath(this.map, this.pos.x, this.pos.y, hitAngle);
            } else if (this.type === ACTORS.superGhost) {
                DeathEffects.superGhostDeath(this.map, this.pos.x, this.pos.y, hitAngle);
            } else if (this.type === ACTORS.marine) {
                DeathEffects.marineDeath(this.map, this.pos.x, this.pos.y, hitAngle);
            }
        }
        this.isDead = true;
        if (this.type === ACTORS.marine) {
            _playerHasDied = this.playerIndex;
        } else if (this.type === ACTORS.superGhost) {
            _superGhostKilled = true;
        }
    }

    switchToMap(newMap) {
        if (this.type !== ACTORS.marine) return;
        this.target = null;
        this.hustleTarget = null;
        this.map.removePlayerActor(this);
        this.map = newMap;
        this.map.addPlayerActor(this);
    }

    onObjectHit(obj) {
        if (this.type === ACTORS.ghost || this.type === ACTORS.superGhost) {
            if (this.health === this.type.maxHealth) {
                this.target = obj.owner;
            }
            return true;
        }
        return false;
    }

    onObjectDamage(obj, damageAmount) {
        // Store the bullet's angle so death effect can use it
        this._lastHitAngle = obj.angle;
        if (this.onDamage(damageAmount)) {
            if (obj.owner && obj.owner.playerInfo) {
                obj.owner.playerInfo.kills++;
            }
        }
    }

    onDamage(damageAmount) {
        this.health -= damageAmount;
        if (this.type === ACTORS.marine) {
            if (gameScene) gameScene.playGameSound('playerHurt');
        }
        if (this.health <= 0) {
            this.kill();
            return true;
        }
        return false;
    }

    onHeal(healAmount) {
        if (this.isDead) return;
        this.health += healAmount;
        if (this.health > this.type.maxHealth) {
            this.health = this.type.maxHealth;
        }
    }

    onActionKey() {
        if (this.type !== ACTORS.marine) return;

        // Check if near stairs
        for (const tile of this.map.tiles) {
            if (!tile.type.physics || !tile.type.physics.shapes[0]) continue;
            const userData = tile.type.physics.shapes[0].userData;
            if (userData !== 'stairsUp' && userData !== 'stairsDown') continue;

            const dist = MathUtils.distance(this.pos.x, this.pos.y, tile.pos.x, tile.pos.y);
            if (dist > TILE_SIZE * 1.2) continue;

            let switchMap = null;
            if (userData === 'stairsUp') {
                switchMap = gameScene.getMapAbove(this.map);
            } else if (userData === 'stairsDown') {
                switchMap = gameScene.getMapBelow(this.map);
            }

            if (switchMap) {
                // Hustle - if shift pressed and has control
                if (gameScene.keys.shift.isDown && this.hasControl) {
                    for (const player of this.map.playerActors) {
                        if (player !== this) {
                            const distance = MathUtils.distance(this.pos.x, this.pos.y, player.pos.x, player.pos.y);
                            if (distance < TILE_SIZE * 3) {
                                player.hustleTarget = { x: tile.pos.x, y: tile.pos.y };
                            }
                        }
                    }
                }
                this.switchToMap(switchMap);
                return;
            }
        }
    }

    applyForce(fx, fy) {
        // Calibrated to match Box2D steady-state velocity with:
        // resolution=1/32, density=1, circle radius=20*res, linearDamping=20
        // Box2D: steady-state = force / (mass * damping) / resolution
        // mass = pi * (radius*res)^2 = ~1.23, so multiplier = 1/(mass*res) ≈ 26/res ≈ 20
        this.vel.x += fx * 20;
        this.vel.y += fy * 20;
    }

    render(graphics, viewPos) {
        if (this.isDead) return;
        if (this.type.renderMethod) {
            this.type.renderMethod(this, graphics, viewPos);
        }
        for (const eq of this.equipment) {
            eq.render(graphics, viewPos);
        }
    }
}

// Raycast line-of-sight through tile grid
function raycastLOS(map, x1, y1, x2, y2) {
    if (!map || !map.tileGrid) return true; // no grid = clear LOS
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / (TILE_SIZE * 0.5));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + dx * t;
        const py = y1 + dy * t;
        const tx = Math.floor(px / TILE_SIZE);
        const ty = Math.floor(py / TILE_SIZE);
        if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
            if (map.tileGrid[tx] && map.tileGrid[tx][ty]) {
                const tileName = map.tileGrid[tx][ty];
                if (TILES[tileName] && TILES[tileName].isBlocking) {
                    return false;
                }
            }
        }
    }
    return true;
}

function checkMarineToEnemyLOS(actor, enemy) {
    const angleToEnemy = MathUtils.angleBetweenPoints(actor.pos.x, actor.pos.y, enemy.pos.x, enemy.pos.y);
    const diff = MathUtils.angleDifferenceAbs(actor.angle, angleToEnemy);
    const dist = MathUtils.distance(actor.pos.x, actor.pos.y, enemy.pos.x, enemy.pos.y);

    if (dist < DEFAULT_ACTOR_RADIUS * 4) {
        enemy.lastSeenTimer = 1;
        return true;
    }

    if (diff > Math.PI * (0.5 / (dist * 0.01))) return false;

    if (raycastLOS(actor.map, actor.pos.x, actor.pos.y, enemy.pos.x, enemy.pos.y)) {
        enemy.lastSeenTimer = 1;
        return true;
    }
    return false;
}

function getMarinePushMultiplier(actor) {
    let pushMultiplier = 1;
    if (actor.health < actor.type.maxHealth && actor.pushAnimTimer) {
        const factor = actor.health / actor.type.maxHealth;
        pushMultiplier = factor + (1 - factor) * 0.5 * Math.abs(Math.cos(actor.pushAnimTimer * 3));
    }
    return pushMultiplier;
}

function updateMarine(actor, time) {
    actor.pushAnimTimer += time;
    const pushMultiplier = getMarinePushMultiplier(actor);

    if (actor.hustleTarget) {
        const distance = MathUtils.distance(actor.pos.x, actor.pos.y, actor.hustleTarget.x, actor.hustleTarget.y);
        if (distance < DEFAULT_ACTOR_RADIUS) {
            actor.hustleTarget = null;
            actor.onActionKey();
            return;
        }

        if (actor.hasControl && gameScene &&
            (gameScene.cursors.left.isDown || gameScene.cursors.up.isDown ||
                gameScene.cursors.right.isDown || gameScene.cursors.down.isDown)) {
            actor.hustleTarget = null;
        } else {
            actor.wantedAngle = MathUtils.angleBetweenPoints(actor.pos.x, actor.pos.y, actor.hustleTarget.x, actor.hustleTarget.y);
            actor.angle = MathUtils.approachAngle(actor.angle, actor.wantedAngle, 6 * time);
            const push = RUN_SPEED * pushMultiplier;
            actor.isRunning = true;
            if (MathUtils.angleDifferenceAbs(actor.angle, actor.wantedAngle) < Math.PI * 0.05) {
                actor.applyForce(push * Math.cos(actor.angle) * time, push * Math.sin(actor.angle) * time);
            }
            return;
        }
    }

    if (actor.hasControl && gameScene) {
        let pressAngle = actor.angle;
        let doPush = false;
        const keys = gameScene.cursors;

        if (keys.right.isDown) {
            doPush = true;
            pressAngle = 0;
            if (keys.up.isDown) pressAngle = -Math.PI * 0.25;
            else if (keys.down.isDown) pressAngle = Math.PI * 0.25;
        } else if (keys.left.isDown) {
            doPush = true;
            pressAngle = -Math.PI;
            if (keys.up.isDown) pressAngle = -Math.PI * 0.75;
            else if (keys.down.isDown) pressAngle = Math.PI * 0.75;
        } else if (keys.up.isDown) {
            doPush = true;
            pressAngle = -Math.PI * 0.5;
        } else if (keys.down.isDown) {
            doPush = true;
            pressAngle = Math.PI * 0.5;
        }

        let push = RUN_SPEED * pushMultiplier;
        actor.isRunning = false;

        if (!gameScene.keys.shift.isDown) {
            if (doPush) {
                actor.wantedAngle = pressAngle;
                actor.lastSelectedAngle = actor.wantedAngle;
                actor.isRunning = true;
            }
        } else {
            actor.wantedAngle = actor.angle;
            actor.lastSelectedAngle = actor.wantedAngle;
            push = WALK_SPEED * pushMultiplier;
        }

        actor.angle = MathUtils.approachAngle(actor.angle, actor.wantedAngle, 6 * time);

        doPush = doPush && (!actor.isRunning || MathUtils.angleDifferenceAbs(actor.angle, pressAngle) < Math.PI * 0.05);

        if (doPush) {
            actor.applyForce(push * Math.cos(pressAngle) * time, push * Math.sin(pressAngle) * time);
            actor.footstepTimer -= time;
            if (actor.footstepTimer <= 0) {
                const isWalking = gameScene.keys.shift.isDown;
                gameScene.playGameSound(isWalking ? 'footstepWalk' : 'footstepRun');
                actor.footstepTimer = isWalking ? 0.55 : 0.3;
            }
        } else {
            actor.footstepTimer = 0;
        }
    } else {
        actor.angle = MathUtils.approachAngle(actor.angle, actor.wantedAngle, 6 * time);
    }

    // Scanning for enemies
    if (!actor.target) {
        actor.nextScanTimer -= time;
        actor.wantedAngle = actor.lastSelectedAngle;

        if (actor.nextScanTimer < 0) {
            actor.nextScanTimer = 0.2 + Math.random() * 0.05;
            let bestResult = null;
            let bestDist = 1e8;

            for (const enemy of actor.map.enemyActors) {
                if (enemy.isDead) continue;
                if (checkMarineToEnemyLOS(actor, enemy)) {
                    const dist = MathUtils.distance2(actor.pos.x, actor.pos.y, enemy.pos.x, enemy.pos.y);
                    if (!bestResult || dist < bestDist) {
                        bestResult = enemy;
                        bestDist = dist;
                    }
                }
            }
            actor.target = bestResult;

            // Update LOS to other ghosts
            for (const enemy of actor.map.enemyActors) {
                if (enemy.lastSeenTimer < 0) {
                    checkMarineToEnemyLOS(actor, enemy);
                }
            }
        }
    } else {
        if (actor.target.isDead || !checkMarineToEnemyLOS(actor, actor.target)) {
            actor.target = null;
            actor.nextScanTimer = 0;
        } else {
            actor.wantedAngle = MathUtils.angleBetweenPoints(actor.pos.x, actor.pos.y, actor.target.pos.x, actor.target.pos.y);
        }
    }
}

function updateGhost(actor, time) {
    if (!actor.target || actor.target.isDead) {
        if (actor.map.playerActors.length > 0) {
            actor.target = actor.map.playerActors[Math.floor(Math.random() * actor.map.playerActors.length)];
            actor.targetOutOfSightCounter = 0;
        }
    }

    if (actor.target) {
        actor.targetInSightTimer -= time;

        if (actor.targetInSightTimer < 0) {
            actor.targetInSightTimer = 1;
            if (!raycastLOS(actor.map, actor.pos.x, actor.pos.y, actor.target.pos.x, actor.target.pos.y)) {
                actor.targetOutOfSightCounter++;
                if (actor.targetOutOfSightCounter > 5) {
                    actor.targetOutOfSightCounter = 0;
                    actor.path = actor.map.findPath(actor.pos.x, actor.pos.y, actor.target.pos.x, actor.target.pos.y);
                    if (!actor.path && actor.type === ACTORS.ghost) {
                        actor.kill(true);
                    }
                }
            } else {
                actor.path = null;
                actor.targetOutOfSightCounter = 0;
            }
        }

        if (!actor.path) {
            actor.wantedAngle = MathUtils.angleBetweenPoints(actor.pos.x, actor.pos.y, actor.target.pos.x, actor.target.pos.y);
        } else {
            const tx = actor.path[0].x;
            const ty = actor.path[0].y;
            actor.wantedAngle = MathUtils.angleBetweenPoints(actor.pos.x, actor.pos.y, tx, ty);
            if (MathUtils.distance2(actor.pos.x, actor.pos.y, tx, ty) < DEFAULT_ACTOR_RADIUS * DEFAULT_ACTOR_RADIUS) {
                actor.path.shift();
                if (actor.path.length < 1) actor.path = null;
            }
        }

        actor.angle = MathUtils.approachAngle(actor.angle, actor.wantedAngle, 6 * time);

        actor.jumpTimer -= time;
        if (actor.jumpTimer < 0) {
            actor.jumpTimer = GHOST_JUMP_DELAY * (0.5 + Math.random() * 0.5);
            const push = GHOST_JUMP_PUSH * (0.5 + Math.random() * 0.5);
            actor.vel.x += push * Math.cos(actor.angle) * 20;
            actor.vel.y += push * Math.sin(actor.angle) * 20;
        }

        actor.applyForce(GHOST_MOVE_SPEED * Math.cos(actor.angle) * time, GHOST_MOVE_SPEED * Math.sin(actor.angle) * time);

        // Melee attack
        actor.attackTimer -= time;
        if (actor.attackTimer < 0) {
            for (const player of actor.map.playerActors) {
                if (player.isDead) continue;
                const dist = MathUtils.distance(actor.pos.x, actor.pos.y, player.pos.x, player.pos.y);
                if (dist < DEFAULT_ACTOR_RADIUS * 2) {
                    player.onDamage(Math.floor(Math.random() * 11) + 10);
                    actor.attackTimer = 0.2 + Math.random() * 0.3;
                    break;
                }
            }
        }
    }

}

// Draw a player index number on an actor using the canvas context directly
function drawNumberOnActor(graphics, cx, cy, num, color, angle) {
    const alpha = color.a / 255;
    const hexColor = '#' + ((1 << 24) + (color.r << 16) + (color.g << 8) + color.b).toString(16).slice(1);

    // Position the number on the back half of the circle (away from direction triangle)
    // Original: vectorMath.rotate(-1 - defaultActorRadius * 0.5, 0, actor.angle)
    const offset = VectorMath.rotate(-1 - DEFAULT_ACTOR_RADIUS * 0.5, 0, angle || 0);

    if (gameScene && gameScene._numbersToDraw) {
        gameScene._numbersToDraw.push({ x: cx + offset.x, y: cy + offset.y, num, color: hexColor, alpha });
    }
}

function marineRender(actor, graphics, viewPos) {
    const animMultiplier = getMarinePushMultiplier(actor);
    let cx = actor.pos.x - viewPos.x;
    let cy = actor.pos.y - viewPos.y;

    // Set marine color based on control state
    const t = actor.hasControl ? Theme.marineCtrl : Theme.marine;
    actor.renderColor.r = t.r;
    actor.renderColor.g = t.g;
    actor.renderColor.b = t.b;

    const marinePhysics = {
        shapes: [{ shape: 'circle', ox: 0, oy: 0, radius: DEFAULT_ACTOR_RADIUS }]
    };
    Renderer.renderPhysicsLines(graphics, cx, cy, marinePhysics, actor.scale, actor.angle, actor.renderColor);

    // Clamp to viewport
    cx = MathUtils.clamp(cx, viewPos.left + 10 - viewPos.screenOffsetX, viewPos.right - 10 - viewPos.screenOffsetX);
    cy = MathUtils.clamp(cy, viewPos.top + 10, viewPos.bottom - 10);

    const hexColor = (actor.renderColor.r << 16) | (actor.renderColor.g << 8) | actor.renderColor.b;
    graphics.lineStyle(1, hexColor, actor.renderColor.a / 255);

    let s = VectorMath.rotate(7 * animMultiplier, 0, actor.angle);
    let e = VectorMath.rotate(-5 * animMultiplier, -5 * animMultiplier, actor.angle);
    graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
    e = VectorMath.rotate(-5 * animMultiplier, 5 * animMultiplier, actor.angle);
    graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
    s = VectorMath.rotate(-5 * animMultiplier, -5 * animMultiplier, actor.angle);
    graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);

    if (actor.hasControl) {
        const pcx = actor.pos.x - viewPos.x;
        const pcy = actor.pos.y - viewPos.y;
        Renderer.renderPhysicsLines(graphics, pcx, pcy, marinePhysics, actor.scale * 0.8, actor.angle, actor.renderColor);
    } else if (actor.playerIndex) {
        // Draw player index number using line segments
        drawNumberOnActor(graphics, cx, cy, actor.playerIndex, actor.renderColor, actor.angle);
    }
}

function ghostRender(actor, graphics, viewPos) {
    if (actor.lastSeenTimer <= 0) return;
    actor.renderColor.a = Math.floor(255 * Math.min(1, actor.lastSeenTimer));
    actor.renderColor.r = Theme.ghost.r;
    actor.renderColor.g = Theme.ghost.g;
    actor.renderColor.b = Theme.ghost.b;

    const cx = actor.pos.x - viewPos.x;
    const cy = actor.pos.y - viewPos.y;

    const ghostPhysics = {
        shapes: [{ shape: 'circle', ox: 0, oy: 0, radius: DEFAULT_ACTOR_RADIUS }]
    };
    Renderer.renderPhysicsLines(graphics, cx, cy, ghostPhysics, actor.scale, actor.angle, actor.renderColor);

    // Direction indicator
    const hexColor = (actor.renderColor.r << 16) | (actor.renderColor.g << 8) | actor.renderColor.b;
    graphics.lineStyle(1, hexColor, actor.renderColor.a / 255);
    let s = VectorMath.rotate(7, 0, actor.angle);
    let e = VectorMath.rotate(-5, -5, actor.angle);
    graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
    e = VectorMath.rotate(-5, 5, actor.angle);
    graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
    s = VectorMath.rotate(-5, -5, actor.angle);
    graphics.lineBetween(cx + s.x, cy + s.y, cx + e.x, cy + e.y);
}

const ACTORS = {
    marine: {
        attachPoints: {
            center: { x: 0, y: 0 },
            front: { x: DEFAULT_ACTOR_RADIUS, y: 0 },
            right: { x: DEFAULT_ACTOR_RADIUS * Math.cos(Math.PI * 0.3), y: DEFAULT_ACTOR_RADIUS * Math.sin(Math.PI * 0.3) },
            left: { x: DEFAULT_ACTOR_RADIUS * Math.cos(-Math.PI * 0.3), y: DEFAULT_ACTOR_RADIUS * Math.sin(-Math.PI * 0.3) },
        },
        updateMethod: updateMarine,
        renderMethod: marineRender,
        maxHealth: 100,
    },

    ghost: {
        attachPoints: {
            center: { x: 0, y: 0 },
            front: { x: DEFAULT_ACTOR_RADIUS, y: 0 },
        },
        updateMethod: updateGhost,
        renderMethod: ghostRender,
        maxHealth: 100,
    },

    superGhost: {
        attachPoints: {
            center: { x: 0, y: 0 },
            front: { x: DEFAULT_ACTOR_RADIUS, y: 0 },
        },
        updateMethod: updateGhost,
        renderMethod(actor, graphics, viewPos) {
            if (actor.lastSeenTimer <= 0) return;
            actor.renderColor.a = Math.floor(255 * Math.min(1, actor.lastSeenTimer));
            actor.renderColor.r = Theme.superGhost.r;
            actor.renderColor.g = Theme.superGhost.g;
            actor.renderColor.b = Theme.superGhost.b;
            const cx = actor.pos.x - viewPos.x;
            const cy = actor.pos.y - viewPos.y;
            const physics = {
                shapes: [{ shape: 'circle', ox: 0, oy: 0, radius: DEFAULT_ACTOR_RADIUS * 3 }]
            };
            Renderer.renderPhysicsLines(graphics, cx, cy, physics, actor.scale, actor.angle, actor.renderColor);
        },
        maxHealth: 999999999,
    }
};
