import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ---------------------------------------------------------
    // 1. Vérifier la session du coach
    // ---------------------------------------------------------
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise.' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const caller = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const {
      data: { user: coach },
      error: userError,
    } = await caller.auth.getUser()

    if (userError || !coach) {
      return new Response(
        JSON.stringify({ error: 'Session invalide.' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // ---------------------------------------------------------
    // 2. Vérifier que l'utilisateur est bien un coach
    // ---------------------------------------------------------
    const { data: coachProfile, error: coachProfileError } =
      await caller
        .from('profiles')
        .select('role')
        .eq('id', coach.id)
        .single()

    if (
      coachProfileError ||
      coachProfile?.role !== 'coach'
    ) {
      return new Response(
        JSON.stringify({ error: 'Accès réservé au coach.' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // ---------------------------------------------------------
    // 3. Lire les données envoyées par le dashboard
    // ---------------------------------------------------------
    const body = await req.json()

    const full_name = String(body.full_name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!full_name || !email || password.length < 8) {
      return new Response(
        JSON.stringify({
          error:
            'Nom, email et mot de passe (8 caractères minimum) requis.',
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // ---------------------------------------------------------
    // 4. Programme initial
    // ---------------------------------------------------------
    const requestedProgramCode =
      String(
        body.program_code ||
          'recomposition_debutante'
      ).trim()

    const requestedWeek =
      Number(body.current_week || 1)

    const currentWeek =
      Number.isFinite(requestedWeek) &&
      requestedWeek >= 1
        ? Math.floor(requestedWeek)
        : 1

    // ---------------------------------------------------------
    // 5. Client admin
    // ---------------------------------------------------------
    const admin = createClient(
      supabaseUrl,
      serviceRoleKey
    )

    // ---------------------------------------------------------
    // 6. Vérifier que le programme existe et est actif
    // ---------------------------------------------------------
    const {
      data: program,
      error: programError,
    } = await admin
      .from('programs')
      .select(
        'id, code, name, active'
      )
      .eq(
        'code',
        requestedProgramCode
      )
      .eq(
        'active',
        true
      )
      .single()

    if (
      programError ||
      !program
    ) {
      return new Response(
        JSON.stringify({
          error:
            `Programme introuvable ou inactif : ${requestedProgramCode}`,
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    // ---------------------------------------------------------
    // 7. Vérifier que la semaine demandée correspond à une phase
    // ---------------------------------------------------------
    const {
      data: phase,
      error: phaseError,
    } = await admin
      .from('program_phases')
      .select(
        'id, name, week_start, week_end'
      )
      .eq(
        'program_id',
        program.id
      )
      .lte(
        'week_start',
        currentWeek
      )
      .gte(
        'week_end',
        currentWeek
      )
      .maybeSingle()

    if (
      phaseError ||
      !phase
    ) {
      return new Response(
        JSON.stringify({
          error:
            `Aucune phase du programme ne correspond à la semaine ${currentWeek}.`,
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    // ---------------------------------------------------------
    // 8. Récupérer tous les exercices du programme
    //
    // IMPORTANT :
    // On récupère toutes les phases afin que le programme
    // individuel conserve toute sa progression.
    // ---------------------------------------------------------
    const {
      data: templateExercises,
      error: exercisesError,
    } = await admin
      .from('program_exercises')
      .select(`
        id,
        phase_id,
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
        note
      `)
      .in(
        'phase_id',
        await getPhaseIds(
          admin,
          program.id
        )
      )
      .order(
        'phase_id',
        { ascending: true }
      )
      .order(
        'exercise_order',
        { ascending: true }
      )

    if (
      exercisesError
    ) {
      return new Response(
        JSON.stringify({
          error:
            `Impossible de récupérer les exercices du programme : ${exercisesError.message}`,
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    // ---------------------------------------------------------
    // 9. Créer le compte Auth de l'athlète
    // ---------------------------------------------------------
    const {
      data: createdUser,
      error: createUserError,
    } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      })

    if (
      createUserError ||
      !createdUser.user
    ) {
      return new Response(
        JSON.stringify({
          error:
            createUserError?.message ||
            'Impossible de créer le compte athlète.',
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    const athlete =
      createdUser.user

    // ---------------------------------------------------------
    // 10. Créer le profil
    // ---------------------------------------------------------
    const {
      error: profileError,
    } =
      await admin
        .from('profiles')
        .insert({
          id: athlete.id,
          full_name,
          email,
          role: 'athlete',
        })

    if (
      profileError
    ) {
      await admin.auth.admin.deleteUser(
        athlete.id
      )

      return new Response(
        JSON.stringify({
          error:
            profileError.message,
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    // ---------------------------------------------------------
    // 11. Associer l'athlète au coach
    // ---------------------------------------------------------
    const {
      error: coachAthleteError,
    } =
      await admin
        .from('coach_athletes')
        .insert({
          coach_id: coach.id,
          athlete_id: athlete.id,
        })

    if (
      coachAthleteError
    ) {
      await admin
        .from('profiles')
        .delete()
        .eq(
          'id',
          athlete.id
        )

      await admin.auth.admin.deleteUser(
        athlete.id
      )

      return new Response(
        JSON.stringify({
          error:
            coachAthleteError.message,
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    // ---------------------------------------------------------
    // 12. Affecter le programme à l'athlète
    // ---------------------------------------------------------
    const {
      data: athleteProgram,
      error: athleteProgramError,
    } =
      await admin
        .from('athlete_programs')
        .insert({
          athlete_id:
            athlete.id,

          program_id:
            program.id,

          current_week:
            currentWeek,

          active: true,
        })
        .select(
          'id'
        )
        .single()

    if (
      athleteProgramError ||
      !athleteProgram
    ) {
      await cleanupAthlete(
        admin,
        coach.id,
        athlete.id
      )

      return new Response(
        JSON.stringify({
          error:
            athleteProgramError?.message ||
            'Impossible d’affecter le programme.',
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    // ---------------------------------------------------------
    // 13. Créer la copie individuelle des exercices
    // ---------------------------------------------------------
    if (
      templateExercises &&
      templateExercises.length > 0
    ) {
      const athleteExercises =
        templateExercises.map(
          (exercise) => ({
            athlete_program_id:
              athleteProgram.id,

            phase_id:
              exercise.phase_id,

            source_exercise_id:
              exercise.id,

            block_id:
              exercise.block_id,

            block_name:
              exercise.block_name,

            block_icon:
              exercise.block_icon,

            exercise_order:
              exercise.exercise_order,

            exercise_name:
              exercise.exercise_name,

            sets:
              exercise.sets,

            reps:
              exercise.reps,

            duration:
              exercise.duration,

            duration_unit:
              exercise.duration_unit,

            recovery:
              exercise.recovery,

            note:
              exercise.note,

            active: true,
          })
        )

      const {
        error: athleteExercisesError,
      } =
        await admin
          .from(
            'athlete_program_exercises'
          )
          .insert(
            athleteExercises
          )

      if (
        athleteExercisesError
      ) {
        await cleanupAthlete(
          admin,
          coach.id,
          athlete.id
        )

        return new Response(
          JSON.stringify({
            error:
              `Impossible de créer le programme individuel : ${athleteExercisesError.message}`,
          }),
          {
            status: 400,
            headers: corsHeaders,
          }
        )
      }
    }

    // ---------------------------------------------------------
    // 14. Succès
    // ---------------------------------------------------------
    return new Response(
      JSON.stringify({
        ok: true,

        athlete_id:
          athlete.id,

        program: {
          id:
            program.id,

          code:
            program.code,

          name:
            program.name,
        },

        phase: {
          id:
            phase.id,

          name:
            phase.name,

          week_start:
            phase.week_start,

          week_end:
            phase.week_end,
        },

        current_week:
          currentWeek,

        exercises_copied:
          templateExercises?.length || 0,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    )

  } catch (error) {

    console.error(
      'create-athlete error:',
      error
    )

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
})


/* ============================================================
   RÉCUPÉRER LES PHASES DU PROGRAMME
   ============================================================ */

async function getPhaseIds(
  admin: ReturnType<typeof createClient>,
  programId: number
) {
  const {
    data,
    error,
  } =
    await admin
      .from('program_phases')
      .select('id')
      .eq(
        'program_id',
        programId
      )
      .order(
        'week_start',
        { ascending: true }
      )

  if (error) {
    throw new Error(
      `Impossible de récupérer les phases : ${error.message}`
    )
  }

  return (
    data?.map(
      (phase) => phase.id
    ) || []
  )
}


/* ============================================================
   NETTOYAGE COMPLET D'UN ATHLÈTE
   ============================================================ */

async function cleanupAthlete(
  admin: ReturnType<typeof createClient>,
  coachId: string,
  athleteId: string
) {
  await admin
    .from(
      'athlete_program_exercises'
    )
    .delete()
    .eq(
      'athlete_program_id',
      athleteId
    )

  await admin
    .from(
      'athlete_programs'
    )
    .delete()
    .eq(
      'athlete_id',
      athleteId
    )

  await admin
    .from(
      'coach_athletes'
    )
    .delete()
    .eq(
      'coach_id',
      coachId
    )
    .eq(
      'athlete_id',
      athleteId
    )

  await admin
    .from(
      'profiles'
    )
    .delete()
    .eq(
      'id',
      athleteId
    )

  await admin.auth.admin.deleteUser(
    athleteId
  )
}