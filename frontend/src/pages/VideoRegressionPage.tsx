import {useState} from 'react';
import {getDrill} from '../api';
import {MediaPipeLivePose} from '../live/poseLandmarker';
import {LiveSampleProcessor} from '../live/sampleProcessor';
import {CalibrationGate} from '../live/calibrationGate';
import {createDrillRuntime, stepDrill} from '../drill/drillEngine';

export async function runVideoRegression(file: File, drillId: string, fps = 30) {
  const drill = await getDrill(drillId);
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  const detector = new MediaPipeLivePose();
  const processor = new LiveSampleProcessor();
  const calibration = new CalibrationGate();
  let runtime = createDrillRuntime();
  let usable = 0, detected = 0, total = 0, inferenceMs = 0;
  const rawFrames = [];
  try {
    video.muted = true; video.playsInline = true; video.src = url;
    await mediaEvent(video, 'loadeddata', () => video.readyState >= 2);
    if (!Number.isFinite(video.duration) || video.duration > 60) throw new Error('Нужен ролик длиной до минуты');
    await detector.initialize();
    for (let index = 0; index / fps < video.duration; index++) {
      const seconds = index / fps;
      if (Math.abs(video.currentTime - seconds) > .001) {
        const sought = mediaEvent(video, 'seeked'); video.currentTime = seconds; await sought;
      }
      const timeMs = Math.round(seconds * 1000);
      const start = performance.now();
      const raw = detector.inferFrame(video, timeMs);
      inferenceMs += performance.now() - start;
      rawFrames.push(raw);
      const sample = processor.process(raw, 'right', drill.trackingMode ?? 'full_body', 'side');
      total++; if (Object.keys(raw.landmarks).length) detected++; if (sample.motionUsable) usable++;
      const ready = calibration.push(sample, drill.trackingMode ?? 'full_body');
      if (runtime.state === 'calibrating' && ready) runtime = stepDrill(runtime, drill, {type: 'quality', ok: true});
      runtime = stepDrill(runtime, drill, {type: 'sample', timeMs: sample.timeMs, features: sample.features,
        enoughSamples: sample.motionUsable, cameraView: 'side', mode: 'motion'});
      if (index % 6 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return {file: file.name, drillId, fps, backend: 'browser MediaPipe lite shared camera pipeline',
      total, detected, usable, inferenceMs: inferenceMs / total, calibrated: calibration.refined, runtime, rawFrames};
  } finally {
    detector.stop(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}

function mediaEvent(video: HTMLVideoElement, name: string, ready?: () => boolean) {
  if (ready?.()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Видео не ответило за 20 секунд')), 20000);
    const ok = () => finish(); const fail = () => finish(new Error('Не удалось декодировать видео'));
    const finish = (error?: Error) => {
      clearTimeout(timer); video.removeEventListener(name, ok); video.removeEventListener('error', fail);
      if (error) reject(error); else resolve();
    };
    video.addEventListener(name, ok, {once: true}); video.addEventListener('error', fail, {once: true});
  });
}

export function VideoRegressionPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [fps, setFps] = useState(30);
  async function run(files: File[]) {
    setBusy(true); setRows([]); const results: Array<Record<string, unknown>> = [];
    try {
      for (const file of files.filter(f => f.name.endsWith('.mp4'))) {
        const path = file.webkitRelativePath.split('/');
        const drillId = path.at(-2);
        if (!drillId) throw new Error('Выбери папку mock-videos целиком');
        setStatus(`Обрабатываю ${drillId}/${file.name}`);
        try { results.push(await runVideoRegression(file, drillId, fps)); }
        catch (error) { results.push({file: file.name, drillId, error: String(error)}); }
        setRows([...results]);
      }
      setStatus('Прогон завершён');
    } catch (error) { setStatus(String(error)); } finally { setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'browser-video-results.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="stack"><h1>Проверка на видео</h1>
    <p>Выбери папку mock-videos. Кадры проходят через модель камеры, проверку видимости и калибровку. Каждый ролик начинает с чистой сессии.</p>
    <label>Кадров в секунду <select value={fps} disabled={busy} onChange={e => setFps(Number(e.target.value))}><option>30</option><option>15</option><option>10</option></select></label>
    <input type="file" multiple {...{webkitdirectory: ''}} disabled={busy} onChange={e => {void run(Array.from(e.target.files ?? [])); e.target.value = '';}} />
    <p role="status">{status}</p><button disabled={busy || !rows.length} onClick={download}>Скачать результаты</button>
    <table><thead><tr><th>Видео</th><th>Результат</th><th>Видимых кадров</th><th>Причина</th></tr></thead><tbody>{rows.map((r, i) => {
      const runtime = r.runtime as ReturnType<typeof createDrillRuntime> | undefined;
      return <tr key={i}><td>{String(r.drillId)}/{String(r.file)}</td><td>{runtime?.state ?? 'error'}</td><td>{String(r.usable ?? 0)}/{String(r.total ?? 0)}</td><td>{runtime?.motion?.message ?? String(r.error ?? '')}</td></tr>;
    })}</tbody></table>
  </main>;
}
