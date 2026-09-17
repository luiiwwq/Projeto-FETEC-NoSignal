/**
 * collisionSystem.js
 * Axis-aligned bounding box collision helpers used by the game engine.
 * Movement is resolved per axis so the player slides along walls instead
 * of getting stuck, and never clips into solid obstacles or map borders.
 */

export function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

export function pointInCircle(px, py, circle) {
    const dx = px - circle.x;
    const dy = py - circle.y;
    const radius = circle.radius ?? 0;
    return dx * dx + dy * dy <= radius * radius;
}

/**
 * Resolve a movement delta for a player whose body is a box centered at
 * (centerX, centerY) with the given half sizes.
 *
 * @param {number} centerX current center x (world)
 * @param {number} centerY current center y (world)
 * @param {number} halfW half width of the player hitbox
 * @param {number} halfH half height of the player hitbox
 * @param {number} dx movement delta on X this frame
 * @param {number} dy movement delta on Y this frame
 * @param {Array<{x,y,w,h}>} obstacles solid AABBs in world coordinates
 * @param {{minX,maxX,minY,maxY}} bounds world limits (top-left origin)
 * @returns {{x:number, y:number}} resolved position (snapped, sliding)
 */
export function resolveSlide(centerX, centerY, halfW, halfH, dx, dy, obstacles, bounds) {
    let x = centerX;
    let y = centerY;

    // ── X axis ──
    let nx = x + dx;
    let rect = { x: nx - halfW, y: y - halfH, w: halfW * 2, h: halfH * 2 };

    if (x !== nx) {
        let blocked = false;
        for (const o of obstacles) {
            if (rectsOverlap(o, rect)) {
                blocked = true;
                nx = dx > 0 ? o.x - halfW : o.x + o.w + halfW;
                rect.x = nx - halfW;
            }
        }
        if (!blocked) {
            if (rect.x < bounds.minX) nx = bounds.minX + halfW;
            else if (rect.x + rect.w > bounds.maxX) nx = bounds.maxX - halfW;
        }
    }

    // ── Y axis ──
    let ny = y + dy;
    rect = { x: nx - halfW, y: ny - halfH, w: halfW * 2, h: halfH * 2 };

    if (y !== ny) {
        let blocked = false;
        for (const o of obstacles) {
            if (rectsOverlap(o, rect)) {
                blocked = true;
                ny = dy > 0 ? o.y - halfH : o.y + o.h + halfH;
                rect.y = ny - halfH;
            }
        }
        if (!blocked) {
            if (rect.y < bounds.minY) ny = bounds.minY + halfH;
            else if (rect.y + rect.h > bounds.maxY) ny = bounds.maxY - halfH;
        }
    }

    return { x: nx, y: ny };
}