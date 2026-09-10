/**
 * MapRenderer.js
 * Renders the Martian surface, landing base station, rock formations,
 * and atmospheric sci-fi dust particles.
 */

export class MapRenderer {
    constructor(worldWidth = 3200, worldHeight = 3200, tileSize = 64) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.tileSize = tileSize;
        this.cols = Math.ceil(worldWidth / tileSize);
        this.rows = Math.ceil(worldHeight / tileSize);

        this.tiles = [];
        this.obstacles = [];
        this.dustParticles = [];

        this._generateTerrain();
        this._initAtmosphericDust();
    }

    _generateTerrain() {
        // Deterministic procedural generation
        for (let r = 0; r < this.rows; r++) {
            this.tiles[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const worldX = (c - this.cols / 2) * this.tileSize;
                const worldY = (r - this.rows / 2) * this.tileSize;
                const distFromCenter = Math.hypot(worldX, worldY);

                // Center area (-150 to 150) is the Landing Platform Station
                if (Math.abs(worldX) <= 192 && Math.abs(worldY) <= 192) {
                    this.tiles[r][c] = {
                        type: 'platform',
                        subType: ((c + r) % 2 === 0) ? 'metal-dark' : 'metal-light',
                        isCenter: Math.hypot(worldX, worldY) < 64
                    };
                } else {
                    // Martian ground variants using pseudo-random hash
                    const hash = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
                    const val = hash - Math.floor(hash);

                    if (val > 0.94 && distFromCenter > 250) {
                        this.tiles[r][c] = { type: 'crater' };
                    } else if (val > 0.88 && distFromCenter > 250) {
                        this.tiles[r][c] = { type: 'iron-rock' };
                        // Add obstacle collider
                        this.obstacles.push({
                            x: worldX + 16,
                            y: worldY + 16,
                            width: 32,
                            height: 32
                        });
                    } else if (val > 0.65) {
                        this.tiles[r][c] = { type: 'dune-dark' };
                    } else if (val > 0.35) {
                        this.tiles[r][c] = { type: 'dune-orange' };
                    } else {
                        this.tiles[r][c] = { type: 'dune-red' };
                    }
                }
            }
        }
    }

    _initAtmosphericDust() {
        const count = 45;
        for (let i = 0; i < count; i++) {
            this.dustParticles.push({
                x: Math.random() * 1280,
                y: Math.random() * 720,
                vx: -0.6 - Math.random() * 1.2, // Drifting west
                vy: 0.2 + Math.random() * 0.4,
                size: Math.random() > 0.6 ? 2 : 1,
                alpha: 0.2 + Math.random() * 0.45
            });
        }
    }

    update(dt) {
        // Update atmospheric dust particles
        for (const p of this.dustParticles) {
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            if (p.x < -10) p.x = 1300;
            if (p.y > 740) p.y = -10;
        }
    }

    render(ctx, camera) {
        const offset = camera.getRenderOffset();
        const startX = -offset.x;
        const startY = -offset.y;
        const endX = startX + camera.viewportWidth;
        const endY = startY + camera.viewportHeight;

        // Calculate tile indices to render (culling)
        const halfCols = this.cols / 2;
        const halfRows = this.rows / 2;

        const minCol = Math.max(0, Math.floor(startX / this.tileSize + halfCols));
        const maxCol = Math.min(this.cols - 1, Math.ceil(endX / this.tileSize + halfCols));
        const minRow = Math.max(0, Math.floor(startY / this.tileSize + halfRows));
        const maxRow = Math.min(this.rows - 1, Math.ceil(endY / this.tileSize + halfRows));

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const worldX = (c - halfCols) * this.tileSize;
                const worldY = (r - halfRows) * this.tileSize;
                const screenX = Math.round(worldX + offset.x);
                const screenY = Math.round(worldY + offset.y);

                const tile = this.tiles[r][c];
                this._drawTile(ctx, screenX, screenY, tile);
            }
        }

        // Draw Landing platform tech markings
        this._drawLandingPadDetails(ctx, offset);
    }

    _drawTile(ctx, x, y, tile) {
        const s = this.tileSize;

        switch (tile.type) {
            case 'platform':
                ctx.fillStyle = tile.subType === 'metal-light' ? '#383b48' : '#272933';
                ctx.fillRect(x, y, s, s);

                // Metal panel borders
                ctx.strokeStyle = '#1b1d24';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);

                // Metal bolts
                ctx.fillStyle = '#676d80';
                ctx.fillRect(x + 4, y + 4, 2, 2);
                ctx.fillRect(x + s - 6, y + 4, 2, 2);
                ctx.fillRect(x + 4, y + s - 6, 2, 2);
                ctx.fillRect(x + s - 6, y + s - 6, 2, 2);
                break;

            case 'crater':
                ctx.fillStyle = '#5c1d10';
                ctx.fillRect(x, y, s, s);
                // Crater rim and depth
                ctx.fillStyle = '#3a1109';
                ctx.beginPath();
                ctx.arc(x + s / 2, y + s / 2, s * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#8f3419';
                ctx.lineWidth = 2;
                ctx.stroke();
                break;

            case 'iron-rock':
                ctx.fillStyle = '#6e2412';
                ctx.fillRect(x, y, s, s);
                // Sharp rock jagged shape
                ctx.fillStyle = '#350e09';
                ctx.beginPath();
                ctx.moveTo(x + 12, y + 48);
                ctx.lineTo(x + 24, y + 16);
                ctx.lineTo(x + 44, y + 12);
                ctx.lineTo(x + 52, y + 36);
                ctx.lineTo(x + 40, y + 54);
                ctx.closePath();
                ctx.fill();
                // Highlight
                ctx.fillStyle = '#a84020';
                ctx.fillRect(x + 24, y + 16, 6, 4);
                break;

            case 'dune-dark':
                ctx.fillStyle = '#612111';
                ctx.fillRect(x, y, s, s);
                // Dune sand wave
                ctx.fillStyle = '#4e190d';
                ctx.fillRect(x, y + s / 2, s, 3);
                break;

            case 'dune-orange':
                ctx.fillStyle = '#7a2d16';
                ctx.fillRect(x, y, s, s);
                ctx.fillStyle = '#9c411d';
                ctx.fillRect(x + 8, y + 12, 16, 2);
                ctx.fillRect(x + 32, y + 40, 20, 2);
                break;

            case 'dune-red':
            default:
                ctx.fillStyle = '#6b2613';
                ctx.fillRect(x, y, s, s);
                // Subtle pixel noise
                ctx.fillStyle = '#85321b';
                ctx.fillRect(x + 14, y + 24, 2, 2);
                ctx.fillRect(x + 48, y + 46, 2, 2);
                break;
        }
    }

    _drawLandingPadDetails(ctx, offset) {
        // Center landing pad beacon & cross
        const cx = Math.round(offset.x);
        const cy = Math.round(offset.y);

        // Yellow-Orange Landing Pad Border
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - 160, cy - 160, 320, 320);

        // Caution Stripes Corners
        ctx.fillStyle = '#e07228';
        ctx.fillRect(cx - 160, cy - 160, 20, 20);
        ctx.fillRect(cx + 140, cy - 160, 20, 20);
        ctx.fillRect(cx - 160, cy + 140, 20, 20);
        ctx.fillRect(cx + 140, cy + 140, 20, 20);

        // Central Target Crosshair
        ctx.strokeStyle = '#f6c885';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.moveTo(cx - 55, cy);
        ctx.lineTo(cx + 55, cy);
        ctx.moveTo(cx, cy - 55);
        ctx.lineTo(cx, cy + 55);
        ctx.stroke();

        // Platform Decal Text
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.textAlign = 'center';
        ctx.fillText('ARES OUTPOST ALPHA-1', cx, cy - 70);
    }

    renderAtmosphericDust(ctx, screenWidth, screenHeight) {
        // Floating Martian red dust particles in foreground
        for (const p of this.dustParticles) {
            ctx.fillStyle = `rgba(235, 120, 50, ${p.alpha})`;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
    }
}
