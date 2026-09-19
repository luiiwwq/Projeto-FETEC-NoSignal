/**
 * stateStorage.js
 * Persistência de configurações do jogo via localStorage.
 */

const SETTINGS_KEY = 'nosignal.settings.v2';

const DEFAULT_SETTINGS = {
    musicVolume: 70,
    sfxVolume: 100,
    brightness: 100,
    fullscreen: false,
};

let cached = null;

function clampNum(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
}

function sanitize(raw) {
    const out = { ...DEFAULT_SETTINGS };
    if (!raw || typeof raw !== 'object') return out;
    out.musicVolume = clampNum(raw.musicVolume, 0, 100, DEFAULT_SETTINGS.musicVolume);
    out.sfxVolume = clampNum(raw.sfxVolume, 0, 100, DEFAULT_SETTINGS.sfxVolume);
    out.brightness = clampNum(raw.brightness, 50, 100, DEFAULT_SETTINGS.brightness);
    out.fullscreen = raw.fullscreen === true;
    return out;
}

function safeRead() {
    try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY));
    } catch (err) {
        return null;
    }
}

function safeWrite(data) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    } catch (err) {
        // Storage indisponível (ex.: modo privado) — mantém apenas em memória.
    }
}

export function loadSettings() {
    if (cached) return { ...cached };
    cached = sanitize(safeRead());
    return { ...cached };
}

export function saveSettings(settings) {
    cached = sanitize({ ...loadSettings(), ...settings });
    safeWrite(cached);
    return { ...cached };
}

export function resetSettings() {
    cached = { ...DEFAULT_SETTINGS };
    try {
        localStorage.removeItem(SETTINGS_KEY);
    } catch (err) {
        // Ignora falha na remoção.
    }
    return { ...cached };
}