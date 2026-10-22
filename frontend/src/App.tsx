import { Link, Route, Routes } from "react-router-dom";
import { NavigationMenu } from "./components/NavigationMenu";
import { lazy, Suspense } from "react";
import { HomePage } from "./pages/HomePage";

// Training and tool pages load on demand: the home page does not pull MediaPipe, the recognition models or the
// reference clips.
const CheckpointCapturePage = lazy(() => import("./pages/CheckpointCapturePage").then(m => ({ default: m.CheckpointCapturePage })));
const DrillPage = lazy(() => import("./pages/DrillPage").then(m => ({ default: m.DrillPage })));
const LibraryPage = lazy(() => import("./pages/LibraryPage").then(m => ({ default: m.LibraryPage })));
const MovementPage = lazy(() => import("./pages/MovementPage").then(m => ({ default: m.MovementPage })));
const MeyerSquarePage = lazy(() => import("./pages/MeyerSquarePage").then(m => ({ default: m.MeyerSquarePage })));
const FollowAlongPage = lazy(() => import("./pages/FollowAlongPage").then(m => ({ default: m.FollowAlongPage })));
const RecordPage = lazy(() => import("./pages/RecordPage").then(m => ({ default: m.RecordPage })));
const SessionPage = lazy(() => import("./pages/SessionPage").then(m => ({ default: m.SessionPage })));


const VideoRegressionPage = import.meta.env.DEV
  ? lazy(() => import("./pages/VideoRegressionPage").then(module => ({ default: module.VideoRegressionPage })))
  : null;

export function App() {
  return (
    <div className="app">
      <header className="top manuscript-top">
        <Link className="brand" to="/">
          <span className="brand-mark">H</span>
          <span>HEMA Trainer</span>
        </Link>
        <img className="masthead-engraving" src={`${import.meta.env.BASE_URL}theme/longsword-fencers.webp`} alt="" aria-hidden="true" width="300" height="100" />
        <NavigationMenu />
      </header>
      <Suspense fallback={<p className="route-loading">Загрузка…</p>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/meyer" element={<MeyerSquarePage />} />
        <Route path="/follow" element={<FollowAlongPage />} />
        <Route path="/drills/:id" element={<DrillPage />} />
        {VideoRegressionPage && <Route path="/dev/video-regression" element={<Suspense fallback={<p>Загрузка тестового инструмента…</p>}><VideoRegressionPage /></Suspense>} />}
        <Route path="/dev/checkpoint-capture" element={<CheckpointCapturePage />} />
        <Route path="/analysis" element={<LibraryPage />} />
        <Route path="/movements/:id" element={<MovementPage />} />
        <Route path="/record/:id" element={<RecordPage />} />
        <Route path="/sessions/:id" element={<SessionPage />} />
      </Routes>
      </Suspense>
    </div>
  );
}
