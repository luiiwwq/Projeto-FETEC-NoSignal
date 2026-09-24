/** Persistência de controles por nome de astronauta no Supabase (Cloudflare Pages). */

import { withNetworkTimeout } from './networkTimeout.js';

const SUPABASE_URL = 'https://ymmowxkznmnhflfklcxg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2WhcoOacjeTPSIf1Ue8HUg_yRBZrkzD';
const REST_ENDPOINT = `${SUPABASE_URL}/rest/v1`;

async function requestControls(path, options = {}) {
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
            throw new Error(`Supabase controles error (${response.status}): ${details}`);
        }

        if (response.status === 204) return null;
        return response.json();
    });
}

/** Busca a config de controles salva para um nome (null se não existir). */
export async function fetchControlsByPlayer(nome) {
    const normalized = String(nome || '').trim().toUpperCase().slice(0, 20);
    if (!normalized) return null;

    const query = new URLSearchParams({
        select: 'controles',
        nome: `eq.${normalized}`
    });
    const rows = await requestControls(`/controles_jogador?${query.toString()}`);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const raw = rows[0]?.controles;
    return raw && typeof raw === 'object' ? raw : null;
}

/** Salva (upsert) a config de controles atrelada ao nome do astronauta. */
export async function saveControlsByPlayer(nome, controles) {
    const normalized = String(nome || '').trim().toUpperCase().slice(0, 20);
    if (!normalized) return;

    return requestControls('/rpc/salvar_controles', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ p_nome: normalized, p_controles: controles })
    });
}
