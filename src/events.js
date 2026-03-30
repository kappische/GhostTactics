// Events/story system ported from events.lua

let _useCheckpoint = 0;

function createEvents() {
    return [
        // Event 1: Player death
        {
            triggered: false,
            condition(gs) { return _playerHasDied > 0; },
            run(gs) {
                if (_playerHasDied === 1) {
                    gs.addStory({
                        elements: [
                            { text: "HQ? The captain is DEAD!", info: gs.playerInfo[3] },
                            { text: "What are you saying, son?", info: gs.extraPlayerInfo[0] },
                            { text: "The captain is DEAD! They got him!", info: gs.playerInfo[3] },
                            { text: "Call off the mission! Get out of there!", info: gs.extraPlayerInfo[0] },
                            { text: "$END", info: gs.extraPlayerInfo[0] },
                        ]
                    });
                } else {
                    gs.addStory({
                        elements: [
                            { text: "Man down! Man down!", info: gs.playerInfo[0] },
                            { text: "What are you saying, captain?", info: gs.extraPlayerInfo[0] },
                            { text: "Sir, we lost one, sir.", info: gs.playerInfo[0] },
                            { text: "Call off the mission! Get out of there!", info: gs.extraPlayerInfo[0] },
                            { text: "$END", info: gs.extraPlayerInfo[0] },
                        ]
                    });
                }
            }
        },

        // Event 2: Spawn blocked
        {
            triggered: false,
            condition(gs) { return _spawnBlockedByPlayer > 0 && _useCheckpoint < 1; },
            run(gs) {
                const idx = _spawnBlockedByPlayer - 1;
                if (_spawnBlockedByPlayer === 1) {
                    gs.addStory({ elements: [
                        { text: "Aha... The ghosts stay hidden when we get close to the vents.", info: gs.playerInfo[0] },
                        { text: "Squad! Block the bastards from entering when-ever you can!", info: gs.playerInfo[0] },
                    ]});
                } else {
                    gs.addStory({ elements: [
                        { text: "Captain! The ghosts seem to hide in the vents!", info: gs.playerInfo[idx] },
                        { text: "Ah, yes of course. Keep blocking those bastards when-ever you can!", info: gs.playerInfo[0] },
                    ]});
                }
            }
        },

        // Event 3: Stairs spotted
        {
            triggered: false,
            condition(gs) { return _stairsSpottedByPlayer > 0 && _useCheckpoint < 1; },
            run(gs) {
                const idx = _stairsSpottedByPlayer - 1;
                if (_stairsSpottedByPlayer === 1) {
                    gs.addStory({ elements: [
                        { text: "OK, squad! I've found the stairs.", info: gs.playerInfo[0] },
                        { text: "Let's regroup and head down together.", info: gs.playerInfo[0] },
                    ]});
                } else {
                    gs.addStory({ elements: [
                        { text: "Captain! Stairs, sir!", info: gs.playerInfo[idx] },
                        { text: "Good, " + gs.playerInfo[idx].rank + ". Let's regroup and head down.", info: gs.playerInfo[0] },
                    ]});
                }
            }
        },

        // Event 4: Reached floor 2 - find medic
        {
            triggered: false,
            condition(gs) { return gs.maps[1].playerCounter > 0 && _useCheckpoint < 1; },
            run(gs) {
                const sourcePlayer = gs.maps[1].playerActors[0];
                const idx = sourcePlayer.playerIndex - 1;
                gs.addPlayerActor(new Actor(ACTORS.marine, sourcePlayer.pos.x + TILE_SIZE * 2, sourcePlayer.pos.y - TILE_SIZE, gs.maps[1]), gs.playerInfo[4]);
                gs.playerInfo[7].status = "DEAD";
                gs._settings.checkpoint = 1;
                gs.addStory({ elements: [
                    { text: "Oh, thank god! I thought I was doomed!", info: gs.playerInfo[4] },
                    { text: "We've come to get you out! Where are the others?", info: gs.playerInfo[idx] },
                    { text: "Oh... it was horrible! We got separated...", info: gs.playerInfo[4] },
                    { text: "I don't know where the others are... but... " + gs.playerInfo[7].fName + "...", info: gs.playerInfo[4] },
                    { text: gs.playerInfo[7].fName + " is dead. He died in my arms...", info: gs.playerInfo[4] },
                    { text: "I tried to save him, but I couldn't! I really tried!", info: gs.playerInfo[4] },
                    { text: "He was in such pain... the anti-toxins didn't help... I had to...", info: gs.playerInfo[4] },
                    { text: "You did what you are trained for. You could---", info: gs.playerInfo[idx] },
                    { text: "No you don't understand! He was my sister's HUSBAND!", info: gs.playerInfo[4] },
                    { text: "... or soon to be husband... oh, christ...", info: gs.playerInfo[4] },
                    { text: "Snap out of it! Your sister doesn't deserve two funerals.", info: gs.playerInfo[idx] },
                    { text: "We need to find the others. Get your gear.", info: gs.playerInfo[idx] },
                ]});
            }
        },

        // Event 5: Story marker level 2
        {
            triggered: false,
            condition(gs) { return _storyMarkerLvl2 > 0 && _useCheckpoint < 2; },
            run(gs) {
                const idx = _storyMarkerLvl2 - 1;
                gs.addStory({ elements: [
                    { text: "It's even worse down here...", info: gs.playerInfo[idx] },
                    { text: "I don't get it... why do the ghosts smell so bad?", info: gs.playerInfo[idx] },
                ]});
            }
        },

        // Event 6: Second level stairs
        {
            triggered: false,
            condition(gs) { return _secondLevelStairs > 0 && _useCheckpoint < 2; },
            run(gs) {
                gs.addStory({ elements: [
                    { text: "Ok, squad, let's regroup for the next floor.", info: gs.playerInfo[0] },
                ]});
            }
        },

        // Event 7: Story marker level 3
        {
            triggered: false,
            condition(gs) { return _storyMarkerLvl3 > 0 && _useCheckpoint < 3; },
            run(gs) {
                gs._settings.checkpoint = 2;
                const idx = _storyMarkerLvl3 - 1;
                if (_storyMarkerLvl3 === 1) {
                    gs.addStory({ elements: [
                        { text: "Hmm... I think I heard a voice...", info: gs.playerInfo[0] },
                        { text: "Cadet! What's up north from here?", info: gs.playerInfo[0] },
                        { text: "Sir, a small storage room.", info: gs.playerInfo[3] },
                        { text: "Any signs of life?", info: gs.playerInfo[0] },
                        { text: "No, sir.", info: gs.playerInfo[3] },
                        { text: "I'm sure I heard something...", info: gs.playerInfo[0] },
                        { text: "Squad, cover your corners and move north!", info: gs.playerInfo[0] },
                    ]});
                } else {
                    gs.addStory({ elements: [
                        { text: "Captain! I heard something!", info: gs.playerInfo[idx] },
                        { text: "Speak up! What kind of 'something'?", info: gs.playerInfo[0] },
                        { text: "I think it was a voice! From the north, sir!", info: gs.playerInfo[idx] },
                        { text: "A voice? Could it be... " + gs.playerInfo[5].fName + "..?", info: gs.playerInfo[4] },
                        { text: "Squad, cover your corners and move north!", info: gs.playerInfo[0] },
                    ]});
                }
            }
        },

        // Event 8: Found survivor on level 3
        {
            triggered: false,
            condition(gs) { return _s2SpottedByPlayer > 0 && _s2Tile && _useCheckpoint < 3; },
            run(gs) {
                _s2Tile.hide = true;
                const actor = gs.addPlayerActor(new Actor(ACTORS.marine, _s2Tile.pos.x, _s2Tile.pos.y, gs.maps[2]), gs.playerInfo[5]);
                actor.health = 27;
                gs.addStory({ elements: [
                    { text: "Heeeey! Heeelp!", info: gs.playerInfo[5] },
                    { text: gs.playerInfo[5].fName + "! You're alive!", info: gs.playerInfo[4] },
                    { text: "The f***ing ghosts almost got me, but I managed to barricade myself in here.", info: gs.playerInfo[5] },
                    { text: "Where is " + gs.playerInfo[6].name + "?", info: gs.playerInfo[0] },
                    { text: "I don't know, I've been alone since the ambush.", info: gs.playerInfo[5] },
                    { text: "Ok. Medic, heal him up. We need to push forward.", info: gs.playerInfo[0] },
                    { text: "I'll try, sir...", info: gs.playerInfo[4] },
                ]});
            }
        },

        // Event 9: Reached floor 4
        {
            triggered: false,
            condition(gs) { return gs.maps[3].playerCounter > 0 && _useCheckpoint <= 3; },
            run(gs) {
                gs._settings.checkpoint = 3;
            }
        },

        // Event 10: Found wounded survivor
        {
            triggered: false,
            condition(gs) { return _s1SpottedByPlayer > 0 && !_s1SpottedByMedic && _useCheckpoint < 4; },
            run(gs) {
                gs.playerInfo[6].status = "Wounded";
                const idx = _s1SpottedByPlayer - 1;
                gs.addStory({ elements: [
                    { text: "Hey! I've found someone! Get the medic here!", info: gs.playerInfo[idx] },
                ]});
            }
        },

        // Event 11: Medic found survivor
        {
            triggered: false,
            condition(gs) { return _s1SpottedByMedic && _useCheckpoint < 4; },
            run(gs) {
                gs.playerInfo[6].status = "Wounded";
                gs._settings.checkpoint = 4;
                gs.addStory({ elements: [
                    { text: "Oh, god, not " + gs.playerInfo[6].fName + " too!", info: gs.playerInfo[4] },
                    { text: "Captain, please... we must save him!", info: gs.playerInfo[4] },
                    { text: "You're the medic, how does it look?", info: gs.playerInfo[0] },
                    { text: "Ahh... it looks bad! The toxin's got a hold of him.", info: gs.playerInfo[4] },
                    { text: "I can keep him alive, barely, but I'm out of anti-toxin.", info: gs.playerInfo[4] },
                    { text: gs.playerInfo[3].fName + ", use the scanner, check if you can find anything.", info: gs.playerInfo[0] },
                    { text: "Yes, sir.", info: gs.playerInfo[3] },
                ]});
                gs.addStory({ elements: [
                    { text: "Sir! There seems to be a supply locker in the north section.", info: gs.playerInfo[3] },
                    { text: "On this floor?", info: gs.playerInfo[0] },
                    { text: "Yes, sir! But we need to go up one level to reach it, sir.", info: gs.playerInfo[3] },
                    { text: "Alright. " + gs.playerInfo[1].fName + ", stay and watch his back.", info: gs.playerInfo[0] },
                    { text: gs.playerInfo[2].fName + ", " + gs.playerInfo[3].fName + ", " + gs.playerInfo[5].fName + ", come with me.", info: gs.playerInfo[0] },
                    { text: "Yes, sir.", info: gs.playerInfo[2] },
                ]});
            }
        },

        // Event 12: Survivor dies, head back
        {
            triggered: false,
            condition(gs) { return (_s1GetBackMarker > 0 || _useCheckpoint === 4) && _useCheckpoint < 5; },
            run(gs) {
                gs.playerInfo[6].status = "DEAD";
                gs._settings.checkpoint = 5;
                gs.addStory({ elements: [
                    { text: "Uuuuuhhhh....", info: gs.playerInfo[6] },
                ]});
                gs.addStory({ elements: [
                    { text: "Captain... I... lost another one...", info: gs.playerInfo[4] },
                    { text: gs.playerInfo[6].fName + " is dead.", info: gs.playerInfo[4] },
                    { text: "Damnit... ok, stay put, we're coming back.", info: gs.playerInfo[0] },
                    { text: "HQ, we are heading back to the surface now.", info: gs.playerInfo[0] },
                    { text: "Confirmed, Captain.", info: gs.extraPlayerInfo[0] },
                ]});
                gs.addStory({ elements: [
                    { text: "Can't wait to get out of this stench!", info: gs.playerInfo[2] },
                    { text: "Keep your cool, private. We need to regroup on the floor above.", info: gs.playerInfo[0] },
                ]});
            }
        },

        // Event 13: Boss fight
        {
            triggered: false,
            condition(gs) { return (_s1GetBackMarker > 0 || _useCheckpoint >= 4) && gs.maps[2].playerCounter > 0; },
            run(gs) {
                const playerActor = gs.maps[2].playerActors[0];
                const pIndex = playerActor.playerIndex - 1;
                gs._settings.checkpoint = 6;
                gs.maps[2].addEnemyActor(new Actor(ACTORS.superGhost, playerActor.pos.x - 300, playerActor.pos.y - 300, gs.maps[2]));

                if (pIndex === 0) {
                    gs.addStory({ elements: [
                        { text: "Wow, that's one big ghost!", info: gs.playerInfo[0] },
                        { text: "Captain? What's up?", info: gs.playerInfo[1] },
                    ]});
                } else {
                    gs.addStory({ elements: [
                        { text: "Woah! What is that?!", info: gs.playerInfo[pIndex] },
                        { text: "That's the biggest Mother-Foxtrot I've ever seen!", info: gs.playerInfo[pIndex] },
                    ]});
                }
                gs.addStory({ elements: [
                    { text: "HQ? There's some kind of monster ghost down here.", info: gs.playerInfo[0] },
                    { text: "What are your instructions?", info: gs.playerInfo[0] },
                    { text: "Keep to the mission, captain. Avoid it if possible and get out of there!", info: gs.extraPlayerInfo[0] },
                    { text: "Yes, sir.", info: gs.playerInfo[0] },
                ]});
            }
        },

        // Event 14: Super ghost killed - victory
        {
            triggered: false,
            condition(gs) { return _superGhostKilled; },
            run(gs) {
                gs.addStory({ elements: [
                    { text: "Captain! The monster is dead! We killed it!", info: gs.playerInfo[1] },
                ]});
                gs.addStory({ elements: [
                    { text: "Captain, the scanner is picking up less activity.", info: gs.playerInfo[3] },
                    { text: "Maybe the ghosts are retreating?", info: gs.playerInfo[3] },
                    { text: "Ah, I can feel it! The air is clearing up!", info: gs.playerInfo[2] },
                    { text: "That is good news " + gs.playerInfo[3].fName + ", but keep your eyes on the scanner.", info: gs.playerInfo[0] },
                    { text: "We're not home yet.", info: gs.playerInfo[0] },
                ]});
                gs.addStory({ elements: [
                    { text: "$WIN", info: gs.playerInfo[1] },
                ]});
            }
        }
    ];
}
