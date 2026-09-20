import { showToast } from './titleScreen.js';
import { renderNameScreen } from './nameScreen.js';
import { openOptionsScreen } from './optionsScreen.js';
import { renderCreditsScreen } from './creditsScreen.js';
import { gameState } from '../state/gameState.js';

export function initMainMenu() {
    const btnStart = document.getElementById('btn-start');
    const btnLoad = document.getElementById('btn-load');
    const btnOptions = document.getElementById('btn-options');
    const btnCredits = document.getElementById('btn-credits');

    btnStart?.addEventListener('click', () => {
        console.log('[Menu] Iniciar Novo Jogo acionado — resetando sessão anterior.');
        gameState.reset();
        const appContainer = document.getElementById('app');
        if (appContainer) {
            renderNameScreen(appContainer);
        }
    });

    btnLoad?.addEventListener('click', () => {
        console.log('[Menu] Carregar Jogo acionado.');
        showToast('Nenhum jogo salvo encontrado no LocalStorage/MySQL.');
    });

    btnOptions?.addEventListener('click', () => {
        console.log('[Menu] Opções acionado.');
        const appContainer = document.getElementById('app');
        if (appContainer) {
            openOptionsScreen(appContainer);
        }
    });

    btnCredits?.addEventListener('click', () => {
        console.log('[Menu] Créditos acionado.');
        const appContainer = document.getElementById('app');
        if (appContainer) {
            renderCreditsScreen(appContainer);
        }
    });
}