/**
 * SkeletonAxeBoss.js
 * The ogre-sized Skeleton_Axe that now guards the Martian Core (map_nucle).
 *
 * It inherits the full Skeleton_Axe behaviour (AI, melee profile, animation
 * sheets) and only overrides what makes it a boss:
 *   - 1,000 HP (vs 150 for a grunt) and increased defense
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
    SKELETON_COLLIDER_HALF_W,
    SKELETON_COLLIDER_HALF_H,
} from './SkeletonAxe.js';

/* ── Boss tuning ─────────────────────────────────────────── */
export const SKELETON_AXE_BOSS_MAX_HP = 1000;
export const SKELETON_AXE_BOSS_PLAYER_DAMAGE_MULTIPLIER = 0.5;
// Golpe de 30 de dano por hit (antes 40): o boss mantém pressão pelo cooldown
// curto (0.5s), não pelo dano bruto.
export const SKELETON_AXE_BOSS_ATTACK_DAMAGE = 30;
export const SKELETON_AXE_BOSS_ATTACK_COOLDOWN = 0.5;      // segundos entre golpes
export const SKELETON_AXE_BOSS_ANIM_SPEED_MUL = 2.5;       // animação 2.5x mais rápida (corrida/reação)
// Velocidade da animação de ATAQUE do boss (independente da corrida): mais
// lenta que os 2.5x para o golpe ficar pesado, sem mudar o cooldown.
export const SKELETON_AXE_BOSS_ATTACK_ANIM_SPEED_MUL = 1.2;
// Ataque com alcance maior que os esqueletos (42 px): o machado enorme do
// guardião atinge o jogador mesmo sem ele estar colado no boss.
export const SKELETON_AXE_BOSS_ATTACK_RANGE = 220;
// O guardião avança mais 60px antes de preparar cada golpe; o alcance real
// do machado e o cooldown rápido permanecem os mesmos.
export const SKELETON_AXE_BOSS_ATTACK_START_RANGE = 160;
// Largura lateral do golpe do machado; o alcance frontal permanece inalterado.
export const SKELETON_AXE_BOSS_ATTACK_HALF_WIDTH = 56;
// Perseguição mais veloz que os esqueletos comuns (70 px/s * 1.55 ≈ 108 px/s).
export const SKELETON_AXE_BOSS_SPEED_MUL = 1.55;
export const SKELETON_AXE_BOSS_COLLIDER_HALF_W = SKELETON_COLLIDER_HALF_W;
export const SKELETON_AXE_BOSS_COLLIDER_HALF_H = SKELETON_COLLIDER_HALF_H;
// Hitbox de acerto das balas: acompanha o corpo gigante (scale 13) com
// largura de 180px e altura que cobre os pés e o corpo até UM POUCO ANTES da
// cabeça — padrão do Necromancer (hitHeight ancorado no chão). A cabeça e os
// extremos do machado ficam de fora para o acerto não parecer "invisível".
export const SKELETON_AXE_BOSS_HIT_HALF_W = 90; // 180px de largura de acerto
export const SKELETON_AXE_BOSS_HIT_HEIGHT = 360; // ~3/4 da arte (cabeça fora)
// 13x: boss bem grande no Núcleo (golpe fica com ~481px de altura).
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
        this.attackStartRange = SKELETON_AXE_BOSS_ATTACK_START_RANGE;
        this.attackHitHalfWidth = SKELETON_AXE_BOSS_ATTACK_HALF_WIDTH;

        // Hitbox de acerto (largura maior que o collider de movimento)
        this.hitHalfW = SKELETON_AXE_BOSS_HIT_HALF_W;
        // Altura de acerto ancorada nos pés: cobre o corpo gigante até um
        // pouco antes da cabeça (mesmo padrão do Necromancer).
        this.hitHeight = SKELETON_AXE_BOSS_HIT_HEIGHT;

        // Rendering
        this.renderScale = SKELETON_AXE_BOSS_RENDER_SCALE;
        this._renderFilter = SKELETON_AXE_BOSS_FILTER;
        this._coinAwarded = false;

        // O boss permanece no posto mesmo quando o jogador tenta fugir.
        this.speedMul = SKELETON_AXE_BOSS_SPEED_MUL;

        // Congelamento durante a cutscene de introdução: enquanto true, o boss
        // permanece parado e não executa nenhuma ação de IA.
        this._cutscenePlaying = false;
    }

    updateAi(dt, engine) {
        this._engine = engine;
        // Congelado durante a cutscene de introdução: boss permanece parado.
        if (this._cutscenePlaying) return;
        super.updateAi(dt, engine);
    }

    /* ── Dano ──────────────────────────────────────────────
     * Mesma lógica base (HP, knockback, estados HURT/DEAD), mas avisa o motor
     * assim que a vida zera — a derrota é permanente até iniciar jogo novo e
     * exibe "SINAL REIVINDICADO" em tela cheia (igual ao Necromancer).      */
    takeDamage(amount = SKELETON_ATTACK_DAMAGE, fromX = null, fromY = null) {
        if (this.isDead || this.state === SKELETON_STATES.DIE) return;

        this.hp = Math.max(0, this.hp - Math.round(amount * SKELETON_AXE_BOSS_PLAYER_DAMAGE_MULTIPLIER));
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

    // O boss NÃO exibe a barrinha de vida flutuante sobre o corpo — o
    // cabeçalho escuro do boss (no rodapé da tela) já comunica a vida.
    _renderHealthBar() {}
}

// Preload dos sprites: o boss usa exatamente as folhas do Skeleton_Axe, que já
// são carregadas por preloadSkeletonAxeSprites() no arranque do motor.
