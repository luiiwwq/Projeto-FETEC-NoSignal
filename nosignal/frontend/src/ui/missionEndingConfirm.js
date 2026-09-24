/** Confirma a decisão irreversível de iniciar a terraformação sem a ARES-1. */
export function confirmIncompleteMission(container) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'mission-ending-confirm';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'mission-ending-confirm-title');
        const panel = document.createElement('div');
        panel.className = 'ns-pixel-panel mission-ending-confirm__panel';
        const title = document.createElement('h2');
        title.id = 'mission-ending-confirm-title';
        title.className = 'mission-ending-confirm__title';
        title.textContent = 'CONCLUIR MISSÃO?';
        const message = document.createElement('p');
        message.className = 'mission-ending-confirm__message';
        message.textContent = 'A ARES-1 ainda não pode partir. Iniciar a terraformação agora significa permanecer em Duna sem resgate.';
        const actions = document.createElement('div');
        actions.className = 'mission-ending-confirm__actions';
        const confirm = document.createElement('button');
        confirm.className = 'ns-pixel-button mission-ending-confirm__button mission-ending-confirm__button--primary';
        confirm.type = 'button';
        confirm.textContent = 'CONCLUIR MISSÃO';
        const cancel = document.createElement('button');
        cancel.className = 'ns-pixel-button mission-ending-confirm__button';
        cancel.type = 'button';
        cancel.textContent = 'CONTINUAR EXPLORANDO';
        const finish = (confirmed) => {
            window.removeEventListener('keydown', onKey, true);
            overlay.remove();
            resolve(confirmed);
        };
        const onKey = (event) => {
            if (event.code !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            finish(false);
        };
        confirm.addEventListener('click', () => finish(true), { once: true });
        cancel.addEventListener('click', () => finish(false), { once: true });
        actions.append(confirm, cancel);
        panel.append(title, message, actions);
        overlay.appendChild(panel);
        container.appendChild(overlay);
        window.addEventListener('keydown', onKey, true);
    });
}
