/**
 * No Signal — Modal de Nome do Astronauta
 *
 * Exibe um modal sobreposto ao menu principal solicitando
 * o nome do jogador antes de iniciar a jornada.
 */

import { gameState } from '../state/gameState.js';
import { renderLoadingScreen } from './loadingScreen.js';

// ─────────────────────────────────────────────────────────
//  Estado compartilhado do jogador
// ─────────────────────────────────────────────────────────
export const playerState = {
    name: '',
};

const NAME_MAX_LENGTH = 20;

// ─────────────────────────────────────────────────────────
//  Abrir o Modal de Nome
// ─────────────────────────────────────────────────────────
export function openNameModal() {
    // Evita duplicatas
    if (document.getElementById('name-modal-overlay')) return;

    const wrapper = document.querySelector('.title-screen-wrapper') || document.getElementById('app');
    if (!wrapper) return;

    const overlay = document.createElement('div');
    overlay.id = 'name-modal-overlay';
    overlay.className = 'name-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Configurar nome do astronauta');

    overlay.innerHTML = `
        <div class="name-modal" id="name-modal">
            <div class="name-modal__header">
                <div>
                    <p class="name-modal__title">NOVO ASTRONAUTA</p>
                    <p class="name-modal__subtitle">MISSÃO: NO SIGNAL // PROTOCOLO DE IDENTIFICAÇÃO</p>
                </div>
            </div>

            <div class="name-modal__body">
                <div>
                    <label class="name-modal__label" for="astronaut-name-input">
                        ► IDENTIFICAÇÃO DO ASTRONAUTA
                    </label>
                    <div class="name-modal__input-wrapper">
                        <input
                            type="text"
                            id="astronaut-name-input"
                            class="name-modal__input"
                            placeholder="EX: CMDR. VALDEZ"
                            maxlength="${NAME_MAX_LENGTH}"
                            autocomplete="off"
                            autocorrect="off"
                            autocapitalize="characters"
                            spellcheck="false"
                            autofocus
                        />
                    </div>
                    <p class="name-modal__char-count" id="name-char-count">
                        0 / ${NAME_MAX_LENGTH}
                    </p>
                    <p class="name-modal__error" id="name-modal-error" role="alert">
                        ⚠ INSIRA UM NOME PARA O ASTRONAUTA
                    </p>
                </div>

                <div class="name-modal__actions">
                    <button
                        type="button"
                        id="name-modal-cancel"
                        class="name-modal__btn name-modal__btn--secondary"
                    >
                        CANCELAR
                    </button>
                    <button
                        type="button"
                        id="name-modal-confirm"
                        class="name-modal__btn name-modal__btn--primary"
                    >
                        CONFIRMAR ►
                    </button>
                </div>
            </div>
        </div>
    `;

    wrapper.appendChild(overlay);

    _bindModalEvents(overlay);
}

// ─────────────────────────────────────────────────────────
//  Fechar o Modal
// ─────────────────────────────────────────────────────────
function closeNameModal() {
    const overlay = document.getElementById('name-modal-overlay');
    if (overlay) overlay.remove();
}

// ─────────────────────────────────────────────────────────
//  Event Listeners do Modal
// ─────────────────────────────────────────────────────────
function _bindModalEvents(overlay) {
    const input     = document.getElementById('astronaut-name-input');
    const charCount = document.getElementById('name-char-count');
    const errorMsg  = document.getElementById('name-modal-error');
    const btnConfirm = document.getElementById('name-modal-confirm');
    const btnCancel  = document.getElementById('name-modal-cancel');

    // ── Contador de caracteres ───────────────────────────
    input?.addEventListener('input', () => {
        const len = input.value.length;
        if (charCount) {
            charCount.textContent = `${len} / ${NAME_MAX_LENGTH}`;
            charCount.classList.toggle('is-near-limit', len >= NAME_MAX_LENGTH - 5 && len < NAME_MAX_LENGTH);
            charCount.classList.toggle('is-at-limit',   len >= NAME_MAX_LENGTH);
        }

        // Remove erro ao digitar
        if (errorMsg && len > 0) {
            errorMsg.classList.remove('is-visible');
        }
    });

    // ── Enter no input confirma ──────────────────────────
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            _confirmName(input, errorMsg);
        }
        if (e.key === 'Escape') {
            closeNameModal();
        }
    });

    // ── Botão CONFIRMAR ──────────────────────────────────
    btnConfirm?.addEventListener('click', () => {
        _confirmName(input, errorMsg);
    });

    // ── Botão CANCELAR ───────────────────────────────────
    btnCancel?.addEventListener('click', () => {
        closeNameModal();
    });

    // ── Clicar fora do modal fecha ───────────────────────
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeNameModal();
        }
    });

    // ── Focar o input ao abrir ───────────────────────────
    setTimeout(() => input?.focus(), 60);
}

// ─────────────────────────────────────────────────────────
//  Validação e Confirmação do Nome
// ─────────────────────────────────────────────────────────
function _confirmName(input, errorMsg) {
    const name = input?.value?.trim() ?? '';

    if (!name) {
        // Shake de erro
        errorMsg?.classList.add('is-visible');
        input?.classList.add('is-error');
        input?.addEventListener('input', () => {
            input.classList.remove('is-error');
        }, { once: true });
        input?.focus();
        return;
    }

    // Armazena o nome no estado
    playerState.name = name;
    gameState.playerName = name;
    console.log(`[No Signal] Nome do astronauta definido: "${name}"`);

    // Fecha o modal
    closeNameModal();

    // Avança diretamente para a Tela de Carregamento / Jogo
    const appContainer = document.getElementById('app');
    if (appContainer) {
        renderLoadingScreen(appContainer);
    }
}
