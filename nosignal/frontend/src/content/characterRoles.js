/**
 * characterRoles.js
 * Configurable role system derived from the character selected on the
 * character-select screen. Given the selected character, the two remaining
 * characters are split deterministically into one ally and one enemy.
 *
 * The rule is explicit (fixed priority order), never based on the visual
 * order of the select cards: the ally is the first remaining character in
 * CHARACTER_ROLE_PRIORITY and the enemy is the other one.
 *
 * Coordinates are all defined here so no spawn position is hard-coded
 * elsewhere in the codebase.
 */

import { CHARACTERS, CHARACTER_IDS } from './characters.js';

export const TEAM = {
    PLAYER: 'player',
    ALLY: 'ally',
    ENEMY: 'enemy'
};

export const ROLE = {
    PLAYER: 'player',
    ALLY: 'ally',
    ENEMY: 'enemy'
};

// Fixed priority used to assign the ally role. The selected character is
// removed first, so:
//   astronaut selected    -> ally space-lizard, enemy ocstronaut
//   space-lizard selected -> ally astronaut,   enemy ocstronaut
//   ocstronaut selected    -> ally astronaut,   enemy space-lizard
export const CHARACTER_ROLE_PRIORITY = [
    CHARACTER_IDS.ASTRONAUT,
    CHARACTER_IDS.SPACE_LIZARD,
    CHARACTER_IDS.OCSTRONAUT
];

// Ally spawn — right at the front of the current shop on the Martian surface.
// The shop obstacle spans x1951..2271 / y120..408, so the ally (centered on the
// shop's x center) hugs its base, overlapping the lower facade.
export const CHARACTER_ALLY_SHOP_POSITION = {
    x: 2111,
    y: 410
};

// Enemy spawn table (per remaining character). `null` means the enemy is
// registered as an enemy but NOT spawned until a position is configured.
export const CHARACTER_ENEMY_SPAWNS = {
    [CHARACTER_IDS.ASTRONAUT]: null,
    [CHARACTER_IDS.SPACE_LIZARD]: null,
    [CHARACTER_IDS.OCSTRONAUT]: null
};

/**
 * Resolve which remaining character becomes the ally and which the enemy.
 * @param {string} selectedCharacterId
 * @returns {{ ally: string|null, enemy: string|null }}
 */
export function resolveCharacterRoles(selectedCharacterId) {
    const known = CHARACTER_ROLE_PRIORITY.filter((id) => CHARACTERS[id]);
    const remaining = known.filter((id) => id !== selectedCharacterId);
    return {
        ally: remaining[0] ?? null,
        enemy: remaining[1] ?? null
    };
}
