// Math and Vector utilities ported from math.lua and vectorMath.lua

const MathUtils = {
    angleBetweenPoints(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    distance2(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    },

    clamp(value, min, max) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    },

    rand(low, high) {
        return low + (Math.random() * (high - low));
    },

    round(value, digits = 1) {
        const remainder = value % digits;
        if (remainder / digits < 0.5) {
            return value - remainder;
        }
        return value - remainder + digits;
    },

    approach(cur, target, inc) {
        inc = Math.abs(inc);
        if (cur < target) {
            return MathUtils.clamp(cur + inc, cur, target);
        }
        return MathUtils.clamp(cur - inc, target, cur);
    },

    normalizeAngle(ang) {
        while (ang < 0) ang += Math.PI * 2;
        while (ang >= Math.PI * 2) ang -= Math.PI * 2;
        if (ang > Math.PI) return ang - Math.PI * 2;
        return ang;
    },

    angleDifference(ang1, ang2) {
        const diff = MathUtils.normalizeAngle(ang1 - ang2);
        if (diff < Math.PI) return diff;
        return diff - Math.PI * 2;
    },

    angleDifferenceAbs(ang1, ang2) {
        const diff = MathUtils.normalizeAngle(ang1 - ang2);
        if (diff < Math.PI) return Math.abs(diff);
        return Math.abs(diff - Math.PI * 2);
    },

    approachAngle(cur, target, inc) {
        const diff = MathUtils.angleDifference(target, cur);
        return MathUtils.approach(cur, cur + diff, inc);
    },

    sign(x) {
        if (x < 0) return -1;
        if (x > 0) return 1;
        return 0;
    }
};

const VectorMath = {
    rotate(x, y, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return { x: x * cos - y * sin, y: y * cos + x * sin };
    },

    dot2(x1, y1, x2, y2) {
        return x1 * x2 + y1 * y2;
    },

    normalize2(x, y) {
        const length = Math.sqrt(x * x + y * y);
        return { x: x / length, y: y / length };
    },

    cross22(x1, y1, x2, y2) {
        return x1 * y2 - y1 * x2;
    }
};

// Aliens-inspired blue CRT color theme
const Theme = {
    // Background
    bg: '#050a14',
    bgHex: 0x050a14,

    // Walls - blue tones per floor
    wallColors: [
        new_color(255, 30, 70, 120),   // floor 1: medium blue
        new_color(255, 40, 80, 110),   // floor 2: teal-blue
        new_color(255, 30, 60, 100),   // floor 3: darker blue
        new_color(255, 25, 70, 90),    // floor 4: steel blue
        new_color(255, 20, 50, 110),   // floor 5: deep blue
    ],

    // Actors
    marine:       { hex: 0x40c0ff, r: 64, g: 192, b: 255, css: '#40c0ff' },
    marineCtrl:   { hex: 0x80e0ff, r: 128, g: 224, b: 255, css: '#80e0ff' },
    ghost:        { hex: 0xff4040, r: 255, g: 64, b: 64, css: '#ff4040' },
    superGhost:   { hex: 0xff2020, r: 255, g: 32, b: 32, css: '#ff2020' },

    // Equipment
    weapon:       0x40c0ff,
    scanner:      0x40ff80,
    healerCross:  0x40ffc0,

    // Tiles
    stairs:       0xc0a040,
    stairsColor:  { r: 192, g: 160, b: 64 },
    spawnActive:  0x802020,
    spawnBlocked: 0x404060,
    electroBeam:  0xff4080,

    // HUD
    hudText:      '#60c0d0',
    hudBright:    '#80e0ff',
    hudDim:       '#305060',
    hudBorder:    0x40c0ff,
    hudBorderDim: 0x204060,
    hudPortrait:  0x40a0c0,
    healthGood:   '#40c0a0',
    healthMid:    '#c0a040',
    healthBad:    '#ff4040',
    statusDead:   '#804040',

    // Chat
    chatText:     '#80c0d0',
    chatBg:       0x080e18,

    // Title
    titleMain:    '#40c0ff',
    titleSub:     '#305870',

    // FPS
    fpsColor:     '#305060',
};

// Helper since Color class isn't defined yet
function new_color(a, r, g, b) { return { a, r, g, b }; }

class Color {
    constructor(a, r, g, b) {
        this.a = a;
        this.r = r;
        this.g = g;
        this.b = b;
    }

    toHex() {
        return (this.r << 16) | (this.g << 8) | this.b;
    }

    toRGBA(alphaOverride) {
        const a = (alphaOverride !== undefined ? alphaOverride : this.a) / 255;
        return `rgba(${this.r},${this.g},${this.b},${a})`;
    }
}
