import { useState } from "react";
import { BackupSection } from "./BackupSection";
import { MainArea } from "./BottomNav";
import { ArchivedExercises } from "./ExerciseActions";
import { ExerciseEditor, ExerciseList } from "./ExerciseList";
import { ExportSection } from "./ExportSection";
import { Icon } from "./icons";
import { RoutineList, RoutineScreen } from "./RoutineList";

/** What settings shows: its main page, or one routine or exercise opened full screen (null: a new exercise). */
type View = { name: "main" } | { name: "routine"; id: string } | { name: "exercise"; id: string | null };

export function SettingsScreen() {
  const [view, setView] = useState<View>({ name: "main" });
  const main = () => setView({ name: "main" });

  if (view.name === "routine") return <RoutineScreen routineId={view.id} onClose={main} />;
  if (view.name === "exercise") return <ExerciseEditor exerciseId={view.id} onClose={main} />;

  return (
    <MainArea area="settings">
      <div className="page area settings">
        <h1 className="h1">Settings</h1>

        <section>
          <div className="h2">Routines</div>
          <RoutineList onOpen={(id) => setView({ name: "routine", id })} />
          <p className="hint">Routine changes apply from the next session.</p>
        </section>

        <section>
          <div className="h2">Exercises</div>
          <ExerciseList onEdit={(id) => setView({ name: "exercise", id })} />
          <button className="btn w add-exercise" onClick={() => setView({ name: "exercise", id: null })}>
            <Icon name="plus" />
            Add an exercise
          </button>
        </section>

        <section>
          <div className="h2">Archived exercises</div>
          <ArchivedExercises />
        </section>

        <section>
          <BackupSection allowRestore />
        </section>

        <section>
          <ExportSection />
        </section>
      </div>
    </MainArea>
  );
}
