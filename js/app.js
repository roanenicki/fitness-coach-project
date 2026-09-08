let user = null;
let profile = null;

let activeSession = null;
let activeWorkoutData = null;

let timerInt = null;
let startMs = 0;

const MAX_REPS = 200;

const $ = (id) => document.getElementById(id);


/* ============================================================
   INITIALISATION
   ============================================================ */

async function init() {

  const {
    data,
    error
  } = await supabaseClient.auth.getUser();


  if (error || !data.user) {

    location.href = "index.html";

    return;
  }


  user = data.user;


  /* ----------------------------------------------------------
     PROFIL
     ---------------------------------------------------------- */

  const {
    data: p,
    error: profileError
  } = await supabaseClient
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();


  if (profileError) {

    console.error(
      "Erreur profil :",
      profileError
    );
  }


  profile = p;


  /* ----------------------------------------------------------
     REDIRECTION COACH
     ---------------------------------------------------------- */

  if (
    profile?.role === "coach"
  ) {

    location.href =
      "coach.html";

    return;
  }


  /* ----------------------------------------------------------
     IDENTITÉ
     ---------------------------------------------------------- */

  $("welcome").textContent =
    `Bonjour ${
      profile?.full_name ||
      user.email
    }`;


  $("today").textContent =
    new Intl.DateTimeFormat(
      "fr-FR",
      {
        dateStyle:
          "full"
      }
    ).format(
      new Date()
    );


  /* ----------------------------------------------------------
     PROGRAMME
     ---------------------------------------------------------- */

  activeWorkoutData =
    await loadAthleteProgram();


  if (
    activeWorkoutData
  ) {

    renderWorkout();

  } else {

    $("workout").innerHTML =
      `
        <p class="muted">
          Aucun programme actif n'est actuellement attribué.
        </p>
      `;
  }


  /* ----------------------------------------------------------
     SÉANCE EN COURS
     ---------------------------------------------------------- */

  await restoreActiveSession();


  /* ----------------------------------------------------------
     HISTORIQUE
     ---------------------------------------------------------- */

  await loadHistory();
}


/* ============================================================
   PROGRAMME INDIVIDUEL
   ============================================================ */

async function loadAthleteProgram() {

  const {
    data: athleteProgram,
    error: programError
  } = await supabaseClient
    .from("athlete_programs")
    .select(`
      id,
      current_week,
      active,
      program_id,
      started_at,
      programs (
        id,
        code,
        name,
        description,
        recommended_frequency
      )
    `)
    .eq(
      "athlete_id",
      user.id
    )
    .eq(
      "active",
      true
    )
    .order(
      "started_at",
      {
        ascending: false
      }
    )
    .limit(1)
    .maybeSingle();


  if (
    programError
  ) {

    console.error(
      "Erreur récupération programme :",
      programError
    );

    return null;
  }


  if (
    !athleteProgram ||
    !athleteProgram.programs
  ) {

    console.warn(
      "Aucun programme actif."
    );

    return null;
  }


  const program =
    athleteProgram.programs;


  const weekNumber =
    Number(
      athleteProgram.current_week
    ) > 0
      ? Number(
          athleteProgram.current_week
        )
      : 1;


  /* ----------------------------------------------------------
     PHASE
     ---------------------------------------------------------- */

  const {
    data: phase,
    error: phaseError
  } = await supabaseClient
    .from("program_phases")
    .select(`
      id,
      name,
      week_start,
      week_end,
      description
    `)
    .eq(
      "program_id",
      program.id
    )
    .lte(
      "week_start",
      weekNumber
    )
    .gte(
      "week_end",
      weekNumber
    )
    .maybeSingle();


  if (
    phaseError ||
    !phase
  ) {

    console.error(
      "Erreur récupération phase :",
      phaseError
    );

    return null;
  }


  /* ----------------------------------------------------------
     EXERCICES INDIVIDUELS
     ---------------------------------------------------------- */

  const {
    data: exercises,
    error: exercisesError
  } = await supabaseClient
    .from(
      "athlete_program_exercises"
    )
    .select(`
      id,
      athlete_program_id,
      phase_id,
      source_exercise_id,
      block_id,
      block_name,
      block_icon,
      exercise_order,
      exercise_name,
      sets,
      reps,
      duration,
      duration_unit,
      recovery,
      note,
      active
    `)
    .eq(
      "athlete_program_id",
      athleteProgram.id
    )
    .eq(
      "phase_id",
      phase.id
    )
    .eq(
      "active",
      true
    )
    .order(
      "exercise_order",
      {
        ascending: true
      }
    );


  if (
    exercisesError
  ) {

    console.error(
      "Erreur récupération exercices :",
      exercisesError
    );

    return null;
  }


  return {

    athleteProgramId:
      athleteProgram.id,

    programDbId:
      athleteProgram.program_id,

    programCode:
      program.code,

    programName:
      program.name,

    programDescription:
      program.description,

    recommendedFrequency:
      program.recommended_frequency,

    weekNumber,

    phase,

    exercises:
      exercises || []
  };
}


/* ============================================================
   AFFICHAGE DU PROGRAMME
   ============================================================ */

function renderWorkout() {

  if (
    !activeWorkoutData
  ) {

    $("workout").innerHTML =
      `
        <p class="muted">
          Programme indisponible.
        </p>
      `;

    return;
  }


  const data =
    activeWorkoutData;


  const phase =
    data.phase;


  /* ----------------------------------------------------------
     INFORMATIONS PROGRAMME
     ---------------------------------------------------------- */

  if (
    $("programInfo")
  ) {

    $("programInfo").innerHTML = `

      <strong>
        ${escapeHtml(
          data.programName
        )}
      </strong>

      <br>

      ${escapeHtml(
        phase.name
      )}

      <br>

      Semaine ${data.weekNumber}

      ${
        data.recommendedFrequency
          ? `
            <br>
            ${data.recommendedFrequency}
            séances recommandées par semaine
          `
          : ""
      }

    `;
  }


  let html = `

    <div class="workout-header">

      <h3>
        ${escapeHtml(
          data.programName
        )}
      </h3>


      <p class="muted">
        ${escapeHtml(
          phase.name
        )}
      </p>


      ${
        phase.description
          ? `
            <p class="muted">
              ${escapeHtml(
                phase.description
              )}
            </p>
          `
          : ""
      }


      <p class="muted">

        Semaine ${data.weekNumber}.
        Séance complète d'environ 1 heure.

        Les jours recommandés sont indicatifs :
        tu peux t'entraîner lorsque tu es disponible.

      </p>

    </div>

  `;


  const blocks =
    groupExercisesByBlock(
      data.exercises
    );


  if (
    !blocks.length
  ) {

    html += `

      <div class="workout-block">

        <p class="muted">
          Aucun exercice n'est actuellement configuré
          pour cette phase.
        </p>

      </div>

    `;

  } else {

    blocks.forEach(
      (block) => {

        html +=
          renderBlock(
            block
          );
      }
    );
  }


  $("workout").innerHTML =
    html;


  setupRepetitionInputs();

  refreshIcons();
}


/* ============================================================
   GROUPER LES EXERCICES
   ============================================================ */

function groupExercisesByBlock(
  exercises
) {

  const map =
    new Map();


  exercises.forEach(
    (exercise) => {

      const blockId =
        exercise.block_id ||
        "default";


      if (
        !map.has(blockId)
      ) {

        map.set(
          blockId,
          {
            blockId,

            name:
              exercise.block_name ||
              "Exercices",

            icon:
              exercise.block_icon ||
              "",

            exercises: []
          }
        );
      }


      map
        .get(blockId)
        .exercises
        .push(
          exercise
        );
    }
  );


  return [
    ...map.values()
  ];
}


/* ============================================================
   ICÔNE D'UN BLOC
   ============================================================ */

function getBlockIcon(
  block
) {

  const id =
    String(
      block.blockId ||
      ""
    ).toLowerCase();


  const name =
    String(
      block.name ||
      ""
    ).toLowerCase();


  if (
    id.includes("warm") ||
    name.includes("échauff") ||
    name.includes("warm")
  ) {

    return "flame";
  }


  if (
    id.includes("glute") ||
    id.includes("leg") ||
    name.includes("fess") ||
    name.includes("jamb")
  ) {

    return "person-standing";
  }


  if (
    id.includes("upper") ||
    id.includes("chest") ||
    id.includes("pector") ||
    name.includes("poitrine") ||
    name.includes("haut")
  ) {

    return "dumbbell";
  }


  if (
    id.includes("core") ||
    id.includes("gain") ||
    name.includes("core") ||
    name.includes("gainage")
  ) {

    return "shield";
  }


  if (
    id.includes("cardio") ||
    name.includes("cardio")
  ) {

    return "zap";
  }


  return "activity";
}


/* ============================================================
   AFFICHAGE D'UN BLOC
   ============================================================ */

function renderBlock(
  block
) {

  const icon =
    getBlockIcon(
      block
    );


  let html = `

    <section class="workout-block">

      <div class="workout-block-heading">

        <span class="workout-block-icon">

          <i data-lucide="${icon}"></i>

        </span>


        <div>

          <span class="section-kicker">
            BLOC
          </span>


          <h4>
            ${escapeHtml(
              block.name
            )}
          </h4>

        </div>

      </div>


      <div class="exercise-list">

  `;


  block.exercises.forEach(
    (
      exercise,
      index
    ) => {

      const details = [];


      if (
        exercise.sets !== null &&
        exercise.sets !== undefined
      ) {

        details.push(
          `
            <span>

              <i data-lucide="layers-3"></i>

              ${exercise.sets}
              série${
                Number(
                  exercise.sets
                ) > 1
                  ? "s"
                  : ""
              }

            </span>
          `
        );
      }


      if (
        exercise.reps !== null &&
        exercise.reps !== undefined &&
        String(
          exercise.reps
        ).trim() !== ""
      ) {

        details.push(
          `
            <span>

              <i data-lucide="repeat-2"></i>

              ${escapeHtml(
                exercise.reps
              )}
              reps

            </span>
          `
        );
      }


      if (
        exercise.duration !== null &&
        exercise.duration !== undefined
      ) {

        details.push(
          `
            <span>

              <i data-lucide="clock-3"></i>

              ${exercise.duration}
              ${
                exercise.duration_unit ||
                "secondes"
              }

            </span>
          `
        );
      }


      if (
        exercise.recovery !== null &&
        exercise.recovery !== undefined
      ) {

        details.push(
          `
            <span>

              <i data-lucide="pause-circle"></i>

              ${exercise.recovery}s repos

            </span>
          `
        );
      }


      html += `

        <article
          class="exercise"
          data-exercise-id="${escapeAttribute(
            exercise.id
          )}"
        >

          <div class="exercise-number">

            ${String(
              index + 1
            ).padStart(
              2,
              "0"
            )}

          </div>


          <div class="exercise-content">

            <b>
              ${escapeHtml(
                exercise.exercise_name
              )}
            </b>


            ${
              details.length
                ? `
                  <div class="exercise-details">

                    ${details.join("")}

                  </div>
                `
                : ""
            }


            ${
              exercise.note
                ? `
                  <small class="exercise-note">

                    <i data-lucide="info"></i>

                    ${escapeHtml(
                      exercise.note
                    )}

                  </small>
                `
                : ""
            }

          </div>


          <div class="exercise-input-wrap">

            <label>

              <span>
                Réalisé
              </span>


              <div class="reps-input">

                <input
                  data-exercise-id="${escapeAttribute(
                    exercise.id
                  )}"
                  data-exercise-name="${escapeAttribute(
                    exercise.exercise_name
                  )}"
                  type="number"
                  min="0"
                  max="${MAX_REPS}"
                  step="1"
                  inputmode="numeric"
                  placeholder="0"
                  aria-label="Répétitions réalisées pour ${escapeAttribute(
                    exercise.exercise_name
                  )}"
                >


                <span>
                  reps
                </span>

              </div>

            </label>

          </div>

        </article>

      `;
    }
  );


  html += `

      </div>

    </section>

  `;


  return html;
}


/* ============================================================
   INPUTS RÉPÉTITIONS
   ============================================================ */

function setupRepetitionInputs() {

  const inputs =
    document.querySelectorAll(
      ".exercise input[type='number']"
    );


  inputs.forEach(
    (input) => {

      input.addEventListener(
        "input",
        () => {

          let value =
            Number(
              input.value
            );


          if (
            !Number.isFinite(
              value
            )
          ) {

            input.value =
              "";

            return;
          }


          value =
            Math.floor(
              value
            );


          value =
            Math.max(
              0,
              Math.min(
                MAX_REPS,
                value
              )
            );


          input.value =
            value;
        }
      );
    }
  );
}


/* ============================================================
   RESTAURATION SÉANCE
   ============================================================ */

async function restoreActiveSession() {

  const {
    data,
    error
  } = await supabaseClient
    .from(
      "workout_sessions"
    )
    .select(`
      id,
      user_id,
      workout_name,
      started_at,
      ended_at,
      duration_seconds
    `)
    .eq(
      "user_id",
      user.id
    )
    .is(
      "ended_at",
      null
    )
    .order(
      "started_at",
      {
        ascending: false
      }
    )
    .limit(1)
    .maybeSingle();


  if (
    error
  ) {

    console.error(
      "Erreur récupération séance en cours :",
      error
    );

    return;
  }


  if (!data) {
    return;
  }


  activeSession =
    data;


  startMs =
    new Date(
      activeSession.started_at
    ).getTime();


  if (
    !Number.isFinite(
      startMs
    )
  ) {

    console.error(
      "Date de début de séance invalide."
    );

    activeSession =
      null;

    return;
  }


  await restoreSessionExercises();


  startTimer();


  $("startBtn").disabled =
    true;

  $("finishBtn").disabled =
    false;


  showSessionStatus(
    "Séance en cours — le chronomètre a été repris."
  );
}


/* ============================================================
   RESTAURATION RÉPÉTITIONS
   ============================================================ */

async function restoreSessionExercises() {

  if (
    !activeSession
  ) {
    return;
  }


  const {
    data,
    error
  } = await supabaseClient
    .from(
      "session_exercises"
    )
    .select(
      "*"
    )
    .eq(
      "session_id",
      activeSession.id
    )
    .order(
      "exercise_index",
      {
        ascending: true
      }
    );


  if (
    error
  ) {

    console.error(
      "Erreur récupération exercices :",
      error
    );

    return;
  }


  if (
    !data?.length
  ) {
    return;
  }


  const inputs = [
    ...document.querySelectorAll(
      ".exercise input[type='number']"
    )
  ];


  data.forEach(
    (exercise) => {

      const index =
        Number(
          exercise.exercise_index
        );


      if (
        !inputs[index]
      ) {
        return;
      }


      const reps =
        Math.max(
          0,
          Math.min(
            MAX_REPS,
            Number(
              exercise.reps_completed
            ) || 0
          )
        );


      inputs[index].value =
        reps;
    }
  );
}


/* ============================================================
   CHRONOMÈTRE
   ============================================================ */

function startTimer() {

  clearInterval(
    timerInt
  );


  updateTimer();


  timerInt =
    setInterval(
      updateTimer,
      1000
    );
}


function updateTimer() {

  if (
    !activeSession ||
    !startMs
  ) {
    return;
  }


  const elapsed =
    Date.now() -
    startMs;


  $("timer").textContent =
    fmt(
      elapsed
    );
}


/* ============================================================
   COMMENCER UNE SÉANCE
   ============================================================ */

$("startBtn").onclick =
  async () => {

    if (
      activeSession
    ) {
      return;
    }


    if (
      !activeWorkoutData
    ) {

      alert(
        "Le programme n'est pas disponible."
      );

      return;
    }


    const {
      data: existingSession,
      error: existingError
    } =
      await supabaseClient
        .from(
          "workout_sessions"
        )
        .select("*")
        .eq(
          "user_id",
          user.id
        )
        .is(
          "ended_at",
          null
        )
        .order(
          "started_at",
          {
            ascending: false
          }
        )
        .limit(1)
        .maybeSingle();


    if (
      existingError
    ) {

      console.error(
        existingError
      );

      alert(
        `Impossible de vérifier la séance en cours : ${existingError.message}`
      );

      return;
    }


    if (
      existingSession
    ) {

      activeSession =
        existingSession;


      startMs =
        new Date(
          existingSession.started_at
        ).getTime();


      await restoreSessionExercises();


      startTimer();


      $("startBtn").disabled =
        true;

      $("finishBtn").disabled =
        false;


      showSessionStatus(
        "Séance en cours."
      );

      return;
    }


    const startedAt =
      new Date()
        .toISOString();


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "workout_sessions"
        )
        .insert({

          user_id:
            user.id,

          workout_name:
            activeWorkoutData
              .programName,

          started_at:
            startedAt

        })
        .select()
        .single();


    if (
      error
    ) {

      console.error(
        error
      );

      alert(
        `Impossible de démarrer la séance : ${error.message}`
      );

      return;
    }


    activeSession =
      data;


    startMs =
      new Date(
        activeSession.started_at
      ).getTime();


    $("startBtn").disabled =
      true;

    $("finishBtn").disabled =
      false;


    startTimer();


    showSessionStatus(
      "Séance en cours."
    );
  };


/* ============================================================
   TERMINER UNE SÉANCE
   ============================================================ */

$("finishBtn").onclick =
  async () => {

    if (
      !activeSession
    ) {
      return;
    }


    const endMs =
      Date.now();


    clearInterval(
      timerInt
    );

    timerInt =
      null;


    const inputs = [
      ...document.querySelectorAll(
        ".exercise input[type='number']"
      )
    ];


    /*
     * Préparer les performances.
     */

    const values =
      inputs.map(
        (
          input,
          index
        ) => {

          let reps =
            Number(
              input.value
            ) || 0;


          reps =
            Math.floor(
              reps
            );


          reps =
            Math.max(
              0,
              Math.min(
                MAX_REPS,
                reps
              )
            );


          return {

            session_id:
              activeSession.id,

            exercise_index:
              index,

            reps_completed:
              reps
          };
        }
      );


    /* --------------------------------------------------------
       SAUVEGARDER LES PERFORMANCES
       -------------------------------------------------------- */

    if (
      values.length > 0
    ) {

      const {
        error:
          exercisesError
      } =
        await supabaseClient
          .from(
            "session_exercises"
          )
          .insert(
            values
          );


      if (
        exercisesError
      ) {

        console.error(
          exercisesError
        );


        startTimer();


        alert(
          `La séance n'a pas pu enregistrer les exercices : ${exercisesError.message}`
        );

        return;
      }
    }


    /* --------------------------------------------------------
       TERMINER LA SÉANCE
       -------------------------------------------------------- */

    const durationSeconds =
      Math.max(
        0,
        Math.round(
          (
            endMs -
            startMs
          ) / 1000
        )
      );


    const {
      error
    } =
      await supabaseClient
        .from(
          "workout_sessions"
        )
        .update({

          ended_at:
            new Date(
              endMs
            ).toISOString(),

          duration_seconds:
            durationSeconds

        })
        .eq(
          "id",
          activeSession.id
        )
        .eq(
          "user_id",
          user.id
        )
        .is(
          "ended_at",
          null
        );


    if (
      error
    ) {

      console.error(
        error
      );


      startTimer();


      alert(
        `Erreur lors de la sauvegarde de la séance : ${error.message}`
      );

      return;
    }


    /*
     * Garder une copie pour le récapitulatif.
     */

    const finishedSession =
      {
        ...activeSession,

        ended_at:
          new Date(
            endMs
          ).toISOString(),

        duration_seconds:
          durationSeconds
      };


    const recapExercises =
      values.map(
        (
          value,
          index
        ) => {

          const source =
            activeWorkoutData?.exercises?.[
              index
            ];


          return {

            exercise_index:
              index,

            exercise_name:
              source?.exercise_name ||
              `Exercice ${index + 1}`,

            reps_completed:
              value.reps_completed
          };
        }
      );


    /*
     * Réinitialiser l'état.
     */

    activeSession =
      null;

    startMs =
      0;


    $("startBtn").disabled =
      false;

    $("finishBtn").disabled =
      true;

    $("timer").textContent =
      "00:00";


    /*
     * Afficher le récapitulatif immédiatement.
     */

    renderFinishedWorkoutRecap(
      finishedSession,
      recapExercises
    );


    /*
     * Recharger l'historique.
     */

    await loadHistory();


    refreshIcons();
  };


/* ============================================================
   RÉCAPITULATIF APRÈS LA SÉANCE
   ============================================================ */

function renderFinishedWorkoutRecap(
  session,
  exercises
) {

  const totalReps =
    exercises.reduce(
      (
        total,
        exercise
      ) =>
        total +
        Number(
          exercise.reps_completed ||
          0
        ),
      0
    );


  const performedExercises =
    exercises.filter(
      (exercise) =>
        Number(
          exercise.reps_completed ||
          0
        ) > 0
    ).length;


  const duration =
    formatDuration(
      Number(
        session.duration_seconds ||
        0
      )
    );


  const recap =
    document.createElement(
      "section"
    );


  recap.className =
    "workout-recap";


  recap.id =
    "workoutRecap";


  recap.innerHTML = `

    <div class="recap-success">

      <div class="recap-success-icon">

        <i data-lucide="circle-check"></i>

      </div>


      <div>

        <span class="section-kicker">
          SÉANCE TERMINÉE
        </span>

        <h3>
          Bravo, séance enregistrée !
        </h3>

        <p class="muted">
          Voici le récapitulatif de ta séance.
        </p>

      </div>

    </div>


    <div class="recap-stats">


      <div>

        <span class="recap-stat-icon">

          <i data-lucide="timer"></i>

        </span>


        <strong>
          ${duration}
        </strong>


        <small>
          durée
        </small>

      </div>


      <div>

        <span class="recap-stat-icon">

          <i data-lucide="repeat-2"></i>

        </span>


        <strong>
          ${totalReps}
        </strong>


        <small>
          répétitions
        </small>

      </div>


      <div>

        <span class="recap-stat-icon">

          <i data-lucide="dumbbell"></i>

        </span>


        <strong>
          ${performedExercises}
        </strong>


        <small>
          exercices réalisés
        </small>

      </div>


    </div>


    <div class="recap-list">


      <div class="recap-list-header">

        <div>

          <span class="section-kicker">
            PERFORMANCE
          </span>

          <h4>
            Récapitulatif des exercices
          </h4>

        </div>


        <span class="recap-total">
          ${totalReps} reps
        </span>

      </div>


      ${
        exercises.length
          ? exercises
              .map(
                (
                  exercise,
                  index
                ) => `

                  <div class="recap-exercise">

                    <span class="recap-number">
                      ${String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </span>


                    <span class="recap-exercise-name">

                      ${escapeHtml(
                        exercise.exercise_name
                      )}

                    </span>


                    <strong>

                      ${Number(
                        exercise.reps_completed ||
                        0
                      )}

                      <small>
                        reps
                      </small>

                    </strong>

                  </div>

                `
              )
              .join("")
          : `
              <p class="muted">
                Aucun exercice enregistré.
              </p>
            `
      }


    </div>


    <button
      type="button"
      class="secondary recap-close"
      id="closeRecapBtn"
    >

      <i data-lucide="arrow-up"></i>

      Retour au programme

    </button>

  `;


  const workout =
    $("workout");


  /*
   * Placer le récapitulatif au début
   * du bloc workout.
   */

  workout.prepend(
    recap
  );


  recap
    .scrollIntoView({
      behavior:
        "smooth",
      block:
        "start"
    });


  const closeButton =
    $("closeRecapBtn");


  if (
    closeButton
  ) {

    closeButton.onclick =
      () => {

        recap.remove();

        window.scrollTo({
          top: 0,
          behavior:
            "smooth"
        });

      };
  }


  refreshIcons();
}


/* ============================================================
   MESSAGE SÉANCE
   ============================================================ */

function showSessionStatus(
  message
) {

  if (
    !$("programInfo")
  ) {
    return;
  }


  $("programInfo")
    .innerHTML +=
      `
        <br>

        <strong>
          ${escapeHtml(
            message
          )}
        </strong>
      `;
}


/* ============================================================
   HISTORIQUE ATHLÈTE
   ============================================================ */

async function loadHistory() {

  const {
    data: sessions,
    error
  } = await supabaseClient
    .from(
      "workout_sessions"
    )
    .select(`
      id,
      workout_name,
      started_at,
      ended_at,
      duration_seconds
    `)
    .eq(
      "user_id",
      user.id
    )
    .order(
      "started_at",
      {
        ascending: false
      }
    )
    .limit(10);


  if (
    error
  ) {

    console.error(
      "Erreur historique :",
      error
    );


    $("history").innerHTML =
      `
        <p class="muted">
          Impossible de charger l’historique.
        </p>
      `;

    return;
  }


  const sessionList =
    sessions || [];


  /*
   * Récupérer les exercices de l'historique.
   */

  const sessionIds =
    sessionList
      .map(
        (session) =>
          session.id
      )
      .filter(Boolean);


  let sessionExercises =
    [];


  if (
    sessionIds.length
  ) {

    const {
      data: exerciseData,
      error: exerciseError
    } = await supabaseClient
      .from(
        "session_exercises"
      )
      .select("*")
      .in(
        "session_id",
        sessionIds
      )
      .order(
        "exercise_index",
        {
          ascending: true
        }
      );


    if (
      exerciseError
    ) {

      console.error(
        "Erreur historique exercices :",
        exerciseError
      );

    } else {

      sessionExercises =
        exerciseData || [];
    }
  }


  /*
   * Grouper par séance.
   */

  const exercisesBySession =
    new Map();


  sessionExercises.forEach(
    (exercise) => {

      const sessionId =
        String(
          exercise.session_id
        );


      if (
        !exercisesBySession.has(
          sessionId
        )
      ) {

        exercisesBySession.set(
          sessionId,
          []
        );
      }


      exercisesBySession
        .get(sessionId)
        .push(
          exercise
        );
    }
  );


  /*
   * Rendu.
   */

  if (
    !sessionList.length
  ) {

    $("history").innerHTML = `

      <div class="history-empty">

        <span class="history-empty-icon">

          <i data-lucide="calendar-days"></i>

        </span>


        <h3>
          Aucune séance enregistrée
        </h3>


        <p class="muted">
          Tes séances terminées apparaîtront ici.
        </p>

      </div>

    `;


    refreshIcons();

    return;
  }


  $("history").innerHTML =
    sessionList
      .map(
        (session) =>
          renderHistorySession(
            session,
            exercisesBySession.get(
              String(
                session.id
              )
            ) || []
          )
      )
      .join("");


  bindHistoryEvents();

  refreshIcons();
}


/* ============================================================
   SÉANCE HISTORIQUE
   ============================================================ */

function renderHistorySession(
  session,
  exercises
) {

  const isCompleted =
    Boolean(
      session.ended_at
    );


  const totalReps =
    exercises.reduce(
      (
        total,
        exercise
      ) =>
        total +
        Number(
          exercise.reps_completed ||
          0
        ),
      0
    );


  const date =
    new Date(
      session.started_at
    );


  const dateText =
    date.toLocaleDateString(
      "fr-FR",
      {
        day:
          "2-digit",
        month:
          "2-digit",
        year:
          "numeric"
      }
    );


  const timeText =
    date.toLocaleTimeString(
      "fr-FR",
      {
        hour:
          "2-digit",
        minute:
          "2-digit"
      }
    );


  return `

    <article
      class="history-session"
      data-history-session="${escapeAttribute(
        session.id
      )}"
    >


      <button
        type="button"
        class="history-session-summary"
        data-history-toggle="${escapeAttribute(
          session.id
        )}"
        aria-expanded="false"
      >


        <span class="history-session-icon">

          <i data-lucide="${
            isCompleted
              ? "circle-check"
              : "play-circle"
          }"></i>

        </span>


        <span class="history-session-main">

          <strong>
            ${escapeHtml(
              session.workout_name ||
              "Séance"
            )}
          </strong>


          <span>
            ${dateText} · ${timeText}
          </span>

        </span>


        <span class="history-session-meta">

          ${
            isCompleted
              ? `
                <span>

                  <i data-lucide="clock-3"></i>

                  ${formatDuration(
                    Number(
                      session.duration_seconds ||
                      0
                    )
                  )}

                </span>


                <span>

                  <i data-lucide="repeat-2"></i>

                  ${totalReps}

                </span>
              `
              : `
                <span>
                  En cours
                </span>
              `
          }

        </span>


        <span class="history-chevron">

          <i data-lucide="chevron-down"></i>

        </span>


      </button>


      <div
        class="history-session-details"
        data-history-details="${escapeAttribute(
          session.id
        )}"
        hidden
      >

        ${
          isCompleted
            ? renderHistoryDetails(
                session,
                exercises
              )
            : `
              <div class="history-in-progress">

                <i data-lucide="info"></i>

                Cette séance n'est pas encore terminée.

              </div>
            `
        }

      </div>


    </article>

  `;
}


/* ============================================================
   DÉTAIL HISTORIQUE
   ============================================================ */

function renderHistoryDetails(
  session,
  exercises
) {

  const totalReps =
    exercises.reduce(
      (
        total,
        exercise
      ) =>
        total +
        Number(
          exercise.reps_completed ||
          0
        ),
      0
    );


  /*
   * Pour les anciennes données, le nom de l'exercice
   * peut ne pas être présent dans session_exercises.
   *
   * On utilise alors l'exercice correspondant à son index
   * dans le programme actuellement chargé.
   */

  const resolvedExercises =
    exercises.map(
      (
        exercise
      ) => {

        const index =
          Number(
            exercise.exercise_index
          );


        const currentExercise =
          activeWorkoutData?.exercises?.[
            index
          ];


        return {

          ...exercise,

          displayName:
            exercise.exercise_name ||
            currentExercise?.exercise_name ||
            `Exercice ${index + 1}`

        };
      }
    );


  if (
    !resolvedExercises.length
  ) {

    return `

      <div class="history-no-data">

        <i data-lucide="clipboard-x"></i>

        <span>
          Aucun exercice n'a été enregistré
          pour cette séance.
        </span>

      </div>

    `;
  }


  return `

    <div class="history-detail-content">


      <div class="history-detail-header">

        <div>

          <span class="section-kicker">
            RÉCAPITULATIF
          </span>


          <h4>
            Exercices réalisés
          </h4>

        </div>


        <span class="history-total">

          <strong>
            ${totalReps}
          </strong>

          reps

        </span>

      </div>


      <div class="history-exercises">

        ${
          resolvedExercises
            .map(
              (
                exercise,
                index
              ) => `

                <div class="history-exercise">

                  <span class="history-exercise-number">

                    ${String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}

                  </span>


                  <span class="history-exercise-name">

                    ${escapeHtml(
                      exercise.displayName
                    )}

                  </span>


                  <span class="history-exercise-reps">

                    <i data-lucide="repeat-2"></i>

                    <strong>
                      ${Number(
                        exercise.reps_completed ||
                        0
                      )}
                    </strong>

                    reps

                  </span>

                </div>

              `
            )
            .join("")
        }

      </div>


      <div class="history-detail-footer">


        <span>

          <i data-lucide="calendar-check-2"></i>

          Terminée le

          ${formatDateTime(
            session.ended_at
          )}

        </span>


        <span>

          <i data-lucide="timer"></i>

          Durée :

          ${formatDuration(
            Number(
              session.duration_seconds ||
              0
            )
          )}

        </span>


      </div>


    </div>

  `;
}


/* ============================================================
   OUVERTURE HISTORIQUE
   ============================================================ */

function bindHistoryEvents() {

  document
    .querySelectorAll(
      "[data-history-toggle]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset.historyToggle;


            const details =
              document.querySelector(
                `[data-history-details="${CSS.escape(
                  id
                )}"]`
              );


            if (!details) {
              return;
            }


            const open =
              !details.hidden;


            details.hidden =
              open;


            button.setAttribute(
              "aria-expanded",
              String(!open)
            );


            const card =
              button.closest(
                ".history-session"
              );


            if (card) {

              card.classList.toggle(
                "expanded",
                !open
              );
            }


            refreshIcons();
          }
        );
      }
    );
}


/* ============================================================
   UTILITAIRES
   ============================================================ */

function formatDuration(
  seconds
) {

  const total =
    Math.max(
      0,
      Math.floor(
        Number(
          seconds
        ) || 0
      )
    );


  const minutes =
    Math.floor(
      total / 60
    );


  const remaining =
    total % 60;


  if (
    minutes === 0
  ) {

    return `${remaining} sec`;
  }


  if (
    remaining === 0
  ) {

    return `${minutes} min`;
  }


  return `${minutes} min ${remaining} sec`;
}


function formatDateTime(
  value
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";
  }


  return date.toLocaleString(
    "fr-FR",
    {
      day:
        "2-digit",
      month:
        "2-digit",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit"
    }
  );
}


function refreshIcons() {

  if (
    typeof lucide !== "undefined"
  ) {

    lucide.createIcons();

  }
}


function fmt(
  ms
) {

  const totalSeconds =
    Math.floor(
      ms / 1000
    );


  const minutes =
    Math.floor(
      totalSeconds / 60
    );


  const seconds =
    totalSeconds % 60;


  return (
    String(
      minutes
    ).padStart(
      2,
      "0"
    ) +
    ":" +
    String(
      seconds
    ).padStart(
      2,
      "0"
    )
  );
}


function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


function escapeAttribute(
  value
) {

  return escapeHtml(
    value
  );
}


/* ============================================================
   DÉCONNEXION
   ============================================================ */

$("logout").onclick =
  async () => {

    /*
     * Une séance en cours n'est pas terminée.
     * Elle pourra être reprise lors de la prochaine connexion.
     */

    await supabaseClient
      .auth
      .signOut();


    location.href =
      "index.html";
  };


/* ============================================================
   LANCEMENT
   ============================================================ */

init();