let currentUser = null;
let athletes = [];
let currentAthlete = null;
let currentAthleteProgram = null;
let currentExercises = [];
let currentPhases = [];


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


  currentUser = data.user;


  const {
    data: profile,
    error: profileError
  } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", currentUser.id)
    .single();


  if (profileError || !profile) {

    console.error(
      "Erreur profil :",
      profileError
    );

    await supabaseClient.auth.signOut();

    location.href = "index.html";

    return;
  }


  if (profile.role !== "coach") {
    location.href = "app.html";
    return;
  }


  const coachName = $("coachName");

  if (coachName) {
    coachName.textContent =
      profile.full_name || currentUser.email;
  }


  await loadAthletes();
}


/* ============================================================
   CHARGEMENT DES ATHLÈTES
   ============================================================ */

async function loadAthletes() {

  $("athletes").innerHTML =
    '<p class="muted">Chargement des athlètes…</p>';


  const {
    data,
    error
  } = await supabaseClient
    .from("coach_athletes")
    .select(`
      coach_id,
      athlete_id,
      created_at,
      profiles!coach_athletes_athlete_id_fkey (
        id,
        full_name,
        email,
        created_at,
        role
      )
    `)
    .eq(
      "coach_id",
      currentUser.id
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    console.error(
      "Erreur chargement athlètes :",
      error
    );


    $("athletes").innerHTML = `
      <p class="message">
        Impossible de charger les athlètes.
        ${escapeHtml(error.message)}
      </p>
    `;

    return;
  }


  athletes = data || [];


  if (!athletes.length) {

    $("athletes").innerHTML = `
      <p class="muted">
        Aucune athlète pour le moment.
        Cliquez sur « Ajouter une athlète ».
      </p>
    `;

    return;
  }


  $("athletes").innerHTML =
    athletes
      .map((item) => {

        const athlete =
          item.profiles;


        return `
          <button
            class="athlete-item"
            data-id="${escapeAttribute(
              item.athlete_id
            )}"
            type="button"
          >

            <b>
              ${escapeHtml(
                athlete?.full_name ||
                "Athlète sans nom"
              )}
            </b>

            <span>
              ${escapeHtml(
                athlete?.email || ""
              )}
            </span>

          </button>
        `;
      })
      .join("");


  document
    .querySelectorAll(".athlete-item")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".athlete-item")
            .forEach(
              (item) =>
                item.classList.remove(
                  "active"
                )
            );


          button.classList.add("active");


          showDetail(
            button.dataset.id
          );
        }
      );
    });
}


/* ============================================================
   DÉTAIL ATHLÈTE
   ============================================================ */

async function showDetail(
  athleteId
) {

  const item =
    athletes.find(
      (athlete) =>
        String(athlete.athlete_id) ===
        String(athleteId)
    );


  if (!item) {
    return;
  }


  currentAthlete =
    item.profiles;


  currentAthleteProgram = null;
  currentExercises = [];
  currentPhases = [];


  $("detailTitle").textContent =
    currentAthlete?.full_name ||
    "Athlète";


  $("detail").innerHTML =
    '<p class="muted">Chargement du programme…</p>';


  await loadAthleteProgram(
    athleteId
  );


  await loadAthleteSessions(
    athleteId
  );
}


/* ============================================================
   PROGRAMME INDIVIDUEL
   ============================================================ */

async function loadAthleteProgram(
  athleteId
) {

  const {
    data,
    error
  } = await supabaseClient
    .from("athlete_programs")
    .select(`
      id,
      athlete_id,
      program_id,
      current_week,
      started_at,
      ended_at,
      active,
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
      athleteId
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


  if (error) {

    console.error(
      "Erreur programme :",
      error
    );


    $("detail").innerHTML = `
      <p class="message">
        Impossible de charger le programme.
        ${escapeHtml(error.message)}
      </p>
    `;

    return;
  }


  currentAthleteProgram =
    data;


  if (!data) {

    $("detail").innerHTML = `
      <p class="muted">
        Aucun programme actif pour cette athlète.
      </p>
    `;

    return;
  }


  await loadProgramPhases(
    data.program_id
  );


  await loadAthleteExercises(
    data.id
  );
}


/* ============================================================
   PHASES DU PROGRAMME
   ============================================================ */

async function loadProgramPhases(
  programId
) {

  const {
    data,
    error
  } = await supabaseClient
    .from("program_phases")
    .select(`
      id,
      program_id,
      name,
      week_start,
      week_end,
      description
    `)
    .eq(
      "program_id",
      programId
    )
    .order(
      "week_start",
      {
        ascending: true
      }
    );


  if (error) {

    console.error(
      "Erreur chargement phases :",
      error
    );


    currentPhases = [];


    showEditorMessage(
      `Impossible de charger les phases : ${error.message}`
    );

    return;
  }


  currentPhases =
    data || [];


  normalizeCurrentWeek();
}


/* ============================================================
   NORMALISATION DE LA SEMAINE
   ============================================================ */

function normalizeCurrentWeek() {

  if (!currentAthleteProgram) {
    return;
  }


  if (!currentPhases.length) {

    currentAthleteProgram.current_week = 1;

    return;
  }


  const minimumWeek =
    Math.min(
      ...currentPhases.map(
        (phase) =>
          Number(phase.week_start)
      )
    );


  const maximumWeek =
    Math.max(
      ...currentPhases.map(
        (phase) =>
          Number(phase.week_end)
      )
    );


  let week =
    Number(
      currentAthleteProgram.current_week
    );


  if (!Number.isFinite(week)) {
    week = minimumWeek;
  }


  week =
    Math.max(
      minimumWeek,
      Math.min(
        maximumWeek,
        week
      )
    );


  currentAthleteProgram.current_week =
    week;
}


/* ============================================================
   EXERCICES INDIVIDUELS
   ============================================================ */

async function loadAthleteExercises(
  athleteProgramId
) {

  const {
    data,
    error
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
      athleteProgramId
    )
    .eq(
      "active",
      true
    )
    .order(
      "phase_id",
      {
        ascending: true
      }
    )
    .order(
      "exercise_order",
      {
        ascending: true
      }
    );


  if (error) {

    console.error(
      "Erreur exercices :",
      error
    );


    $("detail").innerHTML = `
      <p class="message">
        Impossible de charger les exercices.
        ${escapeHtml(error.message)}
      </p>
    `;

    return;
  }


  currentExercises =
    data || [];


  renderProgramEditor();
}


/* ============================================================
   AFFICHAGE DE L'ÉDITEUR
   ============================================================ */

function renderProgramEditor() {

  const program =
    currentAthleteProgram?.programs;


  if (!program) {
    return;
  }


  normalizeCurrentWeek();


  const currentWeek =
    Number(
      currentAthleteProgram.current_week
    ) || 1;


  let html = `

    <section class="program-editor">

      <div class="program-editor-header">

        <div>

          <h3>
            ${escapeHtml(
              program.name
            )}
          </h3>

          <p class="muted">
            ${escapeHtml(
              program.description || ""
            )}
          </p>

        </div>


        <div class="program-meta">

          <span>
            Semaine ${currentWeek}
          </span>

          ${
            program.recommended_frequency
              ? `
                <span>
                  ${program.recommended_frequency}
                  séances / semaine
                </span>
              `
              : ""
          }

        </div>

      </div>


      <div class="program-actions">

        <button
          type="button"
          class="secondary"
          id="previousWeekBtn"
          ${
            !canChangeWeek(-1)
              ? "disabled"
              : ""
          }
        >

          <i data-lucide="chevron-left"></i>

          Semaine précédente

        </button>


        <button
          type="button"
          class="secondary"
          id="nextWeekBtn"
          ${
            !canChangeWeek(1)
              ? "disabled"
              : ""
          }
        >

          Semaine suivante

          <i data-lucide="chevron-right"></i>

        </button>

      </div>


      <div class="phase-list">

  `;


  if (!currentPhases.length) {

    html += `
      <p class="message">
        Aucune phase n'est configurée pour ce programme.
      </p>
    `;

  } else {

    currentPhases.forEach(
      (phase) => {

        const phaseExercises =
          currentExercises.filter(
            (exercise) =>
              Number(
                exercise.phase_id
              ) ===
              Number(phase.id)
          );


        html += renderPhase(
          phase,
          phaseExercises
        );
      }
    );
  }


  html += `

      </div>


      <div
        id="exerciseEditorMessage"
        class="message"
      ></div>


    </section>

  `;


  $("detail").innerHTML =
    html;


  bindProgramEditorEvents();

  refreshIcons();
}


/* ============================================================
   AFFICHAGE D'UNE PHASE
   ============================================================ */

function renderPhase(
  phase,
  exercises
) {

  const blocks =
    groupExercisesByBlock(
      exercises
    );


  let html = `

    <section
      class="program-phase"
      data-phase-id="${phase.id}"
    >

      <div class="phase-header">

        <div>

          <h4>
            ${escapeHtml(
              phase.name
            )}
          </h4>

          <p class="muted">

            Semaines
            ${Number(
              phase.week_start
            )}
            à
            ${Number(
              phase.week_end
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

        </div>


        <button
          type="button"
          class="secondary add-exercise-btn"
          data-phase-id="${phase.id}"
        >

          <i data-lucide="plus"></i>

          Ajouter un exercice

        </button>

      </div>

  `;


  if (!blocks.length) {

    html += `
      <p class="muted">
        Aucun exercice dans cette phase.
      </p>
    `;

  } else {

    blocks.forEach(
      (block) => {

        html += `

          <div
            class="program-block"
            data-block-id="${escapeAttribute(
              block.blockId
            )}"
          >

            <div class="block-header">

              <h5>
                ${escapeHtml(
                  block.blockName
                )}
              </h5>

            </div>


            <div class="editable-exercises">

        `;


        block.exercises.forEach(
          (exercise) => {

            html +=
              renderEditableExercise(
                exercise
              );
          }
        );


        html += `

            </div>

          </div>

        `;
      }
    );
  }


  html += `

    </section>

  `;


  return html;
}


/* ============================================================
   EXERCICE ÉDITABLE
   ============================================================ */

function renderEditableExercise(
  exercise
) {

  return `

    <div
      class="editable-exercise"
      data-exercise-id="${escapeAttribute(
        exercise.id
      )}"
    >


      <div class="exercise-main">

        <input
          class="exercise-name"
          type="text"
          value="${escapeAttribute(
            exercise.exercise_name
          )}"
          placeholder="Nom de l'exercice"
        >


        <input
          class="exercise-order"
          type="number"
          min="0"
          step="1"
          value="${Number(
            exercise.exercise_order || 0
          )}"
          title="Ordre"
        >

      </div>


      <div class="exercise-settings">


        <label>

          Séries

          <input
            class="exercise-sets"
            type="number"
            min="0"
            max="100"
            step="1"
            value="${
              exercise.sets ??
              ""
            }"
          >

        </label>


        <label>

          Répétitions

          <input
            class="exercise-reps"
            type="text"
            value="${escapeAttribute(
              exercise.reps ?? ""
            )}"
            placeholder="ex. 12-15"
          >

        </label>


        <label>

          Durée

          <input
            class="exercise-duration"
            type="number"
            min="0"
            max="3600"
            step="1"
            value="${
              exercise.duration ??
              ""
            }"
          >

        </label>


        <label>

          Unité

          <select
            class="exercise-duration-unit"
          >

            <option
              value=""
              ${
                !exercise.duration_unit
                  ? "selected"
                  : ""
              }
            >
              —
            </option>


            <option
              value="secondes"
              ${
                exercise.duration_unit ===
                "secondes"
                  ? "selected"
                  : ""
              }
            >
              secondes
            </option>


            <option
              value="minutes"
              ${
                exercise.duration_unit ===
                "minutes"
                  ? "selected"
                  : ""
              }
            >
              minutes
            </option>

          </select>

        </label>


        <label>

          Récupération

          <input
            class="exercise-recovery"
            type="number"
            min="0"
            max="3600"
            step="1"
            value="${
              exercise.recovery ??
              ""
            }"
          >

        </label>


      </div>


      <textarea
        class="exercise-note"
        placeholder="Note ou consigne"
      >${escapeHtml(
        exercise.note ?? ""
      )}</textarea>


      <div class="exercise-actions">


        <button
          type="button"
          class="secondary save-exercise-btn"
        >

          <i data-lucide="save"></i>

          Enregistrer

        </button>


        <button
          type="button"
          class="secondary delete-exercise-btn"
        >

          <i data-lucide="trash-2"></i>

          Supprimer

        </button>


      </div>


    </div>

  `;
}


/* ============================================================
   ÉVÉNEMENTS ÉDITEUR
   ============================================================ */

function bindProgramEditorEvents() {


  document
    .querySelectorAll(
      ".save-exercise-btn"
    )
    .forEach(
      (button) => {

        button.onclick =
          () =>
            saveExercise(
              button.closest(
                ".editable-exercise"
              )
            );
      }
    );


  document
    .querySelectorAll(
      ".delete-exercise-btn"
    )
    .forEach(
      (button) => {

        button.onclick =
          () =>
            deleteExercise(
              button.closest(
                ".editable-exercise"
              )
            );
      }
    );


  document
    .querySelectorAll(
      ".add-exercise-btn"
    )
    .forEach(
      (button) => {

        button.onclick =
          () =>
            addExercise(
              button.dataset.phaseId
            );
      }
    );


  const previous =
    $("previousWeekBtn");


  if (previous) {

    previous.onclick =
      () =>
        changeWeek(-1);
  }


  const next =
    $("nextWeekBtn");


  if (next) {

    next.onclick =
      () =>
        changeWeek(1);
  }
}


/* ============================================================
   SAUVEGARDER UN EXERCICE
   ============================================================ */

async function saveExercise(
  element
) {

  if (!element) {
    return;
  }


  const id =
    element.dataset.exerciseId;


  const name =
    element
      .querySelector(
        ".exercise-name"
      )
      .value
      .trim();


  if (!name) {

    showEditorMessage(
      "Le nom de l'exercice est obligatoire."
    );

    return;
  }


  const sets =
    parseNullableInteger(
      element.querySelector(
        ".exercise-sets"
      ).value
    );


  const duration =
    parseNullableInteger(
      element.querySelector(
        ".exercise-duration"
      ).value
    );


  const recovery =
    parseNullableInteger(
      element.querySelector(
        ".exercise-recovery"
      ).value
    );


  const exerciseOrder =
    parseNullableInteger(
      element.querySelector(
        ".exercise-order"
      ).value
    ) ?? 0;


  const reps =
    element
      .querySelector(
        ".exercise-reps"
      )
      .value
      .trim();


  const durationUnit =
    element
      .querySelector(
        ".exercise-duration-unit"
      )
      .value ||
    null;


  const note =
    element
      .querySelector(
        ".exercise-note"
      )
      .value
      .trim() ||
    null;


  const {
    error
  } = await supabaseClient
    .from(
      "athlete_program_exercises"
    )
    .update({

      exercise_name:
        name,

      sets,

      reps:
        reps || null,

      duration,

      duration_unit:
        durationUnit,

      recovery,

      note,

      exercise_order:
        exerciseOrder

    })
    .eq(
      "id",
      id
    )
    .eq(
      "athlete_program_id",
      currentAthleteProgram.id
    );


  if (error) {

    console.error(
      "Erreur sauvegarde exercice :",
      error
    );


    showEditorMessage(
      `Impossible d'enregistrer : ${error.message}`
    );

    return;
  }


  showEditorMessage(
    "Exercice enregistré."
  );


  await loadAthleteExercises(
    currentAthleteProgram.id
  );
}


/* ============================================================
   SUPPRIMER UN EXERCICE
   ============================================================ */

async function deleteExercise(
  element
) {

  if (!element) {
    return;
  }


  const id =
    element.dataset.exerciseId;


  const name =
    element
      .querySelector(
        ".exercise-name"
      )
      .value
      .trim();


  const confirmed =
    confirm(
      `Supprimer « ${name} » du programme de cette athlète ?`
    );


  if (!confirmed) {
    return;
  }


  const {
    error
  } = await supabaseClient
    .from(
      "athlete_program_exercises"
    )
    .update({
      active: false
    })
    .eq(
      "id",
      id
    )
    .eq(
      "athlete_program_id",
      currentAthleteProgram.id
    );


  if (error) {

    console.error(
      "Erreur suppression exercice :",
      error
    );


    showEditorMessage(
      `Impossible de supprimer : ${error.message}`
    );

    return;
  }


  showEditorMessage(
    "Exercice supprimé."
  );


  await loadAthleteExercises(
    currentAthleteProgram.id
  );
}


/* ============================================================
   AJOUTER UN EXERCICE
   ============================================================ */

async function addExercise(
  phaseId
) {

  if (!currentAthleteProgram) {
    return;
  }


  const phase =
    currentPhases.find(
      (item) =>
        Number(item.id) ===
        Number(phaseId)
    );


  if (!phase) {

    showEditorMessage(
      "Phase introuvable."
    );

    return;
  }


  const blockName =
    prompt(
      "Nom du bloc :",
      "Nouveau bloc"
    );


  if (!blockName?.trim()) {
    return;
  }


  const exerciseName =
    prompt(
      "Nom de l'exercice :"
    );


  if (!exerciseName?.trim()) {
    return;
  }


  const phaseExercises =
    currentExercises.filter(
      (exercise) =>
        Number(
          exercise.phase_id
        ) ===
        Number(phaseId)
    );


  const maxOrder =
    phaseExercises.reduce(
      (
        max,
        exercise
      ) =>
        Math.max(
          max,
          Number(
            exercise.exercise_order ||
            0
          )
        ),
      0
    );


  const {
    error
  } = await supabaseClient
    .from(
      "athlete_program_exercises"
    )
    .insert({

      athlete_program_id:
        currentAthleteProgram.id,

      phase_id:
        Number(phaseId),

      source_exercise_id:
        null,

      block_id:
        slugify(
          blockName.trim()
        ),

      block_name:
        blockName.trim(),

      block_icon:
        null,

      exercise_order:
        maxOrder + 1,

      exercise_name:
        exerciseName.trim(),

      sets:
        null,

      reps:
        null,

      duration:
        null,

      duration_unit:
        null,

      recovery:
        null,

      note:
        null,

      active:
        true

    });


  if (error) {

    console.error(
      "Erreur ajout exercice :",
      error
    );


    showEditorMessage(
      `Impossible d'ajouter l'exercice : ${error.message}`
    );

    return;
  }


  showEditorMessage(
    "Exercice ajouté."
  );


  await loadAthleteExercises(
    currentAthleteProgram.id
  );
}


/* ============================================================
   NAVIGATION DES SEMAINES
   ============================================================ */

function getMinimumWeek() {

  if (!currentPhases.length) {
    return 1;
  }


  return Math.min(
    ...currentPhases.map(
      (phase) =>
        Number(phase.week_start)
    )
  );
}


function getMaximumWeek() {

  if (!currentPhases.length) {
    return 1;
  }


  return Math.max(
    ...currentPhases.map(
      (phase) =>
        Number(phase.week_end)
    )
  );
}


function canChangeWeek(
  amount
) {

  if (!currentAthleteProgram) {
    return false;
  }


  const current =
    Number(
      currentAthleteProgram.current_week
    ) || getMinimumWeek();


  const target =
    current + amount;


  return (
    target >= getMinimumWeek() &&
    target <= getMaximumWeek()
  );
}


async function changeWeek(
  amount
) {

  if (!currentAthleteProgram) {
    return;
  }


  const current =
    Number(
      currentAthleteProgram.current_week
    ) || getMinimumWeek();


  const next =
    current + amount;


  if (
    next < getMinimumWeek() ||
    next > getMaximumWeek()
  ) {
    return;
  }


  const {
    error
  } = await supabaseClient
    .from("athlete_programs")
    .update({
      current_week:
        next
    })
    .eq(
      "id",
      currentAthleteProgram.id
    )
    .eq(
      "athlete_id",
      currentAthleteProgram.athlete_id
    );


  if (error) {

    console.error(
      "Erreur changement semaine :",
      error
    );


    showEditorMessage(
      `Impossible de changer de semaine : ${error.message}`
    );

    return;
  }


  currentAthleteProgram.current_week =
    next;


  renderProgramEditor();
}


/* ============================================================
   HISTORIQUE DES SÉANCES
   ============================================================ */

async function loadAthleteSessions(
  athleteId
) {

  const {
    data,
    error
  } = await supabaseClient
    .from("workout_sessions")
    .select(`
      id,
      workout_name,
      started_at,
      ended_at,
      duration_seconds
    `)
    .eq(
      "user_id",
      athleteId
    )
    .order(
      "started_at",
      {
        ascending: false
      }
    )
    .limit(50);


  if (error) {

    console.error(
      "Erreur séances :",
      error
    );


    const detail =
      $("detail");


    if (detail) {

      detail.insertAdjacentHTML(
        "beforeend",
        `
          <p class="message">
            Impossible de charger l'historique des séances.
            ${escapeHtml(error.message)}
          </p>
        `
      );
    }


    return;
  }


  const sessions =
    data || [];


  /*
   * Seules les séances terminées entrent
   * dans les statistiques.
   */

  const completedSessions =
    sessions.filter(
      (session) =>
        session.ended_at
    );


  /*
   * Récupérer les exercices enregistrés
   * pour toutes les séances.
   */

  const sessionIds =
    sessions
      .map(
        (session) =>
          session.id
      )
      .filter(Boolean);


  let sessionExercises = [];


  if (sessionIds.length) {

    const {
      data: exerciseData,
      error: exerciseError
    } = await supabaseClient
      .from("session_exercises")
      .select(`
        id,
        session_id,
        exercise_index,
        exercise_name,
        reps_completed
      `)
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


    if (exerciseError) {

      console.error(
        "Erreur exercices des séances :",
        exerciseError
      );

    } else {

      sessionExercises =
        exerciseData || [];
    }
  }


  /*
   * Associer les exercices à leur séance.
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
        .push(exercise);
    }
  );


  const totalSeconds =
    completedSessions.reduce(
      (
        total,
        session
      ) =>
        total +
        Number(
          session.duration_seconds ||
          0
        ),
      0
    );


  const averageSeconds =
    completedSessions.length
      ? Math.round(
          totalSeconds /
          completedSessions.length
        )
      : 0;


  /*
   * Total des répétitions réalisées
   * sur les séances terminées.
   */

  const totalReps =
    completedSessions.reduce(
      (
        total,
        session
      ) => {

        const exercises =
          exercisesBySession.get(
            String(session.id)
          ) || [];


        return total +
          exercises.reduce(
            (
              exerciseTotal,
              exercise
            ) =>
              exerciseTotal +
              Number(
                exercise.reps_completed ||
                0
              ),
            0
          );
      },
      0
    );


  const existing =
    $("detail");


  if (!existing) {
    return;
  }


  existing.insertAdjacentHTML(
    "beforeend",
    `

      <section class="athlete-history">

        <div class="history-heading">

          <div>

            <span class="section-kicker">
              PROGRESSION
            </span>

            <h3>
              Mon historique
            </h3>

          </div>

          <span class="section-icon orange">

            <i data-lucide="history"></i>

          </span>

        </div>


        <div class="stats">


          <div>

            <b>
              ${completedSessions.length}
            </b>

            <span>
              séances
            </span>

          </div>


          <div>

            <b>
              ${Math.round(
                totalSeconds / 60
              )}
            </b>

            <span>
              minutes
            </span>

          </div>


          <div>

            <b>
              ${formatMinutes(
                averageSeconds
              )}
            </b>

            <span>
              durée moyenne
            </span>

          </div>


          <div>

            <b>
              ${totalReps}
            </b>

            <span>
              répétitions
            </span>

          </div>


        </div>


        <div class="session-history">

          ${
            sessions.length
              ? sessions
                  .map(
                    (session) =>
                      renderSession(
                        session,
                        exercisesBySession.get(
                          String(session.id)
                        ) || []
                      )
                  )
                  .join("")
              : `
                  <div class="empty-state">

                    <div class="empty-state-icon">

                      <i data-lucide="calendar-x"></i>

                    </div>

                    <h3>
                      Aucune séance
                    </h3>

                    <p class="muted">
                      Cette athlète n'a encore réalisé
                      aucune séance.
                    </p>

                  </div>
                `
          }

        </div>


      </section>

    `
  );


  bindSessionHistoryEvents();

  refreshIcons();
}


/* ============================================================
   RENDU D'UNE SÉANCE
   ============================================================ */

function renderSession(
  session,
  exercises
) {

  const started =
    new Date(
      session.started_at
    );


  const isCompleted =
    Boolean(
      session.ended_at
    );


  const durationSeconds =
    Number(
      session.duration_seconds ||
      0
    );


  const duration =
    isCompleted
      ? formatDuration(
          durationSeconds
        )
      : "Séance en cours";


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


  const sessionDate =
    started.toLocaleDateString(
      "fr-FR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }
    );


  const sessionTime =
    started.toLocaleTimeString(
      "fr-FR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );


  return `

    <article
      class="session-card"
      data-session-card="${escapeAttribute(
        session.id
      )}"
    >


      <button
        type="button"
        class="session-summary"
        data-session-toggle="${escapeAttribute(
          session.id
        )}"
        aria-expanded="false"
      >

        <span class="session-icon">

          <i data-lucide="${
            isCompleted
              ? "circle-check"
              : "play-circle"
          }"></i>

        </span>


        <span class="session-summary-main">

          <strong>

            ${escapeHtml(
              session.workout_name ||
              "Séance"
            )}

          </strong>


          <span>

            ${sessionDate}
            ·
            ${sessionTime}

          </span>

        </span>


        <span class="session-summary-stats">

          <span>

            <i data-lucide="clock-3"></i>

            ${duration}

          </span>


          <span>

            <i data-lucide="repeat-2"></i>

            ${totalReps} reps

          </span>

        </span>


        <span class="session-chevron">

          <i data-lucide="chevron-down"></i>

        </span>

      </button>



      <div
        class="session-details"
        data-session-details="${escapeAttribute(
          session.id
        )}"
        hidden
      >

        ${
          isCompleted
            ? renderSessionDetails(
                session,
                exercises
              )
            : `
              <div class="session-in-progress">

                <i data-lucide="info"></i>

                <span>
                  Cette séance n'est pas encore terminée.
                </span>

              </div>
            `
        }

      </div>


    </article>

  `;
}


/* ============================================================
   DÉTAIL D'UNE SÉANCE
   ============================================================ */

function renderSessionDetails(
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


  if (!exercises.length) {

    return `

      <div class="session-no-data">

        <i data-lucide="clipboard-x"></i>

        <p>
          Aucun exercice n'a été enregistré
          pour cette séance.
        </p>

      </div>

    `;
  }


  return `

    <div class="session-detail-content">


      <div class="session-detail-header">

        <div>

          <span class="section-kicker">
            RÉCAPITULATIF
          </span>

          <h4>
            Exercices réalisés
          </h4>

        </div>


        <div class="session-total">

          <strong>
            ${totalReps}
          </strong>

          <span>
            répétitions
          </span>

        </div>

      </div>


      <div class="session-exercises">

        ${exercises
          .map(
            (exercise, index) => {

              const reps =
                Number(
                  exercise.reps_completed ||
                  0
                );


              return `

                <div
                  class="session-exercise-row"
                >

                  <span
                    class="session-exercise-number"
                  >
                    ${index + 1}
                  </span>


                  <span
                    class="session-exercise-name"
                  >

                    ${escapeHtml(
                      exercise.exercise_name ||
                      "Exercice"
                    )}

                  </span>


                  <span
                    class="session-exercise-reps"
                  >

                    <i data-lucide="repeat-2"></i>

                    <strong>
                      ${reps}
                    </strong>

                    <span>
                      reps
                    </span>

                  </span>

                </div>

              `;
            }
          )
          .join("")}

      </div>


      <div class="session-detail-footer">


        <span>

          <i data-lucide="calendar-check-2"></i>

          Séance terminée le

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
   OUVERTURE / FERMETURE DES SÉANCES
   ============================================================ */

function bindSessionHistoryEvents() {

  document
    .querySelectorAll(
      "[data-session-toggle]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const sessionId =
              button.dataset.sessionToggle;


            const details =
              document.querySelector(
                `[data-session-details="${CSS.escape(
                  sessionId
                )}"]`
              );


            if (!details) {
              return;
            }


            const isOpen =
              !details.hidden;


            details.hidden =
              isOpen;


            button.setAttribute(
              "aria-expanded",
              String(!isOpen)
            );


            const card =
              button.closest(
                ".session-card"
              );


            if (card) {

              card.classList.toggle(
                "expanded",
                !isOpen
              );
            }


            refreshIcons();
          }
        );
      }
    );
}


/* ============================================================
   GROUPES
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


      if (!map.has(blockId)) {

        map.set(
          blockId,
          {
            blockId,

            blockName:
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
        .push(exercise);
    }
  );


  return [...map.values()];
}


/* ============================================================
   UTILITAIRES
   ============================================================ */

function parseNullableInteger(
  value
) {

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }


  const number =
    Number(value);


  if (
    !Number.isFinite(number)
  ) {
    return null;
  }


  return Math.max(
    0,
    Math.floor(number)
  );
}


function slugify(
  value
) {

  return String(value)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    ) ||
    "nouveau_bloc";
}


function showEditorMessage(
  message
) {

  const element =
    $("exerciseEditorMessage");


  if (!element) {
    return;
  }


  element.textContent =
    message;
}


function formatMinutes(
  seconds
) {

  if (!seconds) {
    return "0 min";
  }


  return `${Math.round(
    seconds / 60
  )} min`;
}


function formatDuration(
  seconds
) {

  const total =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );


  const minutes =
    Math.floor(
      total / 60
    );


  const remainingSeconds =
    total % 60;


  if (minutes === 0) {

    return `${remainingSeconds} sec`;

  }


  if (remainingSeconds === 0) {

    return `${minutes} min`;

  }


  return `${minutes} min ${remainingSeconds} sec`;
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
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
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

  return escapeHtml(value);
}


/* ============================================================
   AJOUT ATHLÈTE
   ============================================================ */

$("addBtn").onclick = () => {

  $("message").textContent =
    "";

  $("athleteForm").reset();

  $("modal").classList.remove(
    "hidden"
  );

  $("name").focus();
};


$("closeModal").onclick = () => {

  $("modal").classList.add(
    "hidden"
  );
};


$("modal").addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      $("modal")
    ) {

      $("modal").classList.add(
        "hidden"
      );
    }
  }
);


/* ============================================================
   CRÉATION ATHLÈTE
   ============================================================ */

$("athleteForm").onsubmit =
  async (event) => {

    event.preventDefault();


    const button =
      event.submitter;


    const fullName =
      $("name").value.trim();


    const email =
      $("athleteEmail")
        .value
        .trim();


    const password =
      $("athletePassword")
        .value;


    if (!fullName) {

      $("message").textContent =
        "Veuillez renseigner le nom complet.";

      return;
    }


    if (!email) {

      $("message").textContent =
        "Veuillez renseigner l'adresse email.";

      return;
    }


    if (
      password.length < 8
    ) {

      $("message").textContent =
        "Le mot de passe doit contenir au moins 8 caractères.";

      return;
    }


    button.disabled =
      true;


    $("message").textContent =
      "Création du compte…";


    try {

      const {
        data: sessionData,
        error: sessionError
      } =
        await supabaseClient
          .auth
          .getSession();


      if (
        sessionError ||
        !sessionData.session
      ) {

        throw new Error(
          "Votre session a expiré. Veuillez vous reconnecter."
        );
      }


      const response =
        await fetch(
          `${SUPABASE_URL}/functions/v1/create-athlete`,
          {

            method:
              "POST",

            headers: {

              Authorization:
                `Bearer ${sessionData.session.access_token}`,

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                full_name:
                  fullName,

                email,

                password

              })

          }
        );


      const result =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Impossible de créer l'athlète."
        );
      }


      $("message").textContent =
        "Athlète créée avec succès.";


      $("athleteForm").reset();


      setTimeout(
        () => {

          $("modal")
            .classList
            .add("hidden");

          $("message")
            .textContent = "";

        },
        800
      );


      await loadAthletes();

    } catch (
      error
    ) {

      console.error(
        "Erreur création athlète :",
        error
      );


      $("message").textContent =
        error.message ||
        "Erreur lors de la création.";

    } finally {

      button.disabled =
        false;
    }
  };


/* ============================================================
   DÉCONNEXION
   ============================================================ */

$("logout").onclick =
  async () => {

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