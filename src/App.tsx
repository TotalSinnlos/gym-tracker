import { useEffect, useState } from "react";
import { type Core, type EndSessionResult, createCore } from "./core";
import { createIndexedDbStore } from "./storage/indexedDbStore";
import { type Area, NavigateContext } from "./ui/BottomNav";
import { CoreContext, useCore } from "./ui/CoreContext";
import { ExercisePage } from "./ui/ExercisePage";
import { HistoryScreen } from "./ui/HistoryScreen";
import { HomeScreen } from "./ui/HomeScreen";
import { OverviewScreen } from "./ui/OverviewScreen";
import { SessionScreen } from "./ui/SessionScreen";
import { useSafeUpdate } from "./ui/safeUpdate";
import { SettingsScreen } from "./ui/SettingsScreen";
import { SetupScreen } from "./ui/SetupScreen";
import { StaleSessionPrompt, useStaleSessionCheck } from "./ui/StaleSessionPrompt";
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
        <p className="errmsg app-error">Couldn't open your data: {error}</p>
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

type Screen =
  | { name: Area }
  | { name: "session" }
  | { name: "summary"; result: EndSessionResult }
  | { name: "overview" }
  | { name: "exercise"; exerciseId: string };

function Screens() {
  const core = useCore();
  // A running session reopens straight onto the session screen.
  const [screen, setScreen] = useState<Screen>(() => ({ name: core.activeSession() ? "session" : "home" }));
  const askAboutStaleSession = useStaleSessionCheck();

  // Every new screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Updates wait until no session is running and the user is on the home screen (not mid-form).
  useSafeUpdate(core.isSetupComplete() && !core.activeSession() && screen.name === "home");

  if (!core.isSetupComplete()) return <SetupScreen />;
  if (askAboutStaleSession.asking) {
    return (
      <StaleSessionPrompt
        onContinue={() => {
          askAboutStaleSession.dismiss();
          setScreen({ name: "session" });
        }}
        onEnded={(result) => {
          askAboutStaleSession.dismiss();
          setScreen({ name: "summary", result });
        }}
      />
    );
  }
  return (
    <NavigateContext.Provider value={(area: Area) => setScreen({ name: area })}>
      <CurrentScreen screen={screen} setScreen={setScreen} />
    </NavigateContext.Provider>
  );
}

function CurrentScreen({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  const home = () => setScreen({ name: "home" });
  switch (screen.name) {
    case "settings":
      return <SettingsScreen />;
    case "history":
      return <HistoryScreen />;
    case "session":
      return <SessionScreen onLeave={home} onEnded={(result) => setScreen({ name: "summary", result })} />;
    case "summary":
      return <SummaryScreen result={screen.result} onDone={home} />;
    case "overview":
      return <OverviewScreen onOpenExercise={(exerciseId) => setScreen({ name: "exercise", exerciseId })} />;
    case "exercise":
      return <ExercisePage exerciseId={screen.exerciseId} onBack={() => setScreen({ name: "overview" })} />;
    default:
      return <HomeScreen onOpenSession={() => setScreen({ name: "session" })} />;
  }
}
