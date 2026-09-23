import { renderNameScreen } from './nameScreen.js';
import { openOptionsScreen } from './optionsScreen.js';
import { renderCreditsScreen } from './creditsScreen.js';
import { renderRankingScreen } from './rankingScreen.js';
import { gameState } from '../state/gameState.js';

export function initMainMenu() {
    const btnStart = document.getElementById('btn-start');
    const btnRanking = document.getElementById('btn-ranking');
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

    btnRanking?.addEventListener('click', () => {
        const appContainer = document.getElementById('app');
        if (appContainer) renderRankingScreen(appContainer);
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
