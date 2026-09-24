/** Ciclo de vida compartilhado das trilhas em loop (menu, jogo, chefes e cutscenes). */
export function createLoopingMusic(path, { getVolume, name }) {
    let audio = null;
    let requested = false;
    let suspended = false;
    let pending = null;
    let generation = 0;
    let unbindInteraction = null;
    let warned = false;

    const volume = () => {
        const value = getVolume();
        return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
    };

    function clearInteraction() {
        if (unbindInteraction) unbindInteraction();
        unbindInteraction = null;
    }

    function bindInteraction() {
        if (unbindInteraction || typeof window === 'undefined' || !requested || suspended || volume() === 0) return;
        const retry = () => {
            clearInteraction();
            play();
        };
        for (const event of ['pointerdown', 'click', 'keydown', 'touchstart']) window.addEventListener(event, retry);
        unbindInteraction = () => {
            for (const event of ['pointerdown', 'click', 'keydown', 'touchstart']) window.removeEventListener(event, retry);
        };
    }

    function getAudio() {
        if (audio && !audio.error) return audio;
        if (typeof Audio === 'undefined') return null;
        if (audio?.error) {
            generation++;
            pending = null;
            audio = null;
        }

        const current = new Audio(path);
        current.loop = true;
        current.preload = 'auto';
        current.volume = volume();
        audio = current;

        current.addEventListener('error', () => {
            if (audio !== current) return;
            if (!warned) {
                warned = true;
                console.warn(`[Audio] ${name} não pôde ser carregada: ${path}`);
            }
            // Uma falha de mídia invalida este objeto; a próxima interação
            // tenta um novo Audio em vez de reutilizar a instância quebrada.
            generation++;
            pending = null;
            audio = null;
            bindInteraction();
        });
        current.addEventListener('ended', () => {
            if (audio !== current || !requested || suspended || volume() === 0) return;
            // loop=true normalmente evita 'ended', mas alguns navegadores ou
            // streams podem encerrar a faixa mesmo assim.
            generation++;
            pending = null;
            current.currentTime = 0;
            play();
        });
        current.addEventListener('pause', () => {
            if (audio !== current || !requested || suspended || volume() === 0 || !current.paused || current.ended) return;
            // Pausa externa (ex.: sistema suspendeu mídia): não mantenha um
            // play() antigo pendente impedindo a próxima tentativa.
            generation++;
            pending = null;
            bindInteraction();
        });
        current.addEventListener('playing', () => {
            if (audio === current && requested && !suspended) clearInteraction();
        });
        return current;
    }

    function play() {
        if (!requested || suspended || volume() === 0) return;
        const current = getAudio();
        if (!current) return;
        current.loop = true;
        current.volume = volume();
        if (!current.paused && !current.ended) {
            clearInteraction();
            return;
        }
        if (pending) return;
        if (current.ended) current.currentTime = 0;

        bindInteraction();
        const attemptId = ++generation;
        try {
            const result = current.play();
            if (result && typeof result.then === 'function') {
                const attempt = Promise.resolve(result).then(
                    () => {
                        if (generation !== attemptId || audio !== current || !requested || suspended) return;
                        if (current.paused) bindInteraction();
                        else clearInteraction();
                    },
                    () => {
                        if (generation === attemptId && audio === current) bindInteraction();
                    }
                );
                pending = attempt;
                attempt.finally(() => { if (pending === attempt) pending = null; });
            } else if (!current.paused) {
                clearInteraction();
            }
        } catch {
            bindInteraction();
        }
    }

    function invalidate() {
        generation++;
        pending = null;
        clearInteraction();
    }

    return {
        start() {
            requested = true;
            suspended = false;
            play();
        },
        pause() {
            if (!requested) return;
            suspended = true;
            invalidate();
            audio?.pause();
        },
        resume() {
            if (!requested) return;
            suspended = false;
            play();
        },
        stop() {
            requested = false;
            suspended = false;
            invalidate();
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        },
        setVolume() {
            if (audio) audio.volume = volume();
            if (volume() === 0) {
                invalidate();
                audio?.pause();
            } else {
                play();
            }
        },
        preload() {
            const current = getAudio();
            if (!current || current.readyState >= 2) return Promise.resolve();
            return new Promise((resolve) => {
                const done = () => {
                    clearTimeout(timer);
                    current.removeEventListener('loadeddata', done);
                    current.removeEventListener('error', done);
                    resolve();
                };
                const timer = setTimeout(done, 12000);
                current.addEventListener('loadeddata', done);
                current.addEventListener('error', done);
            });
        },
    };
}
