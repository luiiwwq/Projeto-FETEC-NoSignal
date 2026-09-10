/**
 * Bullet.js
 * Plasma projectile fired by the astronaut.
 */

export class Bullet {
    constructor(x, y, angle, speed = 650) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.2; // Lifetime in seconds
        this.maxLife = 1.2;
        this.isAlive = true;
        this.radius = 3;
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

        // Plasma projectile glow
        ctx.save();
        ctx.shadowColor = '#ffaa33';
        ctx.shadowBlur = 8;

        // Outer energy halo
        ctx.fillStyle = '#ff6b22';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Core bright energy
        ctx.fillStyle = '#fffae6';
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();

        // Projectile tail/streak
        const tailX = sx - Math.cos(this.angle) * 8;
        const tailY = sy - Math.sin(this.angle) * 8;
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        ctx.restore();
    }
}
