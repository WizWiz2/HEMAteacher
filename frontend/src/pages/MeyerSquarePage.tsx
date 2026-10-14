import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LivePoseCanvas } from "../components/LivePoseCanvas";
import { useLivePose, type LiveSample } from "../live/useLivePose";
import { HandDirectionDetector, classifyDirection, distinctDirection, type DirectionCalibration, type MotionVector } from "../meyer/direction";
import { ARROWS, LABELS, SECTORS, SERIES, advanceRun, beginRun, emptyRun, makeSequence, pauseRun, recordAttempt, resumeRun, showHints, tickRun, type MeyerMode, type Run } from "../meyer/exercise";
import "../meyer/meyer.css";

const MODES: {id: MeyerMode; name: string; text: string}[] = [
  {id: "learn", name: "Разучивание", text: "Повторяй одну серию из четырёх ударов. Номера и следующий сектор помогают запомнить порядок."},
  {id: "flow", name: "Поток", text: "Четыре серии подряд, 16 ударов за круг. Продолжай движение между сигналами."},
  {id: "memory", name: "По памяти", text: "Первый круг — все подсказки. Второй — только текущий сектор. С третьего — только ритм."},
  {id: "reaction", name: "Реакция", text: "Случайные сектора и немного разный интервал между сигналами. Следующий сектор скрыт."},
];

export function MeyerSquarePage() {
  const [mode, setMode] = useState<MeyerMode>("learn");
  const [series, setSeries] = useState(0);
  const [bpm, setBpm] = useState(40);
  const [rounds, setRounds] = useState(4);
  const [sound, setSound] = useState(true);
  const [camera, setCamera] = useState(false);
  const [calibration, setCalibration] = useState<DirectionCalibration>({});
  const [captured, setCaptured] = useState<MotionVector | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [message, setMessage] = useState("");
  const [run, setRun] = useState<Run>(emptyRun);
  const [now, setNow] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const stage = useRef<HTMLElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const detector = useRef(new HandDirectionDetector());
  const runRef = useRef(run);
  const currentRef = useRef({mode, bpm, camera, calibration, captured});
  currentRef.current = {mode, bpm, camera, calibration, captured};
  const calibrated = SECTORS.every(s => calibration[s]);
  const editable = run.phase === "ready" || run.phase === "completed";
  const calIndex = Object.keys(calibration).length;
  const calibrating = camera && !calibrated;

  const updateRun = useCallback((next: Run) => {runRef.current = next; setRun(next);}, []);
  const beat = useCallback(() => {
    const settings = currentRef.current;
    return 60000 / settings.bpm * (settings.mode === "reaction" ? .8 + Math.random() * .4 : 1);
  }, []);

  useEffect(() => {
    if (run.phase !== "countdown" && run.phase !== "running") return;
    const id = window.setInterval(() => {
      const time = performance.now();
      setNow(time);
      const state = runRef.current;
      updateRun(tickRun(state, time, beat(), currentRef.current.camera && currentRef.current.mode === "learn"));
    }, 50);
    return () => window.clearInterval(id);
  }, [run.phase, beat, updateRun]);

  useEffect(() => {
    detector.current.reset();
    if (run.phase === "running") setMessage("");
  }, [run.phase, run.index]);

  useEffect(() => {
    function visibility() {
      if (document.hidden) updateRun(pauseRun(runRef.current, performance.now()));
    }
    function fs() {setFullscreen(document.fullscreenElement === stage.current);}
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fs);
    return () => {document.removeEventListener("visibilitychange", visibility); document.removeEventListener("fullscreenchange", fs);};
  }, [updateRun]);
  useEffect(() => () => {void audio.current?.close();}, []);

  const countdown = run.phase === "countdown" ? Math.max(1, Math.ceil((run.due - now) / 1000)) : 0;
  useEffect(() => {
    if (!sound || (run.phase !== "running" && run.phase !== "countdown") || !audio.current) return;
    const ctx = audio.current;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.frequency.value = run.phase === "countdown" ? 440 : run.index % 4 === 0 ? 880 : 660;
    gain.gain.setValueAtTime(.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .12);
    oscillator.start(); oscillator.stop(ctx.currentTime + .13);
  }, [run.phase, run.index, countdown, sound]);

  function start() {
    if (sound) {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    }
    detector.current.reset(); setMessage("");
    const time = performance.now(); setNow(time);
    updateRun(beginRun(makeSequence(mode, series, rounds), time));
  }

  const onSample = useCallback((sample: LiveSample) => {
    const state = runRef.current, settings = currentRef.current;
    if (!settings.camera || settings.captured || !["ready", "completed", "running"].includes(state.phase)) return;
    const vector = detector.current.push(sample.raw);
    if (!vector) return;
    if (!SECTORS.every(s => settings.calibration[s])) {
      if (!distinctDirection(settings.calibration, vector)) {
        setMessage("Это движение слишком похоже на уже записанное. Попробуй другую диагональ или тренируйся без камеры.");
        return;
      }
      setCaptured(vector); setMessage("Движение записано. Подтверди, если выполнил удар в указанный сектор.");
      return;
    }
    if (state.phase !== "running") return;
    const sector = classifyDirection(settings.calibration, vector);
    if (!sector || vector.onsetAt < state.promptAt) {setMessage("Направление рук не удалось различить."); return;}
    let next = recordAttempt(state, sector, vector.onsetAt);
    const matched = sector === state.sequence[state.index];
    setMessage(matched ? "✓ Движение совпало" : "Движение отличается от задания");
    if (matched && settings.mode === "learn") next = advanceRun(next, vector.endAt, 60000 / settings.bpm);
    updateRun(next);
  }, [updateRun]);

  function confirmDirection() {
    if (!captured) return;
    setCalibration({...calibration, [SECTORS[calIndex]]: captured});
    setCaptured(null); setMessage(""); detector.current.reset();
  }
  function resetCameraCalibration() {
    updateRun(emptyRun()); setCalibration({}); setCaptured(null); setMessage(""); detector.current.reset();
  }
  function toggleCamera(enabled: boolean) {
    resetCameraCalibration(); setCamera(enabled); setCameraReady(false);
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
      else setMessage("Этот браузер не поддерживает полноэкранный режим.");
    } catch {setMessage("Не удалось открыть полный экран.");}
  }

  const active = calibrating ? SECTORS[calIndex] : run.phase === "running" ? run.sequence[run.index] : null;
  const hints = showHints(mode, run.index);
  const nextSector = run.phase === "running" && run.index + 1 < run.sequence.length ? run.sequence[run.index + 1] : null;
  const preview = SERIES[series];
  const showCurrent = calibrating || run.phase === "running" && hints.current;
  const matchedCount = Object.values(run.attempts).filter(a => a.matched).length;
  const reactionTimes = Object.values(run.attempts).filter(a => a.matched && a.reactionMs !== undefined).map(a => a.reactionMs!);
  const meanReaction = reactionTimes.length ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) : null;
  const status = calibrating ? `Калибровка ${calIndex + 1} из 4 · ${LABELS[SECTORS[calIndex]]}`
    : run.phase === "countdown" ? `Начинаем через ${countdown}`
    : run.phase === "paused" ? "Пауза"
    : run.phase === "completed" ? "Круги завершены"
    : run.phase === "running" ? hints.current ? LABELS[active!] : "Вспомни следующий сектор"
    : "Приготовься к четырём открытиям";

  return <main className="stack meyer-page">
    <section className="manuscript-panel meyer-heading">
      <span className="rubric">Vier Blössen · четыре открытия</span>
      <h1>Крест Мейера</h1>
      <p>Бей в подсвеченный сектор. Стороны указаны так, как ты видишь квадрат перед собой.</p>
      <Link to="/">← К упражнениям</Link>
    </section>
    <div className="meyer-modes" aria-label="Режим тренировки">
      {MODES.map(item => <button key={item.id} type="button" disabled={!editable} aria-pressed={mode === item.id}
        className={mode === item.id ? "active" : "ghost"} onClick={() => {setMode(item.id); updateRun(emptyRun());}}>{item.name}</button>)}
    </div>
    <p className="meyer-description">{MODES.find(m => m.id === mode)!.text}</p>
    <section className="meyer-stage manuscript-panel" ref={stage}>
      <div className="meyer-stage-top">
        <span className="rubric">{run.phase === "running" ? `Сигнал ${run.index + 1} / ${run.sequence.length}` : "Четыре сектора"}</span>
        <button type="button" className="ghost" onClick={() => void toggleFullscreen()}>{fullscreen ? "Свернуть" : "На весь экран"}</button>
      </div>
      <div className={`meyer-square ${run.phase === "paused" ? "meyer-paused" : ""}`} role="img" aria-label={`Квадрат Мейера. ${status}`}>
        {SECTORS.map(sector => {
          const lit = showCurrent && active === sector;
          const upcoming = !calibrating && run.phase === "running" && hints.next && nextSector === sector;
          const numbered = !calibrating && mode !== "reaction" && mode !== "flow" && (editable || run.phase === "running" && hints.numbers);
          return <div key={sector} className={`meyer-sector ${lit ? "meyer-lit" : ""} ${upcoming ? "meyer-next" : ""}`}>
            <span className="meyer-sector-arrow" aria-hidden="true">{ARROWS[sector]}</span>
            <span className="meyer-sector-label">{LABELS[sector]}</span>
            {numbered && <span className="meyer-number">{preview.indexOf(sector) + 1}</span>}
            {lit && <span className="meyer-sector-tag">{calibrating ? "Покажи удар" : "Сейчас"}</span>}
            {!lit && upcoming && <span className="meyer-sector-tag">Далее</span>}
          </div>;
        })}
        {run.phase === "countdown" && <div className="meyer-countdown" aria-hidden="true">{countdown}</div>}
        {run.phase === "paused" && <div className="meyer-countdown" aria-hidden="true">Ⅱ</div>}
        {run.phase === "running" && !hints.current && <div key={run.index} className="meyer-beat" aria-hidden="true">•</div>}
      </div>
      <div className="meyer-status" role="status">{status}</div>
      <div className="meyer-controls">
        {editable && <button type="button" onClick={start} disabled={camera && (!calibrated || !cameraReady)}>{run.phase === "completed" ? "Ещё раз" : "Старт · 5 секунд"}</button>}
        {(run.phase === "running" || run.phase === "countdown") && <button type="button" onClick={() => updateRun(pauseRun(runRef.current, performance.now()))}>Пауза</button>}
        {run.phase === "paused" && <button type="button" onClick={() => {setNow(performance.now()); updateRun(resumeRun(runRef.current, performance.now()));}}>Продолжить · 3 секунды</button>}
        {!editable && <button type="button" className="ghost" onClick={() => updateRun(emptyRun())}>Завершить</button>}
        {run.phase === "running" && camera && mode === "learn" && <button type="button" className="ghost" onClick={() => updateRun(advanceRun(runRef.current, performance.now(), beat()))}>Пропустить</button>}
      </div>
      {message && <p className="meyer-feedback" role="status">{message}</p>}
      {run.phase === "completed" && <div className="meyer-result">
        <strong>{run.sequence.length} подсказок пройдено</strong>
        {camera ? <><span>Совпало движений рук: {matchedCount} из {run.sequence.length}</span>
          {mode === "reaction" && meanReaction !== null && <span>До начала совпавшего движения: в среднем {meanReaction} мс</span>}</>
          : <span>Без камеры выполнение ударов не проверяется.</span>}
      </div>}
    </section>
    <section className="manuscript-panel meyer-settings">
      {mode !== "flow" && mode !== "reaction" && <label>Серия <select value={series} disabled={!editable} onChange={e => {setSeries(Number(e.target.value)); updateRun(emptyRun());}}>
        {SERIES.map((_, i) => <option key={i} value={i}>Серия {i + 1}</option>)}
      </select></label>}
      <label>Темп · {bpm} ударов/мин <input type="range" min="20" max="120" step="5" value={bpm} disabled={!editable} onChange={e => setBpm(Number(e.target.value))} /></label>
      <label>Круги <select value={rounds} disabled={!editable} onChange={e => setRounds(Number(e.target.value))}>
        {[1,2,4,8].map(n => <option key={n} value={n}>{n}</option>)}
      </select></label>
      <label className="toggle-control"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /> Звук</label>
      <label className="toggle-control"><input type="checkbox" checked={camera} disabled={!editable} onChange={e => toggleCamera(e.target.checked)} /> Проверять движения камерой · эксперимент</label>
    </section>
    {camera && <section className="manuscript-panel meyer-camera-section">
      <div><h2>Направление рук</h2><p>Встань лицом к камере. Обе кисти и плечи должны быть видны. Камера сравнивает движение рук с твоими четырьмя образцами; попадание клинком и работу лезвия не проверяет.</p>
        {calibrating ? <><p>Выполни один удар в подсвеченный сектор. После записи подтверди его и переходи к следующему.</p>
          {captured && <div className="meyer-controls"><button type="button" onClick={confirmDirection}>Подтвердить движение</button><button type="button" className="ghost" onClick={() => {setCaptured(null); detector.current.reset();}}>Записать заново</button></div>}
          <p role="status">{message || `Ожидаю образец ${calIndex + 1} из 4`}</p></>
          : <><p>Четыре направления записаны. В разучивании квадрат ждёт совпавшее движение; остальные режимы продолжают задавать ритм.</p><button type="button" className="ghost" disabled={!editable} onClick={resetCameraCalibration}>Записать образцы заново</button></>}
      </div>
      <MeyerCamera onSample={onSample} onReady={setCameraReady} onSwitch={resetCameraCalibration} />
    </section>}
    <details className="meyer-about"><summary>О последовательностях</summary>
      <p>Четыре серии по четыре открытия следуют номерным кольцам диаграммы Мейера 1570 года. Это схема целей, а не обязательная траектория клинка. «Реакция» и постепенное исчезновение подсказок — режимы нашего тренажёра.</p>
      <a href="https://www.keithfarrell.net/blog/2017/05/meyers-four-openings-drill-aka-meyers-square/" target="_blank" rel="noreferrer">Разбор диаграммы и её чтения →</a>
    </details>
  </main>;
}

function MeyerCamera({onSample, onReady, onSwitch}: {onSample: (sample: LiveSample) => void; onReady: (ready: boolean) => void; onSwitch: () => void}) {
  const [tracking, setTracking] = useState(false);
  const lastStatus = useRef(0);
  const live = useLivePose("right", sample => {
    onSample(sample);
    if (sample.timeMs - lastStatus.current > 250) {
      lastStatus.current = sample.timeMs;
      setTracking(["left_wrist", "right_wrist", "left_shoulder", "right_shoulder"].every(n => (sample.raw.landmarks[n]?.visibility ?? 0) >= .65));
    }
  }, {cameraView: "front", trackingMode: "upper_body"});
  useEffect(() => {onReady(live.phase === "ready"); return () => onReady(false);}, [live.phase, onReady]);
  const mirrored = (live.cameraFacingMode ?? live.requestedCamera) === "user";
  return <div className="meyer-camera">
    <div className="camera-pane"><LivePoseCanvas videoRef={live.videoRef} canvasRef={live.canvasRef} mirrored={mirrored} /></div>
    <div className="meyer-controls">
      {!live.live ? <button type="button" disabled={live.phase !== "idle"} onClick={() => void live.start("user")}>{live.phase === "requesting" ? "Разреши доступ…" : "Включить камеру"}</button>
        : <button type="button" className="ghost" disabled={live.phase !== "ready"} onClick={() => {onSwitch(); void live.switchCamera();}}>Переключить камеру</button>}
    </div>
    <p role="status">{live.error || (live.phase === "loading" ? "Загружаю распознавание…" : live.phase === "ready" ? tracking ? "Кисти и плечи видны" : "Покажи обе кисти и плечи" : "Камера выключена")}</p>
  </div>;
}
