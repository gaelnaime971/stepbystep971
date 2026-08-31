import { Resend } from "resend";
import { urlDuSite } from "@/lib/site";

export function resend(): Resend {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) throw new Error("RESEND_API_KEY est absente.");
  return new Resend(cle);
}

export function expediteur(): string {
  return process.env.EMAIL_FROM ?? "Step by Step <onboarding@resend.dev>";
}

/**
 * Adresse de reponse.
 *
 * contact@stepbystep-guadeloupe.fr sert a EXPEDIER mais n'a pas de boite :
 * une reponse y partirait dans le vide. Toute reponse doit arriver chez Oriane.
 */
export function repondreA(): string {
  return process.env.EMAIL_REPLY_TO ?? "sbscoaching28@gmail.com";
}

export const siteUrl = urlDuSite;
