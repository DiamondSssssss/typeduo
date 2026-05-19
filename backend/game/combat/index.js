/**
 * Combat system entry — FSM attack manager + modular attack classes.
 *
 * @see AttackRegistry.js  — register new attacks here
 * @see AttackManager.js   — weighted selection + ultimate at HP%
 * @see attacks/           — Melee, Dash, Teleport, AoE, Ultimate examples
 */
module.exports = {
  ...require("./AttackManager"),
  ...require("./AttackRegistry"),
  AttackContext: require("./AttackContext").AttackContext,
  TelegraphSystem: require("./TelegraphSystem").TelegraphSystem,
  BaseAttack: require("./BaseAttack").BaseAttack,
};
