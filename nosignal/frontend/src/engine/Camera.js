/**
 * Camera.js
 * 2D Camera centered on the astronaut with lerp smoothing.
 * Prevents subpixel jittering for crisp pixel art rendering.
 */

export class Camera {
    constructor(viewportWidth, viewportHeight) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.lerpSpeed = 0.12; // Smooth cinematic following
        this.bounds = null;    // { minX, minY, maxX, maxY }
    }

    setViewport(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    setBounds(minX, minY, maxX, maxY) {
        this.bounds = { minX, minY, maxX, maxY };
    }

    follow(x, y, immediate = false) {
        this.targetX = x;
        this.targetY = y;
        if (immediate) {
            this.x = x;
            this.y = y;
        }
    }

    update() {
        this.x += (this.targetX - this.x) * this.lerpSpeed;
        this.y += (this.targetY - this.y) * this.lerpSpeed;

        if (this.bounds) {
            const halfW = this.viewportWidth / 2;
            const halfH = this.viewportHeight / 2;
            this.x = Math.max(this.bounds.minX + halfW, Math.min(this.bounds.maxX - halfW, this.x));
            this.y = Math.max(this.bounds.minY + halfH, Math.min(this.bounds.maxY - halfH, this.y));
        }
    }

    getRenderOffset() {
        // Snap to whole pixels to prevent pixel art jitter
        return {
            x: Math.round(this.viewportWidth / 2 - this.x),
            y: Math.round(this.viewportHeight / 2 - this.y)
        };
    }

    worldToScreen(worldX, worldY) {
        const offset = this.getRenderOffset();
        return {
            x: Math.round(worldX + offset.x),
            y: Math.round(worldY + offset.y)
        };
    }

    screenToWorld(screenX, screenY) {
        const offset = this.getRenderOffset();
        return {
            x: screenX - offset.x,
            y: screenY - offset.y
        };
    }
}
