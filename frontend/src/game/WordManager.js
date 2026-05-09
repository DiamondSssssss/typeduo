export default class WordManager {
  constructor(initialWords = []) {
    this.words = [...initialWords];
    this.currentWord = this.words[0] || "";
  }
}
