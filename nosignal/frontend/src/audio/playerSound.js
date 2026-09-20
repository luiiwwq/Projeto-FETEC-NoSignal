/**
 * playerSound.js
 * Sons do jogador (No Signal): dano recebido, morte e passos ao caminhar.
 *
 * Danos e morte usam o padrão do shootSound.js (POOL de instâncias de Audio
 * com round-robin). O passo é diferente: o walking.mp3 original é um loop mais
 * longo do que um passo, então tocá-lo inteiro "vaza" depois que o jogador
 * para. O passo é recortado via Web Audio API: o arquivo é decodificado em um
 * AudioBuffer e cada passo reproduz apenas uma fatia curta (onset do som +
 * duração fixa), encerrando no instante exato — um som único de passada
 * idêntico ao andar e ao correr. O volume segue sfxVolume (stateStorage).
 */

import { loadSettings } from '../state/stateStorage.js';

const SFX_DIR = './src/assets/sounds/sound effects/';

const PLAYER_SOUNDS = {
    damage: {
        path: `${SFX_DIR}damage/damage_player.wav`,
        volume: 0.7,
        poolSize: 4,
        pitch: 0.08
    },
    die: {
        path: `${SFX_DIR}die/die_sound.wav`,
        volume: 0.85,
        poolSize: 2,
        pitch: 0.04
    }
};

// Fatia do passo recortada do walking.mp3 (mesmo som para andar e correr).
const WALK = {
    path: `${SFX_DIR}walking/walking.mp3`,
    volume: 0.4,
    sliceDuration: 0.14
};

const pools = {};
const nextIndexByKey = {};
let playerSoundsWarned = false;

// Web Audio p/ o passo recortado
let audioCtx = null;
let walkBuffer = null;
let walkOnset = 0;
let walkPreloadStarted = false;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Volume final = (sfxVolume/100) * volume do efeito, lido a cada toque para
// respeitar mudanças em tempo real feitas nas opções.
function _resolveVolume(volume) {
    const settings = loadSettings();
    const sfx = Number.isFinite(settings.sfxVolume)
        ? clamp(settings.sfxVolume, 0, 100)
        : 100;
    return (sfx / 100) * volume;
}

function _getAudioCtx() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
}

// Detecta o primeiro transiente forte no buffer: começa a fatia no ponto em
// que o passo realmente soa, ignorando silêncio/pré-roll do arquivo original.
function _findOnset(buffer) {
    const data = buffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i += 1) {
        const a = Math.abs(data[i]);
        if (a > peak) peak = a;
    }
    if (peak === 0) return 0;

    const threshold = peak * 0.12;
    for (let i = 0; i < data.length; i += 1) {
        if (Math.abs(data[i]) >= threshold) {
            return Math.min(i / buffer.sampleRate, buffer.duration - 0.01);
        }
    }
    return 0;
}

// Pré-carrega o pool dos efeitos e decodifica o passo (async) na tela de
// loading, para o primeiro toque encontrar tudo pronto (zero latência).
export function preloadPlayerSounds() {
    if (typeof Audio === 'undefined') return;

    Object.keys(PLAYER_SOUNDS).forEach((key) => {
        if (pools[key] && pools[key].length) return;

        const { path, volume, poolSize } = PLAYER_SOUNDS[key];
        const pool = [];
        for (let i = 0; i < poolSize; i++) {
            const audio = new Audio(path);
            audio.preload = 'auto';
            audio.volume = _resolveVolume(volume);

            audio.addEventListener('error', () => {
                if (!playerSoundsWarned) {
                    playerSoundsWarned = true;
                    console.warn(`[Audio] Som do jogador não pôde ser carregado: ${path}`);
                }
            });

            pool.push(audio);
        }
        pools[key] = pool;
    });

    _preloadWalk();
}

function _preloadWalk() {
    if (walkPreloadStarted || walkBuffer || typeof window === 'undefined') return;
    walkPreloadStarted = true;

    const ctx = _getAudioCtx();
    if (!ctx) {
        console.warn('[Audio] Web Audio API indisponível: passo silenciado.');
        return;
    }

    fetch(WALK.path)
        .then((res) => res.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
            walkBuffer = buffer;
            walkOnset = _findOnset(buffer);
        })
        .catch(() => {
            if (!playerSoundsWarned) {
                playerSoundsWarned = true;
                console.warn(`[Audio] walking.mp3 não pôde ser decodificado: ${WALK.path}`);
            }
        });
}

function _play(key) {
    const config = PLAYER_SOUNDS[key];
    if (!config) return;

    if (!pools[key] || !pools[key].length) {
        preloadPlayerSounds();
    }

    const audioList = pools[key];
    if (!audioList || !audioList.length) return;

    // Round-robin: toques consecutivos usam a próxima instância do pool para
    // sobrepor cadências rápidas sem cortar o efeito anterior.
    const index = (nextIndexByKey[key] || 0) % audioList.length;
    nextIndexByKey[key] = index + 1;

    const audio = audioList[index];

    try {
        audio.volume = _resolveVolume(config.volume);

        // Variação sutil de pitch (±config.pitch) para não soar robótico em
        // toques repetidos.
        audio.playbackRate = (1 - config.pitch) + Math.random() * config.pitch * 2;

        audio.currentTime = 0;

        const result = audio.play();
        if (result && typeof result.catch === 'function') {
            result.catch(() => {
                // O navegador pode recusar áudio antes da primeira interação.
            });
        }
    } catch {
        // O som nunca deve quebrar o jogo.
    }
}

export function playDamageSound() {
    _play('damage');
}

export function playDieSound() {
    _play('die');
}

// Passo recortado: cada chamada cria um BufferSource novo que toca apenas a
// fatia (onset -> onset + sliceDuration) e termina na hora. Nada fica "vazando"
// depois que o jogador para de andar, e andar/correr usam o mesmo som único.
export function playWalkSound() {
    const ctx = _getAudioCtx();
    if (!ctx || !walkBuffer) return;

    const source = ctx.createBufferSource();
    source.buffer = walkBuffer;
    source.start(0, walkOnset, Math.min(WALK.sliceDuration, walkBuffer.duration - walkOnset));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(_resolveVolume(WALK.volume), ctx.currentTime);

    source.connect(gain);
    gain.connect(ctx.destination);
}