/**
 * maps.js
 * World / map registry for No Signal.
 *
 * Each map defines its own dimensions, spawn points, solid obstacles
 * (axis-aligned boxes in world coordinates), map-transition exits and
 * decorative structures. Data lives here so rendering and collisions
 * stay separate from gameplay logic.
 */

export const MAP_IDS = {
    MARS_SURFACE: 'mars-surface',
    MARS_CAVE: 'mars-cave',
    CASTLE_HALL: 'castle-hall',
    CASTLE_SIDE_ROOM: 'castle-side-room',
    CASTLE_LOWER_AREA: 'castle-lower-area',
    CASTLE_BOSS_ARENA: 'castle-boss-arena',
};

const TILE = 64;

/* ─────────────── Martian Surface ───────────────
 * Big open world. Spawn area on the west, cave rock
 * formation in the middle-north, castle far east.    */

// Cave entrance rock formation (two solid lobes, opening between them)
const caveWallLeft = { x: 1450, y: 1160, w: 130, h: 250, kind: 'cave-wall' };
const caveWallRight = { x: 1660, y: 1160, w: 130, h: 250, kind: 'cave-wall' };

// Distant castle — visual facade comes from castle-sprite.png (see MapRenderer).
// SOLID collision = 4 structural AABBs (outer towers + inner pillars, all at
// full height from tower top y547 to base y929) + 1 thin strip across the
// door opening (castle-door-block) that stops the player from visually walking
// through the closed door leaves. Footprint computed from the sprite alpha
// bounds (x3386..3919, top y547, base y929, scale 0.15, anchor 3650/940). The
// stretch in front of the door (lintel → base, x3587..3712) is intentionally
// FREE — it is the access corridor from the stairs to the interaction trigger.
// Each structural AABB width was thinned ~12% (centered) so the player gets
// closer to the visual structure before colliding.
const castleTowerLeft = { id: 'castle-tower-left', x: 3398, y: 547, w: 80, h: 382, kind: 'castle-wall' };
const castlePillarLeft = { id: 'castle-pillar-left', x: 3502, y: 547, w: 85, h: 382, kind: 'castle-wall' };
const castlePillarRight = { id: 'castle-pillar-right', x: 3712, y: 547, w: 85, h: 382, kind: 'castle-wall' };
const castleTowerRight = { id: 'castle-tower-right', x: 3822, y: 547, w: 84, h: 382, kind: 'castle-wall' };

// Thin collision strip across the door opening — prevents the player from
// visually walking through the closed door leaves. Its bottom edge (the one
// facing the player approaching from below) is pushed a little further down,
// inside the top of the interaction trigger, so the player stops a bit before
// the door: blocked at centerY = 830 + halfH, i.e. ~22px below the old stop
// point, while the "[E] ENTRAR" prompt is still visible.
const castleDoorBlock = { id: 'castle-door-block', x: 3584, y: 816, w: 131, h: 14, kind: 'castle-wall' };

const surfaceRocks = [
    { x: 280, y: 1360, w: 84, h: 84, kind: 'rock' },
    { x: 760, y: 1180, w: 64, h: 64, kind: 'rock' },
    { x: 900, y: 560, w: 96, h: 96, kind: 'rock' },
    { x: 1180, y: 1540, w: 72, h: 72, kind: 'rock' },
    { x: 1300, y: 420, w: 88, h: 88, kind: 'rock' },
    { x: 1980, y: 840, w: 104, h: 104, kind: 'rock' },
    { x: 2240, y: 1500, w: 80, h: 80, kind: 'rock' },
    { x: 2520, y: 540, w: 92, h: 92, kind: 'rock' },
    { x: 2760, y: 1180, w: 110, h: 110, kind: 'rock' },
    { x: 3000, y: 1850, w: 76, h: 76, kind: 'rock' },
    { x: 3320, y: 400, w: 86, h: 86, kind: 'rock' },
    { x: 3920, y: 1280, w: 98, h: 98, kind: 'rock' },
    { x: 4240, y: 640, w: 84, h: 84, kind: 'rock' },
    { x: 4520, y: 2100, w: 102, h: 102, kind: 'rock' },
];

// Border rocks framing the world edges (visual + collision)
const surfaceBorderRocks = [
    { x: 0, y: 0, w: 4800, h: 60, kind: 'edge-rock' },
    { x: 0, y: 3140, w: 4800, h: 60, kind: 'edge-rock' },
    { x: 0, y: 0, w: 60, h: 3200, kind: 'edge-rock' },
    { x: 4740, y: 0, w: 60, h: 3200, kind: 'edge-rock' },
];

export const marsSurfaceMap = {
    id: MAP_IDS.MARS_SURFACE,
    type: 'surface',
    width: 4800,
    height: 3200,
    tileSize: TILE,
    dust: true,
    spawn: { x: 420, y: 700 },
    spawnPoints: {
        'mars-start': { x: 420, y: 700 },
        'cave-return': { x: 1615, y: 1340 },
        'castle-return': { x: 3660, y: 960 },
    },
    obstacles: [
        ...surfaceRocks,
        ...surfaceBorderRocks,
        caveWallLeft,
        caveWallRight,
        castleTowerLeft,
        castleTowerRight,
        castlePillarLeft,
        castlePillarRight,
        castleDoorBlock,
    ],
    exits: [
        {
            id: 'cave-entrance',
            label: 'ENTRAR NA CAVERNA',
            targetMap: MAP_IDS.MARS_CAVE,
            targetSpawn: 'cave-entry',
            x: 1615,
            y: 1185,
            radius: 62,
        },
        {
            id: 'castle-gate',
            label: 'ENTRAR NO CASTELO',
            targetMap: MAP_IDS.CASTLE_HALL,
            targetSpawn: 'hall-entry',
            x: 3660,
            y: 760,
            radius: 72,
            // Rectangular trigger as a THIN HORIZONTAL STRIP at the door lintel
            // height (y808), centered on the door opening (x3580..3720). Overlap
            // only (rectsOverlap). The bottom (y848) stays well above the
            // castle-return spawn (960) so the prompt does NOT appear on spawn.
            // The castle-door-block collision sits at y816..830, inside the top
            // of this trigger, so the player is stopped a bit further from the
            // door leaves while still overlapping the zone (~18px of standing
            // room below the barrier) with the prompt visible.
            area: { x: 3580, y: 808, w: 140, h: 40 },
        },
    ],
    structures: [
        {
            type: 'rock-form',
            walls: [caveWallLeft, caveWallRight],
        },
    ],
};

/* ─────────────── Mars Cave (dungeon) ─────────────── */

const border4 = (w, h, t, kind) => [
    { x: 0, y: 0, w, h: t, kind },
    { x: 0, y: h - t, w, h: t, kind },
    { x: 0, y: 0, w: t, h, kind },
    { x: w - t, y: 0, w: t, h, kind },
];

export const marsCaveMap = {
    id: MAP_IDS.MARS_CAVE,
    type: 'cave',
    width: 2400,
    height: 1600,
    tileSize: TILE,
    dust: false,
    spawn: { x: 200, y: 820 },
    spawnPoints: {
        'cave-entry': { x: 200, y: 820 },
    },
    obstacles: [
        ...border4(2400, 1600, 140, 'cave-wall'),
        // Columns / rock piles
        { x: 620, y: 460, w: 90, h: 90, kind: 'cave-rock' },
        { x: 640, y: 1040, w: 110, h: 110, kind: 'cave-rock' },
        { x: 1100, y: 620, w: 96, h: 96, kind: 'cave-rock' },
        { x: 1330, y: 1130, w: 88, h: 88, kind: 'cave-rock' },
        { x: 1560, y: 520, w: 84, h: 84, kind: 'cave-rock' },
        { x: 1700, y: 880, w: 100, h: 100, kind: 'cave-rock' },
        { x: 2020, y: 700, w: 90, h: 90, kind: 'cave-rock' },
        // Deep chamber choke points
        { x: 1730, y: 1280, w: 120, h: 120, kind: 'cave-rock' },
        { x: 1500, y: 1330, w: 92, h: 92, kind: 'cave-rock' },
    ],
    exits: [
        {
            id: 'cave-exit',
            label: 'SAIR DA CAVERNA',
            targetMap: MAP_IDS.MARS_SURFACE,
            targetSpawn: 'cave-return',
            x: 260,
            y: 820,
            radius: 62,
        },
    ],
    structures: [
        {
            type: 'crystal',
            x: 1930,
            y: 1160,
        },
    ],
};

/* ─────────────── Castle interior maps ─────────────── */

export const castleHallMap = {
    id: MAP_IDS.CASTLE_HALL,
    type: 'castle',
    width: 1600,
    height: 1200,
    tileSize: TILE,
    dust: false,
    spawn: { x: 300, y: 600 },
    spawnPoints: {
        'hall-entry': { x: 300, y: 600 },
        'hall-side-door': { x: 1518, y: 520 },
        'hall-lower-door': { x: 760, y: 250 },
    },
    obstacles: [
        // Border with 3 openings: west return door, east side room door, north stairs door
        { x: 0, y: 0, w: 1600, h: 140, kind: 'castle-wall' },
        { x: 0, y: 1060, w: 1600, h: 140, kind: 'castle-wall' },
        { x: 0, y: 0, w: 140, h: 480, kind: 'castle-wall' },
        { x: 0, y: 640, w: 140, h: 560, kind: 'castle-wall' },
        { x: 1460, y: 0, w: 140, h: 440, kind: 'castle-wall' },
        { x: 1460, y: 560, w: 140, h: 640, kind: 'castle-wall' },
        { x: 140, y: 0, w: 540, h: 140, kind: 'castle-wall' },
        { x: 860, y: 0, w: 600, h: 140, kind: 'castle-wall' },
        // Pillars
        { x: 420, y: 430, w: 72, h: 72, kind: 'column' },
        { x: 720, y: 720, w: 72, h: 72, kind: 'column' },
        { x: 1060, y: 430, w: 72, h: 72, kind: 'column' },
        // Altar / debris
        { x: 720, y: 620, w: 72, h: 40, kind: 'crate' },
    ],
    exits: [
        {
            id: 'hall-return',
            label: 'VOLTAR A SUPERFICIE',
            targetMap: MAP_IDS.MARS_SURFACE,
            targetSpawn: 'castle-return',
            x: 110,
            y: 600,
            radius: 62,
        },
        {
            id: 'hall-side',
            label: 'SALA LATERAL',
            targetMap: MAP_IDS.CASTLE_SIDE_ROOM,
            targetSpawn: 'side-entry',
            x: 1518,
            y: 500,
            radius: 58,
        },
        {
            id: 'hall-lower',
            label: 'AREA INFERIOR',
            targetMap: MAP_IDS.CASTLE_LOWER_AREA,
            targetSpawn: 'lower-entry',
            x: 760,
            y: 90,
            radius: 58,
        },
    ],
    structures: [],
};

export const castleSideRoomMap = {
    id: MAP_IDS.CASTLE_SIDE_ROOM,
    type: 'castle',
    width: 1280,
    height: 800,
    tileSize: TILE,
    dust: false,
    spawn: { x: 240, y: 500 },
    spawnPoints: {
        'side-entry': { x: 240, y: 500 },
    },
    obstacles: [
        { x: 0, y: 0, w: 1280, h: 130, kind: 'castle-wall' },
        { x: 0, y: 670, w: 1280, h: 130, kind: 'castle-wall' },
        { x: 0, y: 0, w: 130, h: 420, kind: 'castle-wall' },
        { x: 0, y: 540, w: 130, h: 260, kind: 'castle-wall' },
        { x: 1150, y: 0, w: 130, h: 800, kind: 'castle-wall' },
        // Crates / debris
        { x: 360, y: 330, w: 74, h: 74, kind: 'crate' },
        { x: 520, y: 480, w: 90, h: 90, kind: 'crate' },
        { x: 660, y: 300, w: 64, h: 64, kind: 'crate' },
    ],
    exits: [
        {
            id: 'side-return',
            label: 'VOLTAR AO SALAO',
            targetMap: MAP_IDS.CASTLE_HALL,
            targetSpawn: 'hall-side-door',
            x: 100,
            y: 500,
            radius: 56,
        },
    ],
    structures: [],
};

export const castleLowerAreaMap = {
    id: MAP_IDS.CASTLE_LOWER_AREA,
    type: 'castle',
    width: 1400,
    height: 1000,
    tileSize: TILE,
    dust: false,
    spawn: { x: 760, y: 300 },
    spawnPoints: {
        'lower-entry': { x: 760, y: 300 },
        'lower-arena-return': { x: 700, y: 250 },
    },
    obstacles: [
        { x: 0, y: 0, w: 1400, h: 140, kind: 'castle-wall' },
        { x: 0, y: 860, w: 1400, h: 140, kind: 'castle-wall' },
        { x: 0, y: 0, w: 140, h: 1000, kind: 'castle-wall' },
        { x: 1260, y: 0, w: 140, h: 1000, kind: 'castle-wall' },
        // South door gap (return to hall) -> split south wall
        // North door gap (to arena) -> split north wall
        { x: 0, y: 0, w: 660, h: 140, kind: 'castle-wall' },
        { x: 780, y: 0, w: 620, h: 140, kind: 'castle-wall' },
        { x: 0, y: 860, w: 700, h: 140, kind: 'castle-wall' },
        { x: 820, y: 860, w: 580, h: 140, kind: 'castle-wall' },
        // Columns
        { x: 400, y: 500, w: 84, h: 84, kind: 'column' },
        { x: 950, y: 500, w: 84, h: 84, kind: 'column' },
        { x: 640, y: 640, w: 90, h: 90, kind: 'crate' },
        { x: 320, y: 220, w: 70, h: 70, kind: 'crate' },
    ],
    exits: [
        {
            id: 'lower-hall',
            label: 'VOLTAR AO SALAO',
            targetMap: MAP_IDS.CASTLE_HALL,
            targetSpawn: 'hall-lower-door',
            x: 760,
            y: 908,
            radius: 56,
        },
        {
            id: 'lower-arena',
            label: 'ARENA DO BOSS',
            targetMap: MAP_IDS.CASTLE_BOSS_ARENA,
            targetSpawn: 'arena-player',
            x: 720,
            y: 90,
            radius: 58,
        },
    ],
    structures: [],
};

export const castleBossArenaMap = {
    id: MAP_IDS.CASTLE_BOSS_ARENA,
    type: 'castle',
    width: 1800,
    height: 1200,
    tileSize: TILE,
    dust: false,
    spawn: { x: 300, y: 600 },
    spawnPoints: {
        'arena-player': { x: 300, y: 600 },
        'arena-boss': { x: 1500, y: 600 },
    },
    obstacles: [
        { x: 0, y: 0, w: 1800, h: 150, kind: 'castle-wall' },
        { x: 0, y: 1050, w: 1800, h: 150, kind: 'castle-wall' },
        { x: 0, y: 0, w: 150, h: 1200, kind: 'castle-wall' },
        { x: 1650, y: 0, w: 150, h: 1200, kind: 'castle-wall' },
        // South wall split to keep a controlled exit door
        { x: 150, y: 1050, w: 680, h: 150, kind: 'castle-wall' },
        { x: 1040, y: 1050, w: 610, h: 150, kind: 'castle-wall' },
        // Two side pillars, floor mostly open for combat
        { x: 420, y: 300, w: 72, h: 72, kind: 'column' },
        { x: 1310, y: 800, w: 72, h: 72, kind: 'column' },
    ],
    exits: [
        {
            id: 'arena-exit',
            label: 'VOLTAR A AREA INFERIOR',
            targetMap: MAP_IDS.CASTLE_LOWER_AREA,
            targetSpawn: 'lower-arena-return',
            x: 900,
            y: 1090,
            radius: 80,
        },
    ],
    structures: [],
};

export const MAPS = {
    [MAP_IDS.MARS_SURFACE]: marsSurfaceMap,
    [MAP_IDS.MARS_CAVE]: marsCaveMap,
    [MAP_IDS.CASTLE_HALL]: castleHallMap,
    [MAP_IDS.CASTLE_SIDE_ROOM]: castleSideRoomMap,
    [MAP_IDS.CASTLE_LOWER_AREA]: castleLowerAreaMap,
    [MAP_IDS.CASTLE_BOSS_ARENA]: castleBossArenaMap,
};