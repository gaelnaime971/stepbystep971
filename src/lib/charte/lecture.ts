import { clientServeur } from "@/lib/supabase/server";
import { VERSION_CHARTE } from "./texte";

export type EtatCharte = {
  /** Elle a signe LA VERSION EN COURS. */
  signee: boolean;
  /** La version signee, meme si ce n'est plus celle en cours. */
  version: string | null;
  /** La date de la SIGNATURE, pas celle du dernier changement d'avis. */
  signeeLe: string | null;
  /** Le choix en vigueur : la ligne la plus recente, quelle que soit son origine. */
  autorisationImage: boolean | null;
  /** Quand ce choix a ete exprime pour la derniere fois. */
  imageDecideeLe: string | null;
};

const VIDE: EtatCharte = {
  signee: false, version: null, signeeLe: null,
  autorisationImage: null, imageDecideeLe: null,
};

type Ligne = {
  version: string;
  accepted_at: string;
  autorisation_image: boolean;
  origine: string;
};

/**
 * Ou en est une cliente.
 *
 * Deux lectures dans la meme liste, et c'est tout l'interet de la colonne
 * `origine` : la SIGNATURE est la ligne « acceptation » de la version en cours,
 * le CHOIX D'IMAGE est la ligne la plus recente tout court. Confondre les deux
 * ferait afficher la date du dernier changement d'avis comme date de signature.
 */
export async function etatCharte(userId: string): Promise<EtatCharte> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("charte_acceptations")
    .select("version, accepted_at, autorisation_image, origine")
    .eq("user_id", userId)
    .order("accepted_at", { ascending: false })
    .returns<Ligne[]>();

  const lignes = data ?? [];
  if (lignes.length === 0) return VIDE;

  const derniere = lignes[0];
  const signature =
    lignes.find((l) => l.origine === "acceptation" && l.version === VERSION_CHARTE) ??
    [...lignes].reverse().find((l) => l.origine === "acceptation") ??
    null;

  return {
    signee: !!signature && signature.version === VERSION_CHARTE,
    version: signature?.version ?? null,
    signeeLe: signature?.accepted_at ?? null,
    autorisationImage: derniere.autorisation_image,
    imageDecideeLe: derniere.accepted_at,
  };
}

/**
 * L'etat de toutes les clientes, pour l'admin.
 *
 * Une requete, pas une par cliente : la liste en compte deja deux cents.
 */
export async function etatCharteDeTous(): Promise<Map<string, EtatCharte>> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from("charte_acceptations")
    .select("user_id, version, accepted_at, autorisation_image, origine")
    .order("accepted_at", { ascending: false })
    .returns<(Ligne & { user_id: string })[]>();

  const parCliente = new Map<string, (Ligne & { user_id: string })[]>();
  for (const l of data ?? []) {
    parCliente.set(l.user_id, [...(parCliente.get(l.user_id) ?? []), l]);
  }

  const etats = new Map<string, EtatCharte>();
  for (const [userId, lignes] of parCliente) {
    const derniere = lignes[0];
    const signature =
      lignes.find((l) => l.origine === "acceptation" && l.version === VERSION_CHARTE) ??
      [...lignes].reverse().find((l) => l.origine === "acceptation") ??
      null;
    etats.set(userId, {
      signee: !!signature && signature.version === VERSION_CHARTE,
      version: signature?.version ?? null,
      signeeLe: signature?.accepted_at ?? null,
      autorisationImage: derniere.autorisation_image,
      imageDecideeLe: derniere.accepted_at,
    });
  }
  return etats;
}
