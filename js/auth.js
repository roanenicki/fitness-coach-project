const form = document.getElementById("loginForm");
const msg = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    msg.textContent = "Veuillez renseigner votre email et votre mot de passe.";
    return;
  }

  msg.textContent = "Connexion…";

  /*
   * Connexion Supabase Auth
   */
  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    console.error("Erreur de connexion :", error);
    msg.textContent = "Email ou mot de passe incorrect.";
    return;
  }

  /*
   * Récupération du rôle de l'utilisateur.
   */
  const { data: profile, error: profileError } =
    await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

  if (profileError) {
    console.error(
      "Impossible de récupérer le profil :",
      profileError
    );

    /*
     * On déconnecte l'utilisateur si son profil
     * applicatif n'existe pas.
     */
    await supabaseClient.auth.signOut();

    msg.textContent =
      "Votre compte existe mais votre profil n'est pas correctement configuré.";

    return;
  }

  /*
   * Redirection selon le rôle.
   */
  if (profile?.role === "coach") {
    location.href = "coach.html";
    return;
  }

  if (profile?.role === "athlete") {
    location.href = "app.html";
    return;
  }

  /*
   * Rôle inconnu.
   */
  await supabaseClient.auth.signOut();

  msg.textContent =
    "Rôle utilisateur non reconnu. Contactez votre coach.";
});