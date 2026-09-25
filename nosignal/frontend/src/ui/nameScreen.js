/**
 * nameScreen.js
 * Astronaut Name Entry Screen with Mars Sci-Fi Retro aesthetics.
 */

import { gameState } from '../state/gameState.js';
import { renderCharacterSelectScreen } from './characterSelectScreen.js';
import { renderTitleScreen } from './titleScreen.js';
import { initMainMenu } from './screens.js';
import { playClickButtonSound } from '../audio/uiClickSound.js';
import { applyControls, isControlsModifiedThisSession, loadControls } from '../state/controlsStorage.js';
import { fetchControlsByPlayer, saveControlsByPlayer } from '../services/controlsRemote.js';

export function renderNameScreen(container) {
    gameState.currentScene = 'NAME_ENTRY';
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

    const screen = container.querySelector('.name-screen-wrapper');
    const input = screen?.querySelector('#astronaut-name-input');
    const btnConfirm = screen?.querySelector('#btn-confirm-mission');
    const btnBack = screen?.querySelector('#btn-back-menu');
    let submitting = false;

    // Auto focus & select text
    if (input) {
        input.focus();
        input.select();
    }

    const handleConfirm = async () => {
        if (submitting || !screen?.isConnected) return;
        submitting = true;
        input.disabled = true;
        if (btnConfirm) btnConfirm.disabled = true;
        // O VOLTAR continua ativo: com a rede lenta, o jogador não fica preso
        // esperando o carregamento dos controles remotos para decidir.

        const enteredName = input.value.trim().toUpperCase() || 'ARES-1';
        gameState.playerName = enteredName;
console.log(`[No Signal] Astronauta registrado: ${enteredName}`);

        // Vai para a seleção de personagem IMEDIATAMENTE, sem esperar a rede.
        // Os controles do perfil carregam em segundo plano e não travam a tela.
        renderCharacterSelectScreen(container);
        console.log('[No Signal] Avançando para seleção de personagem...');

        // Controles da nuvem: se o jogador remapeou nesta sessão (menu
        // principal), a config local vence o perfil antigo — senão o remap do
        // menu era sobrescrito ao iniciar a partida e "não salvava". Em qualquer
        // caso o carregamento acontece sem bloquear a transição de tela.
        const controlsChangedHere = isControlsModifiedThisSession();
        try {
            const raw = controlsChangedHere ? null : await fetchControlsByPlayer(enteredName);
            if (raw && gameState.currentScene !== 'TITLE') {
                applyControls(raw);
                console.log('[No Signal] Controles carregados para', enteredName);
            }
        } catch (err) {
            console.warn('[No Signal] Falha ao buscar controles remotos:', err);
        }

        // Se o jogador mexeu nos controles aqui, espelha a config local para o
        // perfil deste nome pra mudança ficar salva ao iniciar a partida.
        // Mesmo que não haja rede, o fluxo segue normalmente.
        if (controlsChangedHere) {
            saveControlsByPlayer(enteredName, loadControls())
                .then(() => console.log('[No Signal] Controles salvos para', enteredName))
                .catch(() => { /* sem rede: fica só no localStorage */ });
        }
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
