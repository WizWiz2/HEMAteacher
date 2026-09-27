import { Link } from "react-router-dom";

export function NavigationMenu() {
  return (
    <details className="nav-menu">
      <summary aria-label="Открыть меню">☰ Меню</summary>
      <nav>
        <Link to="/">Тренировка</Link>
        <Link to="/analysis">Подробный разбор видео</Link>
        <Link to="/dev/checkpoint-capture">Снять контрольную точку</Link>
      </nav>
    </details>
  );
}
