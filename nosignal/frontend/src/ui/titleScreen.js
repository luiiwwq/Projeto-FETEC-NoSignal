/**
 * Módulo de Renderização e Controle da Tela Inicial (Title Screen) - No Signal
 */

export function renderTitleScreen(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="title-screen-wrapper">
            <!-- Camada 1: Cenário Espacial Limpo (Espaço, Marte, Terra) -->
            <div class="title-screen__scene" aria-hidden="true"></div>
            
            <!-- Camada 2: Overlay com Animação Discreta de Estrelas -->
            <div class="starfield-overlay" aria-hidden="true"></div>

            <!-- Camada 3 e 4: Painel Fixo da Marca e Menu Principal -->
            <main class="title-screen__content">
                <div class="title-screen__nav-panel">
                    <header class="title-screen__brand">
                        <img 
                            class="title-screen__logo" 
                            src="./src/assets/references/no-signal-logo-trimmed.png" 
                            alt="No Signal Logo" 
                        />
                    </header>

                    <nav class="title-screen__menu" aria-label="Menu Principal">
                        <button type="button" id="btn-start" class="menu-btn is-selected" tabindex="0">
                            NOVO JOGO
                        </button>
                        <button type="button" id="btn-ranking" class="menu-btn" tabindex="0">
                            RANKING
                        </button>
                        <button type="button" id="btn-options" class="menu-btn" tabindex="0">
                            OPÇÕES
                        </button>
                        <button type="button" id="btn-credits" class="menu-btn" tabindex="0">
                            CRÉDITOS
                        </button>
                    </nav>
                </div>

                <footer class="title-screen__footer">
                    <span>v1.0.0 — Sinais de Comunicação Ausentes</span>
                </footer>
            </main>
        </div>
    `;

    setupKeyboardNavigation();
}

/**
 * Gerencia a navegação via teclado (Setas Up/Down e Enter) nos botões do menu
 * O listener global é instalado apenas uma vez e sempre re-consulta o DOM atual,
 * evitando acúmulo de listeners duplicados ao re-renderizar a tela inicial.
 */
let titleKeyHandler = null;
let keyboardNav = false;

function setupKeyboardNavigation() {
    const buttons = Array.from(document.querySelectorAll('.title-screen__menu .menu-btn'));
    if (buttons.length === 0) return;

    const updateSelection = (btn, list) => {
        list.forEach((b) => {
            if (b === btn) b.classList.add('is-selected');
            else b.classList.remove('is-selected');
        });
        btn.focus();
    };

    // Atualiza seleção visual ao passar o mouse / navegar com o teclado.
    // CORREÇÃO (hover preso): com o mouse o destaque só existe enquanto o
    // ponteiro está sobre o botão (mouseenter/mouseleave); com navegação por
    // teclado (keyboardNav=true) o destaque permanece no botão focado.
    buttons.forEach((btn) => {
        btn.addEventListener('mouseenter', () => {
            updateSelection(btn, buttons);
        });

        btn.addEventListener('mouseleave', () => {
            if (!keyboardNav) btn.classList.remove('is-selected');
        });

        btn.addEventListener('focus', () => {
            if (!keyboardNav) return;
            updateSelection(btn, buttons);
        });

        btn.addEventListener('blur', () => {
            if (!keyboardNav) btn.classList.remove('is-selected');
        });
    });

    if (titleKeyHandler) return;

    // Qualquer clique do mouse desativa a "modalidade teclado"
    document.addEventListener('mousedown', () => { keyboardNav = false; });

    titleKeyHandler = (e) => {
        const wrapper = document.querySelector('.title-screen-wrapper');
        if (!wrapper) return;

        // Overlays (opções/créditos) interceptam a navegação do menu
        if (wrapper.querySelector('.credits-overlay, .title-options-overlay, .ranking-overlay')) return;

        const currentButtons = Array.from(wrapper.querySelectorAll('.menu-btn'));
        if (currentButtons.length === 0) return;

        const currentIndex = currentButtons.indexOf(document.activeElement);

        if (e.key === 'ArrowDown' || e.key === 'Down') {
            e.preventDefault();
            keyboardNav = true;
            const next = currentButtons[(currentIndex + 1) % currentButtons.length];
            updateSelection(next, currentButtons);
        } else if (e.key === 'ArrowUp' || e.key === 'Up') {
            e.preventDefault();
            keyboardNav = true;
            const prev = currentButtons[(currentIndex - 1 + currentButtons.length) % currentButtons.length];
            updateSelection(prev, currentButtons);
        }
    };

    document.addEventListener('keydown', titleKeyHandler);
}

/**
 * Exibe notificação no estilo Toast para botões em desenvolvimento
 */
export function showToast(message) {
    const existingToast = document.querySelector('.title-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'title-toast';
    toast.textContent = message;

    const wrapper = document.querySelector('.title-screen-wrapper') || document.body;
    wrapper.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
}
