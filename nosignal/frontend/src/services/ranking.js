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

/** Retorna os 100 melhores resultados: menor tempo, menos mortes e mais moedas.
 * Informe finalId ('final1' a 'final4') para um ranking exclusivo daquele final.
 * No GLOBAL competem apenas os Finais 03 e 04 (os caminhos que exigem o
 * conserto da nave); cada astronauta conta uma vez, com sua melhor partida.
 */
export async function getTopRanking(limit = 100, finalId = '') {
    const isFinalFilter = /^final[1-4]$/.test(String(finalId || ''));
    const target = Math.min(100, Math.max(1, Math.floor(limit)));

    const evaluableFinals = 'in.(final3,final4)';

    const query = new URLSearchParams({
        select: 'nome,personagem_id,tempo_segundos,mortes,moedas,final_id',
        final_feito: 'eq.true',
        order: 'tempo_segundos.asc,mortes.asc,moedas.desc,id.asc',
        // No GLOBAL um nick pode ter até 4 linhas (uma por final); busca um
        // pouco mais para deduplicar e ainda entregar os `target` melhores.
        limit: String(isFinalFilter ? target : Math.min(400, target * 4))
    });
    if (isFinalFilter) query.append('final_id', `eq.${finalId}`);
    else query.append('final_id', evaluableFinals);

    const rows = await requestRanking(`/ranking?${query.toString()}`);
    if (!Array.isArray(rows)) return [];

    // Ranking de um final específico: a unicidade (nome, final) já entrega uma
    // linha por nick, sem necessidade de deduplicar.
    if (isFinalFilter) return rows;

    // GLOBAL: só Finais 03 e 04 contam; mantém a melhor partida de cada
    // astronauta, na ordem que já veio (menor tempo; empates: menos mortes,
    // mais moedas).
    const elegiveis = rows.filter((row) => row && /^final[34]$/.test(String(row.final_id || '')));
    const seen = new Set();
    const uniq = [];
    for (const row of elegiveis) {
        const key = String(row?.nome || '').trim().toUpperCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        uniq.push(row);
        if (uniq.length >= target) break;
    }
    return uniq;
}
