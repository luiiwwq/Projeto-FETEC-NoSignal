import { renderTitleScreen } from './ui/titleScreen.js';
import { initMainMenu } from './ui/screens.js';

document.addEventListener('DOMContentLoaded', () => {
    // ─── Prevenir Zoom Acidental do Navegador ───
    // Bloqueia Ctrl + Scroll do Mouse
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
        }
    }, { passive: false });

    // Bloqueia atalhos de teclado de zoom (Ctrl +, Ctrl -, Ctrl 0, Ctrl =)
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (
            e.key === '+' || e.key === '-' || e.key === '=' || 
            e.key === '_' || e.key === '0' || e.code === 'NumpadAdd' || 
            e.code === 'NumpadSubtract'
        )) {
            e.preventDefault();
        }
    });

    // Bloqueia gestos de pinça no trackpad/touch (Safari/Webkit)
    window.addEventListener('gesturestart', (e) => e.preventDefault());
    window.addEventListener('gesturechange', (e) => e.preventDefault());
    window.addEventListener('gestureend', (e) => e.preventDefault());

    // Bloqueia o menu de contexto do navegador (salvar imagem, sair do jogo,
    // recarregar, etc.) em todo o jogo, exceto em campos de texto, para
    // preservar colar/ditar no campo de nome do astronauta.
    window.addEventListener('contextmenu', (e) => {
        const target = e.target;
        if (target instanceof HTMLElement && (
            target.matches('input, textarea') || target.isContentEditable
        )) {
            return;
        }
        e.preventDefault();
    });

    const appContainer = document.getElementById('app');
    if (appContainer) {
        // Renderiza a estrutura da Tela Inicial
        renderTitleScreen(appContainer);
        
        // Conecta os event listeners do protótipo aos botões renderizados
        initMainMenu();

        console.log('[No Signal] Aplicação inicializada com sucesso.');
    }
});
