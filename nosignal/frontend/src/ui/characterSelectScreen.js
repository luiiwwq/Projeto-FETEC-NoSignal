/**
 * characterSelectScreen.js
 * Crew selection screen: opens between the name entry and the loading
 * screen. Picks a character profile and records it in gameState.
 */

import { gameState } from '../state/gameState.js';
import { CHARACTERS, CHARACTER_IDS, DEFAULT_CHARACTER_ID } from '../content/characters.js';
import { renderLoadingScreen } from './loadingScreen.js';
import { renderNameScreen } from './nameScreen.js';

export function renderCharacterSelectScreen(container) {
    container.innerHTML = `
        <div class="name-screen-wrapper">
            <div class="mars-grid-overlay"></div>

            <div class="name-modal-panel char-select-panel">
                <div class="name-panel-header">
                    <span class="panel-icon">▲</span>
                    <h2 class="panel-title">SELECIONE O TRIPULANTE</h2>
                    <span class="panel-icon">▲</span>
                </div>

                <div class="name-panel-body">
                    <p class="mission-briefing">
                        ESCAPE PODS DETECTADOS NA SUPERFÍCIE DE MARTE. ESCOLHA QUEM DESCE
                        ÀS RUÍNAS PARA RESTABELECER O NO SIGNAL:
                    </p>

                    <div class="char-select-grid" id="char-select-grid">
                        ${Object.entries(CHARACTERS).map(([id, profile]) => `
                            <button
                                type="button"
                                class="char-card"
                                data-char="${id}"
                                aria-pressed="false"
                            >
                                <div class="mars-grid-overlay"></div>
                                <img
                                    class="char-card__preview"
                                    src="${profile.previewPath}"
                                    alt="${profile.label}"
                                    draggable="false"
                                />
                                <span class="char-card__name">${profile.label}</span>
                                <span class="char-card__tagline">${profile.tagline}</span>
                                <span class="char-card__desc">${profile.description}</span>
                            </button>
                        `).join('')}
                    </div>

                    <div class="name-panel-actions">
                        <button id="btn-back-name" class="btn-retro btn-secondary">
                            VOLTAR
                        </button>
                        <button id="btn-confirm-char" class="btn-retro btn-primary">
                            CONFIRMAR MISSÃO
                        </button>
                    </div>
                </div>

                <div class="name-panel-footer">
                    <span>PROTOCOLO DE DESCIDA // NO SIGNAL v1.0</span>
                </div>
            </div>
        </div>
    `;

    const grid = document.getElementById('char-select-grid');
    const btnConfirm = document.getElementById('btn-confirm-char');
    const btnBack = document.getElementById('btn-back-name');

    let selectedId = gameState.selectedCharacter || DEFAULT_CHARACTER_ID;
    if (!CHARACTERS[selectedId]) selectedId = DEFAULT_CHARACTER_ID;

    const cards = Array.from(grid.querySelectorAll('.char-card'));

    const applySelection = () => {
        cards.forEach((card) => {
            const isSelected = card.dataset.char === selectedId;
            card.classList.toggle('is-selected', isSelected);
            card.setAttribute('aria-pressed', String(isSelected));
        });
    };

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            selectedId = card.dataset.char;
            applySelection();
        });
        card.addEventListener('mouseleave', () => {
            if (card.dataset.char !== selectedId) {
                card.classList.remove('is-hover');
            }
        });
        card.addEventListener('mouseenter', () => {
            card.classList.add('is-hover');
        });
    });

    const handleConfirm = () => {
        gameState.selectedCharacter = selectedId;
        console.log(`[No Signal] Tripulante selecionado: ${selectedId}`);
        renderLoadingScreen(container);
    };

    const handleBack = () => {
        renderNameScreen(container);
    };

    btnConfirm?.addEventListener('click', handleConfirm);
    btnBack?.addEventListener('click', handleBack);

    const cleanup = () => {
        document.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            cleanup();
            handleConfirm();
        } else if (e.key === 'Escape') {
            cleanup();
            handleBack();
        }
    };

    // Fires after the current synchronous dispatch so the name screen's leftover
    // Enter/click keydown no longer reaches this new document listener.
    setTimeout(() => {
        document.addEventListener('keydown', onKeyDown);
    }, 0);

    btnConfirm?.addEventListener('click', cleanup);
    btnBack?.addEventListener('click', cleanup);

    applySelection();
}