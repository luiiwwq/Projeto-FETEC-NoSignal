/**
 * Bullet.js
 * Plasma projectile fired by the player character.
 * Rendering and size are driven by the character's weapon profile.
 */

export class Bullet {
    constructor(x, y, angle, speed = 650, profile = null, opts = {}) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.2; // Lifetime in seconds
        this.maxLife = 1.2;
        this.isAlive = true;
        this.radius = profile?.radius ?? 3;
        this.color = profile?.color ?? '#ff6b22';
        this.glow = profile?.glow ?? '#ffaa33';
        this.core = profile?.core ?? '#fffae6';
        this.trail = profile?.trail ?? '#e07228';

        // Ownership & team determine who this projectile may damage.
        this.team = opts.team || 'player';
        this.owner = opts.owner || null;
        this.damage = opts.damage ?? profile?.damage ?? 15;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;

        if (this.life <= 0) {
            this.isAlive = false;
        }
    }

    render(ctx, camera) {
        const screenPos = camera.worldToScreen(this.x, this.y);
        const sx = screenPos.x;
        const sy = screenPos.y;

        const haloR = this.radius + 1;
        const coreR = Math.max(2, this.radius * 0.66);
        const tailLen = this.radius + 5;
        const tailWidth = Math.max(2, this.radius * 0.66);

        // Plasma projectile glow
        ctx.save();
        ctx.shadowColor = this.glow;
        ctx.shadowBlur = 8;

        // Outer energy halo
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(sx, sy, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Core bright energy
        ctx.fillStyle = this.core;
        ctx.beginPath();
        ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
        ctx.fill();

        // Projectile tail/streak
        const tailX = sx - Math.cos(this.angle) * tailLen;
        const tailY = sy - Math.sin(this.angle) * tailLen;
        ctx.strokeStyle = this.trail;
        ctx.lineWidth = tailWidth;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        ctx.restore();
    }
}
