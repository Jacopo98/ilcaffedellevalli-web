-- Esegui una sola volta dopo fixed-cost-history-migration.sql.
-- Consente ai costi fissi di rimanere validi senza una data di fine prestabilita.

alter table public.recurring_cost_plans
  alter column competence_end drop not null;

comment on column public.recurring_cost_plans.competence_end is
  'Fine della validita del costo; NULL indica una durata indeterminata.';
