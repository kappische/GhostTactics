// Tile definitions ported from tiles.lua

const TILE_SIZE = 48;
const DEFAULT_ACTOR_RADIUS = (TILE_SIZE - 8) * 0.5;

// Event trigger globals
let _spawnBlockedByPlayer = 0;
let _stairsSpottedByPlayer = 0;
let _s1SpottedByPlayer = 0;
let _s1SpottedByMedic = false;
let _s1GetBackMarker = 0;
let _storyMarkerLvl2 = 0;
let _storyMarkerLvl3 = 0;
let _secondLevelStairs = 0;
let _s2SpottedByPlayer = 0;
let _s2Tile = null;

const TILES = {
    block: {
        isBlocking: true,
        physics: {
            shapes: [{ shape: 'box', ox: 0, oy: 0, width: TILE_SIZE, height: TILE_SIZE }]
        },
        renderMethod(tile, graphics, viewPos, map) {
            const cx = tile.pos.x - viewPos.x;
            const cy = tile.pos.y - viewPos.y;
            const bc = map && map.blockColor ? map.blockColor : Theme.wallColors[0];
            const color = new Color(180 + Math.floor(Math.random() * 40), bc.r, bc.g, bc.b);
            Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, tile.scale * 0.95, tile.angle, color);
        },
        editColor: new Color(192, 255, 255, 255)
    },

    pushBlock: {
        isBlocking: true,
        isPushable: true,
        physics: {
            shapes: [{ shape: 'box', ox: 0, oy: 0, width: TILE_SIZE, height: TILE_SIZE }]
        },
        updateMethod(tile, time) {
            // PushBlocks can be pushed by actors - apply velocity with heavy damping
            tile.vel = tile.vel || { x: 0, y: 0 };
            const damping = 1 / (1 + 20 * time);
            tile.vel.x *= damping;
            tile.vel.y *= damping;
            tile.pos.x += tile.vel.x * time;
            tile.pos.y += tile.vel.y * time;
            tile.angle *= damping; // Dampen rotation too

            // Check for actors pushing this block
            const halfTile = TILE_SIZE * 0.5;
            const allActors = [...tile.map.playerActors, ...tile.map.enemyActors];
            for (const actor of allActors) {
                if (actor.isDead) continue;
                const radius = DEFAULT_ACTOR_RADIUS;
                const closestX = MathUtils.clamp(actor.pos.x, tile.pos.x - halfTile, tile.pos.x + halfTile);
                const closestY = MathUtils.clamp(actor.pos.y, tile.pos.y - halfTile, tile.pos.y + halfTile);
                const dx = actor.pos.x - closestX;
                const dy = actor.pos.y - closestY;
                const dist2 = dx * dx + dy * dy;
                if (dist2 < radius * radius && dist2 > 0) {
                    const dist = Math.sqrt(dist2);
                    // Push block away from actor
                    const pushForce = 2;
                    tile.vel.x -= (dx / dist) * pushForce;
                    tile.vel.y -= (dy / dist) * pushForce;
                    // Also apply slight rotation
                    tile.angle += (Math.random() - 0.5) * 0.01;
                }
            }

            // Update tileGrid position for collision purposes
            const oldTX = Math.floor((tile.origPos ? tile.origPos.x : tile.pos.x) / TILE_SIZE);
            const oldTY = Math.floor((tile.origPos ? tile.origPos.y : tile.pos.y) / TILE_SIZE);
            const newTX = Math.floor(tile.pos.x / TILE_SIZE);
            const newTY = Math.floor(tile.pos.y / TILE_SIZE);
            if (!tile.origPos) {
                tile.origPos = { x: tile.pos.x, y: tile.pos.y };
            }
            if (oldTX !== newTX || oldTY !== newTY) {
                // Update grid
                if (tile.map.tileGrid[oldTX] && tile.map.tileGrid[oldTX][oldTY] === 'pushBlock') {
                    tile.map.tileGrid[oldTX][oldTY] = null;
                }
                if (tile.map.tileGrid[newTX]) {
                    tile.map.tileGrid[newTX][newTY] = 'pushBlock';
                }
                tile.origPos = { x: tile.pos.x, y: tile.pos.y };
            }
        },
        renderMethod(tile, graphics, viewPos, map) {
            const cx = tile.pos.x - viewPos.x;
            const cy = tile.pos.y - viewPos.y;
            const bc = map && map.blockColor ? map.blockColor : Theme.wallColors[0];
            const color = new Color(200 + Math.floor(Math.random() * 40), bc.r, bc.g, bc.b);
            Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, tile.scale * 0.95, tile.angle, color);
        },
        editColor: new Color(255, 255, 255, 255)
    },

    start: {
        physics: {
            shapes: [{ shape: 'box', ox: 0, oy: 0, width: TILE_SIZE, height: TILE_SIZE, isSensor: true }]
        },
        renderMethod() { },
        editColor: new Color(192, 255, 255, 0)
    },

    stairsDown: {
        physics: {
            shapes: [{ shape: 'box', ox: 0, oy: 0, width: TILE_SIZE, height: TILE_SIZE, isSensor: true, userData: 'stairsDown' }]
        },
        updateMethod(tile, time) {
            if (_stairsSpottedByPlayer === 0) {
                for (const actor of tile.map.playerActors) {
                    if (MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                        _stairsSpottedByPlayer = actor.playerIndex;
                    }
                }
            } else if (_secondLevelStairs === 0 && gameScene && tile.map === gameScene.maps[1]) {
                for (const actor of tile.map.playerActors) {
                    if (MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                        _secondLevelStairs = actor.playerIndex;
                    }
                }
            }
        },
        renderMethod(tile, graphics, viewPos) {
            const cx = tile.pos.x - viewPos.x;
            const cy = tile.pos.y - viewPos.y;
            const top = cy - TILE_SIZE * 0.5 * 0.7;
            const step = (TILE_SIZE * 0.7) / 5;
            const width = (TILE_SIZE * 0.7 * 0.5) / 5;
            graphics.lineStyle(1, Theme.stairs, 1);
            for (let i = 0; i <= 5; i++) {
                const j = 5 - i;
                graphics.lineBetween(cx - 1 - j * width, top + step * i, cx + 1 + j * width, top + step * i);
            }
        },
        editColor: new Color(192, 0, 255, 128)
    },

    stairsUp: {
        physics: {
            shapes: [{ shape: 'box', ox: 0, oy: 0, width: TILE_SIZE, height: TILE_SIZE, isSensor: true, userData: 'stairsUp' }]
        },
        renderMethod(tile, graphics, viewPos) {
            const cx = tile.pos.x - viewPos.x;
            const cy = tile.pos.y - viewPos.y;
            const top = cy - TILE_SIZE * 0.5 * 0.7;
            const step = (TILE_SIZE * 0.7) / 5;
            const width = (TILE_SIZE * 0.7 * 0.5) / 5;
            graphics.lineStyle(1, Theme.stairs, 1);
            for (let i = 0; i <= 5; i++) {
                graphics.lineBetween(cx - 1 - i * width, top + step * i, cx + 1 + i * width, top + step * i);
            }
        },
        editColor: new Color(192, 0, 128, 255)
    },

    spawn: {
        physics: {
            shapes: [{ shape: 'box', ox: 0, oy: 0, width: TILE_SIZE, height: TILE_SIZE, isSensor: true }]
        },
        updateMethod(tile, time) {
            tile.allowSpawn = true;
            for (const actor of tile.map.playerActors) {
                if (MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                    tile.allowSpawn = false;
                    _spawnBlockedByPlayer = actor.playerIndex;
                }
            }
        },
        renderMethod(tile, graphics, viewPos) {
            const cx = tile.pos.x - viewPos.x;
            const cy = tile.pos.y - viewPos.y;
            if (tile.allowSpawn) {
                const color = new Color(160, 128, 32, 32);
                Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, tile.scale * 0.55, tile.angle + Math.PI * 0.25, color);
            } else {
                const color = new Color(100, 64, 64, 96);
                Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, tile.scale * 0.35, tile.angle + Math.PI * 0.25, color);
            }
        },
        editColor: new Color(192, 255, 0, 0)
    },

    indieSpawn: {
        physics: {
            shapes: [{ shape: 'box', ox: 0, oy: 0, width: TILE_SIZE, height: TILE_SIZE, isSensor: true }]
        },
        updateMethod(tile, time) {
            tile.nextSpawn = tile.nextSpawn || 1;
            tile.nextSpawn -= time;
            tile.allowSpawn = true;
            for (const actor of tile.map.playerActors) {
                if (MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                    tile.allowSpawn = false;
                }
            }
            if (tile.nextSpawn < 0 && tile.allowSpawn) {
                tile.nextSpawn = (window._debugIndieSpawnInterval != null)
                    ? window._debugIndieSpawnInterval
                    : 4 + Math.random() * 3;
                tile.map.addEnemyActor(new Actor(ACTORS.ghost, tile.pos.x, tile.pos.y, tile.map));
            }
        },
        renderMethod(tile, graphics, viewPos) {
            const cx = tile.pos.x - viewPos.x;
            const cy = tile.pos.y - viewPos.y;
            if (tile.allowSpawn) {
                const color = new Color(160, 128, 32, 64);
                Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, tile.scale * 0.55, tile.angle + Math.PI * 0.25, color);
                Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, tile.scale * 0.35, tile.angle + Math.PI * 0.25, color);
            } else {
                const color = new Color(100, 64, 64, 96);
                Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, tile.scale * 0.35, tile.angle + Math.PI * 0.25, color);
            }
        },
        editColor: new Color(192, 255, 0, 255)
    },

    electroArmNorth: {
        isBlocking: true,
        physics: {
            shapes: [
                { shape: 'circle', ox: 0, oy: 0, radius: TILE_SIZE * 0.6 },
                { shape: 'poly', x: [TILE_SIZE * 0.3, 0, -TILE_SIZE * 0.3], y: [TILE_SIZE * 0.3, TILE_SIZE * 1.2, TILE_SIZE * 0.3] }
            ]
        },
        updateMethod(tile, time) {
            tile.angleTimer = tile.angleTimer || 0;
            tile.angleTimer += time;
            tile.angle = Math.sin(tile.angleTimer) * Math.PI * 0.2;

            const absAngle = Math.abs(tile.angle);
            if (absAngle < Math.PI * 0.02) {
                if (!tile.sound) {
                    if (gameScene) gameScene.playGameSound('beam');
                    tile.sound = true;
                    // Hurt entities in beam path
                    const allActors = [...tile.map.playerActors, ...tile.map.enemyActors];
                    for (const actor of allActors) {
                        if (actor.pos.x > tile.pos.x - TILE_SIZE * 0.5 &&
                            actor.pos.x < tile.pos.x + TILE_SIZE * 0.5 &&
                            actor.pos.y > tile.pos.y &&
                            actor.pos.y < tile.pos.y + TILE_SIZE * 4) {
                            actor.onDamage(99999999);
                        }
                    }
                }
            } else {
                tile.sound = false;
            }
        },
        renderMethod(tile, graphics, viewPos, map) {
            const cx = tile.pos.x - viewPos.x;
            const cy = tile.pos.y - viewPos.y;
            const color = map && map.blockColor ?
                new Color(240 + Math.floor(Math.random() * 16), map.blockColor.r, map.blockColor.g, map.blockColor.b) :
                null;
            Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, tile.scale * 0.95, tile.angle, color);

            const absAngle = Math.abs(tile.angle);
            if (absAngle < Math.PI * 0.02) {
                const scale = 1 - (absAngle / (Math.PI * 0.02));
                graphics.lineStyle(1, Theme.electroBeam, scale);
                graphics.lineBetween(cx, cy + TILE_SIZE * 1.3, cx, cy + TILE_SIZE * 3.7);
                graphics.lineStyle(1, 0xff4080, scale * 0.7);
                graphics.lineBetween(cx - 1, cy + TILE_SIZE * 1.3, cx - 1, cy + TILE_SIZE * 3.7);
                graphics.lineBetween(cx + 1, cy + TILE_SIZE * 1.3, cx + 1, cy + TILE_SIZE * 3.7);
            }
        },
        editColor: new Color(192, 128, 128, 192)
    },

    electroArmSouth: {
        isBlocking: true,
        physics: {
            shapes: [
                { shape: 'circle', ox: 0, oy: 0, radius: TILE_SIZE * 0.6 },
                { shape: 'poly', x: [-TILE_SIZE * 0.3, 0, TILE_SIZE * 0.3], y: [-TILE_SIZE * 0.3, -TILE_SIZE * 1.2, -TILE_SIZE * 0.3] }
            ]
        },
        updateMethod(tile, time) {
            tile.angleTimer = tile.angleTimer || 0;
            tile.angleTimer += time;
            tile.angle = Math.sin(tile.angleTimer) * Math.PI * 0.2;
            // Note: South arm doesn't deal damage in the original (only North does)
        },
        renderMethod(tile, graphics, viewPos, map) {
            const cx = tile.pos.x - viewPos.x;
            const cy = tile.pos.y - viewPos.y;
            const color = map && map.blockColor ?
                new Color(240 + Math.floor(Math.random() * 16), map.blockColor.r, map.blockColor.g, map.blockColor.b) :
                null;
            Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, tile.scale * 0.95, tile.angle, color);
        },
        editColor: new Color(192, 128, 128, 192)
    },

    survivor1: {
        physics: {
            shapes: [{ shape: 'circle', ox: 0, oy: 0, radius: DEFAULT_ACTOR_RADIUS }]
        },
        updateMethod(tile, time) {
            if (gameScene && tile.map === gameScene.maps[4]) {
                if (_s1SpottedByPlayer === 0) {
                    for (const actor of tile.map.playerActors) {
                        if (MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                            _s1SpottedByPlayer = actor.playerIndex;
                            _s1SpottedByMedic = _s1SpottedByMedic || _s1SpottedByPlayer === 5;
                        }
                    }
                } else if (!_s1SpottedByMedic) {
                    for (const actor of tile.map.playerActors) {
                        if (actor.playerIndex === 5 && MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                            _s1SpottedByMedic = true;
                        }
                    }
                }
            } else if (gameScene && tile.map === gameScene.maps[2]) {
                if (!tile.hide) {
                    for (const actor of tile.map.playerActors) {
                        if (MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                            _s2SpottedByPlayer = actor.playerIndex;
                            _s2Tile = tile;
                        }
                    }
                }
            }
        },
        renderMethod(tile, graphics, viewPos) {
            if (!tile.hide) {
                const cx = tile.pos.x - viewPos.x;
                const cy = tile.pos.y - viewPos.y;
                Renderer.renderPhysicsLines(graphics, cx, cy, tile.type.physics, 1, 0);
            }
        },
        editColor: new Color(192, 255, 192, 0)
    },

    storyMarker: {
        physics: {
            shapes: [{ shape: 'circle', ox: 0, oy: 0, radius: DEFAULT_ACTOR_RADIUS }]
        },
        updateMethod(tile, time) {
            if (!gameScene) return;
            if (_storyMarkerLvl2 === 0 && tile.map === gameScene.maps[1]) {
                for (const actor of tile.map.playerActors) {
                    if (actor.playerIndex === 3 && MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                        _storyMarkerLvl2 = 3;
                    }
                }
            } else if (_storyMarkerLvl3 === 0 && tile.map === gameScene.maps[2]) {
                for (const actor of tile.map.playerActors) {
                    if (MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                        _storyMarkerLvl3 = actor.playerIndex;
                    }
                }
            } else if (_s1GetBackMarker === 0 && _s1SpottedByMedic && tile.map === gameScene.maps[4]) {
                for (const actor of tile.map.playerActors) {
                    if (MathUtils.distance2(tile.pos.x, tile.pos.y, actor.pos.x, actor.pos.y) < 300 * 300) {
                        _s1GetBackMarker = actor.playerIndex;
                    }
                }
            }
        },
        renderMethod() { },
        editColor: new Color(255, 255, 192, 192)
    }
};
