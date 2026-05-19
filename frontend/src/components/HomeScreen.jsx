function HomeScreen({ onSelectMode }) {
  return (
    <section className="card card-wide home-screen">
      <h2 className="home-screen__title">Choose your path</h2>
      <p className="home-screen__sub">Co-op with a friend, practice solo, or learn the basics.</p>
      <div className="home-screen__grid">
        <button type="button" className="home-card home-card--coop" onClick={() => onSelectMode("coop")}>
          <span className="home-card__icon">👥</span>
          <span className="home-card__name">Co-op</span>
          <span className="home-card__desc">2 players · Runner dodges, Typer attacks</span>
        </button>
        <button type="button" className="home-card home-card--solo" onClick={() => onSelectMode("solo")}>
          <span className="home-card__icon">🎯</span>
          <span className="home-card__name">Solo</span>
          <span className="home-card__desc">1 player · Arrows move · A–Z type</span>
        </button>
        <button type="button" className="home-card home-card--tutorial" onClick={() => onSelectMode("tutorial")}>
          <span className="home-card__icon">📖</span>
          <span className="home-card__name">Tutorial</span>
          <span className="home-card__desc">6 steps · Learn dodge & typing</span>
        </button>
        <button type="button" className="home-card home-card--almanac" onClick={() => onSelectMode("almanac")}>
          <span className="home-card__icon">📚</span>
          <span className="home-card__name">Boss Almanac</span>
          <span className="home-card__desc">Attacks · Telegraphs · Dodge guides</span>
        </button>
      </div>
    </section>
  );
}

export default HomeScreen;
