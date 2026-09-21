/**
 * characters.js
 * Character profiles for No Signal.
 * Each profile carries the sprite metadata/base paths, the native frame size,
 * the animation name translation table (PlayerState key -> clip name) and the
 * weapon profile used by Player.js / Bullet.js.
 */

export const CHARACTER_IDS = {
    ASTRONAUT: 'astronaut',
    SPACE_LIZARD: 'space-lizard',
    OCSTRONAUT: 'ocstronaut'
};

export const DEFAULT_CHARACTER_ID = CHARACTER_IDS.ASTRONAUT;

export const CHARACTERS = {
    [CHARACTER_IDS.ASTRONAUT]: {
        id: CHARACTER_IDS.ASTRONAUT,
        label: 'ASTRONAUT',
        tagline: 'AGENTE ARES-1 / ASSALTO BALÍSTICO',
        description: 'COMBATENTE VERSÁTIL. BLASTTER MÉDIO COM CADÊNCIA ALTA.',
        nativeSize: 64,
        metadataPath: './src/assets/sprites/Astronaut/metadata.json',
        assetBasePath: './src/assets/sprites/Astronaut/',
        previewPath: './src/assets/sprites/Astronaut/Astronaut/rotations/south.png',
        animations: {
            IDLE: 'Breathing_Idle',
            RUNNING: 'Running',
            SHOOTING: 'Shooting',
            PUNCHING: 'Punch',
            JUMPING: 'Jumping',
            HURT: 'Hit_Knocked_Back',
            DEAD: 'Death_Animation',
            FLOATING: 'Floating',
            PUSH_PULL: 'Push_Pull'
        },
        weapon: {
            type: 'single',
            cooldown: 0.22,
            speed: 650,
            radius: 3,
            damage: 14,
            energyCost: 16,
            color: '#ff6b22',
            glow: '#ffaa33',
            core: '#fffae6',
            trail: '#e07228'
        }
    },

    [CHARACTER_IDS.SPACE_LIZARD]: {
        id: CHARACTER_IDS.SPACE_LIZARD,
        label: 'LAGARTO ESPACIAL',
        tagline: 'ESPÉCIE GEKKO-7 / SHOTGUN DE PLASMA',
        description: 'PELE RUGOSA, TIRO ESPALHADO. CADÊNCIA BAIXA, DESTRUIÇÃO EM LEQUE.',
        nativeSize: 88,
        metadataPath: './src/assets/sprites/Space_Lizard/Space_Lizard/metadata.json',
        assetBasePath: './src/assets/sprites/Space_Lizard/Space_Lizard/',
        previewPath: './src/assets/sprites/Space_Lizard/Space_Lizard/Space_Lizard_Sprite/rotations/south.png',
        animations: {
            IDLE: 'Breathing_Idle',
            RUNNING: 'Walk',
            SHOOTING: 'Shooting',
            PUNCHING: 'Punch',
            JUMPING: 'Two-Footed_Jump',
            HURT: 'Hit_Knocked_Back',
            DEAD: 'Death',
            FLOATING: 'Float',
            PUSH_PULL: 'Pull_Object'
        },
        weapon: {
            type: 'shotgun',
            cooldown: 0.6,
            speed: 620,
            radius: 3.5,
            pellets: 5,
            spread: 0.28,
            damage: 12,
            energyCost: 33,
            color: '#52e052',
            glow: '#9bff66',
            core: '#eaffea',
            trail: '#2f9e2f'
        }
    },

    [CHARACTER_IDS.OCSTRONAUT]: {
        id: CHARACTER_IDS.OCSTRONAUT,
        label: 'OCSTRONAUT',
        tagline: 'EXOPLÂNETA KRAKEN-9 / CANHÃO ORBITAL',
        description: 'BIOMÓVEL PESADO. PROJÉTIL GRANDE E LENTO COM ALTO IMPACTO.',
        nativeSize: 92,
        metadataPath: './src/assets/sprites/Ocstronaut/Octstronaut/metadata.json',
        assetBasePath: './src/assets/sprites/Ocstronaut/Octstronaut/',
        previewPath: './src/assets/sprites/Ocstronaut/Octstronaut/Octstronaut/rotations/south.png',
        animations: {
            IDLE: 'Breathing_Idle',
            RUNNING: 'Running',
            SHOOTING: 'Shooting',
            PUNCHING: 'Punch',
            JUMPING: 'Two-Footed_Jump_getting_high_off_the_ground',
            HURT: 'Taking_Damage',
            DEAD: 'Death',
            FLOATING: 'Floating',
            PUSH_PULL: 'Breathing_Idle'
        },
        weapon: {
            type: 'single',
            cooldown: 0.35,
            speed: 420,
            radius: 8.5,
            damage: 42,
            energyCost: 25,
            color: '#ff6bd6',
            glow: '#ff9be8',
            core: '#ffe6f9',
            trail: '#d84aa8'
        }
    }
};

export function getCharacter(characterId) {
    return CHARACTERS[characterId] || CHARACTERS[DEFAULT_CHARACTER_ID];
}

const ROTATION_ORDER = [
    'south',
    'south-east',
    'east',
    'north-east',
    'north',
    'north-west',
    'west',
    'south-west'
];

export function getCharacterRotationPaths(characterId) {
    const profile = getCharacter(characterId);
    const base = profile.previewPath.replace('rotations/south.png', 'rotations/');
    return ROTATION_ORDER.map((name) => `${base}${name}.png`);
}