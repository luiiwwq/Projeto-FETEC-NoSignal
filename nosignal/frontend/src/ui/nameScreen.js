/**
 * nameScreen.js
 * Astronaut Name Entry Screen with Mars Sci-Fi Retro aesthetics.
 */

import { gameState } from '../state/gameState.js';
import { renderLoadingScreen } from './loadingScreen.js';
import { renderTitleScreen } from './titleScreen.js';
import { initMainMenu } from './screens.js';

export function renderNameScreen(container) {
    container.innerHTML = `
        <div class="name-screen-wrapper">
            <div class="mars-grid-overlay"></div>
            
            <div class="name-modal-panel">
                <div class="name-panel-header">
                    <span class="panel-icon">▲</span>
                    <h2 class="panel-title">TELEMETRIA ORBITAL DE MARTE</h2>
                    <span class="panel-icon">▲</span>
                </div>
                
                <div class="name-panel-body">
                    <p class="mission-briefing">
                        IDENTIFIQUE O ASTRONAUTA RESPONSÁVEL PELA OPERAÇÃO DE RECONHECIMENTO EM SOLO MARCIANO:
                    </p>

                    <div class="input-container">
                        <label for="astronaut-name-input" class="input-label">NOME DO ASTRONAUTA</label>
                        <div class="input-wrapper">
                            <span class="input-prefix">&gt;</span>
                            <input 
                                type="text" 
                                id="astronaut-name-input" 
                                class="retro-text-input" 
                                maxlength="16" 
                                value="${gameState.playerName || 'ARES-1'}" 
                                autocomplete="off" 
                                spellcheck="false"
                                autofocus
                            />
                        </div>
                    </div>

                    <div class="name-panel-actions">
                        <button id="btn-back-menu" class="btn-retro btn-secondary">
                            VOLTAR
                        </button>
                        <button id="btn-confirm-mission" class="btn-retro btn-primary">
                            INICIAR A JORNADA
                        </button>
                    </div>
                </div>

                <div class="name-panel-footer">
                    <span>PROTOCOLO DE POUSO ATIVO // NO SIGNAL v1.0</span>
                </div>
            </div>
        </div>
    `;

    const input = document.getElementById('astronaut-name-input');
    const btnConfirm = document.getElementById('btn-confirm-mission');
    const btnBack = document.getElementById('btn-back-menu');

    // Auto focus & select text
    if (input) {
        input.focus();
        input.select();
    }

    const handleConfirm = () => {
        const enteredName = input.value.trim().toUpperCase() || 'ARES-1';
        gameState.playerName = enteredName;
        console.log(`[No Signal] Astronauta registrado: ${enteredName}`);

        // Registro assíncrono opcional no backend (não bloqueia caso MySQL/PHP esteja offline)
        try {
            fetch('http://localhost/nosignal/backend/public/index.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: enteredName }),
            }).catch(() => {
                // Silencioso se backend local não estiver rodando
            });
        } catch (_) {}

        // Transition to Loading Screen
        renderLoadingScreen(container);
    };

    btnConfirm?.addEventListener('click', handleConfirm);

    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    });

    btnBack?.addEventListener('click', () => {
        renderTitleScreen(container);
        initMainMenu();
    });
}
