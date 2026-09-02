import type { Niveau } from "@/lib/niveaux";

export type CoursAdmin = {
  id: string;
  location_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  seats_taken: number;
  status: "scheduled" | "canceled";
  canceled_at: string | null;
  cancellation_reason: string | null;
  recurrence_group_id: string | null;
  level: Niveau | null;
};

export type LieuAdmin = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  is_active: boolean;
  sort_order: number;
};

export type Inscrite = {
  bookingId: string;
  userId: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  reserveLe: string;
};

export const COLONNES_COURS_ADMIN =
  "id, location_id, starts_at, ends_at, capacity, seats_taken, status, " +
  "canceled_at, cancellation_reason, recurrence_group_id, level";

export const COLONNES_LIEU = "id, name, address, city, is_active, sort_order";
