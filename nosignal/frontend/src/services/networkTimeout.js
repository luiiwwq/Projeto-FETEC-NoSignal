/** Limita a requisição inteira, inclusive a leitura do corpo da resposta. */
export async function withNetworkTimeout(run, ms = 8000) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer;
    const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller?.abort();
            reject(new Error('Tempo limite da conexão excedido.'));
        }, ms);
    });

    try {
        return await Promise.race([Promise.resolve().then(() => run(controller?.signal)), deadline]);
    } finally {
        clearTimeout(timer);
    }
}
