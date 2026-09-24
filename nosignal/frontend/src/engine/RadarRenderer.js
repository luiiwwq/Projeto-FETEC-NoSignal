/** Minimap local do HUD: mostra o terreno já explorado em cada área. */
import { MAP_IDS } from '../content/maps.js';
import { gameState } from '../state/gameState.js';

const PANEL_WIDTH = 170;
const PANEL_HEIGHT = 132;
const PLOT_WIDTH = 154;
const PLOT_HEIGHT = 98;
const RADAR_SCALE = 0.2; // pixels no radar por unidade do mundo
const EXPLORE_CELL = 32;
const REVEAL_RADIUS = 205;

const AREA_NAMES = {
    [MAP_IDS.MARS_SURFACE]: 'SUPERFÍCIE',
    [MAP_IDS.MARS_CAVE]: 'CAVERNA',
    [MAP_IDS.MARS_CORE]: 'NÚCLEO',
    [MAP_IDS.MARS_CATACOMBS]: 'CATACUMBAS',
    [MAP_IDS.CASTLE_PRINCIPAL_ROOM]: 'CASTELO',
    [MAP_IDS.CASTLE_KING_ROOM]: 'SALA DO REI',
};

const EXIT_NAMES = {
    'cave-entrance': 'CAVERNA',
    'castle-gate': 'CASTELO',
    'principal-to-king': 'REI',
};

const FACING = {
    north: [0, -1], 'north-east': [1, -1], east: [1, 0],
    'south-east': [1, 1], south: [0, 1], 'south-west': [-1, 1],
    west: [-1, 0], 'north-west': [-1, -1],
};

export function getRadarView(map, plot, player) {
    const worldWidth = plot.width / RADAR_SCALE;
    const worldHeight = plot.height / RADAR_SCALE;
    const clamp = (value, max) => Math.max(0, Math.min(Math.max(0, max), value));
    return {
        ...plot,
        worldX: clamp(player.x - worldWidth / 2, map.width - worldWidth),
        worldY: clamp(player.y - worldHeight / 2, map.height - worldHeight),
        worldWidth,
        worldHeight,
        scale: RADAR_SCALE,
    };
}

export function radarWorldToScreen(view, x, y) {
    return {
        x: view.x + (x - view.worldX) * view.scale,
        y: view.y + (y - view.worldY) * view.scale,
    };
}

export function getRadarMarkers(engine) {
    const map = engine.currentMap;
    if (!map) return [];
    const markers = [];
    const exitsLocked = !!engine.shouldLockBossRoomExit?.();

    for (const exit of map.exits || []) {
        const x = exit.area ? exit.area.x + exit.area.w / 2 : exit.x;
        const y = exit.area ? exit.area.y + exit.area.h / 2 : exit.y;
        markers.push({
            type: exitsLocked ? 'locked' : 'exit',
            label: exitsLocked ? 'TRANCADA' : EXIT_NAMES[exit.id] || 'SAÍDA',
            x, y,
        });
    }

    if (map.id === MAP_IDS.MARS_SURFACE) {
        const obstacle = map.obstacles?.find((item) => item.id === 'mission-spaceship');
        const ship = gameState.spaceshipRepaired ? obstacle?.repaired : obstacle;
        if (ship) {
            markers.push({ type: 'landmark', label: 'NAVE', x: ship.x + ship.w / 2, y: ship.y + ship.h });
        }
        const ally = engine.actors?.find((actor) =>
            (actor.role === 'ally' || actor.team === 'ally') && actor !== engine.bossAssistAlly && !actor.isDead);
        if (ally) markers.push({ type: 'landmark', label: 'LOJA', x: ally.x, y: ally.y });
    }

    for (const item of engine.worldItems || []) {
        if (!item.collected) {
            markers.push({ type: 'item', label: item.id === 'meio' ? 'PEÇA' : item.id.toUpperCase(), x: item.x, y: item.y });
        }
    }

    const boss = engine.currentMapId === MAP_IDS.MARS_CORE ? engine.skeletonAxeBoss
        : engine.currentMapId === MAP_IDS.CASTLE_KING_ROOM ? engine.necromancerBoss : null;
    if (boss && !boss.isDead) markers.push({ type: 'boss', label: 'CHEFE', x: boss.x, y: boss.y });

    return markers;
}

export class RadarRenderer {
    constructor() {
        this.backgrounds = new Map();
        // Descoberta mantida por mapa durante a partida; um novo engine reinicia tudo.
        this.explored = new Map();
    }

    _exploration(map) {
        if (!this.explored.has(map.id)) {
            const cols = Math.ceil(map.width / EXPLORE_CELL);
            const rows = Math.ceil(map.height / EXPLORE_CELL);
            this.explored.set(map.id, { cols, rows, cells: new Uint8Array(cols * rows), lastX: -1, lastY: -1 });
        }
        return this.explored.get(map.id);
    }

    reveal(map, x, y) {
        const state = this._exploration(map);
        const col = Math.max(0, Math.min(state.cols - 1, Math.floor(x / EXPLORE_CELL)));
        const row = Math.max(0, Math.min(state.rows - 1, Math.floor(y / EXPLORE_CELL)));
        if (col === state.lastX && row === state.lastY) return;
        state.lastX = col;
        state.lastY = row;

        const reach = Math.ceil(REVEAL_RADIUS / EXPLORE_CELL);
        for (let cy = Math.max(0, row - reach); cy <= Math.min(state.rows - 1, row + reach); cy++) {
            for (let cx = Math.max(0, col - reach); cx <= Math.min(state.cols - 1, col + reach); cx++) {
                const cellX = Math.min(map.width, (cx + 0.5) * EXPLORE_CELL);
                const cellY = Math.min(map.height, (cy + 0.5) * EXPLORE_CELL);
                if (Math.hypot(cellX - x, cellY - y) <= REVEAL_RADIUS) {
                    state.cells[cy * state.cols + cx] = 1;
                }
            }
        }
    }

    isExplored(map, x, y) {
        const state = this.explored.get(map.id);
        if (!state || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
        const col = Math.floor(x / EXPLORE_CELL);
        const row = Math.floor(y / EXPLORE_CELL);
        return state.cells[row * state.cols + col] === 1;
    }

    _background(map) {
        const key = `${map.id}:${map.id === MAP_IDS.MARS_SURFACE && gameState.spaceshipRepaired ? 1 : 0}`;
        if (this.backgrounds.has(key)) return this.backgrounds.get(key);

        const width = Math.ceil(map.width * RADAR_SCALE);
        const height = Math.ceil(map.height * RADAR_SCALE);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = map.terrainMask ? '#121820' : map.type === 'surface' ? '#41221c' : '#534037';
        ctx.fillRect(0, 0, width, height);

        if (map.terrainMask) {
            // Piso real das cavernas ('.'); as rochas ('#') ficam escuras.
            const cell = map.maskCell;
            ctx.fillStyle = '#54646a';
            map.terrainMask.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    if (row[x] !== '.') continue;
                    ctx.fillRect(
                        Math.floor(x * cell / map.width * width),
                        Math.floor(y * cell / map.height * height),
                        Math.max(1, Math.ceil(cell / map.width * width)),
                        Math.max(1, Math.ceil(cell / map.height * height))
                    );
                }
            });
        } else {
            ctx.strokeStyle = map.type === 'surface' ? '#593029' : '#604d42';
            ctx.lineWidth = 1;
            for (let worldX = 160; worldX < map.width; worldX += 160) {
                const line = Math.round(worldX * RADAR_SCALE) + 0.5;
                ctx.beginPath();
                ctx.moveTo(line, 0);
                ctx.lineTo(line, height);
                ctx.stroke();
            }
            for (let worldY = 160; worldY < map.height; worldY += 160) {
                const line = Math.round(worldY * RADAR_SCALE) + 0.5;
                ctx.beginPath();
                ctx.moveTo(0, line);
                ctx.lineTo(width, line);
                ctx.stroke();
            }

            for (const original of map.obstacles || []) {
                const o = original.id === 'mission-spaceship' && gameState.spaceshipRepaired
                    ? original.repaired : original;
                if (!o || o.kind === 'npc') continue;
                ctx.fillStyle = o.kind === 'castle-pillar' ? '#303238'
                    : map.type === 'surface' ? '#98705a' : '#20232c';
                ctx.fillRect(
                    Math.floor(o.x / map.width * width),
                    Math.floor(o.y / map.height * height),
                    Math.max(1, Math.ceil(o.w / map.width * width)),
                    Math.max(1, Math.ceil(o.h / map.height * height))
                );
            }
        }

        this.backgrounds.set(key, canvas);
        return canvas;
    }

    _marker(ctx, view, marker) {
        const pos = radarWorldToScreen(view, marker.x, marker.y);
        const colors = { exit: '#ffab5e', locked: '#a78084', landmark: '#ffd764', item: '#7fe0a0', boss: '#fa777b' };
        const color = colors[marker.type];
        ctx.fillStyle = '#05070c';
        ctx.fillRect(Math.round(pos.x) - 4, Math.round(pos.y) - 4, 8, 8);
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(pos.x) - 2, Math.round(pos.y) - 2, 4, 4);

        ctx.font = '5px "Press Start 2P", monospace';
        const labelW = Math.ceil(ctx.measureText(marker.label).width);
        const beside = pos.x + labelW + 10 <= view.x + view.width ? pos.x + 7 : pos.x - labelW - 7;
        const labelX = Math.max(view.x + 2, Math.min(view.x + view.width - labelW - 2, beside));
        const labelY = Math.max(view.y + 8, Math.min(view.y + view.height - 2, pos.y - 7));
        ctx.fillStyle = 'rgba(5, 7, 12, 0.87)';
        ctx.fillRect(Math.round(labelX) - 2, Math.round(labelY) - 7, labelW + 4, 9);
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(marker.label, Math.round(labelX), Math.round(labelY));
    }

    _coverUnexplored(ctx, map, view) {
        const state = this._exploration(map);
        const left = Math.max(0, Math.floor(view.worldX / EXPLORE_CELL));
        const top = Math.max(0, Math.floor(view.worldY / EXPLORE_CELL));
        const right = Math.min(state.cols, Math.ceil((view.worldX + view.worldWidth) / EXPLORE_CELL));
        const bottom = Math.min(state.rows, Math.ceil((view.worldY + view.worldHeight) / EXPLORE_CELL));
        ctx.fillStyle = '#0b1019';

        for (let row = top; row < bottom; row++) {
            for (let col = left; col < right; col++) {
                if (state.cells[row * state.cols + col]) continue;
                const x = Math.round(view.x + (col * EXPLORE_CELL - view.worldX) * view.scale);
                const y = Math.round(view.y + (row * EXPLORE_CELL - view.worldY) * view.scale);
                const nextX = Math.round(view.x + ((col + 1) * EXPLORE_CELL - view.worldX) * view.scale);
                const nextY = Math.round(view.y + ((row + 1) * EXPLORE_CELL - view.worldY) * view.scale);
                ctx.fillRect(x, y, nextX - x, nextY - y);
            }
        }
    }

    render(ctx, engine) {
        const map = engine.currentMap;
        if (!map || !engine.player) return;
        this.reveal(map, engine.player.x, engine.player.y);

        const x = engine.width - PANEL_WIDTH - 24;
        const y = engine.height - 38 - PANEL_HEIGHT - 12;
        const view = getRadarView(map, { x: x + 8, y: y + 24, width: PLOT_WIDTH, height: PLOT_HEIGHT }, engine.player);

        ctx.save();
        ctx.fillStyle = 'rgba(5, 8, 14, 0.93)';
        ctx.fillRect(x, y, PANEL_WIDTH, PANEL_HEIGHT);
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 0.5, y + 0.5, PANEL_WIDTH - 1, PANEL_HEIGHT - 1);
        ctx.fillStyle = '#e07228';
        ctx.fillRect(x, y, 22, 2);

        ctx.textAlign = 'left';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.fillText(`RADAR // ${AREA_NAMES[map.id] || 'ÁREA'}`, x + 8, y + 16);

        ctx.fillStyle = '#0b1019';
        ctx.fillRect(view.x, view.y, view.width, view.height);

        ctx.save();
        ctx.beginPath();
        ctx.rect(view.x, view.y, view.width, view.height);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this._background(map),
            view.worldX * view.scale, view.worldY * view.scale, view.width, view.height,
            view.x, view.y, view.width, view.height);
        this._coverUnexplored(ctx, map, view);

        for (const marker of getRadarMarkers(engine)) {
            const pos = radarWorldToScreen(view, marker.x, marker.y);
            const inside = pos.x >= view.x + 4 && pos.x <= view.x + view.width - 4 &&
                pos.y >= view.y + 4 && pos.y <= view.y + view.height - 4;
            if (inside && this.isExplored(map, marker.x, marker.y)) this._marker(ctx, view, marker);
        }

        const player = radarWorldToScreen(view, engine.player.x, engine.player.y);
        const [dx, dy] = FACING[engine.player.direction] || FACING.north;
        ctx.strokeStyle = '#03141a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x + dx * 6, player.y + dy * 6);
        ctx.stroke();
        ctx.strokeStyle = '#80eeff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#80eeff';
        ctx.beginPath();
        ctx.arc(player.x, player.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = '#855039';
        ctx.lineWidth = 1;
        ctx.strokeRect(view.x + 0.5, view.y + 0.5, view.width - 1, view.height - 1);
        ctx.restore();
    }
}
