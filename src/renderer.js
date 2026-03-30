// Rendering utilities ported from physRender.lua
// Uses Phaser Graphics context for line drawing

const Renderer = {
    renderPhysicsLines(graphics, cx, cy, definition, scale, angle, color) {
        const a = color ? color.a / 255 : 1;
        const r = color ? color.r : 255;
        const g = color ? color.g : 255;
        const b = color ? color.b : 255;
        const hexColor = (r << 16) | (g << 8) | b;

        graphics.lineStyle(1, hexColor, a);

        for (const phys of definition.shapes) {
            if (phys.shape === 'poly') {
                const first = VectorMath.rotate(phys.x[0] * scale, phys.y[0] * scale, angle);
                let prev = first;
                for (let i = 1; i < phys.x.length; i++) {
                    const next = VectorMath.rotate(phys.x[i] * scale, phys.y[i] * scale, angle);
                    graphics.lineBetween(cx + prev.x, cy + prev.y, cx + next.x, cy + next.y);
                    prev = next;
                }
                graphics.lineBetween(cx + prev.x, cy + prev.y, cx + first.x, cy + first.y);
            } else if (phys.shape === 'box') {
                const o = VectorMath.rotate((phys.ox || 0) * scale, (phys.oy || 0) * scale, angle);
                const corners = [
                    VectorMath.rotate(-phys.width * scale * 0.5, -phys.height * scale * 0.5, angle),
                    VectorMath.rotate(phys.width * scale * 0.5, -phys.height * scale * 0.5, angle),
                    VectorMath.rotate(phys.width * scale * 0.5, phys.height * scale * 0.5, angle),
                    VectorMath.rotate(-phys.width * scale * 0.5, phys.height * scale * 0.5, angle),
                ];
                for (let i = 0; i < 4; i++) {
                    const s = corners[i];
                    const e = corners[(i + 1) % 4];
                    graphics.lineBetween(
                        cx + s.x + o.x, cy + s.y + o.y,
                        cx + e.x + o.x, cy + e.y + o.y
                    );
                }
            } else if (phys.shape === 'circle') {
                const o = VectorMath.rotate(phys.ox || 0, phys.oy || 0, angle);
                const ccx = cx + o.x;
                const ccy = cy + o.y;
                const radius = phys.radius * scale;
                graphics.strokeCircle(ccx, ccy, radius);
            }
        }
    },

    renderLine(graphics, x1, y1, x2, y2, a, r, g, b) {
        const hexColor = (r << 16) | (g << 8) | b;
        graphics.lineStyle(1, hexColor, a / 255);
        graphics.lineBetween(x1, y1, x2, y2);
    },

    renderRect(graphics, x, y, w, h, a, r, g, b) {
        const hexColor = (r << 16) | (g << 8) | b;
        graphics.fillStyle(hexColor, a / 255);
        graphics.fillRect(x, y, w, h);
    },

    renderText(scene, x, y, text, align, fontSize, alpha, r, g, b) {
        // Returns a Phaser text object - caller should manage lifecycle
        const hexStr = '#' + ((1 << 24) + ((r || 255) << 16) + ((g || 255) << 8) + (b || 255)).toString(16).slice(1);
        const config = {
            fontFamily: 'Courier New, monospace',
            fontSize: (fontSize || 12) + 'px',
            color: hexStr,
        };
        const textObj = scene.add.text(x, y, text, config);
        textObj.setAlpha((alpha !== undefined ? alpha : 255) / 255);
        if (align === 1) {
            textObj.setOrigin(0.5, 0);
        } else {
            textObj.setOrigin(0, 0);
        }
        return textObj;
    }
};
