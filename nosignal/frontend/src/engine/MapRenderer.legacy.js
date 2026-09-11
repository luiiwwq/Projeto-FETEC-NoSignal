/**
 * MapRenderer.js
 * Renders the currently active map: themed ground tiles, solid obstacles,
 * decorative structures and (on the Martian surface) atmospheric dust.
 *
 * A single renderer instance is reused by the engine; `setMap(map)` swaps
 * the active configuration. All world coordinates are top-left origin:
 * (0,0) is the north-west corner of the map.
 *
 * Solid collision bodies never live here — they are defined in
 * content/maps.js and read by the collision system.
 */

// ── Small deterministic hash (same tile pattern every run) ──
function hash2(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
}

export class MapRenderer {
    constructor() {
        this.mapId = null;
        this.map = null;
        this.tiles = [];
        this.cols = 0;
        this.rows = 0;
        this.dustEnabled = false;
        this.dustParticles = [];
        this.time = 0;
    }

    setMap(map) {
        this.map = map;
        this.mapId = map.id;
        this.cols = Math.ceil(map.width / map.tileSize);
        this.rows = Math.ceil(map.height / map.tileSize);
        this.time = 0;
        this.dustEnabled = !!map.dust;
        this._generateTerrain(map);
        if (this.dustEnabled) {
            this._initAtmosphericDust();
        } else {
            this.dustParticles = [];
        }
    }

    _generateTerrain(map) {
        const { width, height, tileSize } = map;
        this.tiles = [];
        for (let r = 0; r < this.rows; r++) {
            this.tiles[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const wx = c * tileSize + tileSize / 2;
                const wy = r * tileSize + tileSize / 2;
                const tile = this._terrainTileAt(map, wx, wy);
                this.tiles[r][c] = { type: tile.type, sub: tile.sub };
            }
        }
    }

    _terrainTileAt(map, wx, wy) {
        if (map.type === 'surface') {
            // Landing pad centered on the spawn point
            const padHalf = 192;
            if (Math.abs(wx - map.spawn.x) <= padHalf && Math.abs(wy - map.spawn.y) <= padHalf) {
                return {
                    type: 'platform',
                    sub: (Math.round(wx / 64) + Math.round(wy / 64)) % 2 === 0 ? 'metal-dark' : 'metal-light'
                };
            }
            const val = hash2(Math.floor(wx / 64), Math.floor(wy / 64));
            if (val > 0.94) return { type: 'crater' };
            if (val > 0.86) return { type: 'iron-rock' };
            if (val > 0.66) return { type: 'dune-dark' };
            if (val > 0.36) return { type: 'dune-orange' };
            return { type: 'dune-red' };
        }
        if (map.type === 'cave') {
            const val = hash2(Math.floor(wx / 64), Math.floor(wy / 64));
            if (val > 0.92) return { type: 'cave-dark' };
            if (val > 0.84) return { type: 'cave-glow' };
            if (val > 0.60) return { type: 'cave-mid' };
            return { type: 'cave-floor' };
        }
        // castle
        const val = hash2(Math.floor(wx / 64), Math.floor(wy / 64));
        if (val > 0.90) return { type: 'stone-dark' };
        if (val > 0.62) return { type: 'stone-mid' };
        return { type: 'stone-light' };
    }

    _initAtmosphericDust() {
        const count = 45;
        for (let i = 0; i < count; i++) {
            this.dustParticles.push({
                x: Math.random() * 1280,
                y: Math.random() * 720,
                vx: -0.6 - Math.random() * 1.2,
                vy: 0.2 + Math.random() * 0.4,
                size: Math.random() > 0.6 ? 2 : 1,
                alpha: 0.2 + Math.random() * 0.45
            });
        }
    }

    update(dt) {
        this.time += dt;
        if (!this.dustEnabled) return;
        for (const p of this.dustParticles) {
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            if (p.x < -10) p.x = 1300;
            if (p.y > 740) p.y = -10;
        }
    }

    render(ctx, camera) {
        const offset = camera.getRenderOffset();
        const tile = this.map.tileSize;
        const viewW = camera.viewportWidth;
        const viewH = camera.viewportHeight;

        const minCol = Math.max(0, Math.floor(-offset.x / tile));
        const maxCol = Math.min(this.cols - 1, Math.ceil((viewW - offset.x) / tile));
        const minRow = Math.max(0, Math.floor(-offset.y / tile));
        const maxRow = Math.min(this.rows - 1, Math.ceil((viewH - offset.y) / tile));

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const sx = Math.round(c * tile + offset.x);
                const sy = Math.round(r * tile + offset.y);
                this._drawTile(ctx, sx, sy, this.tiles[r][c]);
            }
        }

        // Landing pad decal (surface only)
        if (this.map.type === 'surface') {
            this._drawLandingPad(ctx, offset);
        }

        // Solid obstacles (also drawn as walls for the player)
        this._drawObstacles(ctx, offset);

        // Decorative structures (rock formation, gate, crystal)
        this._drawStructures(ctx, offset);

        // Map transition markers (glowing doorways)
        this._drawExits(ctx, offset);
    }

    _drawTile(ctx, x, y, tile) {
        const s = this.map.tileSize;

        switch (tile.type) {
            case 'platform':
                ctx.fillStyle = tile.sub === 'metal-light' ? '#383b48' : '#272933';
                ctx.fillRect(x, y, s, s);
                ctx.strokeStyle = '#1b1d24';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
                ctx.fillStyle = '#676d80';
                ctx.fillRect(x + 4, y + 4, 2, 2);
                ctx.fillRect(x + s - 6, y + 4, 2, 2);
                ctx.fillRect(x + 4, y + s - 6, 2, 2);
                ctx.fillRect(x + s - 6, y + s - 6, 2, 2);
                break;

            case 'crater':
                ctx.fillStyle = '#5c1d10';
                ctx.fillRect(x, y, s, s);
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
                ctx.fillStyle = '#350e09';
                ctx.beginPath();
                ctx.moveTo(x + 12, y + 48);
                ctx.lineTo(x + 24, y + 16);
                ctx.lineTo(x + 44, y + 12);
                ctx.lineTo(x + 52, y + 36);
                ctx.lineTo(x + 40, y + 54);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#a84020';
                ctx.fillRect(x + 24, y + 16, 6, 4);
                break;

            case 'dune-dark':
                ctx.fillStyle = '#612111';
                ctx.fillRect(x, y, s, s);
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
                ctx.fillStyle = '#6b2613';
                ctx.fillRect(x, y, s, s);
                ctx.fillStyle = '#85321b';
                ctx.fillRect(x + 14, y + 24, 2, 2);
                ctx.fillRect(x + 48, y + 46, 2, 2);
                break;

            case 'cave-floor':
                ctx.fillStyle = '#241710';
                ctx.fillRect(x, y, s, s);
                ctx.fillStyle = '#2f2016';
                ctx.fillRect(x + 6, y + 8, s * 0.6, 2);
                break;

            case 'cave-mid':
                ctx.fillStyle = '#2a1a12';
                ctx.fillRect(x, y, s, s);
                ctx.fillStyle = '#1e120b';
                ctx.fillRect(x + 2, y + 2, s - 4, 2);
                ctx.fillRect(x + 2, y + 2, 2, s - 4);
                break;

            case 'cave-dark':
                ctx.fillStyle = '#1d130d';
                ctx.fillRect(x, y, s, s);
                break;

            case 'cave-glow':
                ctx.fillStyle = '#2a1a12';
                ctx.fillRect(x, y, s, s);
                const pulse = Math.max(0.15, Math.abs(Math.sin(this.time * 2 + x * 0.01)) * 0.5);
                ctx.fillStyle = `rgba(80, 214, 200, ${pulse})`;
                ctx.fillRect(x + s / 2 - 2, y + s / 2 - 2, 4, 4);
                break;

            case 'stone-dark':
                ctx.fillStyle = '#332e29';
                ctx.fillRect(x, y, s, s);
                ctx.strokeStyle = '#26221e';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
                break;

            case 'stone-mid':
                ctx.fillStyle = '#3b352f';
                ctx.fillRect(x, y, s, s);
                ctx.strokeStyle = '#2b2621';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
                break;

            case 'stone-light':
            default:
                ctx.fillStyle = '#433c35';
                ctx.fillRect(x, y, s, s);
                ctx.strokeStyle = '#322c26';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
                ctx.fillStyle = '#4e463e';
                ctx.fillRect(x + 8, y + 10, 4, 4);
                break;
        }
    }

    _drawObstacles(ctx, offset) {
        for (const o of this.map.obstacles) {
            const sx = Math.round(o.x + offset.x);
            const sy = Math.round(o.y + offset.y);
            this._drawBlock(ctx, sx, sy, o.w, o.h, o.kind);
        }
    }

    _drawBlock(ctx, x, y, w, h, kind) {
        switch (kind) {
            case 'cave-wall':
                ctx.fillStyle = '#2b1b12';
                ctx.fillRect(x, y, w, h);
                ctx.fillStyle = '#1a100a';
                ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
                ctx.strokeStyle = '#170d08';
                ctx.lineWidth = 2;
                for (let j = 0; j < h; j += 32) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + j);
                    ctx.lineTo(x + w, y + j);
                    ctx.stroke();
                }
                break;

            case 'cave-rock':
            case 'rock':
                ctx.fillStyle = '#8f3a1c';
                ctx.fillRect(x, y, w, h);
                ctx.fillStyle = '#5c1d10';
                ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
                ctx.fillStyle = '#a84020';
                ctx.fillRect(x + 6, y + 5, w * 0.35, 5);
                break;

            case 'edge-rock':
                ctx.fillStyle = '#4a1a0e';
                ctx.fillRect(x, y, w, h);
                ctx.fillStyle = '#3a1109';
                ctx.fillRect(x + 2, y + 2, Math.max(0, w - 4), Math.max(0, h - 4));
                ctx.fillStyle = '#e07228';
                ctx.fillRect(x, y, w, 4);
                break;

            case 'castle-wall':
                ctx.fillStyle = '#3d3831';
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#28231e';
                ctx.lineWidth = 2;
                for (let j = 0; j < h; j += 32) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + j);
                    ctx.lineTo(x + w, y + j);
                    ctx.stroke();
                }
                for (let i = 0; i < w; i += 32) {
                    ctx.beginPath();
                    ctx.moveTo(x + i, y);
                    ctx.lineTo(x + i, y + h);
                    ctx.stroke();
                }
                ctx.fillStyle = '#332e28';
                ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
                break;

            case 'column':
                ctx.fillStyle = '#4a443c';
                ctx.fillRect(x, y, w, 10);
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + 4, w / 2, 5, 0, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#5c554b';
                ctx.fillRect(x + 4, y + 10, w - 8, h - 20);
                ctx.fillStyle = '#3a3530';
                ctx.fillRect(x + 10, y + 12, 4, h - 24);
                ctx.fillStyle = '#4a443c';
                ctx.beginPath();
                ctx.ellipse(x + w / 2, y + h - 4, w / 2, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'crate':
            default:
                ctx.fillStyle = '#6b5433';
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#4a3a22';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + w, y + h);
                ctx.moveTo(x + w, y);
                ctx.lineTo(x, y + h);
                ctx.stroke();
                break;
        }
    }

    _drawStructures(ctx, offset) {
        for (const s of this.map.structures || []) {
            if (s.type === 'gate') {
                // Glowing doorway between the castle towers
                ctx.save();
                ctx.fillStyle = 'rgba(224, 114, 40, 0.22)';
                ctx.fillRect(Math.round(s.lintel.x + offset.x + 90), Math.round(s.lintel.y + s.lintel.h + offset.y + 12), s.lintel.w - 180, 120);
                ctx.fillStyle = 'rgba(246, 200, 133, 0.35)';
                ctx.fillRect(Math.round(s.lintel.x + offset.x + 90), Math.round(s.lintel.y + s.lintel.h + offset.y + 12), s.lintel.w - 180, 6);
                ctx.restore();
                // Banners on the lintel
                for (const bx of [s.lintel.x + 20, s.lintel.x + s.lintel.w - 20]) {
                    ctx.save();
                    ctx.translate(Math.round(bx + offset.x), Math.round(s.lintel.y + s.lintel.h + offset.y));
                    ctx.fillStyle = '#7a1f14';
                    ctx.fillRect(0, 0, 8, 34);
                    ctx.fillStyle = '#c0602c';
                    ctx.fillRect(0, 0, 8, 10);
                    ctx.restore();
                }
            } else if (s.type === 'crystal') {
                const cx = Math.round(s.x + offset.x);
                const cy = Math.round(s.y + offset.y);
                const glow = 0.35 + Math.abs(Math.sin(this.time * 1.6)) * 0.35;
                ctx.save();
                ctx.shadowColor = '#50d6c8';
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#2fd8c2';
                ctx.beginPath();
                ctx.moveTo(cx, cy - 46);
                ctx.lineTo(cx + 14, cy - 10);
                ctx.lineTo(cx + 6, cy + 8);
                ctx.lineTo(cx - 8, cy + 8);
                ctx.lineTo(cx - 14, cy - 12);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(220, 255, 250, 0.6)';
                ctx.beginPath();
                ctx.moveTo(cx, cy - 46);
                ctx.lineTo(cx, cy - 12);
                ctx.lineTo(cx - 8, cy + 8);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = `rgba(80, 214, 200, ${glow})`;
                ctx.beginPath();
                ctx.ellipse(cx, cy + 16, 26, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    _drawExits(ctx, offset) {
        for (const exit of this.map.exits || []) {
            const ex = Math.round(exit.x + offset.x);
            const ey = Math.round(exit.y + offset.y);
            const pulse = 0.35 + Math.abs(Math.sin(this.time * 2.2)) * 0.5;
            ctx.save();
            ctx.strokeStyle = `rgba(224, 114, 40, ${pulse})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(ex, ey, exit.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = `rgba(246, 200, 133, ${pulse * 0.9})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ex, ey, exit.radius + 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    _drawLandingPad(ctx, offset) {
        const px = Math.round(this.map.spawn.x + offset.x);
        const py = Math.round(this.map.spawn.y + offset.y);

        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 3;
        ctx.strokeRect(px - 160, py - 160, 320, 320);

        ctx.fillStyle = '#e07228';
        ctx.fillRect(px - 160, py - 160, 20, 20);
        ctx.fillRect(px + 140, py - 160, 20, 20);
        ctx.fillRect(px - 160, py + 140, 20, 20);
        ctx.fillRect(px + 140, py + 140, 20, 20);

        ctx.strokeStyle = '#f6c885';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 40, 0, Math.PI * 2);
        ctx.moveTo(px - 55, py);
        ctx.lineTo(px + 55, py);
        ctx.moveTo(px, py - 55);
        ctx.lineTo(px, py + 55);
        ctx.stroke();

        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.textAlign = 'center';
        ctx.fillText('ARES OUTPOST ALPHA-1', px, py - 70);
        ctx.restore();
    }

    renderAtmosphericDust(ctx, screenWidth, screenHeight) {
        if (!this.dustEnabled) return;
        for (const p of this.dustParticles) {
            ctx.fillStyle = `rgba(235, 120, 50, ${p.alpha})`;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
    }
}