import { useState } from "react";
import { useCore } from "./CoreContext";
import { ExerciseForm } from "./ExerciseForm";
import { ExerciseEditor, ExerciseList } from "./ExerciseList";
import { Icon } from "./icons";
import { Logo } from "./Logo";
import { RoutineEditor } from "./RoutineEditor";
import { useAction } from "./useAction";

/** First launch: add exercises, then arrange them into a routine. */
export function SetupScreen() {
  const core = useCore();
  const [step, setStep] = useState<"exercises" | "routine">("exercises");
  const [editingId, setEditingId] = useState<string | null>(null);
  const { error, run } = useAction();
  const routine = core.listRoutines()[0];
  const hasExercises = core.listExercises().length > 0;

  async function goToRoutine() {
    const ok = await run(async () => {
      if (!routine) await core.createRoutine("My routine");
    });
    if (ok) setStep("routine");
  }

  const errorMessage = error && (
    <p className="errmsg">
      <Icon name="error" />
      {error}
    </p>
  );

  if (editingId) return <ExerciseEditor exerciseId={editingId} onClose={() => setEditingId(null)} />;

  if (step === "exercises") {
    return (
      <main className="screen">
        <div className="setup-head">
          <Logo size={64} />
          <div>
            <h1 className="h1">Welcome!</h1>
            <div className="setup-step">Step 1 of 2: add your exercises.</div>
          </div>
          <div className="steps" aria-hidden="true">
            <div className="d" />
            <div />
          </div>
        </div>
        <div className="setup-body">
          <ExerciseForm onSubmit={(input) => core.createExercise(input)} />
          <div className="sec">{hasExercises ? "Your exercises · tap one to edit it" : "Your exercises"}</div>
          <ExerciseList onEdit={setEditingId} icon="edit" />
          {errorMessage}
        </div>
        <div className="dock push-down">
          {!hasExercises && <div className="help center">Add at least one exercise to continue.</div>}
          <button className="btn lg pri" disabled={!hasExercises} onClick={goToRoutine}>
            Next
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <div className="setup-head setup-head-2">
        <div>
          <h1 className="h1">Your routine</h1>
          <div className="setup-step">Step 2 of 2: add your exercises in the order you usually do them.</div>
        </div>
        <div className="steps" aria-hidden="true">
          <div className="d" />
          <div className="d" />
        </div>
      </div>
      <div className="setup-body">
        {routine && <RoutineEditor routineId={routine.id} detailed withName={false} />}
        {errorMessage}
      </div>
      <div className="dock push-down">
        <div className="g2">
          <button className="btn lg out" onClick={() => setStep("exercises")}>
            Back
          </button>
          <button className="btn lg pri" onClick={() => run(() => core.completeSetup())}>
            Done
          </button>
        </div>
      </div>
    </main>
  );
}
