/**
 * La charte de participation, telle qu'Oriane la fait signer.
 *
 * LE TEXTE EST LA SOURCE, PAS UN PDF. Une charte que les clientes lisent sur
 * leur telephone doit etre du HTML : un PDF se pince et se deplace, et se lit
 * mal la ou il est lu.
 *
 * VERSION. Elle est gravee dans chaque ligne signee et ne se reecrit pas. Si
 * le texte change au point d'engager autrement, il faut une NOUVELLE version
 * ici — les clientes seront alors invitees a signer a nouveau, et l'on saura
 * qui a signe quoi. Corriger une virgule ne le justifie pas ; modifier un
 * article, si.
 */
export const VERSION_CHARTE = "2026-09";

export type Article = {
  /** « ARTICLE 1 », ou vide pour le preambule. */
  numero: string;
  titre: string;
  /** Paragraphes pleins. */
  texte?: string[];
  /** Liste a puces. */
  points?: string[];
  /** Sous-sections numerotees, comme l'article 7. */
  sections?: { numero: string; titre: string; texte?: string[]; points?: string[] }[];
  /** Mis en avant : l'article 7 porte le consentement image. */
  saillant?: boolean;
};

export const TITRE_CHARTE = "Charte de participation";
export const SOUS_TITRE_CHARTE =
  "Règlement intérieur et autorisation de diffusion d'image";

export const CHARTE: Article[] = [
  {
    numero: "",
    titre: "Préambule",
    texte: [
      "La présente charte a pour objectif de définir les règles de fonctionnement du cours de step, afin d'assurer un environnement d'entraînement sûr, respectueux et motivant pour toutes les participantes. En intégrant ce cours, chaque participante s'engage à respecter l'ensemble des dispositions ci-dessous.",
    ],
  },
  {
    numero: "Article 1",
    titre: "Ponctualité et présence",
    points: [
      "Les participantes sont invitées à arriver 5 à 10 minutes avant le début du cours afin de procéder à l'installation du step.",
      "Tout retard supérieur à 15 minutes peut entraîner le refus d'accès à la séance pour des raisons de sécurité, notamment pour éviter les risques de blessures liés à l'absence d'échauffement.",
      "En cas d'absence prévue, la participante est invitée à en informer le coach dans les meilleurs délais, par message ou par tout autre moyen de communication convenu.",
      "Une présence régulière est fortement recommandée pour assurer une progression continue et maximiser les bénéfices du cours.",
    ],
  },
  {
    numero: "Article 2",
    titre: "Tenue et équipement",
    points: [
      "Une tenue de sport adaptée est obligatoire : vêtements confortables permettant une liberté de mouvement totale (leggings, brassière ou t-shirt de sport, etc.).",
      "Des chaussures de sport à semelle souple et crantée sont impératives. Les chaussures de running, cross-training ou step sont recommandées. La pratique pieds nus ou en chaussettes est strictement interdite pour des raisons de sécurité.",
      "Il est conseillé d'apporter une bouteille d'eau et une serviette personnelle.",
      "L'utilisation d'un tapis d'hygiène personnel est recommandée lors des exercices au sol.",
    ],
  },
  {
    numero: "Article 3",
    titre: "Règles de sécurité",
    points: [
      "Chaque participante est responsable du bon réglage de son step, à une hauteur adaptée à son niveau et à sa morphologie. En cas de doute, le coach reste disponible pour toute assistance.",
      "Toute douleur, gêne ou malaise doit être immédiatement signalée au coach. La séance sera adaptée ou interrompue si nécessaire.",
      "Les participantes s'engagent à informer le coach de tout problème de santé, blessure ou contre-indication médicale avant le début du cours.",
      "Il est fortement déconseillé de participer au cours en cas de fièvre, de douleur articulaire aiguë ou de blessure non consolidée.",
    ],
  },
  {
    numero: "Article 4",
    titre: "Présence d'enfants au cours",
    points: [
      "Les enfants sont bienvenus, mais sous la responsabilité exclusive du parent.",
      "Ils doivent rester dans un coin calme pour ne pas gêner le bon déroulement du cours.",
      "Prévois de quoi les occuper discrètement.",
      "Pour des raisons de sécurité, ils ne doivent pas circuler sur l'espace de pratique ni manipuler le matériel.",
    ],
  },
  {
    numero: "Article 5",
    titre: "Comportement et respect",
    points: [
      "Un comportement respectueux envers le coach et les autres participantes est exigé à tout moment.",
      "Les conversations personnelles, l'utilisation du téléphone portable et toute source de distraction sont à éviter pendant la séance afin de garantir la concentration et la sécurité de toutes.",
      "L'entraide et la bienveillance entre participantes sont encouragées. Tout comportement irrespectueux, moqueur ou discriminatoire entraînera une exclusion immédiate et définitive du cours.",
    ],
  },
  {
    numero: "Article 6",
    titre: "Hygiène et respect du matériel",
    points: [
      "Chaque participante est tenue de manipuler le matériel avec soin : step, élastiques, tapis et tout autre équipement mis à disposition.",
      "Le matériel utilisé doit être nettoyé si nécessaire et rangé à son emplacement d'origine après chaque séance.",
      "Aux Abymes : les steps « CARE » ensemble, et une pile pour ceux qui ne sont pas des « CARE ».",
      "Toute dégradation du matériel engage la responsabilité de la participante concernée et pourra faire l'objet d'un remboursement.",
    ],
  },
  {
    numero: "Article 7",
    titre: "Photographies et vidéos",
    saillant: true,
    texte: [
      "Cette section concerne la captation, l'utilisation et la diffusion de photographies et vidéos réalisées dans le cadre du cours de step.",
    ],
    sections: [
      {
        numero: "7.1",
        titre: "Captation par le coach",
        texte: [
          "Dans le cadre de la promotion de ses activités sportives, le coach est susceptible de photographier ou de filmer les séances de step. Ces contenus peuvent être utilisés à des fins de communication sur les réseaux sociaux (Instagram, TikTok, Facebook, YouTube, etc.) ou tout autre support de communication numérique ou imprimé.",
        ],
      },
      {
        numero: "7.2",
        titre: "Autorisation de diffusion",
        texte: [
          "La participante reconnaît avoir été informée de la possible captation de son image lors des cours et accorde expressément au coach l'autorisation de :",
        ],
        points: [
          "Photographier et/ou filmer sa participation aux séances de step.",
          "Utiliser ces contenus sur les réseaux sociaux du coach (Instagram, TikTok, Facebook, YouTube, etc.) et tout autre support de communication.",
          "Modifier, recadrer ou mettre en valeur les contenus de manière bienveillante et respectueuse.",
          "Conserver ces contenus dans ses archives numériques.",
        ],
      },
      {
        numero: "7.3",
        titre: "Conditions et garanties",
        points: [
          "Les contenus diffusés auront exclusivement pour objet la promotion des activités sportives. Aucune utilisation à visée commerciale par un tiers ne sera autorisée sans accord écrit préalable de la participante.",
          "Le coach s'engage à ne pas diffuser de contenus portant atteinte à la dignité ou à l'image de la participante.",
        ],
      },
      {
        numero: "7.4",
        titre: "Refus de diffusion",
        texte: [
          "En cas de refus de la diffusion de son image, la participante doit le notifier expressément par écrit au coach au moment de la signature de la présente charte ou à tout moment au cours de sa participation. Ce refus ne constitue en aucun cas un motif d'exclusion du cours.",
        ],
      },
    ],
  },
  {
    numero: "Article 8",
    titre: "Accidents, blessures, responsabilité",
    points: [
      "La participante déclare participer au cours de manière volontaire et sous sa propre responsabilité, et reconnaît avoir conscience des risques liés à la pratique de cette activité.",
      "Elle s'engage à respecter strictement les consignes et recommandations données par le coach, à adapter son effort à ses capacités physiques, et à interrompre immédiatement l'exercice en cas de douleur, malaise ou difficulté.",
      "Le coach ne pourra être tenu responsable d'un accident, d'une blessure ou d'un malaise résultant notamment d'une mauvaise exécution d'un mouvement, du non-respect des consignes, d'une imprudence, d'un dépassement volontaire de ses capacités physiques, d'une information médicale non communiquée ou de tout autre fait imputable à la participante.",
      "En cas d'accident ou de malaise, le coach prendra les mesures raisonnables nécessaires à la sécurité de la participante, dans la limite de ses compétences, et pourra contacter les services d'urgence si la situation le justifie.",
    ],
  },
  {
    numero: "Article 9",
    titre: "Sanctions",
    texte: [
      "Le non-respect des règles définies dans la présente charte pourra entraîner, selon la gravité des faits :",
    ],
    points: ["Un avertissement verbal.", "L'exclusion définitive du cours, sans remboursement."],
  },
];
