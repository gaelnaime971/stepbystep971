import type { Metadata } from "next";
import { Archivo, Karla } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--police-archivo",
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--police-karla",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Step by Step Coaching — cours de step en Guadeloupe",
  description:
    "Des cours de step où chacune évolue à son rythme, aux Abymes, au Moule et à Jarry.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${archivo.variable} ${karla.variable}`}>
      <body>{children}</body>
    </html>
  );
}
