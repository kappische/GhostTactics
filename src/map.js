// Map class ported from map.lua

class GameMap {
    constructor(width, height, baseColor) {
        this.width = width;
        this.height = height;
        this.tiles = [];
        this.startTiles = [];
        this.spawnTiles = [];
        this.tileGrid = null;
        this.blockColor = baseColor || new Color(255, 192, 160, 160);
        this.playerCounter = 0;
        this.nextSpawnTimer = 1;
        this.playerActors = [];
        this.enemyActors = [];
        this.objects = [];
        this.particles = [];
    }

    createMap(field) {
        if (field) {
            this.tileGrid = field;
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const value = field[x] ? field[x][y] : null;
                    if (value && TILES[value]) {
                        this.addTile(x, y, TILES[value], value);
                    }
                }
            }
        }
    }

    addTile(x, y, tileType, tileName) {
        const tile = {
            pos: { x: (x + 0.5) * TILE_SIZE, y: (y + 0.5) * TILE_SIZE },
            angle: 0,
            scale: 1,
            type: tileType,
            category: 'tile',
            map: this,
            allowSpawn: false,
            tileName: tileName,
        };
        this.tiles.push(tile);

        if (tileType === TILES.start) {
            this.startTiles.push(tile);
        } else if (tileType === TILES.spawn || tileType === TILES.indieSpawn) {
            this.spawnTiles.push(tile);
        }
    }

    update(time) {
        // Spawn enemies
        if (!_superGhostKilled) {
            this.nextSpawnTimer -= time;
            if (this.nextSpawnTimer < 0) {
                this.resetSpawnTimer();
                const spawnTile = this.findRandomSpawnTile();
                if (spawnTile) {
                    this.addEnemyActor(new Actor(ACTORS.ghost, spawnTile.pos.x, spawnTile.pos.y, this));
                    ImpactEffects.ghostSpawn(this, spawnTile.pos.x, spawnTile.pos.y);
                }
            }
        }

        // Update tiles
        for (const tile of this.tiles) {
            if (tile.type.updateMethod) {
                tile.type.updateMethod(tile, time);
            }
        }

        // Update player actors
        for (let i = this.playerActors.length - 1; i >= 0; i--) {
            const actor = this.playerActors[i];
            actor.update(time);
            if (actor.isDead) {
                this.playerActors.splice(i, 1);
                this.playerCounter--;
            }
        }

        // Update enemy actors
        for (let i = this.enemyActors.length - 1; i >= 0; i--) {
            const actor = this.enemyActors[i];
            actor.update(time);
            if (actor.isDead) {
                this.enemyActors.splice(i, 1);
            }
        }

        // Update objects (projectiles)
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            obj.update(time);
            if (obj.isDead) {
                this.objects.splice(i, 1);
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(time);
            if (this.particles[i].isDead) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(graphics, viewPos) {
        for (const tile of this.tiles) {
            if (tile.type.renderMethod) {
                tile.type.renderMethod(tile, graphics, viewPos, this);
            }
        }
        for (const actor of this.playerActors) {
            actor.render(graphics, viewPos);
        }
        for (const actor of this.enemyActors) {
            actor.render(graphics, viewPos);
        }
        for (const obj of this.objects) {
            obj.render(graphics, viewPos);
        }
        for (const p of this.particles) {
            p.render(graphics, viewPos);
        }
    }

    isActive() {
        return this.playerCounter > 0;
    }

    resetSpawnTimer() {
        this.nextSpawnTimer = 1 + Math.random() * 2;
    }

    addEnemyActor(actor) {
        this.enemyActors.push(actor);
    }

    addPlayerActor(actor) {
        this.playerActors.push(actor);
        this.playerCounter++;
    }

    removePlayerActor(actor) {
        const index = this.playerActors.indexOf(actor);
        if (index >= 0) {
            this.playerActors.splice(index, 1);
            this.playerCounter--;
        }
    }

    addObject(obj) {
        this.objects.push(obj);
    }

    addParticle(particle) {
        particle.map = this;
        this.particles.push(particle);
        // Cap debris at 2000 - remove oldest settled shards first
        while (this.particles.length > 2000) {
            const oldest = this.particles.findIndex(p => p.settled);
            if (oldest >= 0) {
                this.particles.splice(oldest, 1);
            } else {
                this.particles.shift(); // remove oldest if none settled
            }
        }
    }

    findRandomSpawnTile() {
        if (this.spawnTiles.length === 0) return null;
        let foundTile = null;
        for (const tile of this.spawnTiles) {
            if (tile.allowSpawn) {
                foundTile = tile;
                break;
            }
        }
        if (!foundTile) return null;

        for (let i = 0; i < 10; i++) {
            const testTile = this.spawnTiles[Math.floor(Math.random() * this.spawnTiles.length)];
            if (testTile.allowSpawn) return testTile;
        }
        return foundTile;
    }

    findNextStartTile() {
        for (const tile of this.startTiles) {
            if (!tile.hasBeenUsed) {
                tile.hasBeenUsed = true;
                return tile;
            }
        }
        return null;
    }

    findPath(startX, startY, endX, endY) {
        if (!this.tileGrid) return null;

        let sx = Math.floor(startX / TILE_SIZE);
        let sy = Math.floor(startY / TILE_SIZE);
        let ex = Math.floor(endX / TILE_SIZE);
        let ey = Math.floor(endY / TILE_SIZE);

        if (sx === ex && sy === ey) return null;
        if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) return null;
        if (ex < 0 || ex >= this.width || ey < 0 || ey >= this.height) return null;

        const maxAllowedCost = 40;
        const neighbors = [
            { x: -1, y: 0, cost: 1 }, { x: -1, y: -1, cost: 1.41 },
            { x: 0, y: -1, cost: 1 }, { x: 1, y: -1, cost: 1.41 },
            { x: 1, y: 0, cost: 1 }, { x: 1, y: 1, cost: 1.41 },
            { x: 0, y: 1, cost: 1 }, { x: -1, y: 1, cost: 1.41 }
        ];

        // A* pathfinding
        const openSet = [0];
        const closedSet = new Set();
        const walkCosts = [0];
        const remCosts = [MathUtils.distance(sx, sy, ex, ey)];
        const totalCosts = [remCosts[0]];
        const parents = [-1];
        const nodeX = [sx];
        const nodeY = [sy];
        let nextIndex = 1;

        while (openSet.length > 0) {
            let bestCost = Infinity;
            let bestIdx = -1;
            let bestPos = -1;
            for (let i = 0; i < openSet.length; i++) {
                if (totalCosts[openSet[i]] < bestCost) {
                    bestCost = totalCosts[openSet[i]];
                    bestIdx = openSet[i];
                    bestPos = i;
                }
            }

            if (bestPos < 0) return null;

            if (nodeX[bestIdx] === ex && nodeY[bestIdx] === ey) {
                // Reconstruct path
                const pathPoints = [{ x: (ex + 0.5) * TILE_SIZE, y: (ey + 0.5) * TILE_SIZE }];
                let current = bestIdx;
                while (parents[current] >= 0) {
                    current = parents[current];
                    pathPoints.unshift({ x: (nodeX[current] + 0.5) * TILE_SIZE, y: (nodeY[current] + 0.5) * TILE_SIZE });
                }
                return pathPoints;
            }

            openSet.splice(bestPos, 1);
            closedSet.add(bestIdx);

            if (totalCosts[bestIdx] <= maxAllowedCost) {
                for (const neigh of neighbors) {
                    const cx = nodeX[bestIdx] + neigh.x;
                    const cy = nodeY[bestIdx] + neigh.y;

                    if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) continue;

                    const tileName = this.tileGrid[cx] ? this.tileGrid[cx][cy] : null;
                    if (tileName && TILES[tileName] && TILES[tileName].isBlocking) continue;

                    // Check closed set
                    let inClosed = false;
                    for (const ci of closedSet) {
                        if (nodeX[ci] === cx && nodeY[ci] === cy) {
                            inClosed = true;
                            break;
                        }
                    }
                    if (inClosed) continue;

                    const newWalkCost = walkCosts[bestIdx] + neigh.cost;

                    // Check open set
                    let inOpen = false;
                    for (const oi of openSet) {
                        if (nodeX[oi] === cx && nodeY[oi] === cy) {
                            inOpen = true;
                            if (newWalkCost < walkCosts[oi]) {
                                parents[oi] = bestIdx;
                                walkCosts[oi] = newWalkCost;
                                totalCosts[oi] = newWalkCost + remCosts[oi];
                            }
                            break;
                        }
                    }

                    if (!inOpen) {
                        openSet.push(nextIndex);
                        parents[nextIndex] = bestIdx;
                        walkCosts[nextIndex] = newWalkCost;
                        remCosts[nextIndex] = MathUtils.distance(cx, cy, ex, ey);
                        totalCosts[nextIndex] = walkCosts[nextIndex] + remCosts[nextIndex];
                        nodeX[nextIndex] = cx;
                        nodeY[nextIndex] = cy;
                        nextIndex++;
                    }
                }
            }
        }
        return null;
    }
}
