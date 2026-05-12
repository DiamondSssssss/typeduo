/** Append a projectile to the projectiles array. */
const spawnProjectile = (game, props) => {
  game.projectiles.push({
    id:      `p${game.nextProjectileId++}`,
    x:       props.x,
    y:       props.y,
    vx:      props.vx      || 0,
    vy:      props.vy      || 0,
    type:    props.type    || "normal",
    homing:  props.homing  || false,
    gravity: props.gravity || 0,  // px/s² — used for arc trajectories (ember_arc)
  });
};

/** Build velocity aimed from boss toward character at the given speed. */
const aimAtChar = (boss, char, speed, type = "aimed") => {
  const dx = char.x - boss.x;
  const dy = char.y - boss.y;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  return { x: boss.x, y: boss.y, vx: (dx / dist) * speed, vy: (dy / dist) * speed, type };
};

/** Reduce shared HP and emit player_hit. Returns new sharedHP. */
const {
  WEAPON_DROP_IMMUNITY_MS,
  WEAPON_PICKUP_RADIUS,
  WEAPON_DROP_DISTANCE_MIN,
  WEAPON_DROP_DISTANCE_MAX,
  WEAPON_PICKUP_LOCK_AFTER_DROP_MS,
} = require("./constants");

/** Clamp to playable arena (same as runner clamps). */
const clampWeaponXY = (x, y) => ({
  x: Math.max(30, Math.min(1250, x)),
  y: Math.max(200, Math.min(590, y)),
});

/** Place weapon away from character so it is not instantly picked up again. */
const computeWeaponDropPosition = (char) => {
  const minDistSq = (WEAPON_PICKUP_RADIUS + 12) ** 2;
  for (let i = 0; i < 16; i++) {
    const dist = WEAPON_DROP_DISTANCE_MIN + Math.random() * (WEAPON_DROP_DISTANCE_MAX - WEAPON_DROP_DISTANCE_MIN);
    const ang = Math.random() * Math.PI * 2;
    let nx = char.x + Math.cos(ang) * dist;
    let ny = char.y + Math.sin(ang) * dist;
    const c = clampWeaponXY(nx, ny);
    nx = c.x; ny = c.y;
    const dx = nx - char.x;
    const dy = ny - char.y;
    if (dx * dx + dy * dy >= minDistSq) return { x: nx, y: ny };
  }
  const fallbacks = [[130, 0], [-130, 0], [0, 95], [0, -95], [100, 75], [-100, 75], [100, -75], [-100, -75]];
  for (const [ox, oy] of fallbacks) {
    const c = clampWeaponXY(char.x + ox, char.y + oy);
    const ddx = c.x - char.x;
    const ddy = c.y - char.y;
    if (ddx * ddx + ddy * ddy >= minDistSq) return c;
  }
  // Emergency: random spot in lower arena (should be unreachable)
  return clampWeaponXY(320 + Math.random() * 640, 360 + Math.random() * 180);
};

const takeDamage = (io, room, damage, x, y) => {
  room.game.sharedHP = Math.max(0, room.game.sharedHP - damage);
  room.game.streak = 0;

  // Drop weapon if held and immunity period has passed
  let weaponDropped = false;
  const w = room.game.weapon;
  const now = Date.now();
  if (w && w.held && (now - w.pickedUpAt) > WEAPON_DROP_IMMUNITY_MS) {
    const pos = computeWeaponDropPosition(room.game.character);
    w.held = false;
    w.x = pos.x;
    w.y = pos.y;
    w.pickedUpAt = 0;
    w.pickupLockedUntil = now + WEAPON_PICKUP_LOCK_AFTER_DROP_MS;
    weaponDropped = true;
    io.to(room.code).emit("weapon_dropped", { x: w.x, y: w.y });
  }

  io.to(room.code).emit("player_hit", {
    damage, sharedHP: room.game.sharedHP, sharedMaxHP: room.game.sharedMaxHP, x, y, weaponDropped,
  });
  return room.game.sharedHP;
};

module.exports = { spawnProjectile, aimAtChar, takeDamage };
