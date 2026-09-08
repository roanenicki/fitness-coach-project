/*javascript*/
/*
 * PROGRAMMES D'ENTRAÎNEMENT
 * --------------------------
 * Ce fichier contient les modèles de programmes disponibles.
 *
 * IMPORTANT :
 * - Les jours de la semaine ne déterminent PLUS la séance.
 * - L'athlète peut faire sa séance le jour où elle est disponible.
 * - La progression est gérée par phase/semaine.
 * - Plus tard, Supabase pourra stocker le programme réellement
 *   attribué à chaque athlète et sa progression.
 */

const PROGRAMMES = {
  recomposition_debutante: {
    id: "recomposition_debutante",
    name: "Programme de recomposition corporelle",
    description:
      "Programme maison d'environ 1 heure visant le développement des fessiers, le renforcement de la poitrine et du haut du corps, le gainage et l'amélioration générale de la silhouette.",

    recommendedDays: [
      "Mercredi",
      "Vendredi",
      "Un troisième jour au choix"
    ],

    frequency: 3,

    phases: {
      "1-2": {
        name: "Semaines 1–2 — Apprentissage",
        description:
          "Apprendre les mouvements et privilégier la qualité d'exécution.",

        warmup: [
          {
            name: "Marche rapide sur place",
            duration: 60
          },
          {
            name: "Jumping jacks légers",
            duration: 45
          },
          {
            name: "Cercles de bras",
            duration: 45
          },
          {
            name: "Montées de genoux",
            duration: 60
          },
          {
            name: "Squats sans charge",
            duration: 60
          },
          {
            name: "Fentes arrière très légères",
            duration: 60
          },
          {
            name: "Rotation du bassin",
            duration: 45
          },
          {
            name: "Mobilité épaules / dos",
            duration: 60
          },
          {
            name: "Marche + respiration",
            duration: 60
          }
        ],

        blocks: [
          {
            id: "glutes_legs",
            name: "Fessiers / jambes",
            icon: "🍑",
            exercises: [
              {
                name: "Hip thrust au sol / Glute bridge",
                sets: 4,
                reps: 15,
                rest: 60,
                note: "Pause d'une seconde en haut et contraction forte des fessiers."
              },
              {
                name: "Squats",
                sets: 3,
                reps: "12-15",
                rest: 60,
                note: "Descente contrôlée et remontée dynamique."
              },
              {
                name: "Fentes arrière",
                sets: 3,
                reps: 10,
                repsUnit: "par jambe",
                rest: 60
              },
              {
                name: "Donkey kicks",
                sets: 3,
                reps: "12-15",
                repsUnit: "par jambe",
                rest: 45
              },
              {
                name: "Fire hydrants",
                sets: 3,
                reps: "12-15",
                repsUnit: "par jambe",
                rest: 45,
                note: "Privilégier la qualité de contraction à la vitesse."
              }
            ]
          },

          {
            id: "upper_body",
            name: "Poitrine / haut du corps",
            icon: "🫀",
            exercises: [
              {
                name: "Pompes inclinées",
                sets: 3,
                reps: "10-15",
                rest: 60,
                note: "Utiliser un support très stable."
              },
              {
                name: "Pompes classiques ou sur les genoux",
                sets: 3,
                reps: "6-12",
                rest: 60
              },
              {
                name: "Chest squeeze",
                sets: 3,
                duration: 30,
                durationUnit: "secondes",
                rest: 45,
                note: "Joindre les paumes devant la poitrine et pousser fortement."
              },
              {
                name: "Superman",
                sets: 3,
                reps: "12-15",
                rest: 45
              },
              {
                name: "Shoulder taps",
                sets: 3,
                reps: "8-12",
                repsUnit: "de chaque côté",
                rest: 45
              }
            ]
          },

          {
            id: "core",
            name: "Abdos / taille / gainage",
            icon: "🔥",
            circuit: true,
            rounds: 3,
            restBetweenRounds: 45,
            exercises: [
              {
                name: "Dead bug",
                reps: 10,
                repsUnit: "par côté"
              },
              {
                name: "Reverse crunch",
                reps: "10-12"
              },
              {
                name: "Planche",
                duration: 30,
                durationUnit: "secondes"
              },
              {
                name: "Planche latérale",
                duration: 20,
                durationUnit: "secondes",
                durationUnitExtra: "de chaque côté"
              },
              {
                name: "Mountain climbers lents",
                reps: 10,
                repsUnit: "par côté"
              }
            ]
          },

          {
            id: "cardio",
            name: "Cardio léger",
            icon: "❤️",
            exercises: [
              {
                name: "Jumping jacks",
                duration: 30,
                durationUnit: "secondes",
                recovery: 30
              },
              {
                name: "Montées de genoux",
                duration: 30,
                durationUnit: "secondes",
                recovery: 30
              }
            ]
          }
        ]
      },

      "3-4": {
        name: "Semaines 3–4 — Progression",
        description:
          "Augmenter progressivement les répétitions tout en conservant une bonne technique.",

        basedOn: "1-2",

        adjustments: {
          reps: "Augmentation progressive des répétitions dans les fourchettes prévues.",
          intensity:
            "Réduire légèrement les temps de récupération si la technique reste parfaite."
        }
      },

      "5-8": {
        name: "Semaines 5–8 — Résistance",
        description:
          "Introduire progressivement une résistance externe lorsque la technique est maîtrisée.",

        basedOn: "3-4",

        adjustments: {
          resistance:
            "Ajouter progressivement une résistance, par exemple un sac à dos chargé.",
          priority:
            "Priorité à la surcharge progressive sur hip thrust, squats et fentes."
        }
      }
    }
  }
};


/*
 * ------------------------------------------------------------------
 * FONCTION PRINCIPALE
 * ------------------------------------------------------------------
 *
 * IMPORTANT :
 * Cette fonction ne regarde PAS le jour de la semaine.
 *
 * Elle retourne le programme demandé.
 *
 * Exemple :
 *
 * getWorkout()
 * getWorkout("recomposition_debutante")
 *
 */

function getWorkout(programId = "recomposition_debutante") {
  return PROGRAMMES[programId] || PROGRAMMES.recomposition_debutante;
}


/*
 * ------------------------------------------------------------------
 * OBTENIR LA PHASE DU PROGRAMME
 * ------------------------------------------------------------------
 *
 * weekNumber = numéro de semaine de progression.
 *
 * Exemple :
 *
 * getProgramPhase(1)  → semaines 1-2
 * getProgramPhase(3)  → semaines 3-4
 * getProgramPhase(6)  → semaines 5-8
 *
 */

function getProgramPhase(weekNumber = 1, programId = "recomposition_debutante") {
  const programme = getWorkout(programId);

  if (weekNumber <= 2) {
    return programme.phases["1-2"];
  }

  if (weekNumber <= 4) {
    return programme.phases["3-4"];
  }

  return programme.phases["5-8"];
}


/*
 * ------------------------------------------------------------------
 * OBTENIR LA SÉANCE ACTUELLE D'UNE ATHLÈTE
 * ------------------------------------------------------------------
 *
 * Cette fonction sera utilisée plus tard avec les données
 * provenant de Supabase.
 *
 * Pour le moment :
 * - programId = programme attribué
 * - weekNumber = semaine actuelle
 *
 */

function getAthleteWorkout({
  programId = "recomposition_debutante",
  weekNumber = 1
} = {}) {
  const programme = getWorkout(programId);
  const phase = getProgramPhase(weekNumber, programId);

  return {
    programme,
    phase,
    programId,
    weekNumber
  };
}


/*
 * ------------------------------------------------------------------
 * UTILITAIRE
 * ------------------------------------------------------------------
 *
 * Permet de savoir quels jours sont recommandés sans les imposer.
 *
 */

function getRecommendedDays(programId = "recomposition_debutante") {
  const programme = getWorkout(programId);

  return programme.recommendedDays || [];
}