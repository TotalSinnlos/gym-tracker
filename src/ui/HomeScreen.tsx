import { MainArea } from "./BottomNav";
import { useCore } from "./CoreContext";
import { formatExerciseNames } from "./format";
import { Icon } from "./icons";
import { Brand } from "./Logo";
import { Progress } from "./Progress";
import { useAction } from "./useAction";

export function HomeScreen({ onOpenSession }: { onOpenSession: () => void }) {
  const core = useCore();
  const routines = core.startableRoutines();
  const active = core.activeSession();
  const { error, run } = useAction();

  async function start(routineId: string) {
    if (await run(() => core.startSession(routineId))) onOpenSession();
  }

  return (
    <MainArea area="home">
      <Brand />
      {/* Everything to act on sits low on the screen, in thumb reach. */}
      <div className="home push-down">
        {active ? (
          <section className="running">
            <div className="running-label">
              <span className="dot" />
              Session running
            </div>
            <div>
              <h1 className="h1">{active.routineName}</h1>
              <div className="running-count num">
                {active.entries.length - core.pendingCount()} of {active.entries.length} done
              </div>
            </div>
            <Progress session={active} onAmber />
            <button className="btn lg dark" onClick={onOpenSession}>
              <Icon name="play" />
              Resume session
            </button>
          </section>
        ) : routines.length === 1 ? (
          <>
            <div>
              <div className="mut home-kicker">Your routine</div>
              <h1 className="h1">{routines[0].name}</h1>
            </div>
            <ol className="ol">
              {core.routineExercises(routines[0].id).map((exercise, index) => (
                // The same exercise can appear twice, so its position is the key.
                <li key={index}>
                  <span>{index + 1}</span>
                  {exercise.name}
                </li>
              ))}
            </ol>
            <button className="btn lg pri" onClick={() => start(routines[0].id)}>
              <Icon name="play" />
              Start session
            </button>
          </>
        ) : routines.length > 1 ? (
          <>
            <div className="home-pick">
              <h1 className="h1 big-title">Start a session</h1>
              <div className="mut">Pick a routine</div>
            </div>
            {routines.map((routine, index) => {
              const exercises = core.routineExercises(routine.id);
              return (
                <button
                  key={routine.id}
                  className={index === 0 ? "rc rc-hero" : "rc rc-tonal"}
                  onClick={() => start(routine.id)}
                >
                  <span className="rc-top">
                    <span className="rc-head">
                      <span className="rc-n">{routine.name}</span>
                      <span className="rc-c">
                        {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"}
                      </span>
                    </span>
                    <span className="play">
                      <Icon name="play" />
                    </span>
                  </span>
                  <span className="rc-x">{formatExerciseNames(exercises)}</span>
                </button>
              );
            })}
          </>
        ) : (
          <div className="nothing">
            <h1 className="nothing-t">Nothing to start yet</h1>
            <p className="body mut">Add exercises to a routine in settings to start a session.</p>
          </div>
        )}
        {error && <p className="errmsg">{error}</p>}
      </div>
    </MainArea>
  );
}
