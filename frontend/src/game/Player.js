export default class Player {
  constructor({ id, role, x = 0, y = 0 }) {
    this.id = id;
    this.role = role;
    this.x = x;
    this.y = y;
  }
}
