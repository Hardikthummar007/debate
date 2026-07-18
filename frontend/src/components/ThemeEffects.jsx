import { useTheme } from "@/context/ThemeContext";
import { useEffect, useMemo } from "react";

/**
 * Renders ambient theme effects globally (snow, fire, fog, none).
 */
export default function ThemeEffects() {
  const { theme } = useTheme();

  const items = useMemo(() => {
    if (theme === "snow") {
      return Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        duration: 6 + Math.random() * 12,
        delay: Math.random() * 10,
        size: 8 + Math.random() * 14,
        char: Math.random() > 0.5 ? "❄" : "❅",
      }));
    }
    if (theme === "fire") {
      return Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        duration: 4 + Math.random() * 6,
        delay: Math.random() * 8,
      }));
    }
    if (theme === "night") {
      return Array.from({ length: 5 }, (_, i) => ({
        id: i,
        top: 10 + i * 18,
        duration: 25 + Math.random() * 20,
        delay: i * 5,
      }));
    }
    return [];
  }, [theme]);

  useEffect(() => {}, [theme]);

  if (theme === "snow") {
    return (
      <div aria-hidden data-testid="theme-fx-snow">
        {items.map((s) => (
          <span
            key={s.id}
            className="snowflake"
            style={{
              left: `${s.left}%`,
              fontSize: `${s.size}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          >
            {s.char}
          </span>
        ))}
      </div>
    );
  }
  if (theme === "fire") {
    return (
      <div aria-hidden data-testid="theme-fx-fire">
        {items.map((s) => (
          <span
            key={s.id}
            className="ember"
            style={{
              left: `${s.left}%`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }
  if (theme === "night") {
    return (
      <div aria-hidden data-testid="theme-fx-night">
        {items.map((s) => (
          <div
            key={s.id}
            className="wisp"
            style={{
              top: `${s.top}%`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
    );
  }
  return null;
}
