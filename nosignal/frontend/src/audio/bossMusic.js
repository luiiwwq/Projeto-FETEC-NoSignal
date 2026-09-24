import { loadSettings } from '../state/stateStorage.js';
import { stopGameMusic } from './gameMusic.js';

const BOSS_THEMES = {
    'castle-king-room': './src/assets/sounds/music enemies/necro/necro_theme.mp3',
    'mars-core': './src/assets/sounds/music enemies/old duna guardian/old_duna_guardian_theme.mp3',
    'mars-catacombs': './src/assets/sounds/music enemies/skeleton catacombs/audio_combat.mp3'
};

let audio = null;
let activeMap = null;
let paused = false;
let unbindInteraction = null;

function volume() {
    const value = loadSettings().musicVolume;
    const level = Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : 1;
    return activeMap === 'mars-catacombs' ? level * 0.6 : level;
}

function clearInteraction() {
    if (unbindInteraction) unbindInteraction();
    unbindInteraction = null;
}

function playTheme() {
    if (!audio || paused || volume() <= 0) return;
    audio.volume = volume();
    const current = audio;
    const result = current.play();
    if (result && typeof result.catch === 'function') {
        result.catch(() => {
            if (audio !== current || paused || unbindInteraction || typeof window === 'undefined') return;
            const retry = () => {
                clearInteraction();
                playTheme();
            };
            window.addEventListener('pointerdown', retry, { once: true });
            window.addEventListener('keydown', retry, { once: true });
            unbindInteraction = () => {
                window.removeEventListener('pointerdown', retry);
                window.removeEventListener('keydown', retry);
            };
        });
    }
}

export function startBossMusic(mapId) {
    const path = BOSS_THEMES[mapId];
    if (!path) return;
    stopGameMusic();
    if (activeMap !== mapId) {
        stopBossMusic();
        activeMap = mapId;
        if (typeof Audio !== 'undefined') {
            audio = new Audio(path);
            audio.loop = true;
            audio.preload = 'auto';
            audio.addEventListener('error', () => console.warn('[Audio] Trilha do boss não pôde ser carregada:', path));
        }
    }
    paused = false;
    playTheme();
}

export function stopBossMusic() {
    clearInteraction();
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
    audio = null;
    activeMap = null;
    paused = false;
}

export function pauseBossMusic() {
    if (!activeMap) return;
    paused = true;
    clearInteraction();
    audio?.pause();
}

export function resumeBossMusic() {
    if (!activeMap) return false;
    paused = false;
    playTheme();
    return true;
}

export function setBossMusicVolume() {
    if (audio) audio.volume = volume();
    if (activeMap && !paused && audio?.paused && volume() > 0) playTheme();
}
