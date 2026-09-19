/**
 * menuMusic.js
 * Música do menu principal (No Signal).
 *
 * Usa uma única instância de Audio, reutilizada em todas as telas do fluxo
 * do menu (título, menu inicial, nome do astronauta e seleção de tripulante).
 * A reprodução nunca força autoplay antes da primeira interação do usuário:
 * se o navegador bloquear o primeiro play(), espera o primeiro clique ou
 * tecla para iniciar. O volume segue a configuração de música (musicVolume)
 * e é atualizado ao vivo quando o jogador muda as opções.
 */

import { loadSettings } from '../state/stateStorage.js';

const MENU_MUSIC_PATH = './src/assets/sounds/music menu/menu_music.mp3';

let menuMusic = null;
let menuMusicLoadStarted = false;
let menuMusicWarned = false;
let menuMusicMutedWarned = false;
let menuMusicPlaying = false;
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

// Instância única: criada uma vez e reaproveitada em todo o fluxo do menu.
function getMenuMusic() {
    if (menuMusic) return menuMusic;
    if (menuMusicLoadStarted || typeof Audio === 'undefined') return null;

    menuMusicLoadStarted = true;
    menuMusic = new Audio(MENU_MUSIC_PATH);
    menuMusic.loop = true;
    menuMusic.preload = 'auto';
    menuMusic.volume = _resolveVolume();

    // Garante que o volume configurado sempre reflita no momento exato em que
    // a reprodução começa — evita que o play() inicie "alto" e o ajuste feito
    // nas opções não seja percebido.
    menuMusic.addEventListener('play', () => {
        menuMusic.volume = _resolveVolume();
    });

    menuMusic.addEventListener('error', () => {
        if (!menuMusicWarned) {
            menuMusicWarned = true;
            console.warn('[Audio] Música do menu não pôde ser carregada.');
        }
        // Libera uma nova tentativa de carga na próxima chamada.
        menuMusic = null;
        menuMusicLoadStarted = false;
    });

    return menuMusic;
}

function _bindFirstInteraction() {
    if (firstInteractionBound || typeof window === 'undefined') return;
    firstInteractionBound = true;

    const onInteraction = () => {
        _unbindFirstInteraction();
        startMenuMusic();
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

export function startMenuMusic() {
    const settings = loadSettings();
    if (!Number.isFinite(settings.musicVolume) || settings.musicVolume <= 0) {
        if (!menuMusicMutedWarned && Number.isFinite(settings.musicVolume)) {
            menuMusicMutedWarned = true;
            console.warn('[Audio] Música do menu silenciada: "VOLUME DA MÚSICA" está em 0 nas opções.');
        }
        return;
    }

    const audio = getMenuMusic();
    if (!audio) return;

    audio.loop = true;
    audio.volume = _resolveVolume();

    if (menuMusicPlaying) return;

    // Mesmo que o autoplay seja bloqueado, a música começa na 1ª interação.
    _bindFirstInteraction();

    const promise = audio.play();
    if (promise && typeof promise.then === 'function') {
        promise.then(() => {
            menuMusicPlaying = true;
            _unbindFirstInteraction();
            audio.volume = _resolveVolume();
        }).catch(() => {
            // Autoplay bloqueado: rearma o gatilho de interação para que um
            // clique/tecla posterior retome a música — nada trava em silêncio.
            _bindFirstInteraction();
        });
    } else {
        menuMusicPlaying = true;
        _unbindFirstInteraction();
    }
}

export function stopMenuMusic() {
    if (menuMusic) {
        menuMusic.pause();
        menuMusic.currentTime = 0;
    }
    menuMusicPlaying = false;
}

// Atualiza o volume da instância já carregada sem reiniciá-la.
export function setMenuMusicVolume() {
    if (menuMusic) {
        menuMusic.volume = _resolveVolume();
    }
}