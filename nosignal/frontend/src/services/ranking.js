/** Integração pública com o ranking do Supabase (Cloudflare Pages). */

import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../content/characters.js';
import { withNetworkTimeout } from './networkTimeout.js';

const SUPABASE_URL = 'https://ymmowxkznmnhflfklcxg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2WhcoOacjeTPSIf1Ue8HUg_yRBZrkzD';
const REST_ENDPOINT = `${SUPABASE_URL}/rest/v1`;

/** Identificador da partida usado para não contar duas vezes o mesmo final. */
export function createEndingAttemptId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function requestRanking(path, options = {}) {
    return withNetworkTimeout(async (signal) => {
        const response = await fetch(`${REST_ENDPOINT}${path}`, {
            ...options,
            signal,
            headers: {
                apikey: SUPABASE_PUBLISHABLE_KEY,
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
    });
}

/** Soma uma conclusão por partida; repetir o mesmo partidaId não altera a contagem. */
export async function registerEndingResult({ partidaId, finalId }) {
    return requestRanking('/rpc/registrar_final', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ p_partida_id: partidaId, p_final_id: finalId })
    });
}

export async function getEndingCounts() {
    return requestRanking('/rpc/contagem_finais', { method: 'POST', body: '{}' });
}

/** Registra uma partida quando a cutscene do final for concluída. */
export async function submitRankingResult({ nome, personagemId, tempoSegundos, mortes = 0, moedas, finalId }) {
    const result = {
        p_nome: String(nome || 'ARES-1').trim().toUpperCase().slice(0, 20) || 'ARES-1',
        p_personagem_id: CHARACTERS[personagemId] ? personagemId : DEFAULT_CHARACTER_ID,
        p_tempo_segundos: Math.max(1, Math.floor(tempoSegundos || 1)),
        p_mortes: Math.max(0, Math.floor(mortes || 0)),
        p_moedas: Math.max(0, Math.floor(moedas || 0)),
        p_final_id: String(finalId || '').slice(0, 32)
    };

    return requestRanking('/rpc/salvar_ranking', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(result)
    });
}

/** Retorna os 100 melhores resultados: menor tempo, menos mortes e mais moedas. */
export async function getTopRanking(limit = 100) {
    const query = new URLSearchParams({
        select: 'nome,personagem_id,tempo_segundos,mortes,moedas,final_id',
        final_feito: 'eq.true',
        order: 'tempo_segundos.asc,mortes.asc,moedas.desc,id.asc',
        limit: String(Math.min(100, Math.max(1, Math.floor(limit))))
    });
    return requestRanking(`/ranking?${query.toString()}`);
}
