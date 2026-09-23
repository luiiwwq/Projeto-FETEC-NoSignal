const LINES = [
    { speaker: 'player', text: 'Você está vivo! Que ótimo, achei que estivesse morto.' },
    { speaker: 'enemy', text: 'Vocês não podem terraformar este lugar.' },
    { speaker: 'player', text: 'Por quê? Do que você está falando?' },
    { speaker: 'enemy', text: 'Você viu o que existe aqui? Existem vidas. Não podemos chegar e simplesmente destruí-las por puro egoísmo.' },
    { speaker: 'player', text: 'E deixar muitas outras vidas morrerem em Kerbin? Não posso fazer isso.' },
    { speaker: 'enemy', text: 'Então você pretende salvar Kerbin matando todos eles?' },
    { speaker: 'player', text: 'Milhões de pessoas estão morrendo. Não temos escolha.' },
    { speaker: 'enemy', text: 'Eu não posso deixar que você os extermine.' },
    { speaker: 'enemy', text: 'Os dois entram em confronto.' }
];

const PLAYER_PORTRAITS = {
    astronaut: './src/assets/sprites/Dialog/astronaut_dialog.png',
    'space-lizard': './src/assets/sprites/Dialog/space_lizard_ally.png',
    ocstronaut: './src/assets/sprites/Ocstronaut/Octstronaut/Octstronaut/rotations/south.png'
};

const ENEMY_PORTRAITS = {
    astronaut: './src/assets/sprites/Dialog/astronaut_dialog.png',
    'space-lizard': './src/assets/sprites/Dialog/space_lizard_Dialog.png',
    ocstronaut: './src/assets/sprites/Ocstronaut/Octstronaut/Octstronaut/rotations/south.png'
};

const CHARACTER_NAMES = {
    astronaut: 'Astronauta',
    'space-lizard': 'Space Lizard',
    ocstronaut: 'Ocstronaut'
};

export function playNpcDialogue(container, playerCharacterId, enemyCharacterId = 'ocstronaut') {
    return new Promise((resolve) => {
        const playerPortrait = PLAYER_PORTRAITS[playerCharacterId] || PLAYER_PORTRAITS.astronaut;
        const enemyPortrait = ENEMY_PORTRAITS[enemyCharacterId] || ENEMY_PORTRAITS.ocstronaut;
        const playerName = CHARACTER_NAMES[playerCharacterId] || CHARACTER_NAMES.astronaut;
        const enemyName = CHARACTER_NAMES[enemyCharacterId] || CHARACTER_NAMES.ocstronaut;
        const overlay = document.createElement('div');
        overlay.id = 'npc-dialogue-overlay';
        overlay.style.cssText = 'position:absolute;inset:0;z-index:9100;display:flex;align-items:flex-end;justify-content:center;padding:clamp(12px,3vw,38px);box-sizing:border-box;background:linear-gradient(0deg,rgba(4,7,14,.62),transparent 58%);font-family:var(--font-pixel,"Press Start 2P",monospace);';
        const panel = document.createElement('div');
        panel.style.cssText = 'position:relative;display:flex;align-items:stretch;gap:0;width:min(1240px,100%);min-height:clamp(150px,20vw,230px);padding:8px;box-sizing:border-box;background:#14090b;border:3px solid #e07228;box-shadow:0 0 35px rgba(224,114,40,.32),inset 0 0 20px rgba(0,0,0,.9),0 8px 0 #090507;color:#f6c885;image-rendering:pixelated;';
        const portraitFrame = document.createElement('div');
        portraitFrame.style.cssText = 'position:relative;display:flex;align-items:flex-end;justify-content:center;flex:0 0 clamp(120px,18vw,210px);min-height:130px;overflow:hidden;background:#190a0d;border:2px solid #6b261a;box-shadow:inset 0 0 16px rgba(0,0,0,.9);';
        const portrait = document.createElement('img');
        portrait.style.cssText = 'width:100%;height:100%;max-height:220px;object-fit:contain;object-position:center bottom;image-rendering:pixelated;filter:drop-shadow(3px 3px 0 #05080d);';
        portrait.src = playerPortrait;
        portraitFrame.appendChild(portrait);
        const textBox = document.createElement('div');
        textBox.style.cssText = 'position:relative;flex:1;align-self:stretch;display:flex;flex-direction:column;justify-content:center;min-width:0;padding:20px clamp(18px,3vw,42px) 28px;box-sizing:border-box;background:#190a0d;border:2px solid #6b261a;border-left:0;';
        const name = document.createElement('strong');
        name.style.cssText = 'width:max-content;max-width:100%;padding:8px 12px;margin:0 0 14px -2px;background:#230d10;border:1px solid #e07228;box-shadow:3px 3px 0 #090507;color:#f6c885;font-size:clamp(8px,1vw,11px);line-height:1.6;letter-spacing:.08em;';
        const line = document.createElement('div');
        line.style.cssText = 'max-width:950px;color:#e8d8c3;font-size:clamp(8px,1vw,11px);line-height:2.1;letter-spacing:.015em;';
        const hint = document.createElement('div');
        hint.textContent = 'ENTER / ESPAÇO / CLIQUE  ▶';
        hint.style.cssText = 'position:absolute;right:18px;bottom:9px;color:#e07228;font-size:7px;line-height:1.6;';
        textBox.append(name, line);
        textBox.appendChild(hint);
        panel.append(portraitFrame, textBox);
        overlay.appendChild(panel);
        container.appendChild(overlay);

        let index = 0;
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            window.removeEventListener('keydown', onKey, true);
            overlay.remove();
            resolve();
        };
        const showLine = () => {
            const entry = LINES[index];
            if (!entry) return finish();
            const isPlayer = entry.speaker === 'player';
            name.textContent = isPlayer ? playerName : enemyName;
            line.textContent = entry.text;
            const currentPortrait = isPlayer ? playerPortrait : enemyPortrait;
            portrait.src = currentPortrait;
            // A rotação sul é um sprite de gameplay com bastante espaço vazio;
            // ampliamos dentro do mesmo quadro para igualar o tamanho visual dos retratos.
            portrait.style.transform = currentPortrait.includes('/Ocstronaut/') ? 'scale(1.8)' : 'none';
            portrait.style.opacity = '1';
        };
        const next = () => { index += 1; showLine(); };
        const onKey = (event) => {
            if (event.code === 'Enter' || event.code === 'Space') {
                event.preventDefault();
                event.stopImmediatePropagation();
                next();
            }
        };
        overlay.addEventListener('click', next);
        window.addEventListener('keydown', onKey, true);
        showLine();
    });
}
