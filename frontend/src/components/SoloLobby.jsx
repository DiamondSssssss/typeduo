import { useEffect, useMemo, useState } from "react";
import BossPicker from "./BossPicker";
import WeaponPicker from "./WeaponPicker";
import { BOSS_LIST } from "../game/bosses/bossConfigs";
import { DEFAULT_WEAPON_ID } from "../game/weapons";
import {
  getSoloLockedBossIds,
  getSoloUnlockedBossIds,
  isSoloBossUnlocked,
  readSoloDefeatedBossIds,
} from "../game/soloProgress";

const ACTIVE_GAME_KEY = "typeduo_active_game";
const clearStaleSession = () => {
  try { sessionStorage.removeItem(ACTIVE_GAME_KEY); } catch (_e) { /* ignore */ }
};

const DIFFICULTY_INFO = {
  easy:   { label: "Easy",   desc: "More HP · slower attacks" },
  normal: { label: "Normal", desc: "Balanced challenge" },
  hard:   { label: "Hard",   desc: "Less HP · faster attacks" },
};

export default function SoloLobby({ socket, currentUser, onBack, onOpenAlmanac }) {
  const username = currentUser?.username || currentUser?.email;
  const [defeatedBossIds, setDefeatedBossIds] = useState(() => readSoloDefeatedBossIds(username));
  const [selectedBoss, setSelectedBoss] = useState(() => {
    const defeated = readSoloDefeatedBossIds(username);
    if (isSoloBossUnlocked("iron_matron", defeated)) return "iron_matron";
    return "training_dummy";
  });
  const [weaponTypeId, setWeaponTypeId] = useState(DEFAULT_WEAPON_ID);

  useEffect(() => {
    clearStaleSession();
  }, []);

  useEffect(() => {
    const defeated = readSoloDefeatedBossIds(username);
    setDefeatedBossIds(defeated);
    setSelectedBoss((prev) => (isSoloBossUnlocked(prev, defeated) ? prev : "iron_matron"));
  }, [username]);

  const lockedBossIds = useMemo(
    () => getSoloLockedBossIds(defeatedBossIds),
    [defeatedBossIds],
  );
  const unlockedCount = useMemo(
    () => getSoloUnlockedBossIds(defeatedBossIds).size - 1,
    [defeatedBossIds],
  );
  const [difficulty, setDifficulty] = useState("normal");
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState("");
  const selected = BOSS_LIST.find((b) => b.id === selectedBoss);

  const startSolo = () => {
    if (!socket?.connected || starting) return;
    clearStaleSession();
    setStarting(true);
    setStatus("");
    socket.emit("start_solo", {
      username,
      bossId: selectedBoss,
      difficulty,
      weaponTypeId,
      defeatedBossIds,
    }, (res) => {
      setStarting(false);
      if (!res?.ok) setStatus(res?.message || "Could not start solo game.");
    });
  };

  return (
    <section className="card card-wide solo-lobby">
      <header className="solo-lobby__top">
        <button type="button" className="btn btn-ghost btn-compact" onClick={onBack}>
          ← Main menu
        </button>
        <div className="solo-lobby__top-text">
          <h2>Solo Mode</h2>
          <p>
            Di chuyển bằng <strong>phím mũi tên</strong> (WASD để gõ). Chọn vũ khí và boss, nhặt vũ khí trên map rồi gõ để đánh.
          </p>
        </div>
        {onOpenAlmanac ? (
          <button type="button" className="btn btn-ghost btn-compact solo-lobby__almanac" onClick={onOpenAlmanac}>
            📚 Almanac
          </button>
        ) : null}
      </header>

      <section className="solo-lobby__diff-strip" aria-label="Difficulty">
        <span className="solo-lobby__section-label">Difficulty</span>
        <div className="solo-lobby__diff-options">
          {["easy", "normal", "hard"].map((d) => (
            <button
              key={d}
              type="button"
              className={`solo-lobby__diff-btn${difficulty === d ? " solo-lobby__diff-btn--active" : ""}`}
              onClick={() => setDifficulty(d)}
            >
              <span className="solo-lobby__diff-btn-title">{DIFFICULTY_INFO[d].label}</span>
              <span className="solo-lobby__diff-btn-desc">{DIFFICULTY_INFO[d].desc}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="solo-lobby__body">
        <div className="solo-lobby__column solo-lobby__column--weapons">
          <WeaponPicker selectedId={weaponTypeId} onSelect={setWeaponTypeId} disabled={starting} />
        </div>

        <div className="solo-lobby__column solo-lobby__column--boss">
          <p className="solo-lobby__progress-hint">
            Đánh bại từng boss để mở khóa boss kế tiếp · {unlockedCount} boss đã mở
          </p>
          <BossPicker
            selectedId={selectedBoss}
            onSelect={setSelectedBoss}
            disabled={starting}
            lockedIds={lockedBossIds}
          />
        </div>
      </div>

      <footer className="solo-lobby__footer">
        {status ? <p className="form-error">{status}</p> : null}
        <button
          type="button"
          className="btn btn-primary btn-wide solo-lobby__start"
          disabled={starting || !socket?.connected}
          onClick={startSolo}
          style={{ "--boss-color": selected?.color }}
        >
          <span className="solo-lobby__start-label">
            {starting ? "Starting…" : `Fight ${selected?.name || "Boss"}`}
          </span>
          <span className="solo-lobby__start-sub">
            {DIFFICULTY_INFO[difficulty].label} · {selected?.maxHP} HP boss
          </span>
        </button>
      </footer>
    </section>
  );
}
