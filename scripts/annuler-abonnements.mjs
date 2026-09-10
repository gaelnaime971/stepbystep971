#!/usr/bin/env node
/**
 * Passe une liste d'abonnements Stripe en `cancel_at_period_end = true`.
 *
 * CE QUE CE SCRIPT NE FAIT PAS : il n'écrit rien dans Supabase. Stripe émet
 * `customer.subscription.updated`, le webhook met `subscriptions` à jour, et
 * c'est le seul chemin. Écrire ici en plus créerait une seconde vérité, qui
 * divergerait au premier échec.
 *
 * Les clientes gardent leurs séances jusqu'à la fin de la période déjà payée :
 * `cancel_at_period_end` ne retire rien, il empêche le prochain prélèvement.
 *
 * USAGE
 *   node scripts/annuler-abonnements.mjs <fichier> [--simulation]
 *
 *   <fichier>      un identifiant `sub_…` par ligne. Les lignes vides et
 *                  celles commençant par # sont ignorées.
 *   --simulation   s'arrête après l'état des lieux, n'écrit rien.
 *
 * La clé est lue dans STRIPE_SECRET_KEY, ou à défaut dans .env.local.
 * Pour agir en Live, exporte la clé Live — le script affiche le mode et
 * demande confirmation avant d'écrire quoi que ce soit.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- Sortie ----------------------------------------------------------------

const COULEUR = process.stdout.isTTY;
const c = (code, s) => (COULEUR ? `\x1b[${code}m${s}\x1b[0m` : s);
const gras = (s) => c("1", s);
const rouge = (s) => c("31", s);
const vert = (s) => c("32", s);
const ambre = (s) => c("33", s);
const gris = (s) => c("90", s);

function mourir(message, detail) {
  console.error(`\n${rouge("Arrêt.")} ${message}`);
  if (detail) console.error(gris(`  ${detail}`));
  process.exit(1);
}

const dateLisible = (secondes) =>
  secondes
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeZone: "America/Guadeloupe",
      }).format(new Date(secondes * 1000))
    : "—";

// --- La clé ----------------------------------------------------------------

function cleStripe() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY.trim();

  const fichier = path.join(RACINE, ".env.local");
  if (!fs.existsSync(fichier)) {
    mourir(
      "Aucune clé Stripe.",
      "Exporte STRIPE_SECRET_KEY, ou place-la dans .env.local.",
    );
  }
  const ligne = fs
    .readFileSync(fichier, "utf8")
    .split("\n")
    .find((l) => l.startsWith("STRIPE_SECRET_KEY="));
  if (!ligne) mourir("STRIPE_SECRET_KEY absente de .env.local.");
  return ligne.slice("STRIPE_SECRET_KEY=".length).replace(/^["']|["']$/g, "").trim();
}

// --- La liste --------------------------------------------------------------

function identifiants(fichier) {
  if (!fichier) {
    mourir(
      "Indique le fichier qui contient les identifiants.",
      "node scripts/annuler-abonnements.mjs mes-abonnements.txt",
    );
  }
  if (!fs.existsSync(fichier)) mourir(`Fichier introuvable : ${fichier}`);

  const lignes = fs
    .readFileSync(fichier, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const mauvais = lignes.filter((l) => !/^sub_[A-Za-z0-9]+$/.test(l));
  if (mauvais.length > 0) {
    mourir(
      `${mauvais.length} ligne(s) ne ressemblent pas à un identifiant d'abonnement.`,
      mauvais.slice(0, 5).join(", "),
    );
  }

  const vus = new Set();
  const doublons = new Set();
  for (const l of lignes) (vus.has(l) ? doublons : vus).add(l);
  if (doublons.size > 0) {
    console.log(
      ambre(`  ${doublons.size} doublon(s) dans le fichier, ignoré(s) : `) +
        [...doublons].join(", "),
    );
  }
  if (vus.size === 0) mourir("Le fichier ne contient aucun identifiant.");

  return [...vus];
}

// --- Lecture ---------------------------------------------------------------

/**
 * L'API 2026-08-26 a sorti `current_period_end` de la racine de l'abonnement :
 * il est porté par la LIGNE d'abonnement. On lit les deux formes, pour survivre
 * à un changement de version épinglée.
 */
function finDePeriode(abo) {
  return abo.current_period_end ?? abo.items?.data?.[0]?.current_period_end ?? null;
}

function emailDuClient(abo) {
  const cl = abo.customer;
  if (!cl || typeof cl === "string") return cl || "—";
  if (cl.deleted) return "(client supprimé)";
  return cl.email ?? "—";
}

async function etatDesLieux(sdk, ids) {
  const lignes = [];
  process.stdout.write(gris(`  lecture de ${ids.length} abonnement(s)`));

  for (const id of ids) {
    let abo;
    try {
      abo = await sdk.subscriptions.retrieve(id, { expand: ["customer"] });
    } catch (erreur) {
      process.stdout.write("\n");
      mourir(`${id} est introuvable chez Stripe.`, erreur.message);
    }
    lignes.push({
      id,
      email: emailDuClient(abo),
      statut: abo.status,
      fin: finDePeriode(abo),
      dejaFait: abo.cancel_at_period_end === true,
      livemode: abo.livemode,
    });
    process.stdout.write(gris("."));
  }
  process.stdout.write("\n\n");
  return lignes;
}

// --- Programme -------------------------------------------------------------

const args = process.argv.slice(2);
const simulation = args.includes("--simulation");
const fichier = args.find((a) => !a.startsWith("--"));

const cle = cleStripe();
const modeLive = cle.startsWith("sk_live_");
if (!/^sk_(live|test)_/.test(cle)) {
  mourir("Cette clé ne ressemble pas à une clé secrète Stripe (attendu sk_live_… ou sk_test_…).");
}

const ids = identifiants(fichier);
const sdk = new Stripe(cle, { timeout: 20_000, maxNetworkRetries: 2 });

console.log(gras("\nAnnulation d'abonnements à la fin de leur période"));
console.log(
  `  Compte  : ${modeLive ? rouge(gras("LIVE — clientes réelles")) : vert("test")}`,
);
console.log(`  Fichier : ${fichier}`);
console.log(`  Base    : ${gris("aucune écriture, le webhook s'en charge")}\n`);

const lignes = await etatDesLieux(sdk, ids);

// Le mode annoncé par la clé doit correspondre à ce que Stripe renvoie.
const incoherents = lignes.filter((l) => l.livemode !== modeLive);
if (incoherents.length > 0) {
  mourir(
    "Le mode des abonnements ne correspond pas à celui de la clé.",
    `${incoherents.length} abonnement(s) en ${modeLive ? "test" : "live"} avec une clé ${modeLive ? "live" : "test"}.`,
  );
}

const aFaire = lignes.filter((l) => l.statut === "active" && !l.dejaFait);
const deja = lignes.filter((l) => l.dejaFait);
const anomalies = lignes.filter((l) => l.statut !== "active" && !l.dejaFait);

const large = Math.max(...lignes.map((l) => l.email.length), 5);
for (const l of lignes) {
  const marque = l.dejaFait ? gris("déjà") : l.statut !== "active" ? rouge("!") : vert("→");
  console.log(
    `  ${marque} ${l.id}  ${l.email.padEnd(large)}  ${l.statut.padEnd(10)}  fin le ${dateLisible(l.fin)}`,
  );
}

console.log(gras(`\n  ${aFaire.length} à passer en annulation`));
if (deja.length > 0) console.log(gris(`  ${deja.length} déjà en cours d'annulation, ignoré(s)`));

if (anomalies.length > 0) {
  console.log(rouge(`  ${anomalies.length} en anomalie :`));
  for (const a of anomalies) console.log(rouge(`    ${a.id} — statut ${a.statut}`));
  mourir(
    "Rien n'a été modifié.",
    "Un abonnement qui n'est pas « active » ne se résilie pas ainsi. Retire-le de la liste, ou traite-le à part.",
  );
}

if (aFaire.length === 0) {
  console.log(vert("\nRien à faire, tout est déjà en place.\n"));
  process.exit(0);
}

if (simulation) {
  console.log(ambre("\n--simulation : rien n'a été écrit.\n"));
  process.exit(0);
}

// --- Confirmation ----------------------------------------------------------

const question = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log(
  `\n  Chacune gardera ses séances jusqu'à la fin de sa période. Aucun prélèvement après.`,
);
const reponse = await question.question(
  `\n  Tape ${gras("ANNULER")} pour lancer sur ${gras(String(aFaire.length))} abonnement(s)${modeLive ? rouge(" en LIVE") : ""}, ou Entrée pour renoncer : `,
);
question.close();

if (reponse.trim() !== "ANNULER") {
  console.log(gris("\nRenoncé. Rien n'a été modifié.\n"));
  process.exit(0);
}

// --- Écriture, une par une -------------------------------------------------

console.log("");
const faits = [];

for (const [i, l] of aFaire.entries()) {
  const compteur = gris(`[${String(i + 1).padStart(2)}/${aFaire.length}]`);
  try {
    const abo = await sdk.subscriptions.update(l.id, { cancel_at_period_end: true });
    faits.push(l.id);
    console.log(
      `  ${compteur} ${vert("ok")}  ${l.id}  ${l.email}  ${gris(`fin le ${dateLisible(abo.cancel_at ?? finDePeriode(abo))}`)}`,
    );
  } catch (erreur) {
    console.log(`  ${compteur} ${rouge("ÉCHEC")}  ${l.id}  ${l.email}`);
    console.error(`\n${rouge("Arrêt au premier échec, les suivants ne sont pas touchés.")}`);
    console.error(gris(`  ${erreur.message}`));

    const restants = aFaire.slice(i).map((r) => r.id);
    const reprise = path.join(process.cwd(), "abonnements-restants.txt");
    fs.writeFileSync(reprise, restants.join("\n") + "\n", "utf8");

    console.error(`\n  ${faits.length} passé(s) en annulation avant l'arrêt.`);
    console.error(`  ${restants.length} non traité(s), écrits dans ${gras(reprise)}`);
    console.error(gris(`  Corrige la cause, puis relance le script sur ce fichier.\n`));
    process.exit(1);
  }
}

console.log(
  vert(gras(`\n  ${faits.length} abonnement(s) passés en annulation de fin de période.`)),
);
console.log(
  gris(
    "  Le webhook customer.subscription.updated met la base à jour de lui-même.\n" +
      "  Vérifie dans /admin/clientes qu'elles apparaissent « Résilié » d'ici une minute.\n",
  ),
);
