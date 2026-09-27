import { Link, Route, Routes } from "react-router-dom";
import { NavigationMenu } from "./components/NavigationMenu";
import { CheckpointCapturePage } from "./pages/CheckpointCapturePage";
import { DrillPage } from "./pages/DrillPage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { MovementPage } from "./pages/MovementPage";
import { RecordPage } from "./pages/RecordPage";
import { SessionPage } from "./pages/SessionPage";

export function App() {
  return (
    <div className="app">
      <header className="top manuscript-top">
        <Link className="brand" to="/">
          <span className="brand-mark">H</span>
          <span>HEMA Trainer</span>
        </Link>
        <NavigationMenu />
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/drills/:id" element={<DrillPage />} />
        <Route path="/dev/checkpoint-capture" element={<CheckpointCapturePage />} />
        <Route path="/analysis" element={<LibraryPage />} />
        <Route path="/movements/:id" element={<MovementPage />} />
        <Route path="/record/:id" element={<RecordPage />} />
        <Route path="/sessions/:id" element={<SessionPage />} />
      </Routes>
    </div>
  );
}
