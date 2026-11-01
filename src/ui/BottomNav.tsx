import { type ReactNode, createContext, useContext } from "react";
import { useCore } from "./CoreContext";
import { Icon, type IconName } from "./icons";

/** The main areas, reached from the bottom navigation. The trainer's only shows while the trainer is on. */
export type Area = "home" | "overview" | "history" | "trainer" | "settings";

const AREAS: { area: Area; label: string; icon: IconName }[] = [
  { area: "home", label: "Home", icon: "home" },
  { area: "overview", label: "Progress", icon: "progress" },
  { area: "history", label: "History", icon: "history" },
  { area: "trainer", label: "Trainer", icon: "chat" },
  { area: "settings", label: "Settings", icon: "settings" },
];

/** Opens a main area. Provided by the app, used by the bottom navigation. */
export const NavigateContext = createContext<(area: Area) => void>(() => {});

/**
 * A main area's screen with the bottom navigation under it. Sub-pages (a session, an exercise page,
 * an editor) leave the navigation out so nothing distracts from them.
 */
export function MainArea({ area, children }: { area: Area; children: ReactNode }) {
  const navigate = useContext(NavigateContext);
  const trainerOn = useCore().trainer().enabled;
  const areas = AREAS.filter((item) => item.area !== "trainer" || trainerOn || area === "trainer");
  return (
    <div className="app-with-nav">
      <main className="screen with-nav">{children}</main>
      <nav className="nav">
        <div className="nav-items">
          {areas.map((item) => (
            <button
              key={item.area}
              className={item.area === area ? "on" : undefined}
              aria-current={item.area === area ? "page" : undefined}
              onClick={() => navigate(item.area)}
            >
              <span className="pill">
                <Icon name={item.icon} />
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
