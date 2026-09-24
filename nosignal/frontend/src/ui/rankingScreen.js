import { getEndingCounts, getTopRanking } from '../services/ranking.js';
import { playClickButtonSound } from '../audio/uiClickSound.js';
import { CHARACTER_IDS } from '../content/characters.js';

let activeOverlay = null;

const CHARACTER_LABELS = {
    [CHARACTER_IDS.ASTRONAUT]: 'ASTRONAUT',
    [CHARACTER_IDS.SPACE_LIZARD]: 'SPACE LIZARD',
    [CHARACTER_IDS.OCSTRONAUT]: 'OCSTRONAUT'
};

function formatCharacter(characterId) {
    return CHARACTER_LABELS[characterId] || '—';
}

function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return hours > 0
        ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
        : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatEnding(finalId) {
    const match = /^final(\d+)$/i.exec(String(finalId || ''));
    return match ? `FINAL ${match[1].padStart(2, '0')}` : (finalId || '—');
}

function makeCell(tag, text, className = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
}

function renderResults(overlay, results) {
    const content = overlay.querySelector('[data-ranking-content]');
    content.replaceChildren();

    if (!results.length) {
        content.appendChild(makeCell('p', 'AINDA NÃO HÁ RESULTADOS. CONCLUA UM FINAL PARA ENTRAR NO RANKING.', 'ranking-empty'));
        return;
    }

    const podium = document.createElement('div');
    podium.className = 'ranking-podium';
    results.slice(0, 3).forEach((result, index) => {
        const card = document.createElement('article');
        card.className = `ranking-podium__card ranking-podium__card--${index + 1}`;
        card.append(
            makeCell('span', `#${index + 1}`, 'ranking-podium__place'),
            makeCell('strong', result.nome || 'ASTRONAUTA', 'ranking-podium__name'),
            makeCell('span', formatCharacter(result.personagem_id), 'ranking-podium__character'),
            makeCell('span', formatTime(result.tempo_segundos), 'ranking-podium__time'),
            makeCell('span', `${Number(result.mortes) || 0} MORTES · ${Number(result.moedas) || 0} MOEDAS`, 'ranking-podium__stats'),
            makeCell('span', formatEnding(result.final_id), 'ranking-podium__stats')
        );
        podium.appendChild(card);
    });
    content.appendChild(podium);

    if (results.length <= 3) return;

    const tableWrap = document.createElement('div');
    tableWrap.className = 'ranking-table-wrap';
    const table = document.createElement('table');
    table.className = 'ranking-table';
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['POS.', 'ASTRONAUTA', 'PERSONAGEM', 'TEMPO', 'MORTES', 'MOEDAS', 'FINAL'].forEach((label) => {
        headerRow.appendChild(makeCell('th', label));
    });
    header.appendChild(headerRow);
    const body = document.createElement('tbody');

    results.slice(3).forEach((result, index) => {
        const row = document.createElement('tr');
        [
            String(index + 4),
            result.nome || 'ASTRONAUTA',
            formatCharacter(result.personagem_id),
            formatTime(result.tempo_segundos),
            String(Number(result.mortes) || 0),
            String(Number(result.moedas) || 0),
            formatEnding(result.final_id)
        ].forEach((value) => row.appendChild(makeCell('td', value)));
        body.appendChild(row);
    });

    table.append(header, body);
    tableWrap.appendChild(table);
    content.appendChild(tableWrap);
}

async function loadResults(overlay) {
    const content = overlay.querySelector('[data-ranking-content]');
    const counts = overlay.querySelector('[data-ranking-ending-counts]');
    const refresh = overlay.querySelector('[data-ranking-refresh]');
    content.replaceChildren(makeCell('p', 'CONSULTANDO TELEMETRIA...', 'ranking-loading'));
    counts.replaceChildren(makeCell('span', 'CONSULTANDO FINAIS...'));
    refresh.disabled = true;

    try {
        const [rankingResponse, countsResponse] = await Promise.allSettled([getTopRanking(100), getEndingCounts()]);
        if (!overlay.isConnected) return;
        if (rankingResponse.status === 'fulfilled') {
            renderResults(overlay, Array.isArray(rankingResponse.value) ? rankingResponse.value : []);
        } else {
            console.error('[Ranking] Falha ao carregar os resultados:', rankingResponse.reason);
            content.replaceChildren(makeCell('p', 'RANKING INDISPONÍVEL. VERIFIQUE A CONEXÃO COM O BANCO DE DADOS.', 'ranking-error'));
        }

        if (countsResponse.status === 'fulfilled' && Array.isArray(countsResponse.value)) {
            const totals = new Map(countsResponse.value.map((entry) => [entry.final_id, Number(entry.total) || 0]));
            counts.replaceChildren(...[1, 2, 3, 4].map((number) => {
                const item = document.createElement('span');
                item.className = 'ranking-ending-count';
                item.append(makeCell('strong', `FINAL ${number}`), makeCell('span', String(totals.get(`final${number}`) || 0)));
                return item;
            }));
        } else {
            if (countsResponse.status === 'rejected') console.error('[Ranking] Falha ao carregar contagem dos finais:', countsResponse.reason);
            counts.replaceChildren(makeCell('span', 'CONTAGEM DE FINAIS INDISPONÍVEL'));
        }
    } finally {
        refresh.disabled = false;
    }
}

export function renderRankingScreen(container) {
    if (activeOverlay) return activeOverlay;
    const mount = container?.querySelector('.title-screen-wrapper') || container || document.body;
    const overlay = document.createElement('section');
    overlay.className = 'ranking-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ranking-title');
    overlay.innerHTML = `
        <div class="ranking-panel">
            <header class="ranking-header">
                <div>
                    <p class="ranking-kicker">NO SIGNAL // TELEMETRIA GLOBAL</p>
                    <h2 id="ranking-title">RANKING</h2>
                    <p class="ranking-subtitle">OS MENORES TEMPOS LIDERAM. EMPATES: MENOS MORTES, DEPOIS MAIS MOEDAS.</p>
                </div>
                <button type="button" class="ranking-close" data-ranking-back aria-label="Voltar ao menu">X</button>
            </header>
            <div class="ranking-ending-counts" data-ranking-ending-counts aria-live="polite"></div>
            <div class="ranking-content" data-ranking-content aria-live="polite"></div>
            <footer class="ranking-footer">
                <span>RESULTADOS REGISTRADOS AO CONCLUIR UM FINAL</span>
                <div class="ranking-actions">
                    <button type="button" class="ranking-action" data-ranking-refresh>ATUALIZAR</button>
                    <button type="button" class="ranking-action" data-ranking-back>VOLTAR</button>
                </div>
            </footer>
        </div>
    `;
    mount.appendChild(overlay);
    activeOverlay = overlay;

    const close = () => closeRankingScreen();
    overlay.querySelectorAll('[data-ranking-back]').forEach((button) => button.addEventListener('click', close));
    overlay.querySelector('[data-ranking-refresh]').addEventListener('click', () => {
        playClickButtonSound();
        loadResults(overlay);
    });
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close();
    });
    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
        }
    });

    overlay.querySelector('[data-ranking-back]').focus();
    loadResults(overlay);
    return overlay;
}

export function closeRankingScreen() {
    if (!activeOverlay) return;
    activeOverlay.remove();
    activeOverlay = null;
}
