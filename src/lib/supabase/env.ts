/**
 * Lecture des variables d'environnement Supabase.
 *
 * Lue a l'appel et non au chargement du module : sinon `next build` echoue sur
 * une machine sans .env.local, alors que rien n'a besoin de ces valeurs a la
 * compilation.
 */
export function envSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !cle) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont absentes. " +
        "Copie .env.local.example en .env.local et renseigne-les.",
    );
  }

  // Verifie la FORME et pas seulement la presence. Une cle collee dans la
  // variable d'URL est l'erreur la plus facile a commettre — les deux valeurs
  // se copient depuis le meme ecran du tableau de bord — et la plus penible a
  // diagnostiquer : sans ce controle, elle sort en « Invalid supabaseUrl »
  // depuis le middleware, sur toutes les routes a la fois.
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL ne ressemble pas a une URL (recu : « ${url.slice(0, 16)}… »). ` +
        "Attendu : https://<ref-du-projet>.supabase.co, depuis Project Settings > Data API.",
    );
  }
  if (/^https?:\/\//.test(cle)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY contient une URL. Les deux variables sont interverties.",
    );
  }

  return { url, cle };
}
