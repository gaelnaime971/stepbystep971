import type { Metadata } from "next";
import { TexteCharte } from "@/components/charte/TexteCharte";

export const metadata: Metadata = {
  title: "Charte de participation — Step by Step",
  description:
    "Les règles de fonctionnement des cours de Fitness Step, et le choix sur la diffusion d'image.",
};

export default function PageCharte() {
  return <TexteCharte />;
}
