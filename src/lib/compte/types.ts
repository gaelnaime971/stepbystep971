export type Lot = {
  id: string;
  quantity_remaining: number;
  expires_at: string;
  plan_id: string | null;
};

export type Lieu = { id: string; name: string };

export type Cours = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  seats_taken: number;
  status: "scheduled" | "canceled";
  location_id: string;
};

export type Reservation = {
  id: string;
  course_id: string;
  booked_at: string;
  credit_lot_id: string;
};

export type Abonnement = {
  id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  payment_failed_at: string | null;
  dunning_exhausted_at: string | null;
  plan_id: string;
};

export type Achat = {
  id: string;
  kind: "purchase" | "subscription_cycle";
  status: string;
  amount_cents: number;
  paid_at: string | null;
  created_at: string;
  plan_id: string;
};

export type FormuleLisible = {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  cancellation_deadline_hours: number;
  kind: string;
};
