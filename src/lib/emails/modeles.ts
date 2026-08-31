import { enCreneau, enDate, enDateAnnee, enJourLong, joursLisibles } from "@/lib/dates";
import { prixLisible } from "@/lib/formules/format";
import type { Contenu } from "./rendu";

/**
 * « à Jarry », mais « aux Abymes » et « au Moule ».
 *
 * Les lieux portent leur article dans leur nom, parce que c'est ainsi que les
 * clientes les appellent. Coller « à » devant donne du « à Les Abymes », qui
 * ne se dit pas — et un email qui ecorche le nom du lieu ou l'on va sonne faux.
 */
export function auLieu(nom: string): string {
  if (/^Les\s/i.test(nom)) return `aux ${nom.slice(4)}`;
  if (/^Le\s/i.test(nom)) return `au ${nom.slice(3)}`;
  if (/^La\s/i.test(nom)) return `à la ${nom.slice(3)}`;
  if (/^L'/i.test(nom)) return `à ${nom}`;
  return `à ${nom}`;
}

/**
 * Les cinq messages. Tutoiement, phrases courtes, verbe d'action, aucun point
 * d'exclamation. Chacun rend un objet et un contenu structure — jamais du HTML
 * en dur, pour que la version texte suive toujours.
 */

export function confirmationAchat(a: {
  prenom: string;
  formule: string;
  seances: number;
  expire: string;
  montantCents: number;
  recurrent: boolean;
}): { objet: string; contenu: Contenu } {
  return {
    objet: a.recurrent
      ? `Ton abonnement est rechargé — ${a.seances} séances`
      : `C'est bon, tu as ${a.seances} séance${a.seances > 1 ? "s" : ""}`,
    contenu: {
      titre: a.recurrent ? "Ton solde est rechargé" : "Merci, c'est enregistré",
      paragraphes: [
        `Salut ${a.prenom},`,
        a.recurrent
          ? `Ton prélèvement est passé et ton solde repart à ${a.seances} séances. Le reliquat du cycle précédent n'est pas reporté, c'est le principe de l'abonnement.`
          : `Tu as maintenant ${a.seances} séance${a.seances > 1 ? "s" : ""} à placer où tu veux dans le planning.`,
      ],
      lignes: [
        ["Formule", a.formule],
        ["Séances", String(a.seances)],
        ["À utiliser avant le", enDate(a.expire)],
        ["Montant", prixLisible(a.montantCents)],
      ],
      encadre:
        "Les séances non utilisées à cette date sont perdues. Place-les dès que le planning te convient.",
      bouton: { libelle: "Réserver mes cours", chemin: "/compte" },
    },
  };
}

export function confirmationReservation(a: {
  prenom: string;
  debut: string;
  fin: string;
  lieu: string;
  delaiHeures: number;
  soldeRestant: number;
}): { objet: string; contenu: Contenu } {
  return {
    objet: `Réservé — ${enJourLong(a.debut)} ${auLieu(a.lieu)}`,
    contenu: {
      titre: "Réservé",
      paragraphes: [
        `Salut ${a.prenom},`,
        "Ta place est prise. On se voit là-bas.",
      ],
      lignes: [
        ["Quand", `${enJourLong(a.debut)}, ${enCreneau(a.debut, a.fin)}`],
        ["Où", a.lieu],
        [
          "Il te reste",
          `${a.soldeRestant} séance${a.soldeRestant > 1 ? "s" : ""} à placer`,
        ],
      ],
      encadre: `Un empêchement ? Tu peux annuler jusqu'à ${a.delaiHeures} h avant le cours et la séance revient sur ton solde. Passé ce délai, elle est décomptée.`,
      bouton: { libelle: "Voir mes réservations", chemin: "/compte" },
    },
  };
}

export function coursAnnule(a: {
  prenom: string;
  debut: string;
  lieu: string;
  motif: string | null;
  recreditee: boolean;
}): { objet: string; contenu: Contenu } {
  return {
    objet: `Cours annulé — ${enJourLong(a.debut)} ${auLieu(a.lieu)}`,
    contenu: {
      titre: "Le cours est annulé",
      paragraphes: [
        `Salut ${a.prenom},`,
        `Je dois annuler le cours du ${enJourLong(a.debut)} ${auLieu(a.lieu)}.${a.motif ? ` ${a.motif}.` : ""} Désolée pour le changement.`,
        a.recreditee
          ? "Ta séance est déjà revenue sur ton solde, tu n'as rien à faire."
          : "Le solde qui avait financé cette séance n'est plus valable, elle n'a donc pas pu revenir dessus. Écris-moi, on trouve une solution.",
      ],
      bouton: { libelle: "Choisir un autre cours", chemin: "/compte" },
    },
  };
}

export function alerteExpiration(a: {
  prenom: string;
  seances: number;
  expire: string;
  joursRestants: number;
}): { objet: string; contenu: Contenu } {
  const s = a.seances > 1;
  return {
    objet: `${a.seances} séance${s ? "s" : ""} à placer avant le ${enDate(a.expire)}`,
    contenu: {
      titre: s ? "Tes séances arrivent à échéance" : "Ta séance arrive à échéance",
      paragraphes: [
        `Salut ${a.prenom},`,
        `Il te reste ${a.seances} séance${s ? "s" : ""} à placer avant le ${enDate(a.expire)}, soit ${joursLisibles(a.joursRestants)}.`,
      ],
      encadre: `Passé cette date, ${s ? "elles sont perdues" : "elle est perdue"}. Aucun report, c'est la règle depuis le début et je ne peux pas y déroger.`,
      bouton: { libelle: "Voir le planning", chemin: "/compte" },
      pied: [
        "Si aucun cours ne te convient d'ici là, écris-moi plutôt que de laisser filer.",
      ],
    },
  };
}

export function paiementEchoue(a: {
  prenom: string;
  formule: string;
  finValidite: string | null;
}): { objet: string; contenu: Contenu } {
  return {
    objet: "Ton prélèvement n'est pas passé",
    contenu: {
      titre: "Ton prélèvement n'est pas passé",
      paragraphes: [
        `Salut ${a.prenom},`,
        `Le prélèvement de ton ${a.formule} a échoué, et les tentatives automatiques sont épuisées. Ton abonnement ne se rechargera pas au prochain cycle.`,
        a.finValidite
          ? `Les séances qu'il te reste sont valables jusqu'au ${enDate(a.finValidite)}, elles ne bougent pas.`
          : "Les séances qu'il te reste ne bougent pas.",
      ],
      lignes: [
        ["Formule", a.formule],
        ["Date", enDateAnnee(new Date().toISOString())],
      ],
      encadre:
        "Mets ta carte à jour depuis ton compte et l'abonnement repart. Rien n'est perdu.",
      bouton: { libelle: "Mettre ma carte à jour", chemin: "/compte/formule" },
    },
  };
}
