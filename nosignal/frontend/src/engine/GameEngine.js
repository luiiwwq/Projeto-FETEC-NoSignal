/**
 * GameEngine.js
 * Core engine loop managing Canvas rendering, Camera, Player,
 * Projectiles, Input handling, and Sci-Fi Mars HUD.
 */

import { Camera } from './Camera.js';
import { MapRenderer } from './MapRenderer.js';
import { Player, PlayerState } from '../entities/Player.js';
import { CharacterActor, ActorRole } from '../entities/CharacterActor.js';
import { Golem, GOLEM_WAVE_SPAWNS, GOLEM_COLLIDER_HALF_W, GOLEM_COLLIDER_HALF_H, preloadGolemSprites } from '../entities/Golem.js';
import { AmongUsEasterEgg, preloadAmongUsSprites, AMONG_US_ELIGIBLE_MAPS, AMONG_US_INTERVAL_SECONDS, AMONG_US_TEST_HALF_W, AMONG_US_TEST_HALF_H, AMONG_US_MAX_ATTEMPTS, DEBUG_AMONG_US_EASTER_EGG } from '../entities/AmongUsEasterEgg.js';
import {
    SkeletonAxe,
    CATACOMBS_SKELETON_AXE_SPAWNS,
    SKELETON_COLLIDER_HALF_W,
    SKELETON_COLLIDER_HALF_H,
    preloadSkeletonAxeSprites,
} from '../entities/SkeletonAxe.js';
import {
    SkeletonSpearman,
    CATACOMBS_SKELETON_SPEARMAN_SPAWNS,
    SPEARMAN_COLLIDER_HALF_W,
    SPEARMAN_COLLIDER_HALF_H,
    preloadSkeletonSpearmanSprites,
} from '../entities/SkeletonSpearman.js';
import { gameState } from '../state/gameState.js';
import { MAPS, MAP_IDS } from '../content/maps.js';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../content/characters.js';
import { CHARACTER_ALLY_SHOP_POSITION, CHARACTER_ENEMY_SPAWNS, resolveCharacterRoles } from '../content/characterRoles.js';
import { resolveSlide, pointInCircle, rectsOverlap } from '../systems/collisionSystem.js';
import { DayNightSystem, DAY_NIGHT_PERIOD, SPAWN_WAVE_EVERY_SECOND_NIGHT, formatDayNightTime } from '../systems/dayNightSystem.js';
import { openPauseMenu, closePauseMenu, isPauseMenuOpen, destroyPauseMenu } from '../ui/pauseMenu.js';
import { openCaveChoiceScreen, closeCaveChoiceScreen, isCaveChoiceOpen } from '../ui/caveChoiceScreen.js';
import { playClickButtonSound } from '../audio/uiClickSound.js';
import { loadSettings } from '../state/stateStorage.js';

const DAY_NIGHT_ICON_PATH = {
    [DAY_NIGHT_PERIOD.DAY]: './src/assets/sprites/Night_Day_System/sun_sprite.png',
    [DAY_NIGHT_PERIOD.NIGHT]: './src/assets/sprites/Night_Day_System/moon_sprite.png'
};

const MAP_LABELS = {
    [MAP_IDS.MARS_SURFACE]: 'SUPERFICIE DE MARTE',
    [MAP_IDS.MARS_CAVE]: 'CAVERNA DE MARTE',
    [MAP_IDS.MARS_CORE]: 'NUCLEO DE MARTE',
    [MAP_IDS.MARS_CATACOMBS]: 'CATACUMBAS MARCIANAS',
    [MAP_IDS.CASTLE_PRINCIPAL_ROOM]: 'SALA PRINCIPAL',
    [MAP_IDS.CASTLE_KING_ROOM]: 'SALA DO REI',
};

// Collision debug overlay for the sprite-castle rooms. When ON it paints the
// room's real collision data on top of the art: red = solid obstacles, blue =
// door interaction areas, bright green = spawn points, yellow = player body.
// Flip to `true` only while reviewing the castle maps; commit as `false`.
const SHOW_CASTLE_COLLISION_DEBUG = false;

// Temporary debug overlay for the Catacombs skeletons (Skeleton_Axe +
// Skeleton_Spearman). When ON it paints each spawn point (with id, local
// coordinates and current map) plus every skeleton's collider box over the
// map art. Flip to `true` only while reviewing the spawns; commit as `false`.
const DEBUG_CATACOMBS_SKELETONS = false;

// Excavate each freeMoveZone out of an obstacle, splitting it into the
// remaining pieces, so the band becomes a real collision-free corridor
// instead of a collision bypass (no penetration -> no resolveSlide teleport).
function subtractZoneFromObstacles(list, zx, zy, zw, zh) {
    const out = [];
    for (const o of list) {
        const ix = Math.max(o.x, zx);
        const iw = Math.min(o.x + o.w, zx + zw) - ix;
        const iy = Math.max(o.y, zy);
        const ih = Math.min(o.y + o.h, zy + zh) - iy;
        if (iw <= 0 || ih <= 0) {
            out.push(o);
            continue;
        }
        if (o.y < iy) out.push({ x: o.x, y: o.y, w: o.w, h: iy - o.y });
        if (o.y + o.h > iy + ih) out.push({ x: o.x, y: iy + ih, w: o.w, h: o.y + o.h - (iy + ih) });
        if (o.x < ix) out.push({ x: o.x, y: iy, w: ix - o.x, h: ih });
        if (o.x + o.w > ix + iw) out.push({ x: ix + iw, y: iy, w: o.x + o.w - (ix + iw), h: ih });
    }
    return out;
}

function buildCollisionObstacles(map, halfW, halfH) {
    let list = map.obstacles;
    for (const z of map.freeMoveZones || []) {
        list = subtractZoneFromObstacles(list, z.x, z.y - halfH, z.w, z.h + halfH * 2);
    }
    return list;
}

export class GameEngine {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        this.width = 1280;
        this.height = 720;

        this.isRunning = false;
        this.lastTime = 0;
        this.animationFrameId = null;
        this.paused = false;

        // Subsystems
        this.camera = new Camera(this.width, this.height);
        this.mapRenderer = new MapRenderer();
        this.player = null;
        this.bullets = [];
        this.particles = [];

        // Non-player characters (ally/enemy) derived from the selected character
        this.actors = [];
        this.characterRoles = { ally: null, enemy: null };

        // Among Us easter egg (estado do loop entre aparições)
        this.amongUsTimer = 0;
        this.amongUsEasterEgg = null;

        // Golem wave + day/night cycle
        this.golems = [];
        this.skeletons = [];
        this.dayNight = new DayNightSystem();
        this._golemWavePendingNight = 0; // night that must still be paid out
        this._lastGolemWaveNight = 0;    // guard against a double spawn
        this._golemWaveCount = 0;
        this._nightBannerTimer = 0;
        this._nightBannerText = '';
        this._nightFlashTimer = 0;
        this._nightBlend = 0; // 0 = full day, 1 = full night tint
        this._dayNightIcons = { cached: new Map(), requested: false };

        // Map state
        this.currentMapId = MAP_IDS.MARS_SURFACE;
        this.currentMap = MAPS[this.currentMapId];
        this.mapTransitionCooldown = 0;
        this.interactableExit = null;
        this.promptText = '';

        // Input state
        this.input = {
            keys: {},
            mouseX: this.width / 2,
            mouseY: this.height / 2,
            mouseLeft: false,
            mouseRight: false
        };

        // Bound listeners for cleanup
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
        this._onContextMenu = (e) => e.preventDefault();
        this._onFullscreenChange = () => {
            if (!this.isRunning) return;
            if (document.fullscreenElement || document.webkitFullscreenElement) return;
            if (window.__noSignalKeepFullscreen) {
                const target = document.documentElement;
                if (target.requestFullscreen) {
                    try { target.requestFullscreen(); } catch (err) { /* ignora */ }
                } else if (target.webkitRequestFullscreen) {
                    try { target.webkitRequestFullscreen(); } catch (err) { /* ignora */ }
                }
            }
        };
        this._onResize = this._handleResize.bind(this);
    }

    init() {
        this.container.innerHTML = '';

        // Viewport Wrapper
        const viewport = document.createElement('div');
        viewport.className = 'game-viewport';
        viewport.style.position = 'relative';
        viewport.style.width = '100%';
        viewport.style.height = '100%';
        viewport.style.display = 'flex';
        viewport.style.justifyContent = 'center';
        viewport.style.alignItems = 'center';
        viewport.style.backgroundColor = '#05050b';
        viewport.style.overflow = 'hidden';

        // Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'game-canvas';
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.display = 'block';
        this.canvas.style.imageRendering = 'pixelated';
        this.canvas.style.cursor = 'crosshair';

        viewport.appendChild(this.canvas);
        this.container.appendChild(viewport);

        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // Aplica configurações persistidas (ex.: brilho ajustado na tela inicial)
        this._applyStoredSettings();

// Warm the golem + day/night sprite caches once for the whole session.
        preloadGolemSprites();
        preloadAmongUsSprites();
        preloadSkeletonAxeSprites();
        preloadSkeletonSpearmanSprites();
        this._loadDayNightIcons();

        // Initialize Player with state name
        const astronautName = gameState.playerName || 'ARES-1';
        this.player = new Player(0, 0, astronautName);
        gameState.activeEngine = this;
        gameState.currentScene = 'GAMEPLAY';

        // Load the starting map (Martian surface)
        this._loadMap(MAP_IDS.MARS_SURFACE, 'mars-start', true);

        // Bind events
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('resize', this._onResize);
        this.canvas.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('contextmenu', this._onContextMenu);
        document.addEventListener('fullscreenchange', this._onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);

        this._handleResize();
        this.start();
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this._gameLoop.bind(this));
    }

    stop() {
        this.isRunning = false;
        this.paused = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        destroyPauseMenu();
        closeCaveChoiceScreen();
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('fullscreenchange', this._onFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', this._onFullscreenChange);
    }

    _loadMap(mapId, spawnId) {
        const map = MAPS[mapId];
        if (!map) return;

        this.currentMapId = mapId;
        this.currentMap = map;
        this.mapRenderer.setMap(map);

        const spawn = map.spawnPoints[spawnId] && map.spawnPoints[spawnId].x !== undefined
            ? map.spawnPoints[spawnId]
            : map.spawn;

        this.player.setPosition(spawn.x, spawn.y);
        this.player.setCollisionResolver(
            this._buildCollisionResolver(map, this.player.colliderHalfW, this.player.colliderHalfH)
        );
        this.player.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });

        this.camera.setBounds(0, 0, map.width, map.height);
        this.camera.follow(this.player.x, this.player.y, true);

        this.bullets.length = 0;
        this.particles.length = 0;
        this.mapTransitionCooldown = 0.4;
        this.interactableExit = null;

        // (Re)create non-player characters for this map
        this._setupCharacterRoles(map);
        this.golems = [];

        // Troca de mapa / nova partida: easter egg some e cronômetro reinicia.
        this.amongUsEasterEgg = null;
        this.amongUsTimer = 0;
        this.skeletons = [];

        // The Catacombs have five fixed Skeleton_Axe spawns (plus five
        // Skeleton_Spearman standing beside them) in LOCAL map coordinates.
        // They are recreated on every load of the map and wiped together with
        // `actors` the moment the player leaves (see above), so they never leak
        // to the surface/castle and never duplicate.
        if (mapId === MAP_IDS.MARS_CATACOMBS) {
            this._spawnCatacombsSkeletons(map);
            this._spawnCatacombsSpearmen(map);
        }

        // A wave scheduled while the player was away is paid out as soon as
        // they set foot back on the allowed map (never lost, never doubled).
        if (mapId === MAP_IDS.MARS_SURFACE && this._golemWavePendingNight > 0) {
            this._spawnGolemWave(mapId, this._golemWavePendingNight);
        }

        gameState.currentMap = mapId;
    }

    /* ── Day / night cycle ──────────────────────────────── */
    _updateDayNight(dt) {
        const event = this.dayNight.update(dt);

        if (event && event.type === 'night-start') {
            this._nightBannerText = `NOITE ${event.nightCount}`;
            this._nightBannerTimer = 3.0;
            this._nightFlashTimer = 0.45;
            this._startNight();
        }

        if (this._nightBannerTimer > 0) this._nightBannerTimer -= dt;
        if (this._nightFlashTimer > 0) this._nightFlashTimer -= dt;

        const target = this.dayNight.period === DAY_NIGHT_PERIOD.NIGHT ? 1 : 0;
        const step = Math.min(1, dt / 1.2);
        this._nightBlend += (target - this._nightBlend) * step;

        gameState.dayNight = this.dayNight.getHudState();
        gameState.dayNight.waveCount = this._golemWaveCount;
    }

    _startNight() {
        if (SPAWN_WAVE_EVERY_SECOND_NIGHT && this.dayNight.nightCount % 2 === 0) {
            this._queueGolemWave(this.dayNight.nightCount);
        }
    }

    // Schedule the wave; spawn now if allowed, otherwise remember the night so
    // it is created when the player returns to the surface.
    _queueGolemWave(night) {
        if (night <= this._lastGolemWaveNight) return;
        if (this.currentMapId === MAP_IDS.MARS_SURFACE) {
            this._spawnGolemWave(MAP_IDS.MARS_SURFACE, night);
        } else {
            this._golemWavePendingNight = night;
        }
    }

    _spawnGolemWave(mapId, night) {
        const map = MAPS[mapId];
        if (!map) return 0;

        // Waves on night 4, 8, 12 … are buffed: each 4th night adds one tier
        // (+15% speed / +70% HP / +15% damage per tier, handled by Golem).
        const buffTier = night % 4 === 0 ? night / 4 : 0;

        const positions = [
            ...GOLEM_WAVE_SPAWNS.bottom,
            ...GOLEM_WAVE_SPAWNS.top,
            ...GOLEM_WAVE_SPAWNS.front
        ];

        let spawned = 0;
        for (const pos of positions) {
            const free = this._findFreeGolemSpawn(map, pos.x, pos.y);
            if (!free) continue;

            const golem = new Golem(free.x, free.y, buffTier);
            golem.setCollisionResolver(
                this._buildCollisionResolver(map, golem.colliderHalfW, golem.colliderHalfH)
            );
            golem.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
            this.actors.push(golem);
            this.golems.push(golem);
            spawned += 1;
        }

        this._lastGolemWaveNight = night;
        this._golemWavePendingNight = 0;
        if (spawned > 0) this._golemWaveCount += 1;
        return spawned;
    }

    // Returns a free {x,y} for a golem box, nudging outward from the requested
    // spot when it overlaps an obstacle, the player or another actor.
    _findFreeGolemSpawn(map, x, y) {
        const hw = GOLEM_COLLIDER_HALF_W;
        const hh = GOLEM_COLLIDER_HALF_H;

        const isBlocked = (cx, cy) => {
            const rect = { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
            if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) {
                return true;
            }
            for (const o of map.obstacles) {
                if (rectsOverlap(o, rect)) return true;
            }
            const p = this.player;
            if (p && !p.isDead) {
                const pr = {
                    x: p.x - p.colliderHalfW,
                    y: p.y - p.colliderHalfH,
                    w: p.colliderHalfW * 2,
                    h: p.colliderHalfH * 2
                };
                if (rectsOverlap(pr, rect)) return true;
            }
            for (const actor of this.actors) {
                const ar = {
                    x: actor.x - actor.colliderHalfW,
                    y: actor.y - actor.colliderHalfH,
                    w: actor.colliderHalfW * 2,
                    h: actor.colliderHalfH * 2
                };
                if (rectsOverlap(ar, rect)) return true;
            }
            return false;
        };

        if (!isBlocked(x, y)) return { x, y };

        const step = 48;
        for (let radius = step; radius <= 480; radius += step) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                const cx = x + Math.cos(a) * radius;
                const cy = y + Math.sin(a) * radius;
                if (!isBlocked(cx, cy)) return { x: Math.round(cx), y: Math.round(cy) };
            }
        }
        return null;
    }

    /**
     * Spawn the five fixed Skeleton_Axe of the Catacombs. `spawn.x/spawn.y`
     * are LOCAL map coordinates (feet position, bottom-center anchor) — never
     * world/surface coordinates. Every spawn is validated before the entity is
     * created: inside the map bounds, on a walkable mask cell, with a collider
     * free of obstacles/edges/exits/player/other actors. If a spot fails the
     * walkability checks, the closest free floor cell is used instead (small
     * local adjustment, never a silent move to another map).
     */
    _spawnCatacombsSkeletons(map) {
        this._spawnCatacombsSkeletonGroup(map, {
            spawns: CATACOMBS_SKELETON_AXE_SPAWNS,
            ctor: SkeletonAxe,
            hw: SKELETON_COLLIDER_HALF_W,
            hh: SKELETON_COLLIDER_HALF_H,
            label: 'Skeleton_Axe',
        });
    }

    /** Spawn the five Skeleton_Spearman, one beside each axe skeleton. */
    _spawnCatacombsSpearmen(map) {
        this._spawnCatacombsSkeletonGroup(map, {
            spawns: CATACOMBS_SKELETON_SPEARMAN_SPAWNS,
            ctor: SkeletonSpearman,
            hw: SPEARMAN_COLLIDER_HALF_W,
            hh: SPEARMAN_COLLIDER_HALF_H,
            label: 'Skeleton_Spearman',
        });
    }

    /**
     * Respawn instantâneo: remove todos os esqueletos atuais (vivos, mortos ou
     * em remoção) e recria cada um exatamente no posto de origem com vida cheia.
     * Só faz sentido nas Catacumbas; fora delas não há esqueletos para resetar.
     */
    _resetCatacombsSkeletons() {
        const removed = this.skeletons;
        this.skeletons = [];
        this.actors = this.actors.filter((a) => !removed.includes(a));
        if (this.currentMapId === MAP_IDS.MARS_CATACOMBS) {
            this._spawnCatacombsSkeletons(this.currentMap);
            this._spawnCatacombsSpearmen(this.currentMap);
        }
    }

    /** Shared spawn/validation/backfill used by both catacombs skeleton types. */
    _spawnCatacombsSkeletonGroup(map, { spawns, ctor, hw, hh, label }) {
        const mask = map.terrainMask;
        const cell = map.maskCell || 32;

        for (const spawn of spawns) {
            // 1) Range check — these are LOCAL catacombs coordinates.
            if (
                spawn.x < 0 ||
                spawn.y < 0 ||
                spawn.x > map.width ||
                spawn.y > map.height
            ) {
                throw new Error(`Spawn inválido: ${spawn.id} (fora dos limites das Catacumbas)`);
            }

            // 2) Feet must sit on a walkable mask cell ('.' = piso caminhável).
            const col = Math.floor(spawn.x / cell);
            const row = Math.floor(spawn.y / cell);
            const walkable =
                mask && mask[row] && mask[row][col] === '.';

            // 3) Collider must be free of obstacles, edges, exits, player and
            //    other actors.
            const feetY = spawn.y; // y dos pés
            const centerY = feetY - hh; // collider centre (feet = base)
            let px = spawn.x;
            let py = centerY;
            if (!walkable || !this._skeletonBoxIsFree(map, mask, cell, px, py, hw, hh)) {
                const adj = this._findNearestFreeSkeletonSpot(map, mask, cell, spawn.x, feetY, hw, hh);
                if (!adj) {
                    console.error(`[Catacombas] spawn ${label} inválido e sem piso livre: ${spawn.id} (${spawn.x},${spawn.y}) — ignorado.`);
                    continue;
                }
                console.warn(
                    `[Catacombas] spawn ${label} ${spawn.id} em ${spawn.x},${spawn.y} não era piso caminhável; ajuste local para ${adj.x},${adj.y}.`
                );
                px = adj.x;
                py = adj.y - hh;
            }

            const skeleton = new ctor(px, py, { id: spawn.id });
            skeleton.setCollisionResolver(
                this._buildCollisionResolver(map, skeleton.colliderHalfW, skeleton.colliderHalfH)
            );
            skeleton.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
            this.actors.push(skeleton);
            this.skeletons.push(skeleton);
        }
    }

    // True when a skeleton collider centred at (cx, cy) does not touch an
    // obstacle, a map edge, an exit area, the player or any existing actor.
    _skeletonBoxIsFree(map, mask, cell, cx, cy, hw = SKELETON_COLLIDER_HALF_W, hh = SKELETON_COLLIDER_HALF_H) {
        const box = { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };

        if (box.x < 0 || box.y < 0 || box.x + box.w > map.width || box.y + box.h > map.height) {
            return false;
        }

        // Every cell covered by the collider must be walkable floor.
        if (mask) {
            const c0 = Math.floor(box.x / cell);
            const c1 = Math.floor((box.x + box.w - 1) / cell);
            const r0 = Math.floor(box.y / cell);
            const r1 = Math.floor((box.y + box.h - 1) / cell);
            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    if (!mask[r] || mask[r][c] !== '.') return false;
                }
            }
        }

        for (const o of map.obstacles) {
            if (rectsOverlap(o, box)) return false;
        }

        for (const exit of map.exits || []) {
            const area = exit.area
                ? exit.area
                : { x: exit.x - (exit.radius || 0), y: exit.y - (exit.radius || 0), w: (exit.radius || 0) * 2, h: (exit.radius || 0) * 2 };
            if (rectsOverlap(area, box)) return false;
        }

        const p = this.player;
        if (p && !p.isDead) {
            const pr = { x: p.x - p.colliderHalfW, y: p.y - p.colliderHalfH, w: p.colliderHalfW * 2, h: p.colliderHalfH * 2 };
            if (rectsOverlap(pr, box)) return false;
        }

        for (const actor of this.actors) {
            if (actor.isDead) continue;
            const ar = { x: actor.x - actor.colliderHalfW, y: actor.y - actor.colliderHalfH, w: actor.colliderHalfW * 2, h: actor.colliderHalfH * 2 };
            if (rectsOverlap(ar, box)) return false;
        }

        return true;
    }

    // Ring search (up to 3 cells out) for the closest walkable floor cell
    // around a requested catacombs feet position. Returns the cell centre
    // (feet position) or null when nothing fits.
    _findNearestFreeSkeletonSpot(map, mask, cell, targetX, targetY, hw = SKELETON_COLLIDER_HALF_W, hh = SKELETON_COLLIDER_HALF_H) {
        if (!mask) return null;
        const rows = mask.length;
        const cols = mask[0] && mask[0].length;
        if (!cols) return null;
        const centerCol = Math.floor(targetX / cell);
        const centerRow = Math.floor(targetY / cell);

        let best = null;
        const maxRadius = 3;
        for (let radius = 0; radius <= maxRadius; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                    const r = centerRow + dr;
                    const c = centerCol + dc;
                    if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
                    if (mask[r][c] !== '.') continue;

                    const feetX = c * cell + cell / 2;
                    const feetY = r * cell + cell / 2;
                    if (!this._skeletonBoxIsFree(map, mask, cell, feetX, feetY - hh, hw, hh)) continue;

                    const dist = Math.hypot(feetX - targetX, feetY - targetY);
                    if (!best || dist < best.dist) best = { x: feetX, y: feetY, dist };
                }
            }
            if (best) break;
        }
        return best;
    }

    _loadDayNightIcons() {
        if (this._dayNightIcons.requested || typeof Image === 'undefined') return;
        this._dayNightIcons.requested = true;
        for (const period of Object.keys(DAY_NIGHT_ICON_PATH)) {
            const img = new Image();
            img.src = DAY_NIGHT_ICON_PATH[period];
            this._dayNightIcons.cached.set(period, img);
        }
    }

    _buildCollisionResolver(map, halfW, halfH) {
        const obstacles = buildCollisionObstacles(map, halfW, halfH);
        return (px, py, dx, dy) => resolveSlide(
            px, py, halfW, halfH, dx, dy, obstacles,
            { minX: 0, minY: 0, maxX: map.width, maxY: map.height }
        );
    }

    /**
     * Derive the ally/enemy characters from the selection and (re)spawn them.
     * The ally only appears on the surface; the enemy only spawns once a
     * position is configured in CHARACTER_ENEMY_SPAWNS.
     */
    _setupCharacterRoles(map) {
        this.actors = [];

        const selectedId = CHARACTERS[gameState.selectedCharacter]
            ? gameState.selectedCharacter
            : DEFAULT_CHARACTER_ID;
        const roles = resolveCharacterRoles(selectedId);
        this.characterRoles = roles;
        gameState.characterRoles = roles;

        if (map.id === MAP_IDS.MARS_SURFACE && roles.ally) {
            const ally = new CharacterActor({
                x: CHARACTER_ALLY_SHOP_POSITION.x,
                y: CHARACTER_ALLY_SHOP_POSITION.y,
                characterId: roles.ally,
                team: 'ally',
                role: ActorRole.ALLY
            });
            ally.setCollisionResolver(this._buildCollisionResolver(map, ally.colliderHalfW, ally.colliderHalfH));
            ally.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
            this.actors.push(ally);
        }

        if (map.id === MAP_IDS.MARS_SURFACE && roles.enemy) {
            const spawn = CHARACTER_ENEMY_SPAWNS[roles.enemy];
            if (spawn) {
                const enemy = new CharacterActor({
                    x: spawn.x,
                    y: spawn.y,
                    characterId: roles.enemy,
                    team: 'enemy',
                    role: ActorRole.ENEMY
                });
                enemy.setCollisionResolver(this._buildCollisionResolver(map, enemy.colliderHalfW, enemy.colliderHalfH));
                enemy.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
                this.actors.push(enemy);
            }
        }
    }

    changeMap(targetMapId, spawnId) {
        this._loadMap(targetMapId, spawnId);
    }

    /* ── Among Us easter egg ─────────────────────────────── */
    _updateAmongUs(dt) {
        // Uma instância por vez: anima e descarta quando o loop acaba.
        if (this.amongUsEasterEgg) {
            this.amongUsEasterEgg.update(dt);
            if (this.amongUsEasterEgg.shouldRemove) {
                this.amongUsEasterEgg = null;
            }
        }

        // O cronômetro só conta em gameplay, dentro de um mapa elegível.
        if (!AMONG_US_ELIGIBLE_MAPS.has(this.currentMapId)) return;
        if (this.player.isDead) return;

        this.amongUsTimer += dt;
        const interval = DEBUG_AMONG_US_EASTER_EGG ? 5 : AMONG_US_INTERVAL_SECONDS;
        if (this.amongUsEasterEgg || this.amongUsTimer < interval) return;

        this.amongUsTimer = 0;
        this._spawnAmongUs();
    }

    _spawnAmongUs() {
        const spot = this._findAmongUsSpot(this.currentMap);
        if (!spot) {
            if (DEBUG_AMONG_US_EASTER_EGG) {
                console.warn(`[AmongUs] nenhuma posição válida em ${this.currentMapId}`);
            }
            return;
        }
        this._placeAmongUs(spot);
    }

    // Spawn secreto (Ctrl+Shift+1+F): faz o impostor surgir pouquíssimos passos
    // à frente do jogador, na direção que ele está olhando.
    _spawnAmongUsInFront() {
        const dist = 96;
        const v = this._facingOffset();
        const spot = this._nudgeAmongUsSpot(
            this.currentMap,
            this.player.x + v.x * dist,
            this.player.y + v.y * dist
        );
        if (!spot) {
            if (DEBUG_AMONG_US_EASTER_EGG) {
                console.warn('[AmongUs] sem posição válida na frente do jogador');
            }
            return;
        }
        this.amongUsTimer = 0;
        this._placeAmongUs(spot);
        if (DEBUG_AMONG_US_EASTER_EGG) {
            console.info(`[AmongUs] spawn secreto na frente em (${spot.x}, ${spot.y})`);
        }
    }

    _placeAmongUs(spot) {
        this.amongUsEasterEgg = new AmongUsEasterEgg(spot.x, spot.y, this.currentMapId);
        if (DEBUG_AMONG_US_EASTER_EGG) {
            console.info(`[AmongUs] easter egg na posição (${spot.x}, ${spot.y}) de ${this.currentMapId}`);
        }
    }

    // Vetor unitário da direção do jogador (direções de 8 pontos do Player).
    _facingOffset() {
        const vectors = {
            south: { x: 0, y: 1 },
            'south-east': { x: 0.7071, y: 0.7071 },
            east: { x: 1, y: 0 },
            'north-east': { x: 0.7071, y: -0.7071 },
            north: { x: 0, y: -1 },
            'north-west': { x: -0.7071, y: -0.7071 },
            west: { x: -1, y: 0 },
            'south-west': { x: -0.7071, y: 0.7071 }
        };
        return vectors[this.player.direction] || { x: 0, y: 1 };
    }

    // Uma posição está livre quando a caixa de teste (TEST_HALF_W/H) não encosta
    // em nada: fora dos limites, obstáculos, área preta/máscara, portas, jogador
    // ou qualquer ator do mapa.
    _amongUsIsBlocked(map, cx, cy) {
        const hw = AMONG_US_TEST_HALF_W;
        const hh = AMONG_US_TEST_HALF_H;
        const rect = { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
        if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) {
            return true;
        }
        for (const o of map.obstacles) {
            if (rectsOverlap(o, rect)) return true;
        }
        for (const exit of map.exits || []) {
            if (exit.area && rectsOverlap(exit.area, rect)) return true;
            if (!exit.area && exit.x !== undefined) {
                const r = exit.radius ?? 48;
                const dx = cx - exit.x;
                const dy = cy - exit.y;
                if (dx * dx + dy * dy <= (r + hw) * (r + hw)) return true;
            }
        }
        const p = this.player;
        if (p && !p.isDead) {
            const pr = {
                x: p.x - p.colliderHalfW,
                y: p.y - p.colliderHalfH,
                w: p.colliderHalfW * 2,
                h: p.colliderHalfH * 2
            };
            if (rectsOverlap(pr, rect)) return true;
        }
        for (const actor of this.actors) {
            const ar = {
                x: actor.x - actor.colliderHalfW,
                y: actor.y - actor.colliderHalfH,
                w: actor.colliderHalfW * 2,
                h: actor.colliderHalfH * 2
            };
            if (rectsOverlap(ar, rect)) return true;
        }
        return false;
    }

    // Procurou uma posição aleatória válida no mapa: livre de obstáculos,
    // área preta (via obstacles/terrainMask), portas, do jogador e dos atores.
    _findAmongUsSpot(map) {
        const hw = AMONG_US_TEST_HALF_W;
        const hh = AMONG_US_TEST_HALF_H;
        const mask = map.terrainMask;
        const cell = map.maskCell;
        for (let attempt = 0; attempt < AMONG_US_MAX_ATTEMPTS; attempt++) {
            let cx, cy;
            if (mask && mask.length) {
                // Cavernas por sprite: a âncora cai no centro de uma célula '.' do chão.
                const cols = mask[0].length;
                const r = Math.floor(Math.random() * mask.length);
                const c = Math.floor(Math.random() * cols);
                if (mask[r][c] !== '.') continue;
                cx = c * cell + cell / 2;
                cy = r * cell + cell / 2;
            } else {
                cx = hw + Math.random() * (map.width - hw * 2);
                cy = hh + Math.random() * (map.height - hh * 2);
            }
            if (this._amongUsIsBlocked(map, cx, cy)) continue;
            return { x: Math.round(cx), y: Math.round(cy) };
        }
        return null;
    }

    // Espiral ao redor de um ponto preferido até achar uma posição livre.
    _nudgeAmongUsSpot(map, baseX, baseY) {
        if (!this._amongUsIsBlocked(map, baseX, baseY)) {
            return { x: Math.round(baseX), y: Math.round(baseY) };
        }
        const step = 40;
        for (let radius = step; radius <= 240; radius += step) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                const cx = baseX + Math.cos(a) * radius;
                const cy = baseY + Math.sin(a) * radius;
                if (this._amongUsIsBlocked(map, cx, cy)) continue;
                return { x: Math.round(cx), y: Math.round(cy) };
            }
        }
        return null;
    }

    _handleResize() {
        if (!this.canvas) return;
        const aspect = this.width / this.height;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let renderW = windowWidth;
        let renderH = windowWidth / aspect;

        if (renderH > windowHeight) {
            renderH = windowHeight;
            renderW = windowHeight * aspect;
        }

        this.canvas.style.width = `${Math.floor(renderW)}px`;
        this.canvas.style.height = `${Math.floor(renderH)}px`;
    }

    /**
     * Aplica as configurações persistidas (tela inicial/pausa) ao game loop.
     * O brilho ajusta o canvas; os volumes de áudio ficam disponíveis em
     * loadSettings() para quando o sistema de som for implementado.
     */
    _applyStoredSettings() {
        const settings = loadSettings();
        if (this.canvas) {
            this.canvas.style.filter = settings.brightness < 100
                ? `brightness(${(settings.brightness / 100).toFixed(2)})`
                : '';
        }
    }

    _handleKeyDown(e) {
        // Ignore key events while the user is typing in a form field
        const target = e.target;
        if (target instanceof HTMLElement && (
            target.matches('input, textarea, select') ||
            target.isContentEditable
        )) {
            return;
        }

        // ESC toggles the pause menu
        if (e.code === 'Escape') {
            e.preventDefault();
            // Impede que o navegador saia da tela cheia ao apertar ESC
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                window.__noSignalKeepFullscreen = true;
                e.preventDefault();
            }
            // Cave choice screen intercepts its own ESC while focused, but this
            // branch is a safety net (e.g. focus outside the overlay).
            if (isCaveChoiceOpen()) {
                closeCaveChoiceScreen();
                this.paused = false;
                return;
            }
            if (isPauseMenuOpen()) {
                closePauseMenu();
                this.paused = false;
            } else {
                this.input.keys = {};
                this.paused = true;
                openPauseMenu(this.container, this);
            }
            return;
        }

        this.input.keys[e.code] = true;

        // While paused, gameplay/debug actions must not execute
        if (this.paused) return;

        // Map transition interaction ([E] on a doorway/portal)
        if (e.code === 'KeyE' && this.interactableExit && this.mapTransitionCooldown <= 0) {
            const exit = this.interactableExit;
            // Som de confirmação: toca SOMENTE quando E realmente ativa a
            // interação (porta/portal) — nunca ao entrar na área do prompt.
            playClickButtonSound();
            // The cave entrance opens the cave CHOICE screen instead of
            // transitioning directly; the map change happens only after the
            // player picks "Núcleo de Marte" or "Catacumbas Marcianas".
            if (exit.id === 'cave-entrance') {
                openCaveChoiceScreen(this.container, this, exit);
                return;
            }
            this.changeMap(exit.targetMap, exit.targetSpawn);
            return;
        }

        // Easter egg secreto: Ctrl+Shift+1+F faz o Among Us surgir na frente.
        // (Ctrl+1 puro é roubado pelo navegador, por isso o Shift.)
        const secretAmongUs = e.ctrlKey && e.shiftKey && (
            (e.code === 'Digit1' && this.input.keys['KeyF']) ||
            (e.code === 'KeyF' && this.input.keys['Digit1'])
        );
        if (secretAmongUs) {
            e.preventDefault();
            this._spawnAmongUsInFront();
            return;
        }

        // State-testing hotkeys
        // (Ctrl+F é 'buscar' do navegador; com Ctrl segurado o F não troca de estado)
        if (e.code === 'KeyF' && !e.ctrlKey) {
            if (this.player.state === PlayerState.FLOATING) {
                this.player.setState(PlayerState.IDLE, true);
            } else {
                this.player.setState(PlayerState.FLOATING, true);
            }
        } else if (e.code === 'KeyP') {
            if (this.player.state === PlayerState.PUSH_PULL) {
                this.player.setState(PlayerState.IDLE, true);
            } else {
                this.player.setState(PlayerState.PUSH_PULL, true);
            }
        } else if (e.code === 'KeyR') {
            const spawn = this.currentMap.spawn;
            this.player.respawn(spawn.x, spawn.y);
            this.camera.follow(spawn.x, spawn.y, true);
            this._resetCatacombsSkeletons();
        }
    }

    _handleKeyUp(e) {
        this.input.keys[e.code] = false;
    }

    _handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;

        this.input.mouseX = (e.clientX - rect.left) * scaleX;
        this.input.mouseY = (e.clientY - rect.top) * scaleY;
    }

    _handleMouseDown(e) {
        if (e.button === 0) {
            this.input.mouseLeft = true;
        } else if (e.button === 2) {
            this.input.mouseRight = true;
        }
    }

    _handleMouseUp(e) {
        if (e.button === 0) {
            this.input.mouseLeft = false;
        } else if (e.button === 2) {
            this.input.mouseRight = false;
        }
    }

    addBullet(bullet) {
        this.bullets.push(bullet);
    }

    // Team damage rules:
    //  - player bullets hit enemies only
    //  - enemy bullets hit the player only (the ally is immune)
    //  - ally bullets hit enemies only
    //  - an entity is never damaged by its own projectile
    _bulletCanDamage(bullet, targetTeam, target) {
        if (target === bullet.owner) return false;
        const attackerTeam = bullet.team || 'player';
        if (targetTeam === attackerTeam) return false;
        if (attackerTeam === 'player') return targetTeam === 'enemy';
        if (attackerTeam === 'enemy') return targetTeam === 'player';
        if (attackerTeam === 'ally') return targetTeam === 'enemy';
        return false;
    }

    _spawnHitSparks(x, y) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 120;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.35 + Math.random() * 0.25,
                color: Math.random() > 0.5 ? '#ff4d15' : '#f6c885',
                size: Math.random() > 0.5 ? 3 : 2
            });
        }
    }

    _gameLoop(timestamp) {
        if (!this.isRunning) return;

        // If the pause menu was closed by clicking the backdrop, resume.
        if (this.paused && !isPauseMenuOpen() && !isCaveChoiceOpen()) {
            this.paused = false;
        }

        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Cap dt to prevent frame skipping glitch
        if (dt > 0.1) dt = 0.1;

        // Paused: freeze gameplay, keep the last rendered frame on screen
        if (this.paused) {
            this.animationFrameId = requestAnimationFrame(this._gameLoop.bind(this));
            return;
        }

        try {
            this.update(dt);
            this.render();
        } catch (err) {
            // A single bad frame must never freeze the game for good: log the
            // error and keep the loop alive instead of dropping the rAF.
            console.error('[GameEngine] erro no frame:', err);
        }

        this.animationFrameId = requestAnimationFrame(this._gameLoop.bind(this));
    }

    update(dt) {
        // Advance the day/night clock first so a wave spawned on a night
        // transition is simulated in the same frame.
        this._updateDayNight(dt);

        // Among Us easter egg: só anima/spawna em gameplay, dentro de mapas elegíveis.
        this._updateAmongUs(dt);

        // Update player input and logic
        this.player.handleInput(this.input, this.camera, this);
        this.player.update(dt);

        // Update non-player characters (allies idle, enemies pursue & fire,
        // golems pursue & melee)
        for (const actor of this.actors) {
            actor.updateAi(dt, this);
            actor.update(dt);
        }
        if (this.actors.some((a) => a.shouldRemove)) {
            this.actors = this.actors.filter((a) => !a.shouldRemove);
            this.golems = this.golems.filter((g) => !g.shouldRemove);
            this.skeletons = this.skeletons.filter((s) => !s.shouldRemove);
        }

        // Map transition interaction detection
        this.mapTransitionCooldown = Math.max(0, this.mapTransitionCooldown - dt);
        this.interactableExit = null;
        this.promptText = '';
        const playerRect = {
            x: this.player.x - this.player.colliderHalfW,
            y: this.player.y - this.player.colliderHalfH,
            w: this.player.colliderHalfW * 2,
            h: this.player.colliderHalfH * 2,
        };
        for (const exit of this.currentMap.exits || []) {
            const triggered = exit.area
                ? rectsOverlap(playerRect, exit.area)
                : pointInCircle(this.player.x, this.player.y, exit);
            if (triggered) {
                this.interactableExit = exit;
                this.promptText = exit.label;
                break;
            }
        }

        // Update Camera
        this.camera.follow(this.player.x, this.player.y);
        this.camera.update();

        // Update Map & Dust
        this.mapRenderer.update(dt);

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update(dt);
            if (!bullet.isAlive) {
                this._spawnHitSparks(bullet.x, bullet.y);
                this.bullets.splice(i, 1);
                continue;
            }

            const bRect = { x: bullet.x - 4, y: bullet.y - 4, w: 8, h: 8 };
            let consumed = false;

            // Bullets stop against solid obstacles (walls, rocks, towers)
            for (const o of this.currentMap.obstacles) {
                if (rectsOverlap(o, bRect)) {
                    consumed = true;
                    break;
                }
            }

            // Bullets damage valid targets based on team alignment
            if (!consumed) {
                for (const actor of this.actors) {
                    if (actor.isDead) continue;
                    const aRect = {
                        x: actor.x - actor.colliderHalfW,
                        y: actor.y - actor.colliderHalfH,
                        w: actor.colliderHalfW * 2,
                        h: actor.colliderHalfH * 2
                    };
                    if (rectsOverlap(aRect, bRect)) {
                        if (this._bulletCanDamage(bullet, actor.team, actor)) {
                            actor.takeDamage(bullet.damage, bullet.x, bullet.y);
                        }
                        consumed = true;
                        break;
                    }
                }
            }

            if (!consumed && !this.player.isDead) {
                const p = this.player;
                const pRect = {
                    x: p.x - p.colliderHalfW,
                    y: p.y - p.colliderHalfH,
                    w: p.colliderHalfW * 2,
                    h: p.colliderHalfH * 2
                };
                if (rectsOverlap(pRect, bRect)) {
                    if (this._bulletCanDamage(bullet, 'player', p)) {
                        p.takeDamage(bullet.damage, bullet.x, bullet.y);
                    }
                    consumed = true;
                }
            }

            if (consumed) {
                this._spawnHitSparks(bullet.x, bullet.y);
                this.bullets.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        // Clear canvas
        ctx.fillStyle = '#05050b';
        ctx.fillRect(0, 0, this.width, this.height);

        // 1. Render Martian Map and Terrain
        this.mapRenderer.render(ctx, this.camera);

        // 1.5 Castle collision debug overlay (red/blue/green/yellow, see above)
        this._renderCollisionDebug(ctx);

        // 1.7 Among Us easter egg (após mapa/deco, antes dos NPCs)
        if (this.amongUsEasterEgg) {
            this.amongUsEasterEgg.render(ctx, this.camera);
        }

        // 2. Render non-player characters (NPCs / enemies / skeletons)
        for (const actor of this.actors) {
            actor.render(ctx, this.camera);
        }

        // 2.5 Catacomb skeleton spawn debug overlay (ponto + collider + ids)
        this._renderSkeletonAxeDebug(ctx);

        // 3. Render Bullets
        for (const bullet of this.bullets) {
            bullet.render(ctx, this.camera);
        }

        // 4. Render Particles
        for (const p of this.particles) {
            const screen = this.camera.worldToScreen(p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(screen.x), Math.round(screen.y), p.size, p.size);
        }

        // 5. Render Player
        this.player.render(ctx, this.camera);

        // 6. Render Martian Dust Weather
        this.mapRenderer.renderAtmosphericDust(ctx, this.width, this.height);

        // 6.5 Night tint + transition flash (below the HUD so it stays readable)
        this._renderDayNightOverlay(ctx);

        // 7. Render Sci-Fi HUD
        this._renderHUD(ctx);

        // 7.5 Temporary "NOITE N" banner on top of everything
        this._renderNightBanner(ctx);

        // 8. Render Aim Crosshair
        this._renderCrosshair(ctx);

        // 9. Render Death Screen Overlay if dead
        if (this.player.state === PlayerState.DEAD) {
            this._renderDeathOverlay(ctx);
        }

        // 10. Render Map Transition Prompt ([E]) when near a doorway
        if (this.interactableExit && this.mapTransitionCooldown <= 0) {
            this._renderExitPrompt(ctx, this.interactableExit);
        }
    }

    _renderExitPrompt(ctx, exit) {
        // When the exit defines a rectangular trigger area, anchor the prompt
        // text at the center of that area (shifted slightly down) so it appears
        // right over the interaction zone — closer to the actual door. Exits
        // without an area keep the legacy position (centered above the exit).
        const promptX = exit.promptX !== undefined ? exit.promptX : (exit.area ? exit.area.x + exit.area.w / 2 : exit.x);
        const promptY = exit.promptY !== undefined ? exit.promptY : (exit.area ? exit.area.y + exit.area.h / 2 + 10 : exit.y - 70);
        const screen = this.camera.worldToScreen(promptX, promptY);
        const label = exit.label || 'ENTRAR';

        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const text = `[E] ${label}`;
        const textW = ctx.measureText(text).width;

        ctx.fillStyle = 'rgba(5, 5, 11, 0.85)';
        ctx.fillRect(screen.x - textW / 2 - 8, screen.y - 8, textW + 16, 16);
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x - textW / 2 - 8, screen.y - 8, textW + 16, 16);

        ctx.fillStyle = '#f6c885';
        ctx.fillText(text, screen.x, screen.y + 3);
        ctx.restore();
    }

    // Paints the collision geometry of the current map over the art, so the
    // sprite-castle rooms can be reviewed precisely against their drawing.
    _renderCollisionDebug(ctx) {
        if (!SHOW_CASTLE_COLLISION_DEBUG) return;
        if (!this.currentMap) return;
        const off = this.camera.getRenderOffset();

        // Solid obstacles (walls, pillars, blocked background) — red.
        ctx.fillStyle = 'rgba(255, 60, 60, 0.55)';
        for (const o of this.currentMap.obstacles || []) {
            ctx.fillRect(
                Math.round(o.x + off.x),
                Math.round(o.y + off.y),
                Math.round(o.w),
                Math.round(o.h)
            );
        }

        // Door / interaction areas — blue.
        ctx.fillStyle = 'rgba(60, 130, 255, 0.55)';
        for (const exit of this.currentMap.exits || []) {
            if (!exit.area) continue;
            ctx.fillRect(
                Math.round(exit.area.x + off.x),
                Math.round(exit.area.y + off.y),
                Math.round(exit.area.w),
                Math.round(exit.area.h)
            );
        }

        // Spawn points — bright green squares.
        ctx.fillStyle = '#00ff00';
        for (const s of Object.values(this.currentMap.spawnPoints || {})) {
            ctx.fillRect(Math.round(s.x + off.x - 6), Math.round(s.y + off.y - 6), 12, 12);
        }

        // Player collider box — yellow outline.
        const p = this.player;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            Math.round(p.x - p.colliderHalfW + off.x) + 0.5,
            Math.round(p.y - p.colliderHalfH + off.y) + 0.5,
            p.colliderHalfW * 2,
            p.colliderHalfH * 2
        );
    }

    // Debug overlay for the Catacombs Skeleton_Axe (see DEBUG_CATACOMBS_SKELETONS).
    // Paints each spawn point (axe in green, spearman in cyan) with its id,
    // local coordinates and current map, plus the collider box of every live
    // skeleton.
    _renderSkeletonAxeDebug(ctx) {
        if (!DEBUG_CATACOMBS_SKELETONS) return;
        if (this.currentMapId !== MAP_IDS.MARS_CATACOMBS) return;

        const off = this.camera.getRenderOffset();

        ctx.font = '8px "Press Start 2P", monospace';

        CATACOMBS_SKELETON_AXE_SPAWNS.forEach((spawn, i) => {
            const sx = Math.round(spawn.x + off.x);
            const sy = Math.round(spawn.y + off.y);

            // Spawn marker — bright green cross on the feet position.
            ctx.fillStyle = '#00ff66';
            ctx.fillRect(sx - 5, sy - 1, 10, 2);
            ctx.fillRect(sx - 1, sy - 5, 2, 10);

            // Text block — id, current map and LOCAL coordinates.
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00ff66';
            ctx.fillText(`Skeleton_Axe_${i + 1}`, sx, sy - 12);
            ctx.fillText(`MAP: ${this.currentMapId}`, sx, sy + 18);
            ctx.fillText(`LOCAL: ${spawn.x}, ${spawn.y}`, sx, sy + 28);
        });

        CATACOMBS_SKELETON_SPEARMAN_SPAWNS.forEach((spawn, i) => {
            const sx = Math.round(spawn.x + off.x);
            const sy = Math.round(spawn.y + off.y);

            ctx.fillStyle = '#00ccff';
            ctx.fillRect(sx - 5, sy - 1, 10, 2);
            ctx.fillRect(sx - 1, sy - 5, 2, 10);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#00ccff';
            ctx.fillText(`Skeleton_Spearman_${i + 1}`, sx, sy - 12);
            ctx.fillText(`MAP: ${this.currentMapId}`, sx, sy + 18);
            ctx.fillText(`LOCAL: ${spawn.x}, ${spawn.y}`, sx, sy + 28);
        });

        // Collider box of every live skeleton — yellow outline.
        for (const s of this.skeletons) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                Math.round(s.x - s.colliderHalfW + off.x) + 0.5,
                Math.round(s.y - s.colliderHalfH + off.y) + 0.5,
                s.colliderHalfW * 2,
                s.colliderHalfH * 2
            );
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(
                Math.round(s.x + off.x - 2),
                Math.round(s.y + off.y - 2),
                4,
                4
            );
        }
    }

    _renderHUD(ctx) {
        ctx.save();

        // TOP-LEFT: Astronaut Vital Telemetry Panel
        const hudX = 24;
        const hudY = 24;
        const panelW = 340;
        const panelH = 126;

        // Frame backing
        ctx.fillStyle = 'rgba(10, 8, 14, 0.85)';
        ctx.fillRect(hudX, hudY, panelW, panelH);
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 2;
        ctx.strokeRect(hudX + 0.5, hudY + 0.5, panelW - 1, panelH - 1);

        // HUD Bevel Accent
        ctx.fillStyle = '#e07228';
        ctx.fillRect(hudX, hudY, 12, 4);
        ctx.fillRect(hudX + panelW - 12, hudY, 12, 4);

        // Name & Mission Title
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.textAlign = 'left';
        ctx.fillText(`OPERADOR: ${this.player.name}`, hudX + 16, hudY + 26);

        // VITALIDADE Label (above the bar)
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#e07228';
        ctx.fillText('VITALIDADE', hudX + 16, hudY + 46);

        // HP Bar
        const barX = hudX + 16;
        const barY = hudY + 56;
        const barW = 200;
        const barH = 18;

        ctx.fillStyle = '#1f0d0b';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeStyle = '#8f3419';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // HP Bar Fill
        const hpPercent = Math.max(0, this.player.hp / this.player.maxHp);
        const fillW = Math.round((barW - 4) * hpPercent);
        if (fillW > 0) {
            ctx.fillStyle = hpPercent > 0.3 ? '#d85a22' : '#e62424';
            ctx.fillRect(barX + 2, barY + 2, fillW, barH - 4);
        }

        // HP Text — positioned to the right of bar, vertically centered
        ctx.fillStyle = '#f6c885';
        ctx.fillText(`${Math.round(this.player.hp)} / ${this.player.maxHp}`, barX + barW + 12, barY + 13);

        // Telemetry Subtext
        ctx.fillStyle = '#c5975b';
        const areaText = `AREA: ${MAP_LABELS[this.currentMapId] || this.currentMapId.toUpperCase()}`;
        const stateText = `ESTADO: ${this.player.state} | DIR: ${this.player.direction.toUpperCase()}`;
        ctx.fillText(areaText, hudX + 16, hudY + 98);
        ctx.fillText(stateText, hudX + 16, hudY + 116);

        // DAY / NIGHT INDICATOR — directly below the vitals panel so it never
        // covers the health bar
        this._renderDayNightIndicator(ctx, hudX, hudY + panelH + 10);

        // TOP-RIGHT: Coordinates & Telemetry
        const trX = this.width - 240;
        const trY = 24;
        ctx.fillStyle = 'rgba(10, 8, 14, 0.85)';
        ctx.fillRect(trX, trY, 216, 50);
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 2;
        ctx.strokeRect(trX + 0.5, trY + 0.5, 215, 49);

        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        const posX = Math.round(this.player.x);
        const posY = Math.round(this.player.y);
        ctx.fillText(`COORD X: ${posX.toString().padStart(5, '0')}`, trX + 14, trY + 20);
        ctx.fillText(`COORD Y: ${posY.toString().padStart(5, '0')}`, trX + 14, trY + 36);

        // BOTTOM: Sci-Fi Controls Reference Bar
        const barBottomY = this.height - 38;
        ctx.fillStyle = 'rgba(5, 5, 11, 0.85)';
        ctx.fillRect(0, barBottomY, this.width, 38);
        ctx.strokeStyle = '#4d1d15';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, barBottomY, this.width, 1);

        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.textAlign = 'center';
        ctx.fillText(
            '[WASD] Mover  [SHIFT] Correr  [L-CLICK] Atirar  [R-CLICK] Socar  [ESPAÇO] Pular  [ESC] Menu',
            this.width / 2,
            barBottomY + 23
        );

        ctx.restore();
    }

    _renderDayNightIndicator(ctx, x, y) {
        const w = 168;
        const h = 40;
        const isNight = this.dayNight.period === DAY_NIGHT_PERIOD.NIGHT;

        // Frame
        ctx.save();
        ctx.fillStyle = 'rgba(10, 8, 14, 0.85)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = isNight ? '#5f7fd8' : '#e07228';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

        // Icon (sun / moon), kept at its natural aspect ratio and pixelated
        const icon = this._dayNightIcons.cached.get(this.dayNight.period);
        const box = 26;
        const iconX = x + 12;
        const iconY = y + (h - box) / 2;
        if (icon && icon.complete && icon.naturalWidth > 0) {
            const ratio = icon.naturalWidth / icon.naturalHeight;
            const iw = Math.round(box * ratio);
            const ih = box;
            ctx.drawImage(icon, iconX + Math.round((box - iw) / 2), iconY, iw, ih);
        } else {
            ctx.fillStyle = isNight ? '#cdd6ff' : '#ffd46b';
            ctx.beginPath();
            ctx.arc(iconX + box / 2, iconY + box / 2, box / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Label + countdown MM:SS
        ctx.textAlign = 'left';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillStyle = isNight ? '#9fb4ff' : '#e07228';
        ctx.fillText(isNight ? `NOITE ${this.dayNight.nightCount}` : 'DIA', x + 48, y + 16);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.fillText(formatDayNightTime(this.dayNight.getRemainingSeconds()), x + 48, y + 33);
        ctx.restore();
    }

    _renderDayNightOverlay(ctx) {
        const alpha = 0.32 * this._nightBlend;
        if (alpha > 0.002) {
            ctx.save();
            ctx.fillStyle = `rgba(12, 16, 48, ${alpha.toFixed(3)})`;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
        }

        if (this._nightFlashTimer > 0) {
            const a = 0.20 * (this._nightFlashTimer / 0.45);
            ctx.save();
            ctx.fillStyle = `rgba(200, 220, 255, ${a.toFixed(3)})`;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
        }
    }

    _renderNightBanner(ctx) {
        if (this._nightBannerTimer <= 0) return;

        const t = this._nightBannerTimer;
        const alpha = Math.min(1, (3.0 - t) / 0.3, t / 0.6);
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.textAlign = 'center';

        const text = this._nightBannerText;
        ctx.font = '20px "Press Start 2P", monospace';
        const textW = ctx.measureText(text).width;

        ctx.fillStyle = 'rgba(5, 5, 18, 0.8)';
        ctx.fillRect(this.width / 2 - textW / 2 - 20, this.height / 2 - 70, textW + 40, 40);
        ctx.strokeStyle = '#5f7fd8';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.width / 2 - textW / 2 - 20, this.height / 2 - 70, textW + 40, 40);

        ctx.fillStyle = '#cdd6ff';
        ctx.fillText(text, this.width / 2, this.height / 2 - 40);
        ctx.restore();
    }

    _renderCrosshair(ctx) {
        const mx = this.input.mouseX;
        const my = this.input.mouseY;

        ctx.save();
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 1.5;

        // Crosshair Circle
        ctx.beginPath();
        ctx.arc(mx, my, 7, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshair ticks
        ctx.beginPath();
        ctx.moveTo(mx - 12, my);
        ctx.lineTo(mx - 3, my);
        ctx.moveTo(mx + 3, my);
        ctx.lineTo(mx + 12, my);
        ctx.moveTo(mx, my - 12);
        ctx.lineTo(mx, my - 3);
        ctx.moveTo(mx, my + 3);
        ctx.lineTo(mx, my + 12);
        ctx.stroke();

        ctx.restore();
    }

    _renderDeathOverlay(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 5, 5, 0.7)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.font = '24px "Press Start 2P", monospace';
        ctx.fillStyle = '#e62424';
        ctx.textAlign = 'center';
        ctx.fillText('SINAL PERDIDO', this.width / 2, this.height / 2 - 20);

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.fillText('O TRAJE ESPACIAL SOFREU DESCOMPRESSÃO CRÍTICA.', this.width / 2, this.height / 2 + 20);
        ctx.fillText('PRESSIONE [ R ] PARA REINICIALIZAR O ASTRONAUTA', this.width / 2, this.height / 2 + 50);

        ctx.restore();
    }
}
