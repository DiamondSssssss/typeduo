/** Append a projectile to the projectiles array. */
const spawnProjectile = (game, props) => {
  game.projectiles.push({
    id: `p${game.nextProjectileId++}`,
    x: props.x,
    y: props.y,
    vx: props.vx || 0,
    vy: props.vy || 0,
    type: props.type || "normal",
    homing: props.homing || false,
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
const takeDamage = (io, room, damage, x, y) => {
  room.game.sharedHP = Math.max(0, room.game.sharedHP - damage);
  room.game.streak = 0;
  io.to(room.code).emit("player_hit", {
    damage, sharedHP: room.game.sharedHP, x, y,
  });
  return room.game.sharedHP;
};

module.exports = { spawnProjectile, aimAtChar, takeDamage };
