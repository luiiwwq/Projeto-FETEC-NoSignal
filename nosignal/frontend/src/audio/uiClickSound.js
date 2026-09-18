/**
 * uiClickSound.js
 * Som global de clique para botões do jogo (No Signal).
 *
 * Centraliza o carregamento e a reprodução de click_button.mp3 em um único
 * Audio, reutilizado por todos os botões — sem um new Audio() por botão e
 * sem múltiplos downloads. O volume segue a configuração de efeitos sonoros
 * (sfxVolume em stateStorage) atenuada pela constante UI_CLICK_VOLUME.
 *
 * Estratégia principal: DELEGAÇÃO GLOBAL de clique (bindGlobalClickSound),
 * aplicada uma única vez no app.js. Como o som é tocado apenas no ponto em
 * que a ação realmente acontece (click, Enter/E confirmados), não há som
 * duplicado por ação. bindClickButtonSound() fica disponível para o caso
 * pontual de anexar o som diretamente a um elemento sem delegar.
 */

import { loadSettings } from '../state/stateStorage.js';

const CLICK_BUTTON_PATH = './src/assets/sounds/button/click_button.mp3';

// Volume básico do clique (nunca volume máximo: o som deve ser discreto).
const UI_CLICK_VOLUME = 0.55;

let clickButtonAudio = null;
let clickButtonLoadStarted = false;
let clickButtonWarned = false;
let globalClickSoundBound = false;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Volume final = (sfxVolume/100) * UI_CLICK_VOLUME, lido a cada toque para
// respeitar mudanças em tempo real feitas nas opções.
function _resolveVolume() {
    const settings = loadSettings();
    const sfx = Number.isFinite(settings.sfxVolume)
        ? clamp(settings.sfxVolume, 0, 100)
        : 100;
    return (sfx / 100) * UI_CLICK_VOLUME;
}

export function preloadClickButtonSound() {
    if (clickButtonLoadStarted || typeof Audio === 'undefined') return;

    clickButtonLoadStarted = true;
    clickButtonAudio = new Audio(CLICK_BUTTON_PATH);
    clickButtonAudio.preload = 'auto';
    clickButtonAudio.volume = _resolveVolume();

    clickButtonAudio.addEventListener('error', () => {
        if (!clickButtonWarned) {
            clickButtonWarned = true;
            console.warn('[Audio] click_button.mp3 não foi carregado.');
        }
    });
}

export function playClickButtonSound() {
    if (!clickButtonAudio) {
        preloadClickButtonSound();
    }

    if (!clickButtonAudio) return;

    try {
        clickButtonAudio.volume = _resolveVolume();

        // Reinicia o áudio no clique mais recente em vez de criar dezenas
        // de instâncias em cliques rápidos.
        clickButtonAudio.currentTime = 0;

        const result = clickButtonAudio.play();

        if (result && typeof result.catch === 'function') {
            result.catch(() => {
                // O navegador pode bloquear áudio antes da primeira interação.
            });
        }
    } catch {
        // O som nunca deve quebrar a interface ou o jogo.
    }
}

/**
 * Anexa o som de clique diretamente a um elemento.
 * Usado apenas como alternativa pontual — a estratégia principal do jogo é a
 * delegação global (bindGlobalClickSound), que evita som em duplicidade.
 */
export function bindClickButtonSound(element) {
    if (!element || element.dataset.clickSoundBound === 'true') return;

    element.dataset.clickSoundBound = 'true';

    element.addEventListener('click', () => {
        playClickButtonSound();
    });
}

// Botões desabilitados (disabled, aria-disabled ou estilos .disabled/.is-disabled)
// não devem tocar som.
function _isButtonActionable(btn) {
    if (!btn || !btn.nodeType || btn.nodeType !== 1) return false;
    if (btn.disabled) return false;
    if (btn.matches && btn.matches('[disabled], .disabled, .is-disabled')) return false;
    const ariaDisabled = btn.getAttribute && btn.getAttribute('aria-disabled');
    if (ariaDisabled === 'true' || ariaDisabled === '') return false;
    return true;
}

/**
 * Delegação global: toca o som de clique para qualquer botão (ou elemento
 * com role="button") ativado por mouse ou por Enter/Espaço nativo do
 * navegador (que gera um evento `click`). Registra uma única vez.
 */
export function bindGlobalClickSound() {
    if (globalClickSoundBound || typeof document === 'undefined') return;
    globalClickSoundBound = true;

    document.addEventListener('click', (event) => {
        if (!event.target || typeof event.target.closest !== 'function') return;

        const button = event.target.closest('button, [role="button"]');

        if (!_isButtonActionable(button)) return;

        playClickButtonSound();
    });
}