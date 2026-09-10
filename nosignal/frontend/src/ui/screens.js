import { showToast } from './titleScreen.js';
import { renderNameScreen } from './nameScreen.js';

export function initMainMenu() {
    const btnStart = document.getElementById('btn-start');
    const btnLoad = document.getElementById('btn-load');
    const btnOptions = document.getElementById('btn-options');
    const btnCredits = document.getElementById('btn-credits');

    btnStart?.addEventListener('click', () => {
        console.log('[Menu] Iniciar Novo Jogo acionado — avançando para identificação do astronauta.');
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
        showToast('Painel de Opções em desenvolvimento.');
    });

    btnCredits?.addEventListener('click', () => {
        console.log('[Menu] Créditos acionado.');
        showToast('No Signal - Protótipo Sci-Fi v1.0.0');
    });
}