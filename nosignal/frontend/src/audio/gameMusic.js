/**
 * gameMusic.js
 * Música ambiente do gameplay (No Signal).
 *
 * Usa uma única instância de Audio, reutilizada durante toda a partida
 * (superfície marciana, catacumbas, castelo etc.). A reprodução nunca força
 * autoplay: se o navegador bloquear o primeiro play(), espera a próxima
 * interação do usuário para iniciar. O volume segue a configuração de música
 * (musicVolume) e é atualizado ao vivo quando o jogador muda as opções.
 */

import { loadSettings } from '../state/stateStorage.js';

const GAME_MUSIC_PATH = './src/assets/sounds/music game ambient/music_game.mp3';

let gameMusic = null;
let gameMusicLoadStarted = false;
let gameMusicWarned = false;
let gameMusicPlaying = false;
let firstInteractionBound = false;
let unbindFirstInteraction = null;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Volume final = (musicVolume / 100), lido a cada uso para respeitar
// mudanças em tempo real feitas nas opções.
function _resolveVolume() {
    const settings = loadSettings();
    const music = Number.isFinite(settings.musicVolume)
        ? clamp(settings.musicVolume, 0, 100)
        : 100;
    return music / 100;
}

// Instância única: criada uma vez e reaproveitada em toda a partida.
function getGameMusic() {
    if (gameMusic) return gameMusic;
    if (gameMusicLoadStarted || typeof Audio === 'undefined') return null;

    gameMusicLoadStarted = true;
    gameMusic = new Audio(GAME_MUSIC_PATH);
    gameMusic.loop = true;
    gameMusic.preload = 'auto';
    gameMusic.volume = _resolveVolume();

    gameMusic.addEventListener('error', () => {
        if (!gameMusicWarned) {
            gameMusicWarned = true;
            console.warn('[Audio] Música do gameplay não pôde ser carregada.');
        }
        // Libera uma nova tentativa de carga na próxima chamada.
        gameMusic = null;
        gameMusicLoadStarted = false;
    });

    return gameMusic;
}

function _bindFirstInteraction() {
    if (firstInteractionBound || typeof window === 'undefined') return;
    firstInteractionBound = true;

    const onInteraction = () => {
        _unbindFirstInteraction();
        startGameMusic();
    };

    unbindFirstInteraction = () => {
        window.removeEventListener('click', onInteraction);
        window.removeEventListener('keydown', onInteraction);
        firstInteractionBound = false;
        unbindFirstInteraction = null;
    };

    window.addEventListener('click', onInteraction);
    window.addEventListener('keydown', onInteraction);
}

function _unbindFirstInteraction() {
    if (unbindFirstInteraction) unbindFirstInteraction();
}

export function startGameMusic() {
    const settings = loadSettings();
    if (!Number.isFinite(settings.musicVolume) || settings.musicVolume <= 0) return;

    const audio = getGameMusic();
    if (!audio) return;

    audio.loop = true;
    audio.volume = _resolveVolume();

    if (gameMusicPlaying) return;

    // Mesmo que o autoplay seja bloqueado, a música começa na próxima interação.
    _bindFirstInteraction();

    const promise = audio.play();
    if (promise && typeof promise.then === 'function') {
        promise.then(() => {
            gameMusicPlaying = true;
            _unbindFirstInteraction();
            audio.volume = _resolveVolume();
        }).catch(() => {
            // Autoplay bloqueado: o listener instalado acima é o gatilho.
        });
    } else {
        gameMusicPlaying = true;
        _unbindFirstInteraction();
    }
}

export function stopGameMusic() {
    _unbindFirstInteraction();
    if (gameMusic) {
        gameMusic.pause();
        gameMusic.currentTime = 0;
    }
    gameMusicPlaying = false;
}

// Atualiza o volume da instância já carregada sem reiniciá-la.
export function setGameMusicVolume() {
    if (gameMusic) {
        gameMusic.volume = _resolveVolume();
    }
}