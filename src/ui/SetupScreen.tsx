import { useState } from "react";
import { useCore } from "./CoreContext";
import { ExerciseList } from "./ExerciseList";
import { RoutineEditor } from "./RoutineEditor";
import { useAction } from "./useAction";

/** First launch: add exercises, then arrange them into a routine. */
export function SetupScreen() {
  const core = useCore();
  const [step, setStep] = useState<"exercises" | "routine">("exercises");
  const { error, run } = useAction();
  const routine = core.listRoutines()[0];

  async function goToRoutine() {
    const ok = await run(async () => {
      if (!routine) await core.createRoutine("My routine");
    });
    if (ok) setStep("routine");
  }

  if (step === "exercises") {
    return (
      <main className="screen">
        <h1>Welcome!</h1>
        <p className="muted">
          Step 1 of 2: add the exercises you do at the gym. You can change all of this later in settings.
        </p>
        <ExerciseList />
        {error && <p className="error">{error}</p>}
        <button className="primary wide" disabled={core.listExercises().length === 0} onClick={goToRoutine}>
          Next: build your routine
        </button>
      </main>
    );
  }

  return (
    <main className="screen">
      <h1>Your routine</h1>
      <p className="muted">Step 2 of 2: add your exercises in the order you usually do them.</p>
      {routine && <RoutineEditor routineId={routine.id} />}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="secondary" onClick={() => setStep("exercises")}>
          Back
        </button>
        <button className="primary" onClick={() => run(() => core.completeSetup())}>
          Finish
        </button>
      </div>
    </main>
  );
}
