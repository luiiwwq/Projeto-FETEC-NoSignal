/**
 * pauseMenu.js
 * In-game pause / options overlay toggled via ESC key.
 * Styled in game.css following the project's Mars Sci-Fi pixel art aesthetic.
 *
 * The pause toggle (ESC) is owned by GameEngine's window keydown handler.
 * This module only manages the overlay DOM, focus, keyboard navigation
 * inside the menu, and the button actions.
 */

import { gameState } from '../state/gameState.js';
import { createOptionsContent, syncOptionsUI } from './optionsView.js';
import { startMenuMusic } from '../audio/menuMusic.js';
import { startGameMusic, stopGameMusic } from '../audio/gameMusic.js';

let menuElement = null;
let isOpen = false;
let mainMenuArmed = false;
let containerRef = null;
let engineRef = null;

let optionsOpen = false;

/**
 * Build and show the pause menu inside `container`.
 * Returns the DOM element.
 */
export function openPauseMenu(container, engine) {
    if (menuElement && !menuElement.hidden) return menuElement;
    containerRef = container;
    engineRef = engine;
    mainMenuArmed = false;

    // Preferir anexar dentro do viewport do jogo ou no container raiz
    const mountTarget = container.querySelector('.game-viewport') || container;

    if (!menuElement) {
        menuElement = _buildDOM();
        mountTarget.appendChild(menuElement);
        _bindEvents();
    } else if (menuElement.parentElement !== mountTarget) {
        mountTarget.appendChild(menuElement);
    }

    menuElement.hidden = false;
    isOpen = true;
    mainMenuArmed = false;
    optionsOpen = false;
    _updateMainMenuButton(false);
    _showOptionsView(false);

    // Ao pausar, silencia a música do gameplay.
    stopGameMusic();

    const firstBtn = menuElement.querySelector('button[data-action="options"]');
    if (firstBtn) setTimeout(() => firstBtn.focus(), 60);

    return menuElement;
}

export function closePauseMenu() {
    if (!menuElement || menuElement.hidden) return;
    menuElement.hidden = true;
    isOpen = false;
    mainMenuArmed = false;
    optionsOpen = false;

    // Ao retomar o jogo, reinstaura a música ambiente do gameplay.
    startGameMusic();
}

export function isPauseMenuOpen() {
    return isOpen;
}

export function destroyPauseMenu() {
    if (!menuElement) return;
    menuElement.remove();
    menuElement = null;
    isOpen = false;
    mainMenuArmed = false;
    optionsOpen = false;
    containerRef = null;
    engineRef = null;
}

/* ── DOM builder ─────────────────────────────────────────── */
function _buildDOM() {
    const el = document.createElement('section');
    el.className = 'pause-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'pause-menu-title');
    el.hidden = true;

    el.innerHTML = `
        <div class="pause-panel">
            <div class="pause-panel__header">
                <span class="pause-panel__icon">||</span>
                <h2 id="pause-menu-title" class="pause-panel__title">MENU DE PAUSA</h2>
                <span class="pause-panel__icon">||</span>
            </div>

            <div class="pause-panel__stage">
                <div class="pause-panel__body" data-pause-view="main">
                    <button type="button" data-action="options"   class="pause-panel__btn">OPÇÕES</button>
                    <button type="button" data-action="main-menu" class="pause-panel__btn">VOLTAR AO MENU</button>
                </div>

                <div class="pause-panel__options-layer" data-pause-view="options" hidden></div>
            </div>

            <div class="pause-panel__footer">
                <span>NO SIGNAL v1.0 — ESC PARA RETOMAR</span>
            </div>
        </div>
    `;

    return el;
}

/* ── Event wiring ────────────────────────────────────────── */
function _bindEvents() {
    if (!menuElement) return;

    // Click on backdrop closes the menu
    menuElement.addEventListener('click', (e) => {
        if (e.target === menuElement) {
            closePauseMenu();
            return;
        }

        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;

        if (action === 'options') {
            _showOptionsView(true);
            return;
        }

        if (action === 'main-menu') {
            if (mainMenuArmed) {
                _returnToMainMenu();
            } else {
                mainMenuArmed = true;
                _updateMainMenuButton(true);
                btn.focus();
            }
            return;
        }
    });

    // Tab focus trap while the dialog is open
    menuElement.addEventListener('keydown', (e) => {
        // ESC volta da tela de opções para o menu; fora dela o engine fecha o pause
        if (e.key === 'Escape' && optionsOpen) {
            e.preventDefault();
            e.stopPropagation();
            _showOptionsView(false);
            return;
        }

        if (e.key !== 'Tab') return;
        const view = optionsOpen ? 'options' : 'main';
        const focusable = Array.from(
            menuElement.querySelectorAll(`[data-pause-view="${view}"] button:not([disabled]), [data-pause-view="${view}"] .opt-item__slider`)
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });
}

/* ── Options view (camada sobre os botões) ───────────────── */
function _buildOptionsOnce(optsLayer) {
    if (!optsLayer || optsLayer.querySelector('.opt-item__slider')) return;

    const title = document.createElement('p');
    title.className = 'pause-panel__options-title';
    title.textContent = 'OPÇÕES';
    optsLayer.appendChild(title);

    const wrap = createOptionsContent({
        onBack: () => _showOptionsView(false),
        containerRef,
    });
    optsLayer.appendChild(wrap);
}

function _showOptionsView(open) {
    optionsOpen = open;

    const panel = menuElement.querySelector('.pause-panel');
    const main = menuElement.querySelector('[data-pause-view="main"]');
    const opts = menuElement.querySelector('[data-pause-view="options"]');

    if (main) {
        main.inert = open;
        main.querySelectorAll('button').forEach((btn) => { btn.tabIndex = open ? -1 : 0; });
    }
    if (panel) panel.classList.toggle('pause-panel--options-open', open);
    if (opts) opts.hidden = !open;

    if (open) {
        _buildOptionsOnce(opts);
        syncOptionsUI(opts, containerRef);
    }

    const target = open
        ? opts && opts.querySelector('.opt-item__slider')
        : main && main.querySelector('button[data-action="options"]');
    if (target) setTimeout(() => target.focus(), 60);
}

/* ── Actions ─────────────────────────────────────────────── */
function _returnToMainMenu() {
    closePauseMenu();

    // Deixou o gameplay: a música do jogo não deve continuar no menu.
    stopGameMusic();

    const container = containerRef || document.getElementById('app');
    const engine = engineRef;

    if (menuElement) {
        menuElement.remove();
        menuElement = null;
    }
    isOpen = false;
    mainMenuArmed = false;
    optionsOpen = false;
    engineRef = null;
    containerRef = null;

    // Reuse existing cleanup: stops the active engine and resets scene state
    if (engine) {
        gameState.reset();
    }

    if (!container) return;

    import('./titleScreen.js').then(({ renderTitleScreen }) => {
        renderTitleScreen(container);
        import('./screens.js').then(({ initMainMenu }) => {
            initMainMenu();
        });
    });

    // Ao voltar ao menu, retoma a música do menu uma única vez.
    startMenuMusic();
}

function _updateMainMenuButton(armed) {
    if (!menuElement) return;
    const btn = menuElement.querySelector('button[data-action="main-menu"]');
    if (!btn) return;
    if (armed) {
        btn.textContent = 'CLIQUE PARA CONFIRMAR SAÍDA';
        btn.classList.add('pause-panel__btn--warning');
    } else {
        btn.textContent = 'VOLTAR AO MENU';
        btn.classList.remove('pause-panel__btn--warning');
    }
}
