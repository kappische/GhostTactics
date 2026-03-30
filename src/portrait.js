// Portrait rendering system ported from gameState.lua renderPortrait

const PortraitRenderer = {
    render(graphics, left, top, right, bottom, pInfo, alpha) {
        if (!pInfo) return;

        const width = right - left;
        const height = bottom - top;
        const cx = left + width * 0.5;
        const cy = top + height * 0.5;
        const headProportions = pInfo.headRatio;
        let fWidth = (height * 0.8) / headProportions;
        let fHeight = height * 0.8;

        if (fWidth > width) {
            fWidth = width * 0.8;
            fHeight = width * 0.8 * headProportions;
        }

        const a = (alpha || 255) / 255;
        const hexColor = Theme.hudPortrait;
        graphics.lineStyle(1, hexColor, a);

        const cheekFunction = (angle) => {
            const x = Math.cos(angle);
            const y = Math.sin(angle);
            if (y > 0) {
                const sign = MathUtils.sign(x);
                return {
                    x: (x + Math.sin(y * Math.PI) * sign * -pInfo.cheekStrength + Math.sin(y * Math.PI * -2) * -pInfo.cheekWaveStrength * sign) * fWidth * 0.5,
                    y: y * fHeight * 0.5
                };
            }
            return { x: x * fWidth * 0.5, y: y * fHeight * 0.5 };
        };

        // Eyes
        const eyeOffset = fWidth * 0.2 * pInfo.eyeSpacing;
        const eyeWidth = fWidth * 0.2 * pInfo.eyeWidth;
        const eyeHeight = eyeWidth * 0.33 * pInfo.eyeHeight;

        if (pInfo.eyeStyle < 0) {
            for (let i = 0; i < 32; i++) {
                const a1 = i * Math.PI * 2 / 32;
                const a2 = (i + 1) * Math.PI * 2 / 32;
                graphics.lineBetween(
                    cx + eyeOffset + Math.cos(a1) * eyeWidth * 0.5, cy + Math.sin(a1) * eyeHeight * 0.5,
                    cx + eyeOffset + Math.cos(a2) * eyeWidth * 0.5, cy + Math.sin(a2) * eyeHeight * 0.5
                );
                graphics.lineBetween(
                    cx - eyeOffset + Math.cos(a1) * eyeWidth * 0.5, cy + Math.sin(a1) * eyeHeight * 0.5,
                    cx - eyeOffset + Math.cos(a2) * eyeWidth * 0.5, cy + Math.sin(a2) * eyeHeight * 0.5
                );
            }
        } else if (pInfo.eyeStyle === 0) {
            const innerWidth = eyeWidth * 0.8;
            for (let i = 0; i < 32; i++) {
                const a1 = i * Math.PI * 2 / 32;
                const a2 = (i + 1) * Math.PI * 2 / 32;
                graphics.lineBetween(
                    cx + eyeOffset + Math.cos(a1) * eyeWidth * 0.5, cy + Math.sin(a1) * eyeWidth * 0.5,
                    cx + eyeOffset + Math.cos(a2) * eyeWidth * 0.5, cy + Math.sin(a2) * eyeWidth * 0.5
                );
                graphics.lineBetween(
                    cx - eyeOffset + Math.cos(a1) * eyeWidth * 0.5, cy + Math.sin(a1) * eyeWidth * 0.5,
                    cx - eyeOffset + Math.cos(a2) * eyeWidth * 0.5, cy + Math.sin(a2) * eyeWidth * 0.5
                );
                graphics.lineBetween(
                    cx + eyeOffset + Math.cos(a1) * innerWidth * 0.5, cy + Math.sin(a1) * innerWidth * 0.5,
                    cx + eyeOffset + Math.cos(a2) * innerWidth * 0.5, cy + Math.sin(a2) * innerWidth * 0.5
                );
                graphics.lineBetween(
                    cx - eyeOffset + Math.cos(a1) * innerWidth * 0.5, cy + Math.sin(a1) * innerWidth * 0.5,
                    cx - eyeOffset + Math.cos(a2) * innerWidth * 0.5, cy + Math.sin(a2) * innerWidth * 0.5
                );
            }
        } else if (pInfo.eyeStyle >= 1) {
            // Square eyes
            const pts = [
                [eyeWidth * 0.5, eyeHeight * 0.5],
                [-eyeWidth * 0.5, eyeHeight * 0.5],
                [-eyeWidth * 0.5, -eyeHeight * 0.5],
                [eyeWidth * 0.5, -eyeHeight * 0.5]
            ];
            for (let i = 0; i < 4; i++) {
                const s = pts[i], e = pts[(i + 1) % 4];
                graphics.lineBetween(cx + eyeOffset + s[0], cy + s[1], cx + eyeOffset + e[0], cy + e[1]);
                graphics.lineBetween(cx - eyeOffset + s[0], cy + s[1], cx - eyeOffset + e[0], cy + e[1]);
            }
        }

        // Mouth
        const mouthPlacement = fHeight * 0.3 * pInfo.mouthOffset;
        const mouthMiddle = mouthPlacement - mouthPlacement * pInfo.mouthPout;
        const mouthWidth = fWidth * 0.1 * pInfo.mouthWidth;
        graphics.lineBetween(cx - mouthWidth, cy + mouthPlacement, cx, cy + mouthMiddle);
        graphics.lineBetween(cx + mouthWidth, cy + mouthPlacement, cx, cy + mouthMiddle);

        // Nose
        const noseHeight = mouthPlacement * 0.75 * pInfo.noseHeight;
        const noseStartWidth = (eyeOffset - eyeWidth * 0.5) * 0.4 * pInfo.noseWidth;
        const noseEndWidth = noseStartWidth * 1.8;
        graphics.lineBetween(cx - noseStartWidth, cy, cx - noseEndWidth, cy + noseHeight);
        graphics.lineBetween(cx + noseStartWidth, cy, cx + noseEndWidth, cy + noseHeight);

        // Nostrils
        const nostrilWidth = noseStartWidth;
        const nostrilHeight = noseStartWidth * 1.2;
        for (let i = 0; i < 8; i++) {
            const a1 = Math.PI * -0.4 + i * Math.PI * 0.8 / 8;
            const a2 = Math.PI * -0.4 + (i + 1) * Math.PI * 0.8 / 8;
            graphics.lineBetween(
                cx + noseEndWidth + Math.cos(a1) * nostrilWidth, cy + noseHeight + Math.sin(a1) * nostrilHeight,
                cx + noseEndWidth + Math.cos(a2) * nostrilWidth, cy + noseHeight + Math.sin(a2) * nostrilHeight
            );
            graphics.lineBetween(
                cx - noseEndWidth - Math.cos(a1) * nostrilWidth, cy + noseHeight + Math.sin(a1) * nostrilHeight,
                cx - noseEndWidth - Math.cos(a2) * nostrilWidth, cy + noseHeight + Math.sin(a2) * nostrilHeight
            );
        }

        // Head frame
        for (let i = 0; i < 32; i++) {
            const a1 = i * Math.PI * 2 / 32;
            const a2 = (i + 1) * Math.PI * 2 / 32;
            const p1 = cheekFunction(a1);
            const p2 = cheekFunction(a2);
            graphics.lineBetween(cx + p1.x, cy + p1.y, cx + p2.x, cy + p2.y);
        }

        // Hair
        if (pInfo.hairStyle === 0) {
            for (let i = 0; i <= 17; i++) {
                const angle = i * Math.PI * -1 / 18;
                const p = cheekFunction(angle);
                const tx = Math.cos(angle) * fWidth * 0.5;
                const ty = Math.sin(angle) * fHeight * 0.2;
                graphics.lineBetween(cx + p.x, cy + p.y, cx + tx, cy + ty);
            }
        } else if (pInfo.hairStyle === 1) {
            for (let i = 0; i <= 17; i++) {
                const angle = i * Math.PI * -1 / 18;
                const p = cheekFunction(angle);
                let yAngle = angle + Math.PI * 0.25;
                if (yAngle > 0) yAngle -= Math.PI;
                const tx = Math.cos(angle) * fWidth * 0.5;
                const ty = Math.sin(yAngle) * fHeight * 0.2;
                graphics.lineBetween(cx + p.x, cy + p.y, cx + tx, cy + Math.max(p.y, ty));
            }
        } else if (pInfo.hairStyle === 2) {
            for (let i = 0; i <= 17; i++) {
                const angle = i * Math.PI * -1 / 18;
                const p = cheekFunction(angle);
                const tx = Math.cos(angle) * fWidth * 0.5;
                const ty = Math.sin(angle) * fHeight * 0.2;
                const newY = fHeight * -0.5 + Math.sin(angle + Math.PI) * fHeight * 0.2;
                graphics.lineBetween(cx + p.x, cy + Math.max(p.y, newY), cx + tx, cy + ty);
            }
        }

        // Beard
        if (pInfo.beardStyle === 0) {
            for (let i = 0; i <= 17; i++) {
                const angle = i * Math.PI / 18;
                const p = cheekFunction(angle);
                const tx = Math.cos(angle) * fWidth * 0.5;
                const ty = Math.sin(angle) * noseHeight * 1.3;
                graphics.lineBetween(cx + p.x, cy + p.y, cx + tx, cy + ty);
            }
        } else if (pInfo.beardStyle === 1) {
            for (let i = 0; i <= 17; i++) {
                const angle = i * Math.PI / 18;
                const p = cheekFunction(angle);
                let tx = Math.cos(angle) * fWidth * 0.5;
                const ty = Math.sin(angle) * fHeight * 0.4;
                if (p.x < 0) tx = Math.max(p.x, tx);
                else tx = Math.min(p.x, tx);
                graphics.lineBetween(cx + p.x, cy + p.y, cx + tx, cy + Math.min(p.y, ty));
            }
        }
    }
};
