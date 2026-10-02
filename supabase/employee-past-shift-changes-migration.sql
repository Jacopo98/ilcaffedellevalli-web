-- Esegui una sola volta dopo employee-shift-requests-migration.sql.
-- Le nuove ore extra restano consentite da oggi in poi.
-- Le modifiche a turni esistenti sono consentite fino a due mesi indietro.

drop policy if exists "Employees create own shift requests"
on public.shift_change_requests;

create policy "Employees create own shift requests"
on public.shift_change_requests
for insert
to authenticated
with check (
  employee_id = (select private.current_employee_id())
  and requested_by = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and (
    (
      request_type = 'add_extra'
      and work_shift_id is null
      and proposed_date >= current_date
    )
    or
    (
      request_type = 'change_shift'
      and proposed_date >= (current_date - interval '2 months')::date
      and work_shift_id in (
        select id
        from public.work_shifts
        where employee_id = (select private.current_employee_id())
          and shift_date >= (current_date - interval '2 months')::date
      )
    )
  )
);

comment on policy "Employees create own shift requests"
on public.shift_change_requests is
  'Extra da oggi; modifiche ai turni personali consentite fino a due mesi indietro.';
