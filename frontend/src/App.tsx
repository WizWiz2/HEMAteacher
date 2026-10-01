import { Link, Route, Routes } from "react-router-dom";
import { NavigationMenu } from "./components/NavigationMenu";
import { CheckpointCapturePage } from "./pages/CheckpointCapturePage";
import { DrillPage } from "./pages/DrillPage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { MovementPage } from "./pages/MovementPage";
import { RecordPage } from "./pages/RecordPage";
import { SessionPage } from "./pages/SessionPage";

import { lazy, Suspense } from "react";
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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/drills/:id" element={<DrillPage />} />
        {VideoRegressionPage && <Route path="/dev/video-regression" element={<Suspense fallback={<p>Загрузка тестового инструмента…</p>}><VideoRegressionPage /></Suspense>} />}
        <Route path="/dev/checkpoint-capture" element={<CheckpointCapturePage />} />
        <Route path="/analysis" element={<LibraryPage />} />
        <Route path="/movements/:id" element={<MovementPage />} />
        <Route path="/record/:id" element={<RecordPage />} />
        <Route path="/sessions/:id" element={<SessionPage />} />
      </Routes>
    </div>
  );
}
