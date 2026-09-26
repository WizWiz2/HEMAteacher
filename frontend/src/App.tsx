import { Link, Route, Routes } from "react-router-dom";
import { LibraryPage } from "./pages/LibraryPage";
import { MovementPage } from "./pages/MovementPage";
import { RecordPage } from "./pages/RecordPage";
import { SessionPage } from "./pages/SessionPage";

export function App() {
  return (
    <div className="app">
      <header className="top">
        <Link className="brand" to="/">HEMA Motion Coach</Link>
        <span className="eyebrow">Сравнение с записью тренера</span>
      </header>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/movements/:id" element={<MovementPage />} />
        <Route path="/record/:id" element={<RecordPage />} />
        <Route path="/sessions/:id" element={<SessionPage />} />
      </Routes>
    </div>
  );
}
