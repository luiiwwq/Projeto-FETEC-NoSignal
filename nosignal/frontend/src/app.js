import { renderTitleScreen } from './ui/titleScreen.js';
import { initMainMenu } from './ui/screens.js';

document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app');
    if (appContainer) {
        // Renderiza a estrutura da Tela Inicial
        renderTitleScreen(appContainer);
        
        // Conecta os event listeners do protótipo aos botões renderizados
        initMainMenu();

        console.log('[No Signal] Aplicação inicializada com sucesso.');
    }
});
