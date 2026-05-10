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
const { WEAPON_DROP_IMMUNITY_MS } = require("./constants");

const takeDamage = (io, room, damage, x, y) => {
  room.game.sharedHP = Math.max(0, room.game.sharedHP - damage);
  room.game.streak = 0;

  // Drop weapon if held and immunity period has passed
  let weaponDropped = false;
  const w = room.game.weapon;
  if (w && w.held && (Date.now() - w.pickedUpAt) > WEAPON_DROP_IMMUNITY_MS) {
    w.held = false;
    w.x    = room.game.character.x;
    w.y    = room.game.character.y;
    w.pickedUpAt = 0;
    weaponDropped = true;
    io.to(room.code).emit("weapon_dropped", { x: w.x, y: w.y });
  }

  io.to(room.code).emit("player_hit", {
    damage, sharedHP: room.game.sharedHP, sharedMaxHP: room.game.sharedMaxHP, x, y, weaponDropped,
  });
  return room.game.sharedHP;
};

module.exports = { spawnProjectile, aimAtChar, takeDamage };
