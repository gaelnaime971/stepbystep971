import { clientServeur } from "@/lib/supabase/server";
import { dateLocale } from "@/lib/planning/dates";
import type {
  AbonnementDetail, AchatDetail, Attention, ClienteResume, EmailEnvoye,
  LotDetail, ReservationDetail,
} from "./types";

const maintenant = () => new Date().toISOString();
const ilYA = (jours: number) => new Date(Date.now() - jours * 86400000).toISOString();
const dans = (jours: number) => new Date(Date.now() + jours * 86400000).toISOString();

/** Premier instant du mois en cours, vu de Guadeloupe. */
function debutDuMois(): string {
  const [a, m] = dateLocale(maintenant()).split("-");
  return new Date(`${a}-${m}-01T00:00:00-04:00`).toISOString();
}

// ---------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------

export type Kpis = {
  encaisseCeMois: number;
  clientesActives: number;
  abonnementsEnCours: number;
  tauxRemplissage: number | null;
  coursTrenteJours: number;
};

export async function kpis(): Promise<Kpis> {
  const supabase = await clientServeur();

  const [ventes, lots, abos, cours] = await Promise.all([
    supabase.from("orders")
      .select("amount_cents, refunded_amount_cents")
      .in("status", ["paid", "partially_refunded"])
      .gte("paid_at", debutDuMois())
      .returns<{ amount_cents: number; refunded_amount_cents: number }[]>(),
    supabase.from("credit_lots")
      .select("user_id")
      .gt("quantity_remaining", 0).is("closed_at", null).gt("expires_at", maintenant())
      .returns<{ user_id: string }[]>(),
    supabase.from("subscriptions")
      .select("id").in("status", ["active", "trialing", "past_due"])
      .returns<{ id: string }[]>(),
    supabase.from("courses")
      .select("capacity, seats_taken")
      .eq("status", "scheduled")
      .gte("starts_at", ilYA(30)).lt("starts_at", maintenant())
      .returns<{ capacity: number; seats_taken: number }[]>(),
  ]);

  const places = (cours.data ?? []).reduce((n, c) => n + c.capacity, 0);
  const prises = (cours.data ?? []).reduce((n, c) => n + c.seats_taken, 0);

  return {
    // Net des remboursements : c'est ce qui est reellement rentre.
    encaisseCeMois: (ventes.data ?? []).reduce(
      (n, o) => n + o.amount_cents - o.refunded_amount_cents, 0),
    clientesActives: new Set((lots.data ?? []).map((l) => l.user_id)).size,
    abonnementsEnCours: abos.data?.length ?? 0,
    tauxRemplissage: places > 0 ? Math.round((prises / places) * 100) : null,
    coursTrenteJours: cours.data?.length ?? 0,
  };
}

/** Ce qui demande une action, et rien d'autre. Une liste vide est une bonne nouvelle. */
export async function pointsDAttention(): Promise<Attention[]> {
  const supabase = await clientServeur();
  const liste: Attention[] = [];

  const [formules, echecs, webhooks, lots, complets, vides] = await Promise.all([
    supabase.from("plans").select("id").eq("is_active", true).is("stripe_price_id", null)
      .returns<{ id: string }[]>(),
    supabase.from("subscriptions").select("id").not("dunning_exhausted_at", "is", null)
      .in("status", ["past_due", "unpaid", "active"]).returns<{ id: string }[]>(),
    supabase.from("stripe_events").select("id").is("processed_at", null)
      .returns<{ id: string }[]>(),
    supabase.from("credit_lots").select("user_id, quantity_remaining")
      .gt("quantity_remaining", 0).is("closed_at", null)
      .gt("expires_at", maintenant()).lt("expires_at", dans(7))
      .returns<{ user_id: string; quantity_remaining: number }[]>(),
    supabase.from("courses").select("id, capacity, seats_taken")
      .eq("status", "scheduled").gt("starts_at", maintenant()).lt("starts_at", dans(14))
      .returns<{ id: string; capacity: number; seats_taken: number }[]>(),
    supabase.from("courses").select("id, seats_taken")
      .eq("status", "scheduled").gt("starts_at", maintenant()).lt("starts_at", dans(3))
      .returns<{ id: string; seats_taken: number }[]>(),
  ]);

  if (formules.data?.length) liste.push({ type: "formule_non_publiee", nombre: formules.data.length });
  if (echecs.data?.length) liste.push({ type: "paiement_en_echec", nombre: echecs.data.length });
  if (webhooks.data?.length) liste.push({ type: "webhook_non_traite", nombre: webhooks.data.length });

  const menacees = lots.data ?? [];
  if (menacees.length) {
    liste.push({
      type: "seances_expirent",
      nombre: menacees.reduce((n, l) => n + l.quantity_remaining, 0),
      clientes: new Set(menacees.map((l) => l.user_id)).size,
    });
  }

  const pleins = (complets.data ?? []).filter((c) => c.seats_taken >= c.capacity);
  if (pleins.length) liste.push({ type: "cours_complet", nombre: pleins.length });

  const sansPersonne = (vides.data ?? []).filter((c) => c.seats_taken === 0);
  if (sansPersonne.length) liste.push({ type: "cours_vide", nombre: sansPersonne.length });

  return liste;
}

// ---------------------------------------------------------------------------
// Les clientes
// ---------------------------------------------------------------------------

export async function clientes(recherche?: string): Promise<ClienteResume[]> {
  const supabase = await clientServeur();

  let requete = supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, created_at")
    .eq("role", "cliente")
    .order("created_at", { ascending: false })
    .limit(200);

  if (recherche?.trim()) {
    const m = recherche.trim().replace(/[%,()]/g, "");
    requete = requete.or(
      `first_name.ilike.%${m}%,last_name.ilike.%${m}%,email.ilike.%${m}%`,
    );
  }

  const { data: profils } = await requete.returns<
    { id: string; first_name: string; last_name: string; email: string; phone: string | null; created_at: string }[]
  >();

  if (!profils?.length) return [];

  const ids = profils.map((p) => p.id);
  const [{ data: lots }, { data: abos }] = await Promise.all([
    supabase.from("credit_lots").select("user_id, quantity_remaining, expires_at, plan_id")
      .in("user_id", ids).gt("quantity_remaining", 0).is("closed_at", null)
      .gt("expires_at", maintenant()).order("expires_at", { ascending: true })
      .returns<{ user_id: string; quantity_remaining: number; expires_at: string; plan_id: string | null }[]>(),
    supabase.from("subscriptions").select("user_id, plan_id, status")
      .in("user_id", ids).in("status", ["active", "trialing", "past_due"])
      .returns<{ user_id: string; plan_id: string; status: string }[]>(),
  ]);

  const idsFormules = [
    ...new Set([...(lots ?? []).map((l) => l.plan_id), ...(abos ?? []).map((a) => a.plan_id)]),
  ].filter((x): x is string => !!x);

  const { data: formules } = idsFormules.length
    ? await supabase.from("plans").select("id, name").in("id", idsFormules)
        .returns<{ id: string; name: string }[]>()
    : { data: [] };

  const nomFormule = new Map((formules ?? []).map((f) => [f.id, f.name]));

  return profils.map((p) => {
    const siens = (lots ?? []).filter((l) => l.user_id === p.id);
    const abo = (abos ?? []).find((a) => a.user_id === p.id);
    return {
      id: p.id,
      prenom: p.first_name,
      nom: p.last_name,
      email: p.email,
      telephone: p.phone,
      solde: siens.reduce((n, l) => n + l.quantity_remaining, 0),
      prochaineEcheance: siens[0]?.expires_at ?? null,
      formule: abo
        ? (nomFormule.get(abo.plan_id) ?? null)
        : (nomFormule.get(siens[0]?.plan_id ?? "") ?? null),
      inscriteLe: p.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// La fiche cliente
// ---------------------------------------------------------------------------

export async function ficheCliente(id: string) {
  const supabase = await clientServeur();

  const { data: profil } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, phone, role, stripe_customer_id, created_at")
    .eq("id", id)
    .maybeSingle<{
      id: string; email: string; first_name: string; last_name: string;
      phone: string | null; role: string; stripe_customer_id: string | null; created_at: string;
    }>();

  if (!profil) return null;

  const [lotsBruts, resaBrutes, achatsBruts, abosBruts, mails] = await Promise.all([
    supabase.from("credit_lots")
      .select("id, quantity_remaining, quantity_initial, expires_at, origin, closed_at, close_reason, plan_id, reason")
      .eq("user_id", id).order("expires_at", { ascending: false })
      .returns<{ id: string; quantity_remaining: number; quantity_initial: number; expires_at: string; origin: string; closed_at: string | null; close_reason: string | null; plan_id: string | null; reason: string | null }[]>(),
    supabase.from("bookings")
      .select("id, status, booked_at, credit_refunded_at, course_id")
      .eq("user_id", id).order("booked_at", { ascending: false }).limit(60)
      .returns<{ id: string; status: string; booked_at: string; credit_refunded_at: string | null; course_id: string }[]>(),
    supabase.from("orders")
      .select("id, kind, status, amount_cents, refunded_amount_cents, paid_at, created_at, plan_id, stripe_payment_intent_id, stripe_invoice_id, stripe_checkout_session_id")
      .eq("user_id", id).order("created_at", { ascending: false })
      .returns<{ id: string; kind: string; status: string; amount_cents: number; refunded_amount_cents: number; paid_at: string | null; created_at: string; plan_id: string; stripe_payment_intent_id: string | null; stripe_invoice_id: string | null; stripe_checkout_session_id: string | null }[]>(),
    supabase.from("subscriptions")
      .select("id, status, current_period_end, cancel_at_period_end, payment_failed_at, dunning_exhausted_at, plan_id, stripe_subscription_id")
      .eq("user_id", id).order("created_at", { ascending: false })
      .returns<{ id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean; payment_failed_at: string | null; dunning_exhausted_at: string | null; plan_id: string; stripe_subscription_id: string }[]>(),
    supabase.from("email_log")
      .select("id, template, to_email, sent_at, error")
      .eq("user_id", id).order("sent_at", { ascending: false }).limit(30)
      .returns<{ id: string; template: string; to_email: string; sent_at: string; error: string | null }[]>(),
  ]);

  const idsCours = [...new Set((resaBrutes.data ?? []).map((r) => r.course_id))];
  const idsFormules = [
    ...new Set([
      ...(lotsBruts.data ?? []).map((l) => l.plan_id),
      ...(achatsBruts.data ?? []).map((a) => a.plan_id),
      ...(abosBruts.data ?? []).map((a) => a.plan_id),
    ]),
  ].filter((x): x is string => !!x);

  const [{ data: cours }, { data: formules }] = await Promise.all([
    idsCours.length
      ? supabase.from("courses").select("id, starts_at, ends_at, location_id, status").in("id", idsCours)
          .returns<{ id: string; starts_at: string; ends_at: string; location_id: string; status: string }[]>()
      : Promise.resolve({ data: [] }),
    idsFormules.length
      ? supabase.from("plans").select("id, name").in("id", idsFormules)
          .returns<{ id: string; name: string }[]>()
      : Promise.resolve({ data: [] }),
  ]);

  const { data: lieux } = await supabase.from("locations").select("id, name")
    .returns<{ id: string; name: string }[]>();

  const nomFormule = new Map((formules ?? []).map((f) => [f.id, f.name]));
  const nomLieu = new Map((lieux ?? []).map((l) => [l.id, l.name]));
  const parCours = new Map((cours ?? []).map((c) => [c.id, c]));

  const lots: LotDetail[] = (lotsBruts.data ?? []).map((l) => ({
    id: l.id, quantite: l.quantity_remaining, quantiteInitiale: l.quantity_initial,
    expire: l.expires_at, origine: l.origin, ferme: l.closed_at,
    motifFermeture: l.close_reason, formule: nomFormule.get(l.plan_id ?? "") ?? null,
    motif: l.reason,
  }));

  const reservations: ReservationDetail[] = (resaBrutes.data ?? [])
    .map((r) => {
      const c = parCours.get(r.course_id);
      if (!c) return null;
      return {
        id: r.id, statut: r.status, debut: c.starts_at, ends: c.ends_at,
        fin: c.ends_at, lieu: nomLieu.get(c.location_id) ?? "—",
        reserveLe: r.booked_at, recreditee: !!r.credit_refunded_at,
        coursId: c.id, coursAnnule: c.status === "canceled",
      } as ReservationDetail;
    })
    .filter((x): x is ReservationDetail => !!x);

  const achats: AchatDetail[] = (achatsBruts.data ?? []).map((a) => ({
    id: a.id, type: a.kind, statut: a.status, montant: a.amount_cents,
    rembourse: a.refunded_amount_cents, date: a.paid_at ?? a.created_at,
    formule: nomFormule.get(a.plan_id) ?? null,
    stripePaymentIntent: a.stripe_payment_intent_id,
    stripeInvoice: a.stripe_invoice_id,
    stripeSession: a.stripe_checkout_session_id,
  }));

  const abonnements: AbonnementDetail[] = (abosBruts.data ?? []).map((a) => ({
    id: a.id, statut: a.status, finPeriode: a.current_period_end,
    resilieALaFin: a.cancel_at_period_end, echecDepuis: a.payment_failed_at,
    echecDefinitif: a.dunning_exhausted_at,
    formule: nomFormule.get(a.plan_id) ?? null,
    stripeId: a.stripe_subscription_id,
  }));

  const emails: EmailEnvoye[] = (mails.data ?? []).map((m) => ({
    id: m.id, modele: m.template, destinataire: m.to_email,
    envoyeLe: m.sent_at, erreur: m.error,
  }));

  const soldeActif = lots
    .filter((l) => l.quantite > 0 && !l.ferme && l.expire > maintenant())
    .reduce((n, l) => n + l.quantite, 0);

  return { profil, lots, reservations, achats, abonnements, emails, soldeActif };
}
