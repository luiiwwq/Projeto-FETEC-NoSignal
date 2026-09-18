/**
 * optionsScreen.js
 * Janela de opções aberta a partir da tela inicial.
 * Reaproveita optionsView.js (sliders, brilho e tela cheia) dentro do
 * mesmo painel pixel-art usado pelo menu de pausa.
 */

import { createOptionsContent, syncOptionsUI } from './optionsView.js';
import { playClickButtonSound } from '../audio/uiClickSound.js';

let overlay = null;

export function openOptionsScreen(container) {
    if (overlay) return overlay;

    const mount = container && container.querySelector('.title-screen-wrapper')
        ? container.querySelector('.title-screen-wrapper')
        : container || document.body;

    overlay = document.createElement('section');
    overlay.className = 'pause-overlay title-options-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'title-options-title');

    overlay.innerHTML = `
        <div class="pause-panel">
            <div class="pause-panel__header">
                <span class="pause-panel__icon">||</span>
                <h2 id="title-options-title" class="pause-panel__title">OPÇÕES</h2>
                <span class="pause-panel__icon">||</span>
            </div>
            <div data-options-host></div>
            <div class="pause-panel__footer">
                <span>NO SIGNAL v1.0</span>
            </div>
        </div>
    `;

    mount.appendChild(overlay);

    const host = overlay.querySelector('[data-options-host]');
    const wrap = createOptionsContent({
        onBack: closeOptionsScreen,
        containerRef: container,
    });
    host.appendChild(wrap);

    // Fecha ao clicar no fundo
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOptionsScreen();
    });

    // Fecha com ESC
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            // ESC fecha as opções, equivalente ao botão VOLTAR (toca o som).
            playClickButtonSound();
            closeOptionsScreen();
        }
    });

    return overlay;
}

export function closeOptionsScreen() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
}

export function isOptionsScreenOpen() {
    return !!overlay;
}

export function syncTitleOptions() {
    if (overlay) {
        syncOptionsUI(overlay.querySelector('[data-options-host]'), null);
    }
}