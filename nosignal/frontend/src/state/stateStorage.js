/**
 * stateStorage.js
 * Persistência de configurações do jogo via localStorage.
 */

const SETTINGS_KEY = 'nosignal.settings.v2';

const DEFAULT_SETTINGS = {
    musicVolume: 50,
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

// Fator real de brilho da tela: o valor 0% nunca apaga a tela (fica preto
// total). 0% equivale a 45% de brilho e 100% equivale a brilho total (1.0),
// com interpolação linear entre esses extremos.
export function brightnessFactor(value) {
    const v = clampNum(value, 0, 100, 100);
    return 0.45 + (v / 100) * (1 - 0.45);
}

// Filtro CSS pronto a partir do valor do slider. Em 100% (fator 1.0) o
// filtro é removido para não criar camada de renderização sem efeito.
export function brightnessFilter(value) {
    const factor = brightnessFactor(value);
    return factor >= 1 ? '' : `brightness(${factor.toFixed(2)})`;
}

function sanitize(raw) {
    const out = { ...DEFAULT_SETTINGS };
    if (!raw || typeof raw !== 'object') return out;
    out.musicVolume = clampNum(raw.musicVolume, 0, 100, DEFAULT_SETTINGS.musicVolume);
    out.sfxVolume = clampNum(raw.sfxVolume, 0, 100, DEFAULT_SETTINGS.sfxVolume);
    out.brightness = clampNum(raw.brightness, 0, 100, DEFAULT_SETTINGS.brightness);
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