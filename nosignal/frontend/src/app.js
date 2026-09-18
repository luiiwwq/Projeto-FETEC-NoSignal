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

    // ─── Proteção dos botões do mouse (navegação do navegador) ───
    // O jogo usa o BOTÃO DIREITO para o soco corpo a corpo, então não dá
    // para simplesmente desativar o clique direito. Em vez disso, cancelamos
    // apenas as AÇÕES PADRÃO do navegador disparadas por botões não
    // primários: menu de contexto, autoscroll (botão do meio), abrir em
    // nova guia e, principalmente, a navegação "voltar/avançar" dos botões
    // laterais (3/4) e do gesto (segurar direito + clicar esquerdo), que
    // fazia a aba sair do jogo durante rajadas de socos.
    // OBS: preventDefault NÃO interrompe a propagação — o engine continua
    // recebendo o mousedown/mouseup e registrando o clique direito.
    const isEditableTarget = (el) => (
        el && el.nodeType === 1 && (
            el.matches('input, textarea, select') || el.isContentEditable
        )
    );

    const isInteractiveTarget = (el) => (
        el && el.nodeType === 1 && (
            el.matches('button, a, input, textarea, select') ||
            (typeof el.closest === 'function' && el.closest('button, a'))
        )
    );

    const blockNonPrimaryButtons = (e) => {
        if (e.button !== 0) e.preventDefault();
    };

    window.addEventListener('mousedown', (e) => {
        if (e.button !== 0) {
            e.preventDefault();
            return;
        }
        // Gesto conhecido do Chrome: segurar o botão direito e clicar o
        // esquerdo aciona "voltar". Cancela o padrão do esquerdo quando o
        // direito já está pressionado, exceto em controles interativos.
        if ((e.buttons & 2) && !isInteractiveTarget(e.target)) {
            e.preventDefault();
        }
    }, true);

    window.addEventListener('mouseup', blockNonPrimaryButtons, true);
    window.addEventListener('auxclick', blockNonPrimaryButtons, true);
    window.addEventListener('contextmenu', (e) => {
        // Preserva colar/ditar no campo de nome do astronauta
        if (!isEditableTarget(e.target)) e.preventDefault();
    }, true);

    // Bloqueia teclas de navegação de histórico do navegador (mouse 4/5,
    // teclas especiais e Alt + setas)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'BrowserBack' || e.key === 'BrowserForward' ||
            e.code === 'BrowserBack' || e.code === 'BrowserForward' ||
            (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))) {
            e.preventDefault();
        }
    }, true);

    // Impede overscroll/touchpad que navega o histórico em gestos laterais
    if ('overscrollBehaviorX' in document.documentElement.style) {
        document.documentElement.style.overscrollBehaviorX = 'none';
        document.documentElement.style.overscrollBehaviorY = 'none';
    }

    const appContainer = document.getElementById('app');
    if (appContainer) {
        // Renderiza a estrutura da Tela Inicial
        renderTitleScreen(appContainer);
        
        // Conecta os event listeners do protótipo aos botões renderizados
        initMainMenu();

        console.log('[No Signal] Aplicação inicializada com sucesso.');
    }
});
