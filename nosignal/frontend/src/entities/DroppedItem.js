/**
 * DroppedItem.js
 * Item de missão presente no mundo (peça da nave).
 *
 * Fica saltitando no ponto onde foi deixado/dropado — o jogador NUNCA o pega
 * automaticamente. Ao chegar perto aparece um pop-up com "[E] COLETAR", o nome
 * e a descrição; a coleta só acontece quando o jogador pressiona E.
 *
 * Implementa a mesma interface leve que o engine espera (update/render), mas
 * não participa de colisão/time de balas: é só um objeto do cenário.
 */

import {
    SPACESHIP_ITEM_DEFS,
    getMissionItemImage,
} from '../content/missionItems.js';

export class DroppedItem {
    /**
     * @param {string} itemId  id da peça em SPACESHIP_ITEM_DEFS
     * @param {number} x       posição do chão (coordenada do mapa)
     * @param {number} y       posição do chão (coordenada do mapa)
     * @param {string} mapId   mapa em que o item aparece
     */
    constructor(itemId, x, y, mapId = null) {
        this.id = itemId;
        this.x = x;
        this.y = y;
        this.mapId = mapId;
        this.def = SPACESHIP_ITEM_DEFS[itemId] || null;

        this.collected = false;
        this.animTime = Math.random() * Math.PI * 2;

        // Animação de "pulo" do item.
        this.bobSpeed = 3.6;
        this.bobHeight = 11;

        // Distância centro a centro para o pop-up de coleta aparecer.
        this.pickupRange = 78;
    }

    update(dt) {
        this.animTime += dt;
    }

    // Altura total que o sprite sobe acima do chão neste instante (0..bobHeight).
    get bobOffset() {
        return Math.abs(Math.sin(this.animTime * this.bobSpeed)) * this.bobHeight;
    }

    isPlayerNear(player) {
        if (!player || player.isDead) return false;
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        return Math.hypot(dx, dy) <= this.pickupRange;
    }

    render(ctx, camera) {
        const img = getMissionItemImage(this.id);
        const screen = camera.worldToScreen(this.x, this.y);
        const bob = this.bobOffset;

        // Sombra no chão: encolhe conforme o item sobe no pulo.
        const rise = bob / this.bobHeight;
        const shadowScale = 1 - rise * 0.4;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 5, 5, 0.45)';
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, 26 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (img) {
            const drawH = 72;
            const ratio = img.naturalWidth / img.naturalHeight;
            const drawW = Math.round(drawH * ratio);
            ctx.drawImage(
                img,
                Math.round(screen.x - drawW / 2),
                Math.round(screen.y - drawH + bob),
                drawW,
                drawH
            );
        } else {
            // Fallback enquanto o sprite carrega.
            const fallback = (this.def && this.def.color) || '#f6c885';
            ctx.fillStyle = fallback;
            ctx.fillRect(Math.round(screen.x - 12), Math.round(screen.y - 24 + bob), 24, 24);
        }
        ctx.restore();
    }
}