// Main GameScene - ported from gameState.lua
// This is the primary Phaser scene that manages all gameplay

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 768;
const HUD_WIDTH = 200;
const HUD_CHAT_HEIGHT = 150;
const NUM_MAPS = 5;
const MAP_WIDTH = 48;
const MAP_HEIGHT = 32;

const PLAYER_NAMES = [
    "James", "Hans", "Charles", "John", "Edward", "Matthew",
    "Bob", "Jon", "Conrad", "Dexter", "Rune", "Peter",
    "Bruce", "Harry", "Kevin", "Tom", "Timmy", "Jimmy",
    "Paul", "George", "Michael", "Mike", "Walker", "William",
    "Terry", "Al", "Edmund", "Phil", "Derek",
];

let gameScene = null;

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Load the map file
        this.load.binary('mapData', 'assets/testMap.map');

        // Load audio
        const sfxNames = ['shoot', 'shotgun', 'beam', 'blip', 'ghostDie', 'playerHurt', 'heal', 'footstepRun', 'footstepWalk'];
        for (const name of sfxNames) {
            for (let i = 1; i <= 4; i++) {
                this.load.audio(`${name}${i}`, `assets/sfx/${name}${i}.wav`);
            }
        }
        // Music is loaded lazily when needed (large OGG files block preload)
    }

    create() {
        gameScene = this;

        this._settings = {
            masterVolume: 0.5,
            musicVolume: 0.8,
            textDelay: 40,
            checkpoint: 0,
            portraitSeed: 105014192,
        };

        // Try to load saved settings
        try {
            const saved = localStorage.getItem('ghostTacticsSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.assign(this._settings, parsed);
            }
        } catch (e) { }

        this.graphics = this.add.graphics();
        this.hudGraphics = this.add.graphics();
        this.hudGraphics.setDepth(10);
        this._numbersToDraw = [];

        // Text objects pool
        this.textObjects = [];

        this.maps = [];
        this.viewPos = { x: 0, y: 0, left: HUD_WIDTH, right: GAME_WIDTH, top: 0, bottom: GAME_HEIGHT, screenOffsetX: 0 };

        this.atTitleScreen = true;
        this.currentControlPlayer = 0; // 0-indexed
        this.playerInfo = [];
        this.extraPlayerInfo = [];
        this.chatVisible = 0;
        this.lastNumChatCharacters = 0;
        this.storyList = [];
        this.chatPortrait = null;
        this.currentMusic = null;
        this.nextMusic = null;
        this.gameOver = false;
        this.currentRenderMap = null;
        this.events = createEvents();

        // Fixed timestep accumulator
        this.strayTime = 0;
        this.fpsTimer = 0;
        this.fpsCount = 0;
        this.lastFPS = 0;

        // Setup input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = {
            shift: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
            tab: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
            enter: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
            space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            one: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            two: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            three: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
            four: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
            five: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
            six: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SIX),
            seven: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SEVEN),
            eight: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.EIGHT),
            r: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
            ctrl: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL),
        };

        // Key handlers
        this.input.keyboard.on('keydown', (event) => this.onKeyDown(event));

        // Prevent browser from scrolling on arrow keys/space/tab
        this.input.keyboard.disableGlobalCapture();

        // Parse map data
        this.parseAndInit();
    }

    parseAndInit() {
        const mapBuffer = this.cache.binary.get('mapData');
        if (!mapBuffer) {
            console.error('Failed to load map data');
            return;
        }

        const mapResult = MapDataLoader.parseMapFile(mapBuffer);
        this.editFields = mapResult.maps;

        // Create seeded random for portraits
        this.seedRandom = this.createSeededRandom(this._settings.portraitSeed);

        const baseColors = [
            new Color(255, 30, 70, 120),   // floor 1: medium blue
            new Color(255, 40, 80, 110),   // floor 2: teal-blue
            new Color(255, 30, 60, 100),   // floor 3: darker blue
            new Color(255, 25, 70, 90),    // floor 4: steel blue
            new Color(255, 20, 50, 110),   // floor 5: deep blue
        ];

        for (let i = 0; i < NUM_MAPS; i++) {
            const map = new GameMap(MAP_WIDTH, MAP_HEIGHT, baseColors[i]);
            map.createMap(this.editFields[i].field);
            this.maps.push(map);
        }

        // Create player info
        this.playerInfo.push(this.createPlayerInfo("Captain", 1));
        this.playerInfo.push(this.createPlayerInfo("Private", 2));
        this.playerInfo.push(this.createPlayerInfo("Private", 3));
        this.playerInfo.push(this.createPlayerInfo("Officer Cadet", 4));
        this.playerInfo.push(this.createPlayerInfo("Lieutenant", 5));
        this.playerInfo.push(this.createPlayerInfo("Private", 6));
        this.playerInfo.push(this.createPlayerInfo("Private", 7));
        this.playerInfo.push(this.createPlayerInfo("Private", 8));

        this.extraPlayerInfo.push(this.createPlayerInfo("HQ", -1));
        this.extraPlayerInfo[0].name = "HQ";
        this.extraPlayerInfo[0].voicePitch = 0.65;

        // Chat text display
        this.chatText = this.add.text(HUD_WIDTH + 160, GAME_HEIGHT - HUD_CHAT_HEIGHT + 5, '', {
            fontFamily: 'Courier New, monospace',
            fontSize: '14px',
            color: Theme.chatText,
            wordWrap: { width: GAME_WIDTH - HUD_WIDTH - 170 }
        });
        this.chatText.setDepth(15);
        this.chatText.setVisible(false);

        this.playMusicTrack('AtraMateria', 1, false);
        DebugMenu.init(this);
    }

    createSeededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    createPlayerInfo(rank, index) {
        const rng = this.seedRandom;
        const info = {};
        let fNameOk = true;
        do {
            fNameOk = true;
            info.fName = PLAYER_NAMES[Math.floor(rng() * PLAYER_NAMES.length)];
            for (const other of this.playerInfo) {
                if (other && other.fName === info.fName) {
                    fNameOk = false;
                    break;
                }
            }
        } while (!fNameOk);

        info.lName = PLAYER_NAMES[Math.floor(rng() * PLAYER_NAMES.length)] + "son";
        info.name = info.fName + " " + info.lName;
        info.rank = rank;
        info.kills = 0;
        info.status = "MIA";
        info.voicePitch = 0.75 + rng() * 0.4;
        info.portrait = {
            headRatio: 1.2 + rng() * 0.2,
            cheekStrength: 0.05 + rng() * 0.15,
            eyeSpacing: 0.9 + rng() * 0.3,
            eyeWidth: 0.9 + rng() * 0.4,
            eyeHeight: 0.9 + rng() * 0.4,
            mouthOffset: 0.8 + rng() * 0.4,
            mouthWidth: 0.8 + rng() * 0.8,
            mouthPout: rng() * 0.1,
            noseWidth: 1 - rng() * 0.2,
            noseHeight: 1 - rng() * 0.4,
            hairStyle: Math.floor(rng() * 9) - 6,
            beardStyle: Math.floor(rng() * 6) - 4,
            eyeStyle: Math.floor(rng() * 8) - 6,
        };
        info.portrait.cheekWaveStrength = info.portrait.cheekStrength * 0.1 + rng() * 0.5 * info.portrait.cheekStrength;
        info.playerIndex = index;
        info.actor = null;
        return info;
    }

    addPlayerActor(actor, info) {
        if (info.rank === "Lieutenant") {
            actor.addEquipment(new Equipment(EQUIPMENT.pistol, actor, actor.type.attachPoints.right || actor.type.attachPoints.front));
            actor.addEquipment(new Equipment(EQUIPMENT.healer, actor, actor.type.attachPoints.left || actor.type.attachPoints.center));
        } else if (info.rank === "Captain") {
            actor.addEquipment(new Equipment(EQUIPMENT.shotgun, actor, actor.type.attachPoints.front));
        } else if (info.rank === "Officer Cadet") {
            actor.addEquipment(new Equipment(EQUIPMENT.pistol, actor, actor.type.attachPoints.right || actor.type.attachPoints.front));
            actor.addEquipment(new Equipment(EQUIPMENT.scanner, actor, actor.type.attachPoints.left || actor.type.attachPoints.center));
        } else {
            actor.addEquipment(new Equipment(EQUIPMENT.rifle, actor, actor.type.attachPoints.front));
        }
        actor.playerInfo = info;
        actor.playerIndex = info.playerIndex;
        info.actor = actor;
        info.status = null;
        actor.map.addPlayerActor(actor);
        return actor;
    }

    initStartMap(mapIndex, numPlayers) {
        const startMap = this.maps[mapIndex];
        startMap.nextSpawnTimer = 10;
        for (let i = 0; i < numPlayers; i++) {
            const tile = startMap.findNextStartTile();
            let x = 100, y = 100;
            if (tile) { x = tile.pos.x; y = tile.pos.y; }
            this.addPlayerActor(new Actor(ACTORS.marine, x, y, startMap), this.playerInfo[i]);
        }
    }

    initStartingState() {
        if (_useCheckpoint === 0) {
            this.playMusicTrack('TheGale', 0.8, false);
            this.initStartMap(0, 4);
            this.maps[0].nextSpawnTimer = 25;

            this.storyList = [
                { elements: [
                    { text: "Ah god damn! The smell... it's awful.", info: this.playerInfo[2] },
                    { text: "Yeah, yeah...", info: this.playerInfo[0] },
                    { text: "Smells like sweat mixed with deoderant.", info: this.playerInfo[2] },
                    { text: "... awful.", info: this.playerInfo[2] },
                ]},
                { elements: [
                    { text: "HQ? We're in.", info: this.playerInfo[0] },
                    { text: "Roger that. Any sign of hostiles?", info: this.extraPlayerInfo[0] },
                    { text: "Not yet, but the odor is evident.", info: this.playerInfo[0] },
                    { text: "Captain, there's activity on the radar.", info: this.playerInfo[3] },
                    { text: "As we suspected. That place is crawling with ghosts.", info: this.extraPlayerInfo[0] },
                    { text: "Remember, your objective is to get more people OUT than went IN.", info: this.extraPlayerInfo[0] },
                    { text: "I will accept NO casualties!", info: this.extraPlayerInfo[0] },
                    { text: "Yes, sir, we read the briefing. Squad, move out!", info: this.playerInfo[0] },
                ]},
            ];
        } else {
            this.playMusicTrack(null, 0.8, false);
            if (_useCheckpoint >= 1) this.playerInfo[7].status = "DEAD";
            if (_useCheckpoint >= 5) this.playerInfo[6].status = "DEAD";

            if (_useCheckpoint === 1) this.initStartMap(1, 5);
            else if (_useCheckpoint === 2) this.initStartMap(2, 5);
            else if (_useCheckpoint === 3) this.initStartMap(3, 6);
            else if (_useCheckpoint === 4) this.initStartMap(4, 6);
            else if (_useCheckpoint === 5) {
                // Special squad split
                const startMap = this.maps[4];
                let tile = startMap.findNextStartTile();
                if (tile) this.addPlayerActor(new Actor(ACTORS.marine, tile.pos.x, tile.pos.y, startMap), this.playerInfo[1]);
                tile = startMap.findNextStartTile();
                if (tile) this.addPlayerActor(new Actor(ACTORS.marine, tile.pos.x, tile.pos.y, startMap), this.playerInfo[4]);

                let sx = 100, sy = 100;
                for (const t of startMap.tiles) {
                    if (t.type === TILES.stairsUp && t.pos.y < TILE_SIZE * 16) {
                        sx = t.pos.x; sy = t.pos.y;
                    }
                }
                this.addPlayerActor(new Actor(ACTORS.marine, sx - TILE_SIZE, sy - TILE_SIZE, startMap), this.playerInfo[0]);
                this.addPlayerActor(new Actor(ACTORS.marine, sx + TILE_SIZE, sy - TILE_SIZE, startMap), this.playerInfo[2]);
                this.addPlayerActor(new Actor(ACTORS.marine, sx + TILE_SIZE, sy + TILE_SIZE, startMap), this.playerInfo[3]);
                this.addPlayerActor(new Actor(ACTORS.marine, sx - TILE_SIZE, sy + TILE_SIZE, startMap), this.playerInfo[5]);
            } else if (_useCheckpoint === 6) {
                this.initStartMap(3, 6);
            }
        }
    }

    playGameSound(name) {
        const idx = Math.floor(Math.random() * 4) + 1;
        const key = name + idx;
        try {
            this.sound.play(key, { volume: this._settings.masterVolume });
        } catch (e) { }
    }

    // Music uses HTML5 Audio to avoid blocking Phaser preload with large OGG files
    _createMusicAudio(name, volume) {
        if (!name) return null;
        const musicMap = {
            'AtraMateria': 'assets/music/AtraMateria.ogg',
            'TheGale': 'assets/music/TheGale.ogg',
            'TheDyingRace': 'assets/music/TheDyingRace.ogg',
            'DreamlikeSilence': 'assets/music/DreamlikeSilence.ogg',
            'Disturbance': 'assets/music/Disturbance.ogg',
            'WeDontSee': 'assets/music/WeDontSee.ogg',
        };
        const url = musicMap[name];
        if (!url) return null;
        try {
            const audio = new Audio(url);
            audio.loop = true;
            audio.volume = volume;
            return audio;
        } catch (e) { return null; }
    }

    playMusicTrack(name, volume, loop) {
        const musicVol = this._settings.musicVolume;
        if (musicVol <= 0) return;

        if (!this.currentMusic) {
            this.currentMusic = { name, volume: volume || 0.8, scale: 1 };
            this.currentMusic.obj = this._createMusicAudio(name, (volume || 0.8) * musicVol);
            if (this.currentMusic.obj) {
                this.currentMusic.obj.play().catch(() => {});
            }
        } else if (this.nextMusic) {
            if (this.nextMusic.obj) { try { this.nextMusic.obj.pause(); } catch(e){} }
            this.nextMusic = { name, volume: volume || 0.8 };
            this.nextMusic.obj = this._createMusicAudio(name, 0.001);
            if (this.nextMusic.obj) this.nextMusic.obj.play().catch(() => {});
        } else {
            this.nextMusic = { name, volume: volume || 0.8 };
            this.nextMusic.obj = this._createMusicAudio(name, 0.001);
            if (this.nextMusic.obj) this.nextMusic.obj.play().catch(() => {});
        }
    }

    updateMusicCrossfade(time) {
        if (!this.nextMusic || !this.currentMusic) return;
        const musicVol = this._settings.musicVolume;
        const fadeSpeed = 0.5;

        this.currentMusic.scale -= fadeSpeed * time;
        if (this.currentMusic.scale < 0) {
            if (this.currentMusic.obj) { try { this.currentMusic.obj.pause(); } catch(e){} }
            this.currentMusic = this.nextMusic;
            this.nextMusic = null;
            this.currentMusic.scale = 1;
            if (this.currentMusic.obj) this.currentMusic.obj.volume = this.currentMusic.volume * musicVol;
        } else {
            if (this.currentMusic.obj) this.currentMusic.obj.volume = this.currentMusic.volume * this.currentMusic.scale * musicVol;
            if (this.nextMusic.obj) this.nextMusic.obj.volume = this.nextMusic.volume * (1 - this.currentMusic.scale) * musicVol;
        }
    }

    selectPlayerActor(index) {
        if (!this.playerInfo[index] || !this.playerInfo[index].actor || this.playerInfo[index].actor.isDead) {
            return false;
        }
        this.currentControlPlayer = index;
        return true;
    }

    selectNextPlayerActor() {
        for (let i = this.currentControlPlayer + 1; i < this.playerInfo.length; i++) {
            if (this.selectPlayerActor(i)) return true;
        }
        for (let i = 0; i <= this.currentControlPlayer; i++) {
            if (this.selectPlayerActor(i)) return true;
        }
        return false;
    }

    getMapAbove(current) {
        for (let i = 1; i < NUM_MAPS; i++) {
            if (this.maps[i] === current) return this.maps[i - 1];
        }
        return null;
    }

    getMapBelow(current) {
        for (let i = 0; i < NUM_MAPS - 1; i++) {
            if (this.maps[i] === current) return this.maps[i + 1];
        }
        return null;
    }

    addStory(story) {
        this.storyList.push(story);
    }

    onKeyDown(event) {
        if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.TAB) {
            event.preventDefault();
            this.selectNextPlayerActor();
        } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.ENTER) {
            if (this.atTitleScreen && this._settings.checkpoint > 0) {
                _useCheckpoint = this._settings.checkpoint;
                this.atTitleScreen = false;
                this.initStartingState();
            } else if (!this.atTitleScreen) {
                const info = this.playerInfo[this.currentControlPlayer];
                if (info && info.actor && !info.actor.isDead) {
                    info.actor.onActionKey();
                }
            }
        } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.SPACE) {
            if (this.atTitleScreen) {
                this.atTitleScreen = false;
                _useCheckpoint = 0;
                this.initStartingState();
            }
        } else if (event.keyCode >= 49 && event.keyCode <= 56) { // 1-8
            this.selectPlayerActor(event.keyCode - 49);
        } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.R && this.keys.ctrl.isDown) {
            // Restart
            this.scene.restart();
        } else if (event.keyCode === 192) { // backtick `
            DebugMenu.toggle();
        }
    }

    update(gameTime, delta) {
        const time = delta / 1000;

        // FPS counter
        this.fpsTimer += time;
        if (this.fpsTimer > 1) {
            this.fpsTimer -= 1;
            this.lastFPS = this.fpsCount;
            this.fpsCount = 0;
        }
        this.fpsCount++;

        // Fixed timestep for physics/gameplay
        const clampedTime = Math.min(time, 0.06);
        this.strayTime += clampedTime;
        const dt = 0.015625; // 64 Hz

        while (this.strayTime >= dt) {
            this.strayTime -= dt;
            this.gameUpdate(dt);
        }

        // Story/dialog updates once per frame (not per physics tick)
        // to ensure text is visible between advances
        if (!this.atTitleScreen) {
            this.updateStoryInfo(clampedTime);
        }

        this.gameRender();
    }

    gameUpdate(time) {
        this.viewPos.left = HUD_WIDTH;
        this.viewPos.right = GAME_WIDTH;
        this.viewPos.top = 0;
        this.viewPos.bottom = GAME_HEIGHT;
        this.viewPos.screenOffsetX = 0;

        if (this.atTitleScreen) return;

        // Update control
        for (let i = 0; i < this.playerInfo.length; i++) {
            const info = this.playerInfo[i];
            if (info && info.actor) {
                if (i === this.currentControlPlayer) {
                    if (info.actor.isDead) {
                        this.selectNextPlayerActor();
                    } else {
                        info.actor.hasControl = true;
                    }
                } else {
                    info.actor.hasControl = false;
                }
            }
        }

        const controlInfo = this.playerInfo[this.currentControlPlayer];
        if (controlInfo && controlInfo.actor) {
            this.currentRenderMap = controlInfo.actor.map;

            let viewHeight = GAME_HEIGHT;
            if (this.chatVisible > 0) {
                viewHeight -= HUD_CHAT_HEIGHT * this.chatVisible;
            }

            const tx = -HUD_WIDTH + controlInfo.actor.pos.x - (GAME_WIDTH - HUD_WIDTH) / 2;
            const ty = controlInfo.actor.pos.y - viewHeight / 2;
            this.viewPos.x += (tx - this.viewPos.x) * time * 10;
            this.viewPos.y += (ty - this.viewPos.y) * time * 10;

            this.viewPos.x = Math.min(Math.max(this.viewPos.x, -HUD_WIDTH), TILE_SIZE * MAP_WIDTH - GAME_WIDTH);
            this.viewPos.y = Math.min(Math.max(this.viewPos.y, 0), TILE_SIZE * MAP_HEIGHT - viewHeight);
            this.viewPos.bottom = viewHeight;
        }

        // Update active maps
        for (let i = 0; i < NUM_MAPS; i++) {
            if (this.maps[i] && this.maps[i].isActive()) {
                this.maps[i].update(time);
            }
        }

        // Run events
        for (const event of this.events) {
            if (!event.triggered && event.condition(this)) {
                event.run(this);
                event.triggered = true;
            }
        }

        // Music crossfading
        this.updateMusicCrossfade(time);

        // Debug
        DebugMenu.update(this);
    }

    updateStoryInfo(time) {
        this.chatVisible = 0;
        if (this.storyList.length > 0) {
            const currentStory = this.storyList[0];
            currentStory.initTimer = currentStory.initTimer || 3;
            currentStory.initTimer -= time;
            this.chatVisible = Math.max(0, 1 - currentStory.initTimer);

            if (currentStory.initTimer <= 0) {
                this.chatVisible = 1;

                if (!currentStory.elements || currentStory.elements.length === 0) {
                    this.storyList.shift();
                    return; // Don't process next story in same tick
                } else {
                    const currentElement = currentStory.elements[0];
                    currentElement.timer = currentElement.timer || 0;
                    currentElement.timer += time;

                    if (currentElement.text === "$END") {
                        this.chatText.setText("MISSION FAILED");
                        this.chatPortrait = null;
                        this.gameOver = true;
                    } else if (currentElement.text === "$WIN") {
                        this.chatText.setText("You've reached the end of the prototype. Congratulations!");
                        this.chatPortrait = null;
                        this.gameOver = true;
                    } else {
                        const textLength = currentElement.text.length;
                        let numChars = Math.floor(currentElement.timer / (this._settings.textDelay * 0.001));

                        if (numChars > textLength + 50) {
                            numChars = 0;
                            currentStory.elements.shift();
                            if (currentStory.elements.length === 0) return;
                            const next = currentStory.elements[0];
                            if (next) {
                                this.chatPortrait = next.info.portrait;
                                this.chatText.setText(next.info.name + ": " + next.text.substring(0, 0));
                            }
                        } else if (currentElement) {
                            this.chatPortrait = currentElement.info.portrait;
                            const displayText = currentElement.info.name + ": " + currentElement.text.substring(0, numChars);
                            this.chatText.setText(displayText);

                            if (numChars < textLength && Math.floor(numChars / 2) !== this.lastNumChatCharacters) {
                                this.lastNumChatCharacters = Math.floor(numChars / 2);
                                this.playGameSound('blip');
                            }
                        }
                    }
                }
            }
        } else if (this.chatVisible > 0) {
            this.chatVisible -= time;
            if (this.chatVisible < 0) this.chatVisible = 0;
        }

        this.chatText.setVisible(this.chatVisible >= 1);
    }

    gameRender() {
        // Clear all graphics
        this.graphics.clear();
        this.hudGraphics.clear();

        // Clean up old text objects
        for (const t of this.textObjects) t.destroy();
        this.textObjects = [];

        if (this.atTitleScreen) {
            this.renderTitleScreen();
            return;
        }

        // Render current map
        this._numbersToDraw = [];
        const renderMap = this.currentRenderMap || this.maps[0];
        if (renderMap) {
            renderMap.render(this.graphics, this.viewPos);
        }

        // Render actor index numbers (queued during map render)
        for (const n of this._numbersToDraw) {
            const txt = this.add.text(n.x, n.y, '' + n.num, {
                fontFamily: 'Courier New, monospace',
                fontSize: '12px',
                color: n.color,
            }).setOrigin(0.5, 0.5).setAlpha(n.alpha).setDepth(5);
            this.textObjects.push(txt);
        }

        // Render HUD
        this.renderHUD();

        // Render chat
        if (this.chatVisible > 0) {
            this.renderChat();
        }

        // FPS
        const fpsText = this.add.text(10, GAME_HEIGHT - 20, 'FPS: ' + this.lastFPS, {
            fontFamily: 'Courier New, monospace', fontSize: '12px', color: Theme.fpsColor
        });
        fpsText.setDepth(20);
        this.textObjects.push(fpsText);

        if (this.gameOver) {
            const goText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Press Ctrl+R to Restart', {
                fontFamily: 'Courier New, monospace', fontSize: '14px', color: Theme.hudBright
            }).setOrigin(0.5);
            goText.setDepth(20);
            this.textObjects.push(goText);

            const cpText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, 'Checkpoints Reached: ' + this._settings.checkpoint, {
                fontFamily: 'Courier New, monospace', fontSize: '12px', color: Theme.hudText
            }).setOrigin(0.5);
            cpText.setDepth(20);
            this.textObjects.push(cpText);
        }

        // CRT scanline overlay
        this.renderCRTOverlay();
    }

    renderTitleScreen() {
        const g = this.hudGraphics;
        // Dark blue background
        g.fillStyle(Theme.bgHex, 1);
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Decorative grid lines
        g.lineStyle(1, Theme.hudBorderDim, 0.15);
        for (let x = 0; x < GAME_WIDTH; x += 48) g.lineBetween(x, 0, x, GAME_HEIGHT);
        for (let y = 0; y < GAME_HEIGHT; y += 48) g.lineBetween(0, y, GAME_WIDTH, y);

        const lines = [
            { text: 'GHOST TACTICS', x: GAME_WIDTH / 2, y: 250, size: 32, color: Theme.titleMain },
            { text: 'Inspired by Horror Tactics by Oxeye Game Studio', x: GAME_WIDTH / 2, y: 350, size: 12, color: Theme.titleSub },
            { text: 'Ported to Phaser JS', x: GAME_WIDTH / 2, y: 370, size: 12, color: Theme.titleSub },
            { text: 'Press SPACE to Begin', x: GAME_WIDTH / 2, y: 500, size: 14, color: Theme.hudBright },
            { text: 'Press ENTER to Continue from Checkpoint', x: GAME_WIDTH / 2, y: 520, size: 12, color: Theme.hudText },
            { text: 'Arrow Keys - Run', x: GAME_WIDTH / 2, y: 560, size: 12, color: Theme.titleSub },
            { text: 'Shift - Walk', x: GAME_WIDTH / 2, y: 576, size: 12, color: Theme.titleSub },
            { text: 'TAB - Next Squad Member', x: GAME_WIDTH / 2, y: 592, size: 12, color: Theme.titleSub },
            { text: '1..8 - Select Squad Member', x: GAME_WIDTH / 2, y: 608, size: 12, color: Theme.titleSub },
            { text: 'ENTER - Use Stairs', x: GAME_WIDTH / 2, y: 624, size: 12, color: Theme.titleSub },
            { text: 'Shift+ENTER - Hustle! (At Stairs)', x: GAME_WIDTH / 2, y: 640, size: 12, color: Theme.titleSub },
            { text: 'Ctrl+R - Restart', x: GAME_WIDTH / 2, y: 670, size: 12, color: Theme.titleSub },
        ];

        for (const line of lines) {
            const t = this.add.text(line.x, line.y, line.text, {
                fontFamily: 'Courier New, monospace',
                fontSize: line.size + 'px',
                color: line.color,
            }).setOrigin(0.5, 0).setDepth(20);
            this.textObjects.push(t);
        }
    }

    renderHUD() {
        const g = this.hudGraphics;

        // HUD background - dark blue
        g.fillStyle(Theme.bgHex, 1);
        g.fillRect(0, 0, HUD_WIDTH, GAME_HEIGHT);

        const pHeight = GAME_HEIGHT / 10;

        for (let i = 0; i < this.playerInfo.length; i++) {
            const info = this.playerInfo[i];
            let alpha = 1;
            if (!info || !info.actor || info.actor.isDead) alpha = 0.5;

            const top = i * pHeight + 2;
            const left = 2;
            const bottom = top + pHeight - 4;
            const right = HUD_WIDTH - 2;

            // Selection border
            if (i === this.currentControlPlayer) {
                g.lineStyle(1, Theme.hudBorder, alpha);
                g.strokeRect(left, top, right - left, bottom - top);
            }

            const portraitWidth = Math.floor(pHeight / 1.6);

            // Portrait border
            g.lineStyle(1, Theme.hudPortrait, alpha * 0.7);
            g.strokeRect(left + 2, top + 2, portraitWidth, bottom - top - 4);

            if (info) {
                // Render portrait
                PortraitRenderer.render(g, left + 2, top + 2, left + portraitWidth + 2, bottom - 2, info.portrait, alpha * 255);

                const textX = left + portraitWidth + 10;

                // Name
                const nameText = this.add.text(textX, top + 2, info.playerIndex + '. ' + info.name, {
                    fontFamily: 'Courier New, monospace', fontSize: '10px', color: Theme.hudBright,
                }).setAlpha(alpha).setDepth(15);
                this.textObjects.push(nameText);

                // Rank
                const rankText = this.add.text(textX, top + 14, info.rank, {
                    fontFamily: 'Courier New, monospace', fontSize: '10px', color: Theme.hudText,
                }).setAlpha(alpha).setDepth(15);
                this.textObjects.push(rankText);

                // Health/Status
                if (info.actor && info.actor.health > 0) {
                    let color = Theme.healthGood;
                    if (info.actor.health < info.actor.type.maxHealth * 0.33) color = Theme.healthBad;
                    else if (info.actor.health < info.actor.type.maxHealth * 0.66) color = Theme.healthMid;

                    const hpText = this.add.text(textX, top + 26, 'Health: ' + Math.ceil(info.actor.health), {
                        fontFamily: 'Courier New, monospace', fontSize: '10px', color: color,
                    }).setAlpha(alpha).setDepth(15);
                    this.textObjects.push(hpText);
                } else {
                    const statusStr = info.status || 'DEAD';
                    const statusText = this.add.text(textX, top + 26, statusStr, {
                        fontFamily: 'Courier New, monospace', fontSize: '10px', color: Theme.statusDead,
                    }).setAlpha(alpha).setDepth(15);
                    this.textObjects.push(statusText);
                }

                // Kills
                const killText = this.add.text(textX, top + 38, 'Kills: ' + info.kills, {
                    fontFamily: 'Courier New, monospace', fontSize: '10px', color: Theme.hudText,
                }).setAlpha(alpha).setDepth(15);
                this.textObjects.push(killText);
            }
        }
    }

    renderCRTOverlay() {
        if (!this.crtGraphics) {
            // Create once and cache the CRT overlay
            this.crtGraphics = this.add.graphics();
            this.crtGraphics.setDepth(100);

            // Scanlines - alternating dark bands every 2px
            for (let y = 0; y < GAME_HEIGHT; y += 4) {
                this.crtGraphics.fillStyle(0x000000, 0.25);
                this.crtGraphics.fillRect(0, y, GAME_WIDTH, 2);
            }

            // Vignette - heavy darkening at edges using filled rects
            const w = GAME_WIDTH;
            const h = GAME_HEIGHT;
            // Top edge
            for (let i = 0; i < 60; i++) {
                const a = 0.4 * (1 - i / 60) * (1 - i / 60);
                this.crtGraphics.fillStyle(0x000000, a);
                this.crtGraphics.fillRect(0, i, w, 1);
            }
            // Bottom edge
            for (let i = 0; i < 60; i++) {
                const a = 0.4 * (1 - i / 60) * (1 - i / 60);
                this.crtGraphics.fillStyle(0x000000, a);
                this.crtGraphics.fillRect(0, h - 1 - i, w, 1);
            }
            // Left edge
            for (let i = 0; i < 80; i++) {
                const a = 0.35 * (1 - i / 80) * (1 - i / 80);
                this.crtGraphics.fillStyle(0x000000, a);
                this.crtGraphics.fillRect(i, 0, 1, h);
            }
            // Right edge
            for (let i = 0; i < 80; i++) {
                const a = 0.35 * (1 - i / 80) * (1 - i / 80);
                this.crtGraphics.fillStyle(0x000000, a);
                this.crtGraphics.fillRect(w - 1 - i, 0, 1, h);
            }

            // Corner darkening (extra)
            for (let i = 0; i < 120; i++) {
                const a = 0.15 * (1 - i / 120);
                this.crtGraphics.fillStyle(0x000000, a);
                this.crtGraphics.strokeCircle(w / 2, h / 2, Math.max(w, h) * 0.7 + i * 2);
            }
        }
    }

    renderChat() {
        const g = this.hudGraphics;
        const top = GAME_HEIGHT - HUD_CHAT_HEIGHT * this.chatVisible;
        const left = HUD_WIDTH;
        const bottom = GAME_HEIGHT;
        const right = GAME_WIDTH;

        // Chat background - dark blue
        g.fillStyle(Theme.chatBg, 1);
        g.fillRect(left, top, right - left, bottom - top);
        // Top border line
        g.lineStyle(1, Theme.hudBorderDim, 0.5);
        g.lineBetween(left, top, right, top);

        if (this.chatVisible >= 1) {
            const portraitHeight = bottom - top - 4;
            const portraitWidth = Math.floor(portraitHeight);

            if (this.chatPortrait) {
                PortraitRenderer.render(g, left + 2, top + 2, left + portraitWidth + 2, bottom - 2, this.chatPortrait, 255);
            }

            this.chatText.setPosition(left + portraitWidth + 10, top + 5);
        }
    }
}
