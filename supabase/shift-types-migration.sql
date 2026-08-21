-- Esegui questo file una sola volta se hai già creato work_shifts.

alter table public.work_shifts
add column if not exists entry_type text not null default 'work';

alter table public.work_shifts
drop constraint if exists work_shifts_entry_type_check;

alter table public.work_shifts
add constraint work_shifts_entry_type_check
check (entry_type in ('work', 'rol', 'holiday', 'sick'));

comment on column public.work_shifts.entry_type is
'Tipologia evento: work=lavoro, rol=ROL, holiday=ferie, sick=malattia';
