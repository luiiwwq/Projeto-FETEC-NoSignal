/** Integração pública com o ranking do Supabase (Cloudflare Pages). */

const SUPABASE_URL = 'https://ymmowxkznmnhflfklcxg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2WhcoOacjeTPSIf1Ue8HUg_yRBZrkzD';
const RANKING_ENDPOINT = `${SUPABASE_URL}/rest/v1/ranking`;

async function requestRanking(path = '', options = {}) {
    const response = await fetch(`${RANKING_ENDPOINT}${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(`Supabase ranking error (${response.status}): ${details}`);
    }

    if (response.status === 204) return null;
    return response.json();
}

/** Registra uma partida quando a cutscene do final for concluída. */
export async function submitRankingResult({ nome, tempoSegundos, mortes = 0, moedas, finalId }) {
    const result = {
        nome: String(nome || 'ARES-1').trim().slice(0, 20),
        tempo_segundos: Math.max(1, Math.floor(tempoSegundos || 1)),
        mortes: Math.max(0, Math.floor(mortes || 0)),
        moedas: Math.max(0, Math.floor(moedas || 0)),
        final_feito: true,
        final_id: String(finalId || '').slice(0, 32)
    };

    return requestRanking('', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(result)
    });
}

/** Retorna os 100 melhores resultados: menor tempo, menos mortes e mais moedas. */
export async function getTopRanking(limit = 100) {
    const query = new URLSearchParams({
        select: 'nome,tempo_segundos,mortes,moedas,final_id,criado_em',
        final_feito: 'eq.true',
        order: 'tempo_segundos.asc,mortes.asc,moedas.desc',
        limit: String(Math.min(100, Math.max(1, Math.floor(limit))))
    });
    return requestRanking(`?${query.toString()}`);
}
