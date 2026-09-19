/**
 * AmongUsEasterEgg.js
 * Easter egg visual do Among Us: um impostor de pé animando o ciclo de
 * caminhada no lugar, sem colisão, combate ou interação. Surge em um mapa
 * elegível a cada 5 minutos de gameplay, toca um loop completo dos 30 frames
 * de caminhada (~2.4s) e some até o próximo intervalo.
 */

import { MAP_IDS } from '../content/maps.js';

/* ── Configuração ─────────────────────────────────────── */
export const AMONG_US_INTERVAL_SECONDS = 300;
export const AMONG_US_FRAME_DURATION = 0.08;
export const AMONG_US_SCALE = 4;
export const AMONG_US_FRAME_W = 16;
export const AMONG_US_FRAME_H = 16;
export const AMONG_US_TEST_HALF_W = 10;
export const AMONG_US_TEST_HALF_H = 10;
export const AMONG_US_MAX_ATTEMPTS = 100;
export const DEBUG_AMONG_US_EASTER_EGG = false;

export const AMONG_US_ELIGIBLE_MAPS = new Set([
    MAP_IDS.MARS_SURFACE,
    MAP_IDS.MARS_CAVE,
    MAP_IDS.MARS_CORE,
    MAP_IDS.MARS_CATACOMBS,
    MAP_IDS.CASTLE_PRINCIPAL_ROOM,
    MAP_IDS.CASTLE_KING_ROOM,
]);

/* ── Frames de caminhada (grade 10x6, apenas r06..r10) ──
 * A seleção é explícita pelas linhas corretas. As linhas r01..r05 contêm
 * frames de morte/queda/desaparecimento e NUNCA são carregadas.             */
const AMONG_US_WALK_FRAMES = [];

for (let row = 6; row <= 10; row++) {
    for (let col = 1; col <= 6; col++) {
        const path =
            `./src/assets/sprites/EasterEgg/AmongUs/among_r${String(row).padStart(2, '0')}_c${String(col).padStart(2, '0')}.png`;
        AMONG_US_WALK_FRAMES.push(path);
    }
}

if (
    AMONG_US_WALK_FRAMES.length !== 30 ||
    AMONG_US_WALK_FRAMES.some((path) => /among_r0[1-5]_/.test(path))
) {
    throw new Error(
        '[AmongUs] A animação deve usar somente os 30 frames de caminhada das linhas r06-r10.'
    );
}

/* Frames carregados uma única vez e compartilhados por todas as aparições. */
let frameCache = null;

/** Aquece o cache no boot; o primeiro easter egg leva minutos para surgir. */
export function preloadAmongUsSprites() {
    if (frameCache || typeof Image === 'undefined') return;
    console.debug(AMONG_US_WALK_FRAMES);
    frameCache = AMONG_US_WALK_FRAMES.map((path) => {
        const img = new Image();
        img.src = path;
        return img;
    });
}

function getWalkFrame(index) {
    if (!frameCache) return null;
    const img = frameCache[index];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export class AmongUsEasterEgg {
    constructor(x, y, mapId) {
        this.x = x;
        this.y = y;
        this.mapId = mapId;
        this.active = true;
        this.shouldRemove = false;
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.framesPlayed = 0;
    }

    update(dt) {
        this.frameTimer += dt;
        while (this.frameTimer >= AMONG_US_FRAME_DURATION) {
            this.frameTimer -= AMONG_US_FRAME_DURATION;
            this.frameIndex = (this.frameIndex + 1) % AMONG_US_WALK_FRAMES.length;
            this.framesPlayed += 1;
        }
        // Um loop completo reproduzido: o easter egg cumpre seu papel e some.
        if (this.framesPlayed >= AMONG_US_WALK_FRAMES.length) {
            this.active = false;
            this.shouldRemove = true;
        }
    }

    render(ctx, camera) {
        const img = getWalkFrame(this.frameIndex);
        const renderW = AMONG_US_FRAME_W * AMONG_US_SCALE;
        const renderH = AMONG_US_FRAME_H * AMONG_US_SCALE;

        // Âncora bottom-center: os pés ficam no chão, no ponto de spawn.
        const screen = camera.worldToScreen(this.x, this.y);
        const drawX = Math.round(screen.x - renderW / 2);
        const drawY = Math.round(screen.y - renderH);

        if (img) {
            ctx.drawImage(img, drawX, drawY, renderW, renderH);
        } else {
            ctx.fillStyle = '#d6244e';
            ctx.fillRect(drawX, drawY, renderW, renderH);
        }
    }
}