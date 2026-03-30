// Main entry point - creates the Phaser game instance

const config = {
    type: Phaser.CANVAS,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#050a14',
    parent: document.body,
    scene: [GameScene],
    audio: {
        disableWebAudio: false,
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
    },
    fps: {
        target: 60,
        forceSetTimeOut: false,
    },
    input: {
        keyboard: {
            target: window,
        }
    }
};

const game = new Phaser.Game(config);
