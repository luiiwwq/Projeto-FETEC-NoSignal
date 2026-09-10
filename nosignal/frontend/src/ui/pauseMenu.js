/**
 * pauseMenu.js
 * In-game pause / options overlay toggled via ESC key.
 * Styled in game.css following the project's Mars Sci-Fi pixel art aesthetic.
 *
 * The pause toggle (ESC) is owned by GameEngine's window keydown handler.
 * This module only manages the overlay DOM, focus, keyboard navigation
 * inside the menu, and the button actions.
 */

import { showToast } from './titleScreen.js';
import { gameState } from '../state/gameState.js';

let menuElement = null;
let isOpen = false;
let mainMenuArmed = false;
let containerRef = null;
let engineRef = null;

/**
 * Build and show the pause menu inside `container`.
 * Returns the DOM element.
 */
export function openPauseMenu(container, engine) {
    if (menuElement && !menuElement.hidden) return menuElement;
    containerRef = container;
    engineRef = engine;
    mainMenuArmed = false;

    if (!menuElement) {
        menuElement = _buildDOM();
        container.appendChild(menuElement);
        _bindEvents();
    }

    menuElement.hidden = false;
    isOpen = true;
    mainMenuArmed = false;
    _updateMainMenuButton(false);

    const firstBtn = menuElement.querySelector('button[data-action="options"]');
    if (firstBtn) setTimeout(() => firstBtn.focus(), 60);

    return menuElement;
}

export function closePauseMenu() {
    if (!menuElement || menuElement.hidden) return;
    menuElement.hidden = true;
    isOpen = false;
    mainMenuArmed = false;
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

            <div class="pause-panel__body">
                <button type="button" data-action="options"   class="pause-panel__btn pause-panel__btn--primary">OPÇÕES</button>
                <button type="button" data-action="main-menu" class="pause-panel__btn pause-panel__btn--secondary">VOLTAR AO MENU</button>
                <button type="button" data-action="save"      class="pause-panel__btn pause-panel__btn--secondary">SALVAR</button>
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

        mainMenuArmed = false;
        _updateMainMenuButton(false);

        if (action === 'options') {
            showToast('Painel de Opções em desenvolvimento.');
            closePauseMenu();
        } else if (action === 'save') {
            showToast('Sistema de salvamento ainda não disponível.');
            closePauseMenu();
        }
    });

    // Tab focus trap while the dialog is open
    menuElement.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusable = menuElement.querySelectorAll('button:not([disabled])');
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

/* ── Actions ─────────────────────────────────────────────── */
function _returnToMainMenu() {
    closePauseMenu();

    const container = containerRef || document.getElementById('app');
    const engine = engineRef;

    if (menuElement) {
        menuElement.remove();
        menuElement = null;
    }
    isOpen = false;
    mainMenuArmed = false;
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