/**
 * MapRenderer.js
 * Renders the currently active map in layers (ground → detail → props).
 *
 * A single renderer instance is reused by the engine; `setMap(map)` swaps
 * the active configuration. All world coordinates are top-left origin:
 * (0,0) is the north-west corner of the map.
 *
 * ── Rendering vs. gameplay grids ────────────────────────────────────
 * Gameplay (maps.js / collisionSystem / Player) lives on LOGICAL_TILE (64).
 * This renderer draws the Martian surface on a purely visual RENDER_TILE
 * (16px) micro-grid and NEVER changes logical coordinates, hitboxes, camera
 * bounds, speeds or transitions. Conversion helpers live in
 * content/tilemap.js and are explicit/testable.
 *
 * The legacy procedural path (used for mars-cave and castle maps until they
 * are migrated) is preserved inside this file; a full copy of the previous
 * file is also kept at engine/MapRenderer.legacy.js as fallback.
 */

import {
    LOGICAL_TILE,
    RENDER_TILE,
    renderTileToWorld,
    SURFACE_PALETTE,
} from '../content/tilemap.js';
import { tileAtlas } from './tileAtlas.js';

const P = SURFACE_PALETTE;

// Visual facade of the distant castle (scale 0.90 = ~2x original / 1.5x reduced from 1.35).
// Anchored at x: 3650, y: 1037 so the top of the 977px building sits
// comfortably below the northern border rocks at y: 60.
const CASTLE_SPRITE_PATH = './src/assets/sprites/Castle/castle_sprite.png?v=4';
const CASTLE_SPRITE_ANCHOR = { x: 3650, y: 1037, originX: 0.5, originY: 1.0, scale: 0.90 };

// Cave entrance sprite (single monolithic rock with a dark mouth in its
// centre). Anchored bottom-center on the same ground line the cave-wall
// obstacles use (y=1410), centred on the formation (~x1620). scale ~1/6 maps
// the art's central mouth (sprite ~x850..1450, y580..1140) to a ~100px-wide
// opening at world x1567..1667 — matching the free corridor kept between
// cavePillarLeft and caveWallRight.
const CAVE_SPRITE_PATH = './src/assets/sprites/Cavern/cavern_entrance.png?v=3';
const CAVE_SPRITE_ANCHOR = { x: 1620, y: 1410, originX: 0.5, originY: 1.0, scale: 0.167 };

// Base folder for individual prop sprites (loaded generically via
// _loadSpriteOnce; each undead obstacle/decoration stores its own `sprite`
// path relative to this base).
const SPRITE_BASE = './src/assets/sprites/';

// ── Sprite-cavern maps (Núcleo + Catacumbas) ─────────────────────────────
// Each of these maps is a single pre-composed PNG (pure black background +
// the whole cave artwork). It is drawn 1:1 at world (0,0), once, with no
// scaling/repetition/texture; collisions live in the map data (separate
// walkability mask), never derived from the pixels at render time.
const CAVERN_SPRITE_PATHS = {
    'mars-core': './src/assets/sprites/Cavern/map_nucle.png',
    'mars-catacombs': './src/assets/sprites/Cavern/map_catacombs.png',
};

// Ground texture (tileable PNG), loaded once and used as a CanvasPattern in
// _drawSurfaceGroundCell when available; otherwise procedural ground fallback.
const MAP_SURFACE_TEXTURE_PATH = './src/assets/sprites/Map/map_surface.png';
const MAP_SURFACE_PATTERN_SCALE = 0.5; // pattern.setTransform scale (texture cell = 512px)
// The photo texture (~84 avg luminance with the current art) is brightened +
// saturated ONCE when it is baked into the offscreen canvas (the procedural
// ground it replaces was ~100); never applied per frame.
const SURFACE_PATTERN_FILTER = 'brightness(1.15) saturate(1.1)';

/* The old Catacombs/Núcleo procedural terrain + wall/edge texture system was
 * removed: both maps are now rendered by the `sprite-cavern` pipeline. */

// ── Small deterministic hash (same pattern every run) ──
function hash2(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
}

// Smooth value noise from the hashes of the four corners of a LOGICAL_TILE.
function bilinearHash(lc, lr, fx, fy) {
    const a = hash2(lc, lr);
    const b = hash2(lc + 1, lr);
    const c = hash2(lc, lr + 1);
    const d = hash2(lc + 1, lr + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Linear RGB mix between two '#rrggbb' hex colors. Returns an `rgb(...)`
// string so canvas accepts it directly. Used by _duneTone to replace the hard
// banded thresholds with a smooth continuous ground color field.
function mixHex(hexA, hexB, t) {
    const a = [parseInt(hexA.slice(1, 3), 16), parseInt(hexA.slice(3, 5), 16), parseInt(hexA.slice(5, 7), 16)];
    const b = [parseInt(hexB.slice(1, 3), 16), parseInt(hexB.slice(3, 5), 16), parseInt(hexB.slice(5, 7), 16)];
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
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
        this.castleSprite = null;
        this._castleSpriteRequested = false;
        this._castleSpriteWarned = false;
        this.caveEntranceSprite = null;
        this._caveEntranceSpriteRequested = false;
        this._caveEntranceSpriteWarned = false;
        this.mapSurfaceTexture = null;
        this._mapSurfacePattern = null;
        this._mapSurfaceRequested = false;
        this._mapSurfaceWarned = false;
        // Sprite-cavern full-map PNGs (mars-core / mars-catacombs): cached per
        // map id, requested once, never reloaded per frame or per map swap.
        this.cavernSprites = new Map();
        this._cavernSpriteRequested = new Set();
        this._cavernSpriteWarned = new Set();
        // Generic individual-sprite cache shared by surface props and the shop
        // NPC (key = full URL; value = Image once ready, null while loading or
        // after a failed load). `_undeadWarned` de-dupes the console warnings.
        this._spriteCache = new Map();
        this._undeadWarned = new Set();
    }

    setMap(map) {
        this.map = map;
        this.mapId = map.id;
        // cols/rows always follow the LOGICAL_TILE (64) gameplay grid.
        this.cols = Math.ceil(map.width / LOGICAL_TILE);
        this.rows = Math.ceil(map.height / LOGICAL_TILE);
        this.time = 0;
        this.dustEnabled = !!map.dust;

        if (map.type === 'surface') {
            // Surface uses the layered micro-tile pipeline (no precomputed grid).
            this.tiles = [];
        } else if (map.type === 'sprite-cavern') {
            // Single pre-composed PNG: no terrain grid, no tiles, no pattern.
            this.tiles = [];
        } else {
            // Cave/castle keep the legacy procedural path (migrated next stage).
            this._generateTerrain(map);
        }

        if (this.dustEnabled) {
            this._initAtmosphericDust();
        } else {
            this.dustParticles = [];
        }

        if (map.type === 'sprite-cavern') {
            // Only the full-map artwork is needed; nothing else is drawn over it.
            this.loadCavernMapSprite(map.id);
            return;
        }

        this.loadCastleSprite();
        this.loadCaveEntranceSprite();
        this.loadMapSurfaceTexture();
    }

    /**
     * Loads the full-map PNG of a sprite-cavern map exactly once (cached per
     * map id). While it is loading/failed the map stays pure black — there is
     * NO procedural fallback texture for these maps.
     */
    loadCavernMapSprite(mapId) {
        if (!CAVERN_SPRITE_PATHS[mapId]) return;
        if (this.cavernSprites.has(mapId) || this._cavernSpriteRequested.has(mapId)) return;
        this._cavernSpriteRequested.add(mapId);
        if (typeof Image === 'undefined') return; // non-browser (tests)
        const img = new Image();
        img.onload = () => {
            this.cavernSprites.set(mapId, img);
        };
        img.onerror = () => {
            if (!this._cavernSpriteWarned.has(mapId)) {
                this._cavernSpriteWarned.add(mapId);
                console.warn(
                    `[MapRenderer] ${CAVERN_SPRITE_PATHS[mapId]} não carregou — mapa de caverna permanece preto.`
                );
            }
        };
        img.src = CAVERN_SPRITE_PATHS[mapId];
    }

    /**
     * Loads the castle facade sprite exactly once. Image loading is async, so
     * renders fall back to the procedural towers until it finishes (or warn
     * once if the file is missing). Never reloaded per frame or per map swap.
     */
    loadCastleSprite() {
        if (this.castleSprite || this._castleSpriteRequested) return;
        this._castleSpriteRequested = true;
        if (typeof Image === 'undefined') return; // non-browser (tests)
        const img = new Image();
        img.onload = () => {
            this.castleSprite = img;
        };
        img.onerror = () => {
            const fallback = new Image();
            fallback.onload = () => {
                this.castleSprite = fallback;
            };
            fallback.onerror = () => {
                if (!this._castleSpriteWarned) {
                    this._castleSpriteWarned = true;
                    console.warn(
                        `[MapRenderer] ${CASTLE_SPRITE_PATH} não carregou — usando fallback procedural para o castelo.`
                    );
                }
            };
            fallback.src = './src/assets/sprites/Castle/castle-sprite.png?v=4';
        };
        img.src = CASTLE_SPRITE_PATH;
    }

    /**
     * Loads the cave entrance sprite exactly once (same guard pattern as the
     * castle). Renders fall back to the procedural _drawCaveFormation until the
     * image finishes loading (or warn once if the file is missing). Never
     * reloaded per frame or per map swap.
     */
    loadCaveEntranceSprite() {
        if (this.caveEntranceSprite || this._caveEntranceSpriteRequested) return;
        this._caveEntranceSpriteRequested = true;
        if (typeof Image === 'undefined') return; // non-browser (tests)
        const img = new Image();
        img.onload = () => {
            this.caveEntranceSprite = img;
        };
        img.onerror = () => {
            if (!this._caveEntranceSpriteWarned) {
                this._caveEntranceSpriteWarned = true;
                console.warn(
                    `[MapRenderer] ${CAVE_SPRITE_PATH} não carregou — usando fallback procedural para a entrada da caverna.`
                );
            }
        };
        img.src = CAVE_SPRITE_PATH;
    }

    // Ground texture (tileable JPEG). Loaded once; creates and caches a
    // CanvasPattern lazily from the first 2D context that draws a ground cell.
    loadMapSurfaceTexture() {
        if (this.mapSurfaceTexture || this._mapSurfaceRequested) return;
        this._mapSurfaceRequested = true;
        if (typeof Image === 'undefined') return; // non-browser (tests)
        const img = new Image();
        img.onload = () => {
            this.mapSurfaceTexture = img;
        };
        img.onerror = () => {
            const fallback = new Image();
            fallback.onload = () => {
                this.mapSurfaceTexture = fallback;
            };
            fallback.onerror = () => {
                if (!this._mapSurfaceWarned) {
                    this._mapSurfaceWarned = true;
                    console.warn(
                        `[MapRenderer] ${MAP_SURFACE_TEXTURE_PATH} não carregou — usando chão procedural.`
                    );
                }
            };
            fallback.src = './src/assets/sprites/Map/map_surface.jpeg';
        };
        img.src = MAP_SURFACE_TEXTURE_PATH;
    }

    /**
     * Loads a generic individual sprite exactly once and caches it by `key`
     * (internal Map, e.g. this._spriteCache). Guards against reloading the
     * same file and silently returns null while the image is still loading or
     * after a failed load — the renderer simply skips drawing that frame.
     * Used for the many undead-tileset props instead of one loadX() per file.
     */
    _loadSpriteOnce(key, path) {
        if (this._spriteCache.has(key)) return this._spriteCache.get(key);
        this._spriteCache.set(key, null); // mark as requested (no reloads)
        if (typeof Image === 'undefined') return null; // non-browser (tests)
        const img = new Image();
        img.onload = () => {
            this._spriteCache.set(key, img);
        };
        img.onerror = () => {
            this._spriteCache.set(key, null);
            if (!this._undeadWarned.has(key)) {
                this._undeadWarned.add(key);
                console.warn(`[MapRenderer] ${path} não carregou — sprite não desenhado.`);
            }
        };
        img.src = path;
        return null;
    }

    // Draws one full individual sprite (no sub-rect crop — each file is a
    // complete sprite already) at the obstacle/decoration's world position.
    // Supports `anchor: 'bottom-center'` so the sprite's base sits exactly
    // on the world coordinate (y = base, x = center).
    // Returns without drawing if the sprite is still loading or failed.
    _drawUndeadSprite(ctx, o, offset) {
        if (!o.sprite) return;
        const path = `${SPRITE_BASE}${o.sprite}`;
        const img = this._loadSpriteOnce(path, path);
        if (!img || !img.complete || img.naturalWidth === 0) return;
        const baseX = Math.round(o.x + offset.x);
        const baseY = Math.round(o.y + offset.y);
        let drawX, drawY, drawW, drawH;
        if (o.source) {
            const s = o.source;
            drawW = o.w || s.w;
            drawH = o.h || s.h;
        } else if (o.w && o.h) {
            drawW = o.w;
            drawH = o.h;
        } else if (o.scale) {
            drawW = Math.round(img.naturalWidth * o.scale);
            drawH = Math.round(img.naturalHeight * o.scale);
        } else {
            drawW = img.naturalWidth;
            drawH = img.naturalHeight;
        }
        if (o.anchor === 'bottom-center') {
            drawX = baseX - drawW / 2;
            drawY = baseY - drawH;
        } else {
            drawX = baseX;
            drawY = baseY;
        }
        if (o.source) {
            const s = o.source;
            ctx.drawImage(img, s.x, s.y, s.w, s.h, drawX, drawY, drawW, drawH);
        } else {
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }
    }

    // Animated decor (kind 'undead-decor-anim'): picks a frame from o.frames
    // (sprite paths) cycling every o.interval seconds (default 0.45), drawn at
    // natural size × o.scale (default 1). Both water frames share position/size.
    _drawUndeadAnim(ctx, o, offset) {
        const frames = o.frames || (o.sprite ? [o.sprite] : []);
        if (!frames.length) return;
        const interval = o.interval || 0.45;
        const idx = frames.length > 1 ? Math.floor(this.time / interval) % frames.length : 0;
        const path = `${SPRITE_BASE}${frames[idx]}`;
        const img = this._loadSpriteOnce(path, path);
        if (!img || !img.complete || img.naturalWidth === 0) return;
        const scale = o.scale || 1;
        ctx.drawImage(
            img,
            Math.round(o.x + offset.x),
            Math.round(o.y + offset.y),
            Math.round(img.naturalWidth * scale),
            Math.round(img.naturalHeight * scale)
        );
    }

    _ensureMapSurfacePattern(ctx) {
        if (this._mapSurfacePattern || !this.mapSurfaceTexture) return this._mapSurfacePattern;
        try {
            // Bake the brightened texture ONCE: apply the color filter to an
            // offscreen canvas a single time and pattern from that, so no
            // per-frame ctx.filter is ever needed in the ground loop.
            const cw = Math.max(1, Math.floor(this.mapSurfaceTexture.naturalWidth || 1));
            const ch = Math.max(1, Math.floor(this.mapSurfaceTexture.naturalHeight || 1));
            const bake = document.createElement('canvas');
            bake.width = cw;
            bake.height = ch;
            const bctx = bake.getContext('2d');
            bctx.filter = SURFACE_PATTERN_FILTER;
            bctx.drawImage(this.mapSurfaceTexture, 0, 0, cw, ch);
            const pattern = ctx.createPattern(bake, 'repeat');
            if (pattern) {
                pattern.setTransform(new DOMMatrix().scale(MAP_SURFACE_PATTERN_SCALE));
                this._mapSurfacePattern = pattern;
            }
        } catch (e) {
            this._mapSurfacePattern = null;
        }
        return this._mapSurfacePattern;
    }

    // True only after the cave sprite has actually finished decoding, so we
    // never draw a frame before onload fires (or while the file is missing).
    _caveEntranceReady() {
        return (
            !!this.caveEntranceSprite &&
            this.caveEntranceSprite.complete &&
            this.caveEntranceSprite.naturalWidth !== 0
        );
    }

    // Screen-space rect of the cave entrance sprite on the current frame
    // (world object). Uses the full canvas extent, margins included.
    _caveEntranceSpriteRect(offset) {
        const a = CAVE_SPRITE_ANCHOR;
        let cw = 2335;
        let ch = 1824;
        if (this.caveEntranceSprite && this.caveEntranceSprite.naturalWidth > 0) {
            cw = this.caveEntranceSprite.naturalWidth;
            ch = this.caveEntranceSprite.naturalHeight;
        }
        cw = Math.round(cw * a.scale);
        ch = Math.round(ch * a.scale);
        return {
            x: Math.round(a.x + offset.x - cw * a.originX),
            y: Math.round(a.y + offset.y - ch * a.originY),
            w: cw,
            h: ch,
        };
    }

    // Screen-space rect of the castle facade on the current frame (world object).
    _castleSpriteRect(offset) {
        const a = CASTLE_SPRITE_ANCHOR;
        let cw = 1448;
        let ch = 1086;
        if (this.castleSprite && this.castleSprite.naturalWidth > 0) {
            cw = this.castleSprite.naturalWidth;
            ch = this.castleSprite.naturalHeight;
        }
        cw = Math.round(cw * a.scale);
        ch = Math.round(ch * a.scale);
        return {
            x: Math.round(a.x + offset.x - cw * a.originX),
            y: Math.round(a.y + offset.y - ch * a.originY),
            w: cw,
            h: ch,
        };
    }

    // ═══════════════════════ SURFACE PIPELINE ═══════════════════════

    _isPlatformZone(wx, wy) {
        const padHalf = 192;
        return (
            Math.abs(wx - this.map.spawn.x) <= padHalf &&
            Math.abs(wy - this.map.spawn.y) <= padHalf
        );
    }

    _macroAt(lc, lr) {
        // The dark 'iron' macro (collisionless rock clusters scattered over the
        // surface) was removed by request: every logical tile is dune terrain.
        return 'dune';
    }

    _duneTone(wx, wy) {
        const lc = Math.floor(wx / LOGICAL_TILE);
        const lr = Math.floor(wy / LOGICAL_TILE);
        const fx = wx / LOGICAL_TILE - lc;
        const fy = wy / LOGICAL_TILE - lr;
        const f = clamp01(bilinearHash(lc, lr, fx, fy));
        // Continuous mix instead of hard thresholds: red→orange over 0–0.5 and
        // orange→dark over 0.5–1, so neighboring tiles never have a visible
        // straight seam between two flat colors.
        let base, variant;
        if (f < 0.5) {
            const t = f * 2;
            base = mixHex(P.groundRed, P.groundOrange, t);
            variant = mixHex(P.groundRedVariant, P.groundOrangeVariant, t);
        } else {
            const t = (f - 0.5) * 2;
            base = mixHex(P.groundOrange, P.groundDark, t);
            variant = mixHex(P.groundOrangeVariant, P.groundDarkVariant, t);
        }
        const kind = f >= 0.68 ? 'dark' : f >= 0.40 ? 'orange' : 'red';
        return { kind, base, variant };
    }

    _surfaceGroundStyle(wx, wy) {
        if (this._isPlatformZone(wx, wy)) {
            const even = (Math.round(wx / RENDER_TILE) + Math.round(wy / RENDER_TILE)) % 2 === 0;
            return { base: even ? P.platformLight : P.platformDark, speckle: null, crack: false };
        }
        const h = hash2(Math.round(wx / RENDER_TILE), Math.round(wy / RENDER_TILE));
        let speckle = null;
        if (h > 0.95) {
            speckle = this._duneTone(wx, wy).variant;
        } else if (h > 0.90) {
            speckle = P.craterRim;
        }
        const macro = this._macroAt(Math.floor(wx / LOGICAL_TILE), Math.floor(wy / LOGICAL_TILE));
        let base;
        if (macro === 'iron') base = P.iron;
        else base = this._duneTone(wx, wy).base;
        return { base, speckle, crack: h > 0.985 && h <= 0.995 };
    }

    _drawSurfaceGroundCell(ctx, sx, sy, wx, wy) {
        const pattern = this._ensureMapSurfacePattern(ctx);
        if (pattern && !this._isPlatformZone(wx, wy)) {
            // Ground texture already painted by the single world-anchored fill in
            // _renderSurface; nothing extra to draw for this cell.
            return;
        }
        const g = this._surfaceGroundStyle(wx, wy);
        ctx.fillStyle = g.base;
        ctx.fillRect(sx, sy, RENDER_TILE, RENDER_TILE);

        if (g.speckle) {
            const hx = hash2(Math.round(wx / RENDER_TILE) + 1000, Math.round(wy / RENDER_TILE) + 500);
            ctx.fillStyle = g.speckle;
            ctx.fillRect(sx + Math.floor(hx * 12), sy + Math.floor(hash2(hx, 1) * 12), 2, 2);
        }
        if (g.crack) {
            ctx.fillStyle = 'rgba(20, 8, 4, 0.55)';
            ctx.fillRect(sx + 6, sy + 3, 1, 7);
            ctx.fillRect(sx + 9, sy + 5, 1, 5);
        }
    }

    _drawSurfaceFeature(ctx, offset, lc, lr) {
        const x = lc * LOGICAL_TILE;
        const y = lr * LOGICAL_TILE;
        const cx = Math.round(x + offset.x);
        const cy = Math.round(y + offset.y);
        const s = LOGICAL_TILE;

        if (this._isPlatformZone(x + s / 2, y + s / 2)) {
            ctx.fillStyle = P.platformBolt;
            ctx.fillRect(cx + 4, cy + 4, 2, 2);
            ctx.fillRect(cx + s - 6, cy + 4, 2, 2);
            ctx.fillRect(cx + 4, cy + s - 6, 2, 2);
            ctx.fillRect(cx + s - 6, cy + s - 6, 2, 2);
            return;
        }

        const macro = this._macroAt(lc, lr);
        if (macro === 'iron') {
            // Dark collisionless rock clusters removed by request. Kept as a
            // guard so no iron rock is ever drawn even if _macroAt changes.
            return;
        }
        const tone = this._duneTone(x + s / 2, y + s / 2);
        if (tone.kind === 'dark' || tone.kind === 'orange') {
            const h = hash2(lc, lr);
            ctx.fillStyle = 'rgba(30, 12, 6, 0.35)';
            ctx.fillRect(cx + 6, cy + Math.floor(h * s * 0.6) + 4, Math.floor(s * 0.7), 2);
        }
    }

    _drawSurfaceDetail(ctx, offset, minTC, maxTC, minTR, maxTR) {
        for (let r = minTR; r <= maxTR; r++) {
            for (let c = minTC; c <= maxTC; c++) {
                const wx = renderTileToWorld(c);
                const wy = renderTileToWorld(r);
                if (this._isPlatformZone(wx, wy)) continue;
                const sx = Math.round(wx + offset.x);
                const sy = Math.round(wy + offset.y);
                const h = hash2(Math.round(wx / RENDER_TILE) + 500, Math.round(wy / RENDER_TILE) + 500);
                if (h > 0.965) {
                    ctx.fillStyle = 'rgba(30, 10, 5, 0.8)';
                    ctx.fillRect(sx + Math.floor(hash2(h, 3) * 12), sy + Math.floor(hash2(h, 4) * 12), 2, 2);
                } else if (h > 0.93) {
                    ctx.fillStyle = 'rgba(232, 178, 138, 0.45)';
                    ctx.fillRect(sx + Math.floor(hash2(h, 5) * 14), sy + Math.floor(hash2(h, 6) * 14), 1, 1);
                }
            }
        }
    }

    _drawSurfaceProps(ctx, offset, viewW, viewH) {
        // Castle facade sprite (scenery layer, world-anchored, culled).
        if (this.castleSprite) {
            const r = this._castleSpriteRect(offset);
            if (r.x < viewW && r.x + r.w > 0 && r.y < viewH && r.y + r.h > 0) {
                ctx.drawImage(this.castleSprite, r.x, r.y, r.w, r.h);
            }
        }

        // Cave entrance sprite (scenery layer, world-anchored, culled by its
        // full drawn extent so it isn't cut early at the screen edges).
        if (this._caveEntranceReady()) {
            const r = this._caveEntranceSpriteRect(offset);
            if (r.x < viewW && r.x + r.w > 0 && r.y < viewH && r.y + r.h > 0) {
                ctx.drawImage(this.caveEntranceSprite, r.x, r.y, r.w, r.h);
            }
        }

        for (const o of this.map.obstacles) {
            const sx = Math.round(o.x + offset.x);
            const sy = Math.round(o.y + offset.y);
            const seed = Math.round(o.x * 0.7 + o.y * 1.3);

            if (o.kind === 'rock') {
                this._drawSurfaceRock(ctx, sx, sy, o, seed);
            } else if (o.kind === 'cave-wall') {
                // The cave entrance sprite replaces the procedural formation;
                // only draw _drawCaveFormation as a fallback while the sprite
                // is unavailable (missing/offline).
                if (this._caveEntranceReady()) continue;
                this._drawCaveFormation(ctx, sx, sy, o, seed);
            } else if (o.kind === 'castle-wall') {
                if (this.castleSprite) continue; // facade sprite covers the castle
                if (o.h >= 300) {
                    this._drawTower(ctx, sx, sy, o, seed);
                } else {
                    this._drawBlock(ctx, sx, sy, o.w, o.h, o.kind);
                }
            } else if (o.kind === 'edge-rock') {
                this._drawEdgeRiff(ctx, sx, sy, o, seed);
            } else if (o.kind === 'npc') {
                this._drawUndeadSprite(ctx, o, offset);
            } else {
                this._drawBlock(ctx, sx, sy, o.w, o.h, o.kind);
            }
        }

        // Crystal and remaining overlays (cave). The gate structure no longer
        // exists on the surface — it was replaced by the castle sprite.
        this._drawStructures(ctx, offset);
    }

    // Irregular silhouette that stays inside [x, x+w] × [y, y+h], so the
    // drawn rock never understates the AABB collision box around it.
    _polygonPath(ctx, x, y, w, h, seed, inset, div = 2) {
        const rnd = (i) => hash2(seed, i);
        const pts = [];
        const steps = Math.max(1, div);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            pts.push([x + t * w + (rnd(i) - 0.5) * inset * 0.4, y + rnd(10 + i) * inset]);
        }
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            pts.push([x + w - rnd(20 + i) * inset, y + t * h]);
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            pts.push([x + t * w + (rnd(30 + i) - 0.5) * inset * 0.4, y + h - rnd(40 + i) * inset]);
        }
        for (let i = steps - 1; i > 0; i--) {
            const t = i / steps;
            pts.push([x + rnd(50 + i) * inset, y + t * h]);
        }

        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fill();
    }

    // Same control-point generation as _polygonPath, but connected with smooth
    // quadratic curves through edge midpoints (control = vertex). Produces a
    // rounded "weathered stone" silhouette that still stays inside
    // [x, x+w] × [y, y+h] (a quadratic Bézier lies inside the triangle of its
    // three points, so it never understates the collision box). Cave/castle
    // keep using the original _polygonPath, untouched.
    _roundedPolygonPath(ctx, x, y, w, h, seed, inset, div = 2) {
        const rnd = (i) => hash2(seed, i);
        const pts = [];
        const steps = Math.max(1, div);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            pts.push([x + t * w + (rnd(i) - 0.5) * inset * 0.4, y + rnd(10 + i) * inset]);
        }
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            pts.push([x + w - rnd(20 + i) * inset, y + t * h]);
        }
        for (let i = steps; i >= 0; i--) {
            const t = i / steps;
            pts.push([x + t * w + (rnd(30 + i) - 0.5) * inset * 0.4, y + h - rnd(40 + i) * inset]);
        }
        for (let i = steps - 1; i > 0; i--) {
            const t = i / steps;
            pts.push([x + rnd(50 + i) * inset, y + t * h]);
        }

        ctx.beginPath();
        const n = pts.length;
        const mid = (i0, i1) => [(pts[i0][0] + pts[i1][0]) / 2, (pts[i0][1] + pts[i1][1]) / 2];
        let m = mid(0, 1);
        ctx.moveTo(m[0], m[1]);
        for (let i = 1; i <= n; i++) {
            const next = (i + 1) % n;
            const ctrl = pts[i % n];
            const end = mid(i % n, next);
            ctx.quadraticCurveTo(ctrl[0], ctrl[1], end[0], end[1]);
        }
        ctx.closePath();
        ctx.fill();
    }

    _drawSurfaceRock(ctx, x, y, o, seed) {
        const w = o.w;
        const h = o.h;
        // Contact shadow: a wide, flat dark ellipse hugging the base, drawn
        // before the rock so it reads as resting on the ground.
        ctx.fillStyle = 'rgba(20, 8, 4, 0.35)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h - 2, w * 0.55, Math.max(3, h * 0.14), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = P.rock;
        this._roundedPolygonPath(ctx, x, y, w, h, seed, 7, 2);
        ctx.fillStyle = P.rockDark;
        this._roundedPolygonPath(ctx, x + 3, y + 3, w - 8, h - 8, seed + 7, 5, 2);
        ctx.fillStyle = P.rockLight;
        const hl = hash2(seed, 99);
        ctx.fillRect(x + 4 + Math.floor(hl * 6), y + 3, 6, 2);
        ctx.fillRect(x + 3, y + 5 + Math.floor(hash2(seed, 100) * 4), 2, 8);

        ctx.fillStyle = 'rgba(25, 8, 4, 0.55)';
        ctx.fillRect(x + w - 10, y + h - 6, 6, 3);
        // Pebbles hugging the base.
        ctx.fillStyle = P.rockDark;
        ctx.fillRect(x + 4, y + h - 4, 3, 3);
        ctx.fillRect(x + w - 6, y + h - 3, 4, 3);
    }

    _drawCaveFormation(ctx, x, y, o, seed) {
        const w = o.w;
        const h = o.h;
        const slabs = [
            { top: 0.0, hf: 0.30, inset: 10 },
            { top: 0.24, hf: 0.36, inset: 6 },
            { top: 0.54, hf: 0.46, inset: 4 },
        ];
        for (let i = 0; i < slabs.length; i++) {
            const sl = slabs[i];
            ctx.fillStyle = i % 2 === 0 ? P.caveWallDark : P.caveWall;
            this._polygonPath(ctx, x, y + h * sl.top, w, h * sl.hf, seed + i * 13, sl.inset, 2);
        }
        ctx.fillStyle = 'rgba(120, 70, 40, 0.22)';
        this._polygonPath(ctx, x, y, w, h * 0.1, seed + 5, 4, 1);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x + 2, y + h - 4, w - 4, 3);
    }

    _drawTower(ctx, x, y, o, seed) {
        const w = o.w;
        const h = o.h;
        ctx.fillStyle = P.tower;
        ctx.fillRect(x, y, w, h);

        // Crenellation along the top.
        ctx.fillStyle = '#4c463e';
        const mw = Math.max(12, Math.round(w / 12));
        for (let mx = x + 2; mx < x + w - mw; mx += mw) {
            ctx.fillRect(mx + 2, y, mw - 4, 8);
        }

        // Horizontal grout rows.
        ctx.strokeStyle = P.towerLine;
        ctx.lineWidth = 2;
        const rowH = 22;
        for (let j = y + rowH; j < y + h; j += rowH) {
            ctx.beginPath();
            ctx.moveTo(x, j);
            ctx.lineTo(x + w, j);
            ctx.stroke();
        }

        // Staggered brick joints.
        ctx.strokeStyle = 'rgba(40, 35, 30, 0.6)';
        let vy = y + 10;
        let vrow = 0;
        while (vy < y + h - rowH) {
            const off = (vrow % 2) * (mw / 2);
            for (let vx = x + off + 6; vx < x + w - 4; vx += mw) {
                ctx.beginPath();
                ctx.moveTo(vx, vy);
                ctx.lineTo(vx, vy + rowH - 6);
                ctx.stroke();
            }
            vy += rowH;
            vrow++;
        }

        // Window slits.
        ctx.fillStyle = '#1c1916';
        const wn = Math.max(2, Math.round(h / 90));
        for (let k = 0; k < wn; k++) {
            const wy0 = y + (k + 0.5) * (h / wn);
            const wx0 = x + 18 + hash2(seed, k) * (w - 44);
            ctx.fillRect(Math.round(wx0), Math.round(wy0), 8, 16);
        }

        // Door arch at the base center.
        const dw = 20;
        const dh = Math.min(h * 0.28, 64);
        const dx = x + w / 2 - dw / 2;
        const dy = y + h - dh;
        ctx.fillStyle = '#14110f';
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx, y + h);
        ctx.lineTo(dx + dw, y + h);
        ctx.lineTo(dx + dw, dy);
        ctx.arc(x + w / 2, dy, dw / 2, 0, Math.PI, true);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(20, 18, 16, 0.25)';
        ctx.fillRect(x, y, w, 3);
    }

    _drawEdgeRiff(ctx, x, y, o, seed) {
        const w = o.w;
        const h = o.h;
        ctx.fillStyle = P.edge;
        ctx.fillRect(x, y, w, h);

        ctx.fillStyle = P.edgeDark;
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y + 6);
        const pts = 8;
        const seg = w / pts;
        for (let i = 1; i < pts; i++) {
            ctx.lineTo(x + i * seg, y + 6 + hash2(seed, i) * 8);
        }
        ctx.lineTo(x + w, y + 6);
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = P.hazard;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 1, y + 3);
        for (let i = 1; i < pts; i++) {
            ctx.lineTo(x + i * seg, y + 3 + hash2(seed + 7, i) * 6);
        }
        ctx.lineTo(x + w - 1, y + 3);
        ctx.stroke();
    }

    // ═══════════════════════ LEGACY PIPELINE (cave/castle) ═══════════════════════

    _generateTerrain(map) {
        const rows = Math.ceil(map.height / map.tileSize);
        const cols = Math.ceil(map.width / map.tileSize);
        for (let r = 0; r < rows; r++) {
            this.tiles[r] = [];
            for (let c = 0; c < cols; c++) {
                const wx = c * map.tileSize + map.tileSize / 2;
                const wy = r * map.tileSize + map.tileSize / 2;
                const tile = this._terrainTileAt(map, wx, wy);
                this.tiles[r][c] = { type: tile.type, sub: tile.sub };
            }
        }
    }

    _terrainTileAt(map, wx, wy) {
        if (map.type === 'surface') {
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
        const val = hash2(Math.floor(wx / 64), Math.floor(wy / 64));
        if (map.type === 'cave') {
            if (val > 0.92) return { type: 'cave-dark' };
            if (val > 0.84) return { type: 'cave-glow' };
            if (val > 0.60) return { type: 'cave-mid' };
            return { type: 'cave-floor' };
        }
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
        if (this.map.type === 'sprite-cavern') {
            this._renderSpriteCavern(ctx, camera);
        } else if (this.map.type === 'surface') {
            this._renderSurface(ctx, camera);
        } else {
            this._renderLegacy(ctx, camera);
        }
    }

    /**
     * Sprite-cavern pipeline: pure black viewport + the whole map PNG
     * drawn once at world origin (1:1, pixel-snapped, no smoothing, no
     * stretch, no repetition). Camera scrolls by shifting the draw
     * origin. Floor-level decorations (back then front) are painted
     * directly on top of the base sprite; entities, bullets and the HUD
     * are drawn by the engine on top.
     */
    _renderSpriteCavern(ctx, camera) {
        const viewW = camera.viewportWidth;
        const viewH = camera.viewportHeight;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, viewW, viewH);

        const img = this.cavernSprites.get(this.mapId);
        if (!img) return; // still loading / failed: keep black

        const offset = camera.getRenderOffset();
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(offset.x), Math.round(offset.y));
        ctx.imageSmoothingEnabled = prevSmoothing;

        // Floor-level decorations drawn on the base sprite.
        // 'back' items first (integrated into the wall), then 'front'
        // items (skulls, arms, plants clearly on top of the floor).
        this._drawDecorations(ctx, offset, 'back');
        this._drawDecorations(ctx, offset, 'front');
    }

    _renderLegacy(ctx, camera) {
        const offset = camera.getRenderOffset();
        const tile = this.map.tileSize;
        const viewW = camera.viewportWidth;
        const viewH = camera.viewportHeight;

        const minCol = Math.max(0, Math.floor(-offset.x / tile));
        const maxCol = Math.min(this.cols - 1, Math.ceil((viewW - offset.x) / tile));
        const minRow = Math.max(0, Math.floor(-offset.y / tile));
        const maxRow = Math.min(this.rows - 1, Math.ceil((viewH - offset.y) / tile));

        // Cave/castle procedural terrain (surface and sprite-cavern maps never
        // reach this path — see setMap/render).
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const sx = Math.round(c * tile + offset.x);
                const sy = Math.round(r * tile + offset.y);
                this._drawTile(ctx, sx, sy, this.tiles[r][c]);
            }
        }

        // Layer order: terrain → [back decor] → [obstacles] → [structures] → [front decor].
        this._drawLandingPad(ctx, offset);
        this._drawDecorations(ctx, offset, 'back');
        this._drawObstacles(ctx, offset);
        this._drawStructures(ctx, offset);
        this._drawDecorations(ctx, offset, 'front');
        this._drawExits(ctx, offset);
    }

    _renderSurface(ctx, camera) {
        const offset = camera.getRenderOffset();
        const viewW = camera.viewportWidth;
        const viewH = camera.viewportHeight;

        // ── culling on the visual (RENDER_TILE) grid ──
        const renderCols = Math.ceil(this.map.width / RENDER_TILE);
        const renderRows = Math.ceil(this.map.height / RENDER_TILE);
        const minTC = Math.max(0, Math.floor(-offset.x / RENDER_TILE));
        const maxTC = Math.min(renderCols - 1, Math.ceil((viewW - offset.x) / RENDER_TILE));
        const minTR = Math.max(0, Math.floor(-offset.y / RENDER_TILE));
        const maxTR = Math.min(renderRows - 1, Math.ceil((viewH - offset.y) / RENDER_TILE));

        // LAYER 1 — ground micro-tiles. The photo pattern is baked brightened ONCE
        // in _ensureMapSurfacePattern, so there is no per-frame ctx.filter.
        // The pattern fill is kept world-anchored (single rect aligned to the
        // world grid) so the texture scrolls WITH the world instead of sliding
        // with the camera while the player walks.
        const groundPattern = this._ensureMapSurfacePattern(ctx);
        if (groundPattern) {
            // World-anchored pattern fill: translate pattern by camera offset
            // so texture is pinned to world (0,0) and stays completely fixed
            // in place when the player moves and camera scrolls.
            if (typeof DOMMatrix !== 'undefined') {
                groundPattern.setTransform(
                    new DOMMatrix()
                        .translate(Math.round(offset.x), Math.round(offset.y))
                        .scale(MAP_SURFACE_PATTERN_SCALE)
                );
            }
            ctx.fillStyle = groundPattern;
            ctx.fillRect(Math.round(offset.x), Math.round(offset.y), Math.round(this.map.width), Math.round(this.map.height));
        }
        for (let r = minTR; r <= maxTR; r++) {
            for (let c = minTC; c <= maxTC; c++) {
                const wx = renderTileToWorld(c);
                const wy = renderTileToWorld(r);
                const sx = Math.round(wx + offset.x);
                const sy = Math.round(wy + offset.y);
                this._drawSurfaceGroundCell(ctx, sx, sy, wx, wy);
            }
        }

        // LAYER 1b — macro terrain features on the LOGICAL_TILE grid
        // (iron clusters, dunes, platform bolts).
        const minLC = Math.max(0, Math.floor(-offset.x / LOGICAL_TILE));
        const maxLC = Math.min(this.cols - 1, Math.ceil((viewW - offset.x) / LOGICAL_TILE));
        const minLR = Math.max(0, Math.floor(-offset.y / LOGICAL_TILE));
        const maxLR = Math.min(this.rows - 1, Math.ceil((viewH - offset.y) / LOGICAL_TILE));
        for (let lr = minLR; lr <= maxLR; lr++) {
            for (let lc = minLC; lc <= maxLC; lc++) {
                this._drawSurfaceFeature(ctx, offset, lc, lr);
            }
        }

        this._drawLandingPad(ctx, offset);

        // LAYER 2 — detail (pebbles, specks, cracks).
        this._drawSurfaceDetail(ctx, offset, minTC, maxTC, minTR, maxTR);

        // LAYER 3 — props (rocks, cave formation, castle sprite, edge riffs).
        this._drawSurfaceProps(ctx, offset, viewW, viewH);

        // Map transition markers on top.
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
            if (o.kind === 'undead-rock' || o.kind === 'undead-decor') {
                this._drawUndeadSprite(ctx, o, offset);
                continue;
            }
            this._drawBlock(ctx, sx, sy, o.w, o.h, o.kind);
        }
    }

    // Non-solid undead decorations (map.decorations) split into two paint
    // phases: 'back' right after the terrain, 'front' after the structures.
    // Props without a layer flag stay in the back phase (same as before).
    _drawDecorations(ctx, offset, layer) {
        for (const d of this.map.decorations || []) {
            if (layer === 'front' ? d.layer !== 'front' : d.layer === 'front') continue;
            if (d.kind === 'undead-decor-anim') {
                this._drawUndeadAnim(ctx, d, offset);
                continue;
            }
            this._drawUndeadSprite(ctx, d, offset);
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
        // The surface castle facade is drawn from castle-sprite.png; the old
        // procedural gate/lintel block was removed together with the `gate`
        // structure in content/maps.js. Only overlay structures remain.
        for (const s of this.map.structures || []) {
            if (s.type === 'crystal') {
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
            if (exit.area) continue; // door/corridor triggers use a rectangular overlap, not radial rings
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

        ctx.strokeStyle = P.accentOrange;
        ctx.lineWidth = 3;
        ctx.strokeRect(px - 160, py - 160, 320, 320);

        ctx.fillStyle = P.accentOrange;
        ctx.fillRect(px - 160, py - 160, 20, 20);
        ctx.fillRect(px + 140, py - 160, 20, 20);
        ctx.fillRect(px - 160, py + 140, 20, 20);
        ctx.fillRect(px + 140, py + 140, 20, 20);

        ctx.strokeStyle = P.accentCream;
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
        ctx.fillStyle = P.accentCream;
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

// Exposed for the smoke test / debug tooling (no gameplay impact).
export { LOGICAL_TILE, RENDER_TILE, tileAtlas };