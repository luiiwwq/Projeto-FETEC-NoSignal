/**
 * missionItems.js
 * Missão principal: "Conserte a nave e saia de Duna".
 *
 * Define os 3 itens que consertam a nave, onde cada um aparece e o ícone de
 * missão do HUD. Os itens NÃO são apanhados automaticamente — caem no chão
 * saltitando e só são coletados quando o jogador chega perto e aperta E.
 *
 *  - motor: parte trazeira (a BASE) — solto pelo Old Duna Guardian (Skeleton
 *           Axe Boss) no Núcleo de Duna.
 *  - meio : parte central (todos os componentes) — já está no chão da
 *           superfície nas coordenadas X02138 / Y02527.
 *  - ponta : parte dianteira (a peça que falta) — solta pelo Necro, King of
 *           Duna (Necromancer) na Sala do Rei.
 */

export const PRINCIPAL_MISSION = {
    id: 'principal',
    title: 'Conserte a nave e saia de Duna',
    icon: './src/assets/sprites/Mission/principal_mission/spaceship_misson_hud.png',
};

export const SPACESHIP_ITEM_DEFS = {
    motor: {
        id: 'motor',
        slot: 1,
        name: 'Motor da Nave',
        description: 'O motor é a base da nave. Sem ele, nenhum componente funciona.',
        hint: 'Procure no Núcleo de Duna',
        sprite: './src/assets/sprites/Itens/spaceship_itens/spaceship_item1.png',
        dropFrom: 'skeletonAxeBoss',
    },
    meio: {
        id: 'meio',
        slot: 2,
        name: 'Combustível',
        description: 'O combustível: a energia que impulsiona a nave pela fuga de Duna.',
        hint: 'Procure pelas coordenadas X02138 E Y02527',
        sprite: './src/assets/sprites/Itens/spaceship_itens/spaceship_item2.png',
        dropFrom: null,
        mapId: 'mars-surface',
        x: 2138,
        y: 2527,
    },
    ponta: {
        id: 'ponta',
        slot: 3,
        name: 'Estabilizadores',
        description: 'Os estabilizadores: a peça que falta para completar o conserto.',
        hint: 'Derrote o Rei',
        sprite: './src/assets/sprites/Itens/spaceship_itens/spaceship_item3.png',
        dropFrom: 'necromancerBoss',
    },
};

// Ordem apresentada no indicador de missão do HUD.
export const MISSION_ITEM_ORDER = ['motor', 'meio', 'ponta'];

/* ── Sprites (id -> HTMLImageElement) ────────────────────── */
const imageCache = new Map();

/** Pré-carrega os sprites dos 3 itens + o ícone da missão. */
export function preloadMissionItemSprites() {
    if (typeof Image === 'undefined') return;

    if (!imageCache.has('mission-icon')) {
        const icon = new Image();
        icon.src = PRINCIPAL_MISSION.icon;
        imageCache.set('mission-icon', icon);
    }

    for (const id of Object.keys(SPACESHIP_ITEM_DEFS)) {
        if (imageCache.has(id)) continue;
        const img = new Image();
        img.src = SPACESHIP_ITEM_DEFS[id].sprite;
        imageCache.set(id, img);
    }
}

export function getMissionItemImage(id) {
    const img = imageCache.get(id);
    return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export function getMissionIconImage() {
    const img = imageCache.get('mission-icon');
    return img && img.complete && img.naturalWidth > 0 ? img : null;
}
