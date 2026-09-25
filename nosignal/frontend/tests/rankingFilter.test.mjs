import test from 'node:test';
import assert from 'node:assert/strict';

import { getTopRanking } from '../src/services/ranking.js';

test('getTopRanking filtra por final apenas quando for um dos quatro finais', async () => {
    const originalFetch = globalThis.fetch;
    const urls = [];
    globalThis.fetch = async (url, options) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => [] };
    };
    try {
        await getTopRanking(100, 'final1');
        await getTopRanking(100, 'final2');
        await getTopRanking(100, 'final3');
        await getTopRanking(100, 'final4');
        await getTopRanking(100);
        await getTopRanking(100, 'final5');
        await getTopRanking(100, '');
        assert.equal(urls.length, 7);
        for (let number = 1; number <= 4; number++) {
            assert.match(urls[number - 1], new RegExp(`final_id=eq\\.final${number}`));
        }
        assert.doesNotMatch(urls[4], /final_id=/);
        assert.doesNotMatch(urls[5], /final_id=/);
        assert.doesNotMatch(urls[6], /final_id=/);
        assert.ok(urls.every((url) => url.includes('final_feito=eq.true')));
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('getTopRanking mantém a ordenação e o limite na consulta', async () => {
    const originalFetch = globalThis.fetch;
    let url = '';
    globalThis.fetch = async (requestUrl) => {
        url = requestUrl;
        return { ok: true, status: 200, json: async () => [] };
    };
    try {
        await getTopRanking(20, 'final3');
        const params = new URLSearchParams(url.split('?')[1]);
        assert.equal(params.get('order'), 'tempo_segundos.asc,mortes.asc,moedas.desc,id.asc');
        assert.equal(params.get('limit'), '20');
        assert.equal(params.get('final_id'), 'eq.final3');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('getTopRanking GLOBAL deduplica por nick e mantém só a melhor partida', async () => {
    const originalFetch = globalThis.fetch;
    let url = '';
    const rows = [
        { nome: 'BRENO', personagem_id: 'astronaut', tempo_segundos: 300, mortes: 1, moedas: 50, final_id: 'final2' },
        { nome: 'ARES', personagem_id: 'space-lizard', tempo_segundos: 120, mortes: 0, moedas: 80, final_id: 'final4' },
        { nome: 'BRENO', personagem_id: 'ocstronaut', tempo_segundos: 600, mortes: 3, moedas: 20, final_id: 'final4' }
    ];
    globalThis.fetch = async (requestUrl) => {
        url = requestUrl;
        return { ok: true, status: 200, json: async () => rows };
    };
    try {
        const result = await getTopRanking(100);
        // O BRENO aparece duas vezes (final2 e final4); no GLOBAL só a primeira
        // (melhor) conta — e nunca dois BRENOs no mesmo ranking.
        assert.equal(result.length, 2);
        const brenos = result.filter((row) => row.nome === 'BRENO');
        assert.equal(brenos.length, 1, 'nick não pode repetir no GLOBAL');
        assert.equal(brenos[0].final_id, 'final2', 'o melhor tempo do nick vence');
        // Busca o dobro para conseguir deduplicar e ainda ter o pedido.
        const params = new URLSearchParams(url.split('?')[1]);
        assert.equal(params.get('limit'), '400');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('getTopRanking de um final não deduplica (a unicidade nome+final é do banco)', async () => {
    const originalFetch = globalThis.fetch;
    const rows = [
        { nome: 'BRENO', personagem_id: 'astronaut', tempo_segundos: 300, mortes: 1, moedas: 50, final_id: 'final2' },
        { nome: 'ARES', personagem_id: 'space-lizard', tempo_segundos: 120, mortes: 0, moedas: 80, final_id: 'final2' }
    ];
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => rows });
    try {
        const result = await getTopRanking(100, 'final2');
        assert.equal(result.length, 2);
    } finally {
        globalThis.fetch = originalFetch;
    }
});