import { useEffect, useState } from "react";
import { type Core, type EndSessionResult, createCore } from "./core";
import { createIndexedDbStore } from "./storage/indexedDbStore";
import { CoreContext, useCore } from "./ui/CoreContext";
import { HomeScreen } from "./ui/HomeScreen";
import { SessionScreen } from "./ui/SessionScreen";
import { SettingsScreen } from "./ui/SettingsScreen";
import { SetupScreen } from "./ui/SetupScreen";
import { SummaryScreen } from "./ui/SummaryScreen";

export function App() {
  const [core, setCore] = useState<Core | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createCore(createIndexedDbStore())
      .then(setCore)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <main className="screen">
        <p className="error">Couldn't open your data: {error}</p>
      </main>
    );
  }
  if (!core) return null;

  return (
    <CoreContext.Provider value={core}>
      <Screens />
    </CoreContext.Provider>
  );
}

type Screen = { name: "home" } | { name: "settings" } | { name: "session" } | { name: "summary"; result: EndSessionResult };

function Screens() {
  const core = useCore();
  // A running session reopens straight onto the session screen.
  const [screen, setScreen] = useState<Screen>(() => ({ name: core.activeSession() ? "session" : "home" }));
  const home = () => setScreen({ name: "home" });

  if (!core.isSetupComplete()) return <SetupScreen />;
  switch (screen.name) {
    case "settings":
      return <SettingsScreen onBack={home} />;
    case "session":
      return <SessionScreen onLeave={home} onEnded={(result) => setScreen({ name: "summary", result })} />;
    case "summary":
      return <SummaryScreen result={screen.result} onDone={home} />;
    default:
      return (
        <HomeScreen onOpenSettings={() => setScreen({ name: "settings" })} onOpenSession={() => setScreen({ name: "session" })} />
      );
  }
}
