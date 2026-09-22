/**
 * cutsceneMusic.js
 * Trilha sonora das cutscenes de abertura (No Signal).
 *
 * Usa uma única instância de Audio, reutilizada em todas as scenes da
 * cutscene de início de jogo. O volume segue a configuração de música
 * (musicVolume) e é atualizado ao vivo quando o jogador muda as opções.
 */

import { loadSettings } from '../state/stateStorage.js';

const CUTSCENE_MUSIC_PATH = './src/assets/cutscenes/start_game/soundtrack_start/soundtrack_start_scenes.mp3';

let cutsceneMusic = null;
let cutsceneMusicLoadStarted = false;
let cutsceneMusicWarned = false;
let cutsceneMusicMutedWarned = false;
let cutsceneMusicPlaying = false;
let firstInteractionBound = false;
let unbindFirstInteraction = null;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function _resolveVolume() {
    const settings = loadSettings();
    const music = Number.isFinite(settings.musicVolume)
        ? clamp(settings.musicVolume, 0, 100)
        : 100;
    return music / 100;
}

function getCutsceneMusic() {
    if (cutsceneMusic) return cutsceneMusic;
    if (cutsceneMusicLoadStarted || typeof Audio === 'undefined') return null;

    cutsceneMusicLoadStarted = true;
    cutsceneMusic = new Audio(CUTSCENE_MUSIC_PATH);
    cutsceneMusic.loop = true;
    cutsceneMusic.preload = 'auto';
    cutsceneMusic.volume = _resolveVolume();

    cutsceneMusic.addEventListener('play', () => {
        cutsceneMusic.volume = _resolveVolume();
    });

    cutsceneMusic.addEventListener('error', () => {
        if (!cutsceneMusicWarned) {
            cutsceneMusicWarned = true;
            console.warn('[Audio] Trilha da cutscene não pôde ser carregada.');
        }
        cutsceneMusic = null;
        cutsceneMusicLoadStarted = false;
    });

    return cutsceneMusic;
}

export function preloadCutsceneMusic() {
    const audio = getCutsceneMusic();
    if (!audio || typeof audio.readyState !== 'number') return Promise.resolve();
    if (audio.readyState >= 2) return Promise.resolve();
    return new Promise((resolve) => {
        const done = () => {
            audio.removeEventListener('loadeddata', done);
            audio.removeEventListener('error', done);
            resolve();
        };
        audio.addEventListener('loadeddata', done);
        audio.addEventListener('error', done);
    });
}

export function startCutsceneMusic() {
    const settings = loadSettings();
    if (!Number.isFinite(settings.musicVolume) || settings.musicVolume <= 0) {
        if (!cutsceneMusicMutedWarned && Number.isFinite(settings.musicVolume)) {
            cutsceneMusicMutedWarned = true;
            console.warn('[Audio] Trilha da cutscene silenciada: "VOLUME DA MÚSICA" está em 0 nas opções.');
        }
        return;
    }

    const audio = getCutsceneMusic();
    if (!audio) return;

    audio.loop = true;
    audio.volume = _resolveVolume();

    if (cutsceneMusicPlaying) return;

    _bindFirstInteraction();

    const promise = audio.play();
    if (promise && typeof promise.then === 'function') {
        promise.then(() => {
            cutsceneMusicPlaying = true;
            _unbindFirstInteraction();
            audio.volume = _resolveVolume();
        }).catch(() => {
            _bindFirstInteraction();
        });
    } else {
        cutsceneMusicPlaying = true;
        _unbindFirstInteraction();
    }
}

export function stopCutsceneMusic() {
    _unbindFirstInteraction();
    if (cutsceneMusic) {
        cutsceneMusic.pause();
        cutsceneMusic.currentTime = 0;
    }
    cutsceneMusicPlaying = false;
}

export function setCutsceneMusicVolume() {
    if (cutsceneMusic) {
        cutsceneMusic.volume = _resolveVolume();
    }
}

function _bindFirstInteraction() {
    if (firstInteractionBound || typeof window === 'undefined') return;
    firstInteractionBound = true;

    const onInteraction = () => {
        _unbindFirstInteraction();
        startCutsceneMusic();
    };

    unbindFirstInteraction = () => {
        window.removeEventListener('click', onInteraction);
        window.removeEventListener('keydown', onInteraction);
        window.removeEventListener('pointerdown', onInteraction);
        window.removeEventListener('touchstart', onInteraction);
        firstInteractionBound = false;
        unbindFirstInteraction = null;
    };

    window.addEventListener('click', onInteraction);
    window.addEventListener('keydown', onInteraction);
    window.addEventListener('pointerdown', onInteraction);
    window.addEventListener('touchstart', onInteraction);
}

function _unbindFirstInteraction() {
    if (unbindFirstInteraction) unbindFirstInteraction();
}