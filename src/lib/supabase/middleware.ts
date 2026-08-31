import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { envSupabase } from "./env";

/** Routes reservees aux personnes connectees. */
const ROUTES_PRIVEES = ["/compte", "/admin", "/mon-espace"];

/** Pages d'authentification : sans objet une fois connectee. */
const ROUTES_AUTH = ["/connexion", "/inscription", "/mot-de-passe-oublie"];

function commencePar(chemin: string, prefixes: string[]) {
  return prefixes.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

/**
 * Rafraichit la session a chaque requete et garde les routes privees.
 *
 * Le controle de ROLE n'est pas ici : il demanderait une requete en base a
 * chaque navigation. Le middleware ne repond qu'a « y a-t-il quelqu'un ? ».
 * « Est-ce Oriane ? » est tranche dans app/admin/layout.tsx.
 */
export async function rafraichirSession(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const { url, cle } = envSupabase();
  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll() {
        return requete.cookies.getAll();
      },
      setAll(cookiesAEcrire) {
        for (const { name, value } of cookiesAEcrire) {
          requete.cookies.set(name, value);
        }
        reponse = NextResponse.next({ request: requete });
        for (const { name, value, options } of cookiesAEcrire) {
          reponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() et non getSession() : getUser valide le jeton aupres de Supabase.
  // getSession se contente de lire un cookie, qui peut avoir ete falsifie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = requete.nextUrl.pathname;

  if (!user && commencePar(chemin, ROUTES_PRIVEES)) {
    const versConnexion = requete.nextUrl.clone();
    versConnexion.pathname = "/connexion";
    versConnexion.search = "";
    // On garde la destination pour y revenir apres la connexion.
    versConnexion.searchParams.set("suite", chemin);
    return NextResponse.redirect(versConnexion);
  }

  if (user && commencePar(chemin, ROUTES_AUTH)) {
    // Vers l'aiguillage et non vers /compte en dur : Oriane doit atterrir sur
    // /admin. Le middleware ignore le role, /mon-espace le lit.
    const versEspace = requete.nextUrl.clone();
    versEspace.pathname = "/mon-espace";
    versEspace.search = "";
    return NextResponse.redirect(versEspace);
  }

  return reponse;
}
