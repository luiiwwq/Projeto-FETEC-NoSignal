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

export function renderCreditsScreen(container) {
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

    // Mede a distância a percorrer e centraliza o bloco ao final da subida
    const scroller = overlay.querySelector('.credits-scroller');
    const viewportH = overlay.offsetHeight;
    const contentH = scroller.scrollHeight;
    const rise = (viewportH + contentH) / 2;
    scroller.style.setProperty('--rise', `${rise}px`);
    scroller.style.animationDuration = `${Math.max(8, Math.round(rise / 70))}s`;

    overlay.querySelector('[data-action="credits-back"]').addEventListener('click', closeCreditsScreen);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCreditsScreen();
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            // ESC volta ao menu, equivalente ao botão VOLTAR (toca o som).
            playClickButtonSound();
            closeCreditsScreen();
        }
    });

    const skipBtn = overlay.querySelector('.credits-skip');
    if (skipBtn) setTimeout(() => skipBtn.focus(), 80);

    return overlay;
}

export function closeCreditsScreen() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
}

export function isCreditsScreenOpen() {
    return !!overlay;
}