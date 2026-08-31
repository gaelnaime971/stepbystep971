"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profilCourant } from "@/lib/auth/session";
import { clientServeur } from "@/lib/supabase/server";
import { clientService } from "@/lib/supabase/service";
import { envoyer } from "@/lib/emails/envoyer";
import { coursAnnule } from "@/lib/emails/modeles";
import { enDate, enHeure } from "@/lib/dates";
import { ajouterJours, instantGuadeloupe } from "./dates";
import { messagePlanning } from "./erreurs";
import type { EtatPlanning } from "./etat";
import { COLONNES_COURS_ADMIN, type CoursAdmin } from "./types";

const REPETITIONS = new Map([["1", 1], ["4", 4], ["12", 12]]);

function texte(d: FormData, champ: string): string {
  const v = d.get(champ);
  return typeof v === "string" ? v.trim() : "";
}

async function exigerAdmin(): Promise<void> {
  const profil = await profilCourant();
  if (!profil || profil.role !== "admin") redirect("/connexion?suite=/admin/planning");
}

function retour(chemin: string, message: string, ton: "succes" | "erreur"): never {
  revalidatePath("/admin/planning", "layout");
  redirect(`${chemin}?message=${encodeURIComponent(message)}&ton=${ton}`);
}

// ---------------------------------------------------------------------------
// Creer un cours, seul ou repete
// ---------------------------------------------------------------------------

export async function creerCours(
  _precedent: EtatPlanning,
  donnees: FormData,
): Promise<EtatPlanning> {
  await exigerAdmin();

  const lieuId = texte(donnees, "lieu");
  const date = texte(donnees, "date");
  const debut = texte(donnees, "debut");
  const fin = texte(donnees, "fin");
  const places = Number(texte(donnees, "places"));
  const repetition = texte(donnees, "repetition");

  const valeurs = { lieu: lieuId, date, debut, fin, places: String(places || ""), repetition };
  const echec = (erreur: string, detail?: string) => ({ erreur, detail, valeurs });

  if (!lieuId) return echec("Choisis un lieu.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return echec("Choisis une date.");
  if (!/^\d{2}:\d{2}$/.test(debut) || !/^\d{2}:\d{2}$/.test(fin)) {
    return echec("Renseigne l'heure de début et l'heure de fin.");
  }
  if (fin <= debut) return echec("L'heure de fin doit être après l'heure de début.");
  if (!Number.isInteger(places) || places < 1) {
    return echec("Il faut au moins une place.");
  }

  const nombre = REPETITIONS.get(repetition) ?? 1;

  const occurrences = Array.from({ length: nombre }, (_, i) => {
    const jour = ajouterJours(date, 7 * i);
    return {
      jour,
      starts_at: instantGuadeloupe(jour, debut),
      ends_at: instantGuadeloupe(jour, fin),
    };
  });

  const supabase = await clientServeur();

  // Pre-controle du chevauchement. La contrainte courses_no_overlap reste le
  // juge, mais elle ne sait pas dire QUELLE date pose probleme dans une
  // repetition de douze semaines — et c'est exactement ce qu'Oriane a besoin
  // de savoir pour corriger.
  const { data: existants } = await supabase
    .from("courses")
    .select(COLONNES_COURS_ADMIN)
    .eq("status", "scheduled")
    .gte("starts_at", occurrences[0].starts_at)
    .lte("starts_at", instantGuadeloupe(ajouterJours(occurrences.at(-1)!.jour, 1), "00:00"))
    .returns<CoursAdmin[]>();

  const conflits = occurrences.filter((o) =>
    (existants ?? []).some((e) => e.starts_at < o.ends_at && e.ends_at > o.starts_at),
  );

  if (conflits.length > 0) {
    const dates = conflits.map((c) => enDate(c.starts_at)).join(", ");
    return echec(
      conflits.length === 1
        ? `Tu as déjà un cours le ${dates} à cette heure-là.`
        : `Tu as déjà un cours à cette heure-là sur ${conflits.length} de ces dates : ${dates}.`,
      nombre > 1
        ? "Rien n'a été créé. Décale l'horaire, ou crée les séances une par une en sautant les dates occupées."
        : "Tu ne peux pas être à deux endroits en même temps.",
    );
  }

  const groupe = nombre > 1 ? randomUUID() : null;
  const profil = await profilCourant();

  // Un seul INSERT pour toutes les occurrences : la contrainte d'exclusion
  // s'applique a l'ensemble, donc ou les douze seances existent, ou aucune.
  const { error } = await supabase.from("courses").insert(
    occurrences.map((o) => ({
      location_id: lieuId,
      starts_at: o.starts_at,
      ends_at: o.ends_at,
      capacity: places,
      recurrence_group_id: groupe,
      created_by: profil?.id ?? null,
    })),
  );

  if (error) return echec(messagePlanning(error));

  retour(
    "/admin/planning",
    nombre === 1
      ? `Cours créé le ${enDate(occurrences[0].starts_at)} à ${enHeure(occurrences[0].starts_at)}.`
      : `${nombre} cours créés, du ${enDate(occurrences[0].starts_at)} au ${enDate(occurrences.at(-1)!.starts_at)}.`,
    "succes",
  );
}

// ---------------------------------------------------------------------------
// Modifier un cours
// ---------------------------------------------------------------------------

export async function modifierCours(
  _precedent: EtatPlanning,
  donnees: FormData,
): Promise<EtatPlanning> {
  await exigerAdmin();

  const id = texte(donnees, "id");
  const lieuId = texte(donnees, "lieu");
  const date = texte(donnees, "date");
  const debut = texte(donnees, "debut");
  const fin = texte(donnees, "fin");
  const places = Number(texte(donnees, "places"));

  const valeurs = { lieu: lieuId, date, debut, fin, places: String(places || "") };
  const echec = (erreur: string, detail?: string) => ({ erreur, detail, valeurs });

  if (!lieuId || !date || !debut || !fin) return echec("Tous les champs sont nécessaires.");
  if (fin <= debut) return echec("L'heure de fin doit être après l'heure de début.");
  if (!Number.isInteger(places) || places < 1) return echec("Il faut au moins une place.");

  const supabase = await clientServeur();
  const { data: cours } = await supabase
    .from("courses").select(COLONNES_COURS_ADMIN).eq("id", id).single<CoursAdmin>();
  if (!cours) return echec("Ce cours n'existe plus. Recharge la page.");

  // On le dit AVANT que la base refuse : le message est le meme, mais il
  // arrive au bon moment.
  if (places < cours.seats_taken) {
    return echec(
      `Ce cours a déjà ${cours.seats_taken} inscrite${cours.seats_taken > 1 ? "s" : ""} : tu ne peux pas descendre en dessous.`,
      "Désinscris quelqu'un d'abord, ou garde le nombre de places actuel.",
    );
  }

  const starts_at = instantGuadeloupe(date, debut);
  const ends_at = instantGuadeloupe(date, fin);

  const { data: chevauchants } = await supabase
    .from("courses")
    .select(COLONNES_COURS_ADMIN)
    .eq("status", "scheduled")
    .neq("id", id)
    .lt("starts_at", ends_at)
    .gt("ends_at", starts_at)
    .returns<CoursAdmin[]>();

  if (chevauchants?.length) {
    return echec(
      "Tu as déjà un cours sur ce créneau.",
      "Tu ne peux pas être à deux endroits en même temps : choisis un autre horaire.",
    );
  }

  const { error } = await supabase
    .from("courses")
    .update({ location_id: lieuId, starts_at, ends_at, capacity: places })
    .eq("id", id);

  if (error) return echec(messagePlanning(error, { inscrites: cours.seats_taken }));

  retour(`/admin/planning/${id}`, "Le cours est à jour.", "succes");
}

// ---------------------------------------------------------------------------
// Annuler un cours — regle 7 : recredit automatique de toutes les inscrites
// ---------------------------------------------------------------------------

export async function annulerCours(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const id = texte(donnees, "id");
  const motif = texte(donnees, "motif");

  const supabase = await clientServeur();
  const { data, error } = await supabase.rpc("cancel_course", {
    p_course_id: id,
    p_reason: motif || null,
  });

  if (error) retour(`/admin/planning/${id}`, messagePlanning(error), "erreur");

  // cancel_course rend une ligne par inscrite touchee, avec le detail du
  // recredit : c'est ce que la route serveur utilisera pour envoyer les emails.
  const lignes = (data ?? []) as { user_id: string; refunded: boolean }[];
  const touchees = lignes.length;
  const recreditees = lignes.filter((l) => l.refunded).length;

  // Regle 7 : recredit ET email. Le recredit est deja fait par le RPC, en
  // transaction. Les emails partent apres, un par inscrite, et un echec
  // d'envoi ne defait rien — il se lit dans email_log.
  const envois = await prevenirDesAnnulations(id, lignes);

  // Le decompte est explicite : une seance non recreditee (lot expire ou
  // ferme entre-temps) doit se voir, pas se deviner.
  const prevenues = envois.filter((e) => e).length;
  const message =
    touchees === 0
      ? "Cours annulé. Personne n'était inscrite."
      : recreditees === touchees
        ? `Cours annulé. ${touchees} inscrite${touchees > 1 ? "s" : ""} recréditée${touchees > 1 ? "s" : ""} et prévenue${touchees > 1 ? "s" : ""} par mail.`
        : `Cours annulé. ${recreditees} recréditée${recreditees > 1 ? "s" : ""} sur ${touchees} — pour les autres, le solde qui avait financé la séance n'est plus valable. Toutes ont reçu un mail.`;

  const alerte =
    prevenues < touchees
      ? ` ${touchees - prevenues} mail${touchees - prevenues > 1 ? "s" : ""} n'${touchees - prevenues > 1 ? "ont" : "a"} pas pu partir : préviens-les toi-même.`
      : "";

  retour(
    "/admin/planning",
    message + alerte,
    touchees === recreditees && !alerte ? "succes" : "erreur",
  );
}

// ---------------------------------------------------------------------------
// Desinscrire une cliente
// ---------------------------------------------------------------------------

export async function desinscrire(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const coursId = texte(donnees, "coursId");
  const bookingId = texte(donnees, "reservationId");

  const supabase = await clientServeur();

  // Le nom est lu en base, jamais recopie depuis un champ cache : un champ
  // cache est une donnee fournie par le navigateur, donc pas une source de
  // verite — et un formulaire de moins a distinguer des autres sur la page.
  const { data: qui } = await supabase
    .from("bookings")
    .select("user_id")
    .eq("id", bookingId)
    .maybeSingle<{ user_id: string }>();

  const { data: profil } = qui
    ? await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", qui.user_id)
        .maybeSingle<{ first_name: string; last_name: string }>()
    : { data: null };

  const { error } = await supabase.rpc("admin_unbook", {
    p_booking_id: bookingId,
    p_refund: true,
    p_note: "Désinscrite par Oriane depuis le planning",
  });

  if (error) retour(`/admin/planning/${coursId}`, messagePlanning(error), "erreur");

  const nom = profil ? `${profil.first_name} ${profil.last_name}` : "La cliente";
  retour(
    `/admin/planning/${coursId}`,
    `${nom} est désinscrite, sa séance lui est rendue.`,
    "succes",
  );
}

// ---------------------------------------------------------------------------
// Les lieux
// ---------------------------------------------------------------------------

export async function creerLieu(
  _precedent: EtatPlanning,
  donnees: FormData,
): Promise<EtatPlanning> {
  await exigerAdmin();

  const nom = texte(donnees, "nom");
  const adresse = texte(donnees, "adresse");
  const ville = texte(donnees, "ville");
  const valeurs = { nom, adresse, ville };

  if (!nom) return { erreur: "Donne un nom au lieu.", valeurs };

  const supabase = await clientServeur();
  const { error } = await supabase.from("locations").insert({
    name: nom, address: adresse || null, city: ville || null,
  });

  if (error) {
    return {
      erreur: messagePlanning(error),
      detail: error.code === "23505" ? "Choisis un autre nom, ou réactive le lieu existant." : undefined,
      valeurs,
    };
  }

  retour("/admin/lieux", `« ${nom} » est ajouté.`, "succes");
}

export async function basculerLieu(donnees: FormData): Promise<void> {
  await exigerAdmin();
  const id = texte(donnees, "id");

  const supabase = await clientServeur();

  // L'etat vise est deduit de l'etat courant lu en base, et non d'un champ
  // cache. Le formulaire ne transmet plus que l'identifiant : il ne peut plus
  // etre confondu avec un autre, ni porter une valeur qu'il n'a pas le droit
  // de decider.
  const { data: lieu } = await supabase
    .from("locations")
    .select("name, is_active")
    .eq("id", id)
    .maybeSingle<{ name: string; is_active: boolean }>();

  if (!lieu) retour("/admin/lieux", "Ce lieu n'existe plus. Recharge la page.", "erreur");

  const actif = !lieu.is_active;
  const nom = lieu.name;

  const { error } = await supabase.from("locations").update({ is_active: actif }).eq("id", id);

  if (error) retour("/admin/lieux", messagePlanning(error), "erreur");
  retour(
    "/admin/lieux",
    actif
      ? `« ${nom} » est de nouveau utilisable.`
      : `« ${nom} » est fermé. Les cours déjà programmés là-bas ne bougent pas.`,
    "succes",
  );
}

/**
 * Previent chaque inscrite qu'un cours est annule.
 *
 * Rend un booleen par inscrite : l'admin doit savoir si un mail n'est pas
 * parti, pour prevenir a la main. Un cours annule dont l'inscrite n'apprend
 * rien est le pire cas possible.
 */
async function prevenirDesAnnulations(
  coursId: string,
  lignes: { user_id: string; refunded: boolean }[],
): Promise<boolean[]> {
  if (lignes.length === 0) return [];

  const base = clientService();
  const { data: cours } = await base
    .from("courses")
    .select("starts_at, location_id, cancellation_reason")
    .eq("id", coursId)
    .maybeSingle<{ starts_at: string; location_id: string; cancellation_reason: string | null }>();
  if (!cours) return lignes.map(() => false);

  const { data: lieu } = await base
    .from("locations").select("name").eq("id", cours.location_id)
    .maybeSingle<{ name: string }>();

  const { data: profils } = await base
    .from("profiles").select("id, email, first_name")
    .in("id", lignes.map((l) => l.user_id))
    .returns<{ id: string; email: string; first_name: string }[]>();

  const parId = new Map((profils ?? []).map((p) => [p.id, p]));

  return Promise.all(
    lignes.map(async (l) => {
      const p = parId.get(l.user_id);
      if (!p) return false;
      const { objet, contenu } = coursAnnule({
        prenom: p.first_name,
        debut: cours.starts_at,
        lieu: lieu?.name ?? "le lieu habituel",
        motif: cours.cancellation_reason,
        recreditee: l.refunded,
      });
      const r = await envoyer({
        modele: "course_canceled",
        userId: l.user_id,
        destinataire: p.email,
        objet,
        contenu,
        liens: { course_id: coursId },
      });
      return r.etat === "envoye" || r.etat === "deja_envoye";
    }),
  );
}
