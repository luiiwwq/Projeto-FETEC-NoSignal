/**
 * nameScreen.js
 * Astronaut Name Entry Screen with Mars Sci-Fi Retro aesthetics.
 */

import { gameState } from '../state/gameState.js';
import { renderCharacterSelectScreen } from './characterSelectScreen.js';
import { renderTitleScreen } from './titleScreen.js';
import { initMainMenu } from './screens.js';
import { playClickButtonSound } from '../audio/uiClickSound.js';
import { applyControls } from '../state/controlsStorage.js';
import { fetchControlsByPlayer } from '../services/controlsRemote.js';

export function renderNameScreen(container) {
    container.innerHTML = `
        <div class="name-screen-wrapper">
            <div class="mars-grid-overlay"></div>
            
            <div class="name-modal-panel">
                <div class="name-panel-header">
                    <span class="panel-icon">▲</span>
                    <h2 class="panel-title">TELEMETRIA ORBITAL DE DUNA</h2>
                    <span class="panel-icon">▲</span>
                </div>
                
                <div class="name-panel-body">
                    <p class="mission-briefing">
                        IDENTIFIQUE O ASTRONAUTA RESPONSÁVEL PELA OPERAÇÃO DE RECONHECIMENTO EM SOLO DE DUNA:
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

        // Ao reconhecer o nome, carrega os controles personalizados salvos
        // para aquele astronauta (mesmo nome -> mesma config de botões).
        const loadRemote = async () => {
            try {
                const raw = await fetchControlsByPlayer(enteredName);
                if (raw) {
                    applyControls(raw);
                    console.log('[No Signal] Controles carregados para', enteredName);
                }
            } catch (err) {
                console.warn('[No Signal] Falha ao buscar controles remotos:', err);
            }
            renderCharacterSelectScreen(container);
        };
        loadRemote();
    };

    btnConfirm?.addEventListener('click', handleConfirm);

    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Enter no campo de nome é a "confirmação" equivalente ao botão
            // INICIAR A JORNADA (o navegador não gera `click` aqui).
            playClickButtonSound();
            handleConfirm();
        }
    });

    btnBack?.addEventListener('click', () => {
        renderTitleScreen(container);
        initMainMenu();
    });
}
