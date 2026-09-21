/**
 * SkeletonAxeBoss.js
 * The ogre-sized Skeleton_Axe that now guards the Martian Core (map_nucle).
 *
 * It inherits the full Skeleton_Axe behaviour (AI, melee profile, animation
 * sheets) and only overrides what makes it a boss:
 *   - 500 HP (vs 150 for a grunt)
 *   - bigger render scale (2.5x, up from the old 4x of the 22-43px frames)
 *   - an orange Mars-toned color filter applied to the artwork ONLY (drawn
 *     inside a ctx.save/ctx.filter/ctx.drawImage/ctx.restore block), a proper
 *     boss-bar HP like the Necromancer, and the "SINAL REIVINDICADO" defeat
 *     flow shared with the king-room boss.
 *
 * Spawn post (LOCAL mars-core coordinates): NUCLEUS_SKELETON_AXE_BOSS_SPAWN.
 * This is the Skeleton_Axe removed from the Catacombs combat.
 */

import {
    SkeletonAxe,
    SKELETON_STATES,
    SKELETON_ATTACK_DAMAGE,
    SKELETON_COLLIDER_HALF_W,
    SKELETON_COLLIDER_HALF_H,
} from './SkeletonAxe.js';

/* ── Boss tuning ─────────────────────────────────────────── */
export const SKELETON_AXE_BOSS_MAX_HP = 750;
// Mesmo dano por golpe dos antigos esqueletos (40 de dano) com vida de boss.
// A CADÊNCIA é bem mais rápida: cooldown de 0.5s e animação 2.5x veloz.
export const SKELETON_AXE_BOSS_ATTACK_DAMAGE = SKELETON_ATTACK_DAMAGE;
export const SKELETON_AXE_BOSS_ATTACK_COOLDOWN = 0.5;      // segundos entre golpes
export const SKELETON_AXE_BOSS_ANIM_SPEED_MUL = 2.5;       // animação 2.5x mais rápida (corrida/reação)
// Velocidade da animação de ATAQUE do boss (independente da corrida): mais
// lenta que os 2.5x para o golpe ficar pesado, sem mudar o cooldown.
export const SKELETON_AXE_BOSS_ATTACK_ANIM_SPEED_MUL = 1.2;
// Ataque com alcance maior que os esqueletos (42 px): o machado enorme do
// guardião atinge o jogador mesmo sem ele estar colado no boss.
export const SKELETON_AXE_BOSS_ATTACK_RANGE = 125;
// Perseguição mais veloz que os esqueletos comuns (70 px/s * 1.55 ≈ 108 px/s).
export const SKELETON_AXE_BOSS_SPEED_MUL = 1.55;
export const SKELETON_AXE_BOSS_COLLIDER_HALF_W = SKELETON_COLLIDER_HALF_W;
export const SKELETON_AXE_BOSS_COLLIDER_HALF_H = SKELETON_COLLIDER_HALF_H;
// Hitbox de ACERTO maior que o collider de movimento: como o render é 13x, o
// corpo desenhado é muito maior que os 48px do collider físico. Essa meia-largura
// extra (só comprimento — altura continua a mesma) é usada para as balas
// acertarem o corpo todo do guardião.
export const SKELETON_AXE_BOSS_HIT_HALF_W = 100; // 200px de largura de acerto
// 4x: boss bem grande no Núcleo (golpe fica com ~168px de altura).
export const SKELETON_AXE_BOSS_RENDER_SCALE = 13.0;

// Filtro laranja (tom marciano) aplicado SOMENTE ao asset do boss — nunca nos
// golens/esqueletos comuns nem no cenário. O Núcleo é a única mapa sem filtro
// de água/brilho e o boss carrega sozinho o tom da "arena vermelha".
export const SKELETON_AXE_BOSS_FILTER = 'sepia(0.72) saturate(2.3) hue-rotate(-8deg) brightness(1.03) contrast(1.05)';

/* ── Local spawn layout (MARS_CORE coordinate space) ───────
 * Coordenadas LOCAIS do `mars-core` (1536×1024), ponto de pés caminhável
 * (col 24 / row 16). Não são coordenadas de superfície — o motor spawna o
 * boss com spawn.x/spawn.y diretamente como posição dos pés no Núcleo.    */
export const NUCLEUS_SKELETON_AXE_BOSS_SPAWN = { id: 'nucleus-skeleton-axe-boss', x: 792, y: 512 };

export class SkeletonAxeBoss extends SkeletonAxe {
    constructor(x = 0, y = 0, { id = null } = {}) {
        super(x, y, { id });

        this.name = 'OLD DUNA GUARDIAN';
        this.maxHp = SKELETON_AXE_BOSS_MAX_HP;
        this.hp = this.maxHp;
        this.attackDamage = SKELETON_AXE_BOSS_ATTACK_DAMAGE;
        this.attackCooldown = 0;
        // Ataques rápidos: cooldown curto + animação 2.5x (lido pelo render base)
        this.attackCooldownDuration = SKELETON_AXE_BOSS_ATTACK_COOLDOWN;
        this.animSpeedMul = SKELETON_AXE_BOSS_ANIM_SPEED_MUL;
        this.attackAnimSpeedMul = SKELETON_AXE_BOSS_ATTACK_ANIM_SPEED_MUL;
        this.attackRange = SKELETON_AXE_BOSS_ATTACK_RANGE;

        // Hitbox de acerto (largura maior que o collider de movimento)
        this.hitHalfW = SKELETON_AXE_BOSS_HIT_HALF_W;

        // Rendering
        this.renderScale = SKELETON_AXE_BOSS_RENDER_SCALE;
        this._renderFilter = SKELETON_AXE_BOSS_FILTER;
        this._coinAwarded = false;

        // O boss permanece no posto mesmo quando o jogador tenta fugir.
        this.speedMul = SKELETON_AXE_BOSS_SPEED_MUL;
    }

    updateAi(dt, engine) {
        this._engine = engine;
        super.updateAi(dt, engine);
    }

    /* ── Dano ──────────────────────────────────────────────
     * Mesma lógica base (HP, knockback, estados HURT/DEAD), mas avisa o motor
     * assim que a vida zera — a derrota é permanente até iniciar jogo novo e
     * exibe "SINAL REIVINDICADO" em tela cheia (igual ao Necromancer).      */
    takeDamage(amount = SKELETON_ATTACK_DAMAGE, fromX = null, fromY = null) {
        if (this.isDead || this.state === SKELETON_STATES.DIE) return;

        this.hp = Math.max(0, this.hp - amount);
        this._hpBarTimer = 6;

        if (fromX !== null && fromY !== null) {
            const angle = Math.atan2(this.y - fromY, this.x - fromX);
            this.vx += Math.cos(angle) * 50;
            this.vy += Math.sin(angle) * 50;
        }

        if (this.hp <= 0) {
            this.isDead = true;
            this.vx = 0;
            this.vy = 0;
            this._setState(SKELETON_STATES.DIE, true);
            if (this._engine) this._engine.onSkeletonAxeBossDefeated(this);
        } else {
            this._setState(SKELETON_STATES.HURT, true);
        }
    }

    /** Volta o boss ao estado inicial da luta (usado quando o jogador morre). */
    resetForRetry() {
        this.hp = this.maxHp;
        this.isDead = false;
        this.shouldRemove = false;
        this.vx = 0;
        this.vy = 0;
        this.attackHitApplied = false;
        this.attackCooldown = 0;
        this._reacted = false;
        this._hpBarTimer = 0;
        this._coinAwarded = false;
        this.x = this.homeX;
        this.y = this.homeY;
        this._setState('idle', true);
    }

    /* ── Rendering ──────────────────────────────────────────
     * Usa a folha do Skeleton_Axe (mesmo cache dos esqueletos comuns) mas com
     * a escala maior e a sombra proporcionalmente maior sob os pés. O filtro
     * laranja é aplicado pelo _renderFilter no render base da classe-mãe.    */
    _groundShadow(ctx, screen, feetY) {
        ctx.save();
        ctx.fillStyle = 'rgba(10, 5, 5, 0.5)';
        ctx.beginPath();
        ctx.ellipse(screen.x, feetY - 8, 62, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // O boss NÃO exibe a barrinha de vida flutuante sobre o corpo — o
    // cabeçalho escuro do boss (no rodapé da tela) já comunica a vida.
    _renderHealthBar() {}
}

// Preload dos sprites: o boss usa exatamente as folhas do Skeleton_Axe, que já
// são carregadas por preloadSkeletonAxeSprites() no arranque do motor.