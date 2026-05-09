export default class Boss {
  constructor(maxHp = 100) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.state = "idle";
  }
}
