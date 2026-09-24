/** Trilhas das arenas; catacumbas tocam a 60% do volume configurado. */
import { loadSettings } from '../state/stateStorage.js';
import { stopGameMusic } from './gameMusic.js';
import { createLoopingMusic } from './loopingMusic.js';

const BOSS_THEMES = {
    'castle-king-room': './src/assets/sounds/music enemies/necro/necro_theme.mp3',
    'mars-core': './src/assets/sounds/music enemies/old duna guardian/old_duna_guardian_theme.mp3',
    'mars-catacombs': './src/assets/sounds/music enemies/skeleton catacombs/audio_combat.mp3',
};

const themes = new Map();
let activeMap = null;

function trackFor(mapId) {
    if (!themes.has(mapId)) {
        themes.set(mapId, createLoopingMusic(BOSS_THEMES[mapId], {
            name: `Trilha do boss (${mapId})`,
            getVolume: () => loadSettings().musicVolume / 100 * (mapId === 'mars-catacombs' ? 0.6 : 1),
        }));
    }
    return themes.get(mapId);
}

export function startBossMusic(mapId) {
    if (!BOSS_THEMES[mapId]) return;
    stopGameMusic();
    if (activeMap && activeMap !== mapId) stopBossMusic();
    activeMap = mapId;
    trackFor(mapId).start();
}

export function stopBossMusic() {
    if (activeMap) {
        trackFor(activeMap).stop();
        // Uma nova entrada na arena começa uma trilha nova, sem herdar buffer
        // ou erro da luta anterior.
        themes.delete(activeMap);
    }
    activeMap = null;
}

export function pauseBossMusic() {
    if (activeMap) trackFor(activeMap).pause();
}

export function resumeBossMusic() {
    if (!activeMap) return false;
    trackFor(activeMap).resume();
    return true;
}

export function setBossMusicVolume() {
    if (activeMap) trackFor(activeMap).setVolume();
}
