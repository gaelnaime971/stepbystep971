# Modèles d'emails Supabase Auth

Trois emails ne partent **pas** par Resend depuis le code : Supabase Auth les
envoie lui-même, parce qu'ils portent un jeton que seul Supabase connaît.

À coller dans **Authentication → Emails → Templates**, un par onglet :

| Fichier | Onglet Supabase |
|---|---|
| `01-confirmation-inscription.html` | Confirm signup |
| `02-reinitialisation-mot-de-passe.html` | Reset password |
| `03-changement-email.html` | Change email address |

## Pourquoi ces liens et pas ceux d'origine

Le modèle par défaut utilise `{{ .ConfirmationURL }}`, qui pointe vers le
domaine de Supabase, vérifie le jeton chez lui, puis redirige. Ces modèles-ci
pointent **directement sur le site** :

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…
```

C'est la route `src/app/auth/confirm/route.ts` qui appelle alors `verifyOtp`.
Trois conséquences : la cliente ne voit jamais d'URL `supabase.co`, la session
est posée par notre propre serveur, et le paramètre `suite` permet d'envoyer la
réinitialisation droit sur `/nouveau-mot-de-passe`.

## Ce dont ils dépendent

- **Site URL** doit être l'URL de production : c'est elle que `{{ .SiteURL }}`
  rend. Une Site URL restée sur `localhost` produit exactement le bug d'origine.
- **Redirect URLs** doit autoriser `https://stepbystep-guadeloupe.fr/**`.
- Les valeurs de `type` correspondent à `EmailOtpType` du SDK : `signup`,
  `recovery`, `email_change`. Les changer casse la vérification.

## Version texte

Le tableau de bord Supabase n'accepte qu'un corps HTML, sans variante texte.
C'est pour cela que chaque modèle affiche le lien en clair sous le bouton : une
messagerie qui n'affiche pas le HTML laisse quand même l'adresse cliquable.
