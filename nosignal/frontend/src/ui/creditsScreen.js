/**
 * creditsScreen.js
 * Tela de créditos com estética da tela inicial — estilo créditos de filme.
 * O bloco sobe lentamente da parte de baixo e para centralizado na tela.
 */

import { playClickButtonSound } from '../audio/uiClickSound.js';

const CREDITS_HTML = `
    <div class="credits-track">
        <div class="credits-block">
            <p class="credits-kicker">NO SIGNAL</p>
            <p class="credits-title">CRÉDITOS</p>
        </div>

        <div class="credits-block">
            <p class="credits-role">DESENVOLVEDORES</p>
            <p class="credits-name">LUIZ MIGUEL</p>
            <p class="credits-name">MIGUEL MIRANDA</p>
            <p class="credits-name">NICOLAS OLIVEIRA</p>
            <p class="credits-name">OCTÁVIO BISSOLI</p>
            <p class="credits-name">YASMIN EGE</p>
        </div>

        <div class="credits-block">
            <p class="credits-role">TURMA</p>
            <p class="credits-class">2° DESENVOLVIMENTO DE SISTEMAS</p>
            <p class="credits-class credits-class--light">TARDE</p>
        </div>

        <div class="credits-block">
            <p class="credits-role">AGRADECIMENTOS</p>
            <p class="credits-name credits-name--sm">OBRIGADO POR JOGAR!</p>
        </div>
    </div>
`;

let overlay = null;
let revealTimer = null;

export function renderCreditsScreen(container, { afterEnding = false, onBack = null } = {}) {
    if (overlay) return overlay;

    const mount = container && container.querySelector('.title-screen-wrapper')
        ? container.querySelector('.title-screen-wrapper')
        : container || document.body;

    overlay = document.createElement('section');
    overlay.className = 'credits-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
        <div class="credits-scroller">${CREDITS_HTML}</div>
        <button type="button" class="credits-skip" data-action="credits-back">VOLTAR AO MENU</button>
    `;

    mount.appendChild(overlay);
    const backButton = overlay.querySelector('[data-action="credits-back"]');
    if (afterEnding) backButton.hidden = true;

    // Mede a distância a percorrer e centraliza o bloco ao final da subida
    const scroller = overlay.querySelector('.credits-scroller');
    const viewportH = overlay.offsetHeight;
    const contentH = scroller.scrollHeight;
    const rise = (viewportH + contentH) / 2;
    const duration = Math.max(8, Math.round(rise / 70));
    scroller.style.setProperty('--rise', `${rise}px`);
    scroller.style.animationDuration = `${duration}s`;

    const showReturnButton = () => {
        if (!overlay || !backButton.isConnected || !backButton.hidden) return;
        backButton.hidden = false;
        backButton.focus();
    };
    if (afterEnding) {
        scroller.addEventListener('animationend', (event) => {
            if (event.animationName === 'creditsRise') showReturnButton();
        });
        // Fallback se o navegador não disparar animationend.
        revealTimer = setTimeout(showReturnButton, duration * 1000 + 250);
        overlay.tabIndex = -1;
        overlay.focus();
    }

    const goBack = () => {
        if (afterEnding && backButton.hidden) return;
        closeCreditsScreen();
        if (onBack) onBack();
    };
    backButton.addEventListener('click', goBack);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !afterEnding) goBack();
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            playClickButtonSound();
            if (afterEnding && backButton.hidden) {
                // ESC adianta os créditos, mas ainda exige VOLTAR AO MENU.
                scroller.style.animation = 'none';
                scroller.style.transform = `translateY(-${rise}px)`;
                showReturnButton();
            } else {
                goBack();
            }
        }
    });

    if (!afterEnding) setTimeout(() => { if (backButton.isConnected) backButton.focus(); }, 80);

    return overlay;
}

export function closeCreditsScreen() {
    if (!overlay) return;
    clearTimeout(revealTimer);
    revealTimer = null;
    overlay.remove();
    overlay = null;
}

export function isCreditsScreenOpen() {
    return !!overlay;
}
