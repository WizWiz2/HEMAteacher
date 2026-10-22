import { Link } from "react-router-dom";

export function NavigationMenu() {
  return (
    <details className="nav-menu">
      <summary aria-label="Открыть меню">Меню</summary>
      <nav>
        <Link to="/">Главная</Link>
        <Link to="/follow">Повторяй за эталоном</Link>
        <Link to="/meyer">Крест Мейера</Link>
        {/* /analysis and /dev/checkpoint-capture stay reachable by URL; they are developer tools, not in the menu. */}
      </nav>
    </details>
  );
}
