-- Verification apres 0007 — le type, la colonne et le GRANT.
-- Attendu : 6 lignes « ok ».

with controles (n, controle, obtenu, attendu) as (values
  (1, 'le type course_level existe avec 3 valeurs',
     (select coalesce(string_agg(e.enumlabel::text, ', ' order by e.enumsortorder), '(type absent)')
        from pg_type t
        join pg_namespace ns on ns.oid = t.typnamespace
        left join pg_enum e on e.enumtypid = t.oid
       where ns.nspname = 'public' and t.typname = 'course_level'),
     'debutante, intermediaire, tous_niveaux'),

  (2, 'courses.level existe et porte ce type',
     (select coalesce(format_type(a.atttypid, a.atttypmod), '(colonne absente)')
        from pg_attribute a
       where a.attrelid = 'public.courses'::regclass
         and a.attname = 'level' and not a.attisdropped),
     'course_level'),

  (3, 'la colonne est NULLABLE',
     (select case when a.attnotnull then 'NOT NULL' else 'nullable' end
        from pg_attribute a
       where a.attrelid = 'public.courses'::regclass and a.attname = 'level'),
     'nullable'),

  -- Un DEFAULT aurait etiquete les cours existants sans qu'Oriane le decide.
  (4, 'la colonne n''a AUCUN defaut',
     (select case when a.atthasdef then 'un defaut existe' else 'aucun defaut' end
        from pg_attribute a
       where a.attrelid = 'public.courses'::regclass and a.attname = 'level'),
     'aucun defaut'),

  -- Sans ce GRANT, la vitrine renverrait « permission denied for column level ».
  (5, 'anon et authenticated peuvent LIRE level',
     (select case
               when has_column_privilege('anon', 'public.courses', 'level', 'select')
                and has_column_privilege('authenticated', 'public.courses', 'level', 'select')
               then 'les deux' else 'MANQUANT' end),
     'les deux'),

  (6, 'admin_notes reste hors de portee',
     (select case
               when not has_column_privilege('anon', 'public.courses', 'admin_notes', 'select')
                and not has_column_privilege('authenticated', 'public.courses', 'admin_notes', 'select')
               then 'protegee' else 'FUITE' end),
     'protegee')
),
juge as (
  select n, controle, obtenu, attendu,
         case when obtenu = attendu then 'ok' else 'ECHEC' end as verdict
    from controles
)
select * from juge order by (verdict = 'ok'), n;
