import { useEffect, useState } from "react";
import { type Core, createCore } from "./core";
import { createIndexedDbStore } from "./storage/indexedDbStore";
import { CoreContext, useCore } from "./ui/CoreContext";
import { HomeScreen } from "./ui/HomeScreen";
import { SettingsScreen } from "./ui/SettingsScreen";
import { SetupScreen } from "./ui/SetupScreen";

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

function Screens() {
  const core = useCore();
  const [screen, setScreen] = useState<"home" | "settings">("home");

  if (!core.isSetupComplete()) return <SetupScreen />;
  if (screen === "settings") return <SettingsScreen onBack={() => setScreen("home")} />;
  return <HomeScreen onOpenSettings={() => setScreen("settings")} />;
}
