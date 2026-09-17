/**
 * tilemap.js
 * Data-driven layer/tile definitions used ONLY by the map renderer.
 *
 * ── Coordinate conventions ──────────────────────────────────────────
 * LOGICAL_TILE (64) is the gameplay grid: obstacles, spawns, exits and
 * player hitboxes all live on multiples of 64 in content/maps.js.
 *
 * RENDER_TILE (16) is a purely visual micro-grid. The renderer draws
 * terrain in 16px cells but never changes logical coordinates or
 * collision data. These conversion helpers exist so coord translation
 * is explicit and testable; gameplay code must NOT use them.
 *
 * This module contains no drawing logic — it is the single registry of
 * tile styles, palettes and layer ownership consumed by MapRenderer.
 */

export const LOGICAL_TILE = 64;
export const RENDER_TILE = 16;

// Explicit conversion helpers (render-only; not for gameplay/collision).
export const worldToRenderTile = (wx) => Math.floor(wx / RENDER_TILE);
export const renderTileToWorld = (rt) => rt * RENDER_TILE;
export const worldToLogicalTile = (wx) => Math.floor(wx / LOGICAL_TILE);
export const logicalTileToWorld = (lt) => lt * LOGICAL_TILE;

export const TILE_LAYERS = {
    GROUND: 'ground',
    DETAIL: 'detail',
    PROPS: 'props',
};

/**
 * Martian surface palette. These values match the procedural art used so
 * far; when sprite sheets are added (see engine/tileAtlas.js) they remain
 * as fallback tints under the sprites.
 */
export const SURFACE_PALETTE = {
    groundRed: '#6b2613',
    groundRedVariant: '#85321b',
    groundDark: '#611f11',
    groundDarkVariant: '#4e190d',
    groundOrange: '#76301a',
    groundOrangeVariant: '#9c411d',
    crater: '#5c1d10',
    craterDeep: '#3a1109',
    craterRim: '#8f3419',
    iron: '#6e2412',
    ironDark: '#350e09',
    ironLight: '#a84020',
    platformDark: '#272933',
    platformLight: '#383b48',
    platformEdge: '#1b1d24',
    platformBolt: '#676d80',
    edge: '#4a1a0e',
    edgeDark: '#3a1109',
    hazard: '#e07228',
    rock: '#7e3419',
    rockDark: '#5c1d10',
    rockLight: '#a84020',
    caveWall: '#2b1b12',
    caveWallDark: '#1a100a',
    caveWallLine: '#170d08',
    tower: '#3d3831',
    towerDark: '#332e28',
    towerLine: '#28231e',
    accentOrange: '#e07228',
    accentCream: '#f6c885',
};

/**
 * Tile type registry. Each id belongs to a render layer. Today all types
 * are drawn procedurally; the atlas (engine/tileAtlas.js) can later attach
 * sprite frames to the same ids without touching gameplay.
 */
export const TILE_TYPES = {
    SURFACE_GROUND: 'surface-ground',
    SURFACE_DARK: 'surface-dark',
    SURFACE_ORANGE: 'surface-orange',
    SURFACE_CRATER: 'surface-crater',
    SURFACE_IRON: 'surface-iron',
    SURFACE_DUNE: 'surface-dune-band',
    PLATFORM: 'platform',
    EDGE_RIFF: 'surface-edge',
};

export const TILE_LAYER_OF = {
    [TILE_TYPES.SURFACE_GROUND]: TILE_LAYERS.GROUND,
    [TILE_TYPES.SURFACE_DARK]: TILE_LAYERS.GROUND,
    [TILE_TYPES.SURFACE_ORANGE]: TILE_LAYERS.GROUND,
    [TILE_TYPES.SURFACE_CRATER]: TILE_LAYERS.GROUND,
    [TILE_TYPES.SURFACE_IRON]: TILE_LAYERS.DETAIL,
    [TILE_TYPES.SURFACE_DUNE]: TILE_LAYERS.DETAIL,
    [TILE_TYPES.PLATFORM]: TILE_LAYERS.GROUND,
    [TILE_TYPES.EDGE_RIFF]: TILE_LAYERS.PROPS,
};