/**
 * GameEngine.js
 * Core engine loop managing Canvas rendering, Camera, Player,
 * Projectiles, Input handling, and Sci-Fi Mars HUD.
 */

import { Camera } from './Camera.js';
import { MapRenderer } from './MapRenderer.js';
import { Player, PlayerState } from '../entities/Player.js';
import { gameState } from '../state/gameState.js';
import { MAPS, MAP_IDS } from '../content/maps.js';
import { resolveSlide, pointInCircle, rectsOverlap } from '../systems/collisionSystem.js';
import { openPauseMenu, closePauseMenu, isPauseMenuOpen, destroyPauseMenu } from '../ui/pauseMenu.js';
import { openCaveChoiceScreen, closeCaveChoiceScreen, isCaveChoiceOpen } from '../ui/caveChoiceScreen.js';

const MAP_LABELS = {
    [MAP_IDS.MARS_SURFACE]: 'SUPERFICIE DE MARTE',
    [MAP_IDS.MARS_CAVE]: 'CAVERNA DE MARTE',
    [MAP_IDS.CASTLE_HALL]: 'SALAO PRINCIPAL',
    [MAP_IDS.CASTLE_SIDE_ROOM]: 'SALA LATERAL',
    [MAP_IDS.CASTLE_LOWER_AREA]: 'AREA INFERIOR',
    [MAP_IDS.CASTLE_BOSS_ARENA]: 'ARENA DO BOSS',
};

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
            (px, py, dx, dy) => resolveSlide(
                px, py,
                this.player.colliderHalfW,
                this.player.colliderHalfH,
                dx, dy,
                buildCollisionObstacles(map, this.player.colliderHalfW, this.player.colliderHalfH),
                { minX: 0, minY: 0, maxX: map.width, maxY: map.height }
            )
        );
        this.player.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });

        this.camera.setBounds(0, 0, map.width, map.height);
        this.camera.follow(this.player.x, this.player.y, true);

        this.bullets.length = 0;
        this.particles.length = 0;
        this.mapTransitionCooldown = 0.4;
        this.interactableExit = null;

        gameState.currentMap = mapId;
    }

    changeMap(targetMapId, spawnId) {
        this._loadMap(targetMapId, spawnId);
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

        // Test hotkeys for quick state testing
        if (e.code === 'KeyH') {
            this.player.takeDamage(25);
            this._spawnHitSparks(this.player.x, this.player.y);
        } else if (e.code === 'KeyK') {
            this.player.die();
        } else if (e.code === 'KeyF') {
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
        // Update player input and logic
        this.player.handleInput(this.input, this.camera, this);
        this.player.update(dt);

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
            // Bullets stop against solid obstacles (walls, rocks, towers)
            const bRect = { x: bullet.x - 4, y: bullet.y - 4, w: 8, h: 8 };
            for (const o of this.currentMap.obstacles) {
                if (rectsOverlap(o, bRect)) {
                    this._spawnHitSparks(bullet.x, bullet.y);
                    this.bullets.splice(i, 1);
                    break;
                }
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

        // 2. Render Bullets
        for (const bullet of this.bullets) {
            bullet.render(ctx, this.camera);
        }

        // 3. Render Particles
        for (const p of this.particles) {
            const screen = this.camera.worldToScreen(p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(screen.x), Math.round(screen.y), p.size, p.size);
        }

        // 4. Render Player
        this.player.render(ctx, this.camera);

        // 5. Render Martian Dust Weather
        this.mapRenderer.renderAtmosphericDust(ctx, this.width, this.height);

        // 6. Render Sci-Fi HUD
        this._renderHUD(ctx);

        // 7. Render Aim Crosshair
        this._renderCrosshair(ctx);

        // 8. Render Death Screen Overlay if dead
        if (this.player.state === PlayerState.DEAD) {
            this._renderDeathOverlay(ctx);
        }

        // 9. Render Map Transition Prompt ([E]) when near a doorway
        if (this.interactableExit && this.mapTransitionCooldown <= 0) {
            this._renderExitPrompt(ctx, this.interactableExit);
        }
    }

    _renderExitPrompt(ctx, exit) {
        // When the exit defines a rectangular trigger area, anchor the prompt
        // text at the center of that area (shifted slightly down) so it appears
        // right over the interaction zone — closer to the actual door. Exits
        // without an area keep the legacy position (centered above the exit).
        const promptX = exit.area ? exit.area.x + exit.area.w / 2 : exit.x;
        const promptY = exit.area ? exit.area.y + exit.area.h / 2 + 10 : exit.y - 70;
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
            '[WASD] Mover  [SHIFT] Correr  [L-CLICK] Atirar  [R-CLICK] Socar  [ESPAÇO] Pular  [ESC] Menu  [H] Dano  [K] Morte  [R] Reiniciar',
            this.width / 2,
            barBottomY + 23
        );

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
