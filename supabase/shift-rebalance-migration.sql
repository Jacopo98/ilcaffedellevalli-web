-- Esegui una sola volta dopo employee-contract-type-migration.sql,
-- employee-portal-migration.sql ed employee-shift-requests-migration.sql.
-- Applica in una singola transazione le proposte approvate di riordino ore.

create or replace function public.apply_shift_rebalance(p_changes jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  change_item jsonb;
  segment_item jsonb;
  current_shift public.work_shifts%rowtype;
  original_minutes integer;
  proposed_minutes integer;
  applied_count integer := 0;
  first_segment boolean;
begin
  if not (select private.is_admin()) then
    raise exception 'Operazione riservata agli amministratori';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 1000 then
    raise exception 'Proposta non valida';
  end if;

  for change_item in select value from jsonb_array_elements(p_changes)
  loop
    select * into current_shift
    from public.work_shifts
    where id = (change_item->>'shiftId')::bigint
    for update;

    if not found
      or current_shift.employee_id <> (change_item->>'employeeId')::bigint
      or current_shift.shift_date <> (change_item->>'date')::date
      or current_shift.start_time <> (change_item->>'startTime')::time
      or current_shift.end_time <> (change_item->>'endTime')::time
      or current_shift.break_minutes <> (change_item->>'breakMinutes')::integer
      or current_shift.entry_type <> change_item->>'entryType'
      or current_shift.approval_status <> 'approved'
    then
      raise exception 'Un turno è cambiato dopo la generazione della proposta. Rigenera il prospetto.';
    end if;

    original_minutes := extract(epoch from (current_shift.end_time-current_shift.start_time))::integer/60-current_shift.break_minutes;
    proposed_minutes := 0;
    for segment_item in select value from jsonb_array_elements(change_item->'segments')
    loop
      if segment_item->>'entryType' not in ('work','extra')
        or (segment_item->>'endTime')::time <= (segment_item->>'startTime')::time
      then raise exception 'Segmento proposto non valido'; end if;
      proposed_minutes := proposed_minutes
        + extract(epoch from ((segment_item->>'endTime')::time-(segment_item->>'startTime')::time))::integer/60
        - (segment_item->>'breakMinutes')::integer;
    end loop;
    if original_minutes <> proposed_minutes then
      raise exception 'La proposta altera il totale delle ore del turno';
    end if;

    first_segment := true;
    for segment_item in select value from jsonb_array_elements(change_item->'segments')
    loop
      if first_segment then
        update public.work_shifts set
          entry_type=segment_item->>'entryType',
          start_time=(segment_item->>'startTime')::time,
          end_time=(segment_item->>'endTime')::time,
          break_minutes=(segment_item->>'breakMinutes')::integer,
          approval_status='approved',approved_at=now(),approved_by=auth.uid()
        where id=current_shift.id;
        first_segment := false;
      else
        insert into public.work_shifts
          (employee_id,entry_type,shift_date,start_time,end_time,actual_start_time,actual_end_time,break_minutes,notes,created_by,approval_status,approved_at,approved_by)
        values
          (current_shift.employee_id,segment_item->>'entryType',current_shift.shift_date,
           (segment_item->>'startTime')::time,(segment_item->>'endTime')::time,null,null,
           (segment_item->>'breakMinutes')::integer,current_shift.notes,current_shift.created_by,
           'approved',now(),auth.uid());
      end if;
    end loop;
    applied_count := applied_count + 1;
  end loop;
  return applied_count;
end;
$$;

revoke all on function public.apply_shift_rebalance(jsonb) from public;
grant execute on function public.apply_shift_rebalance(jsonb) to authenticated;

comment on function public.apply_shift_rebalance(jsonb) is
  'Applica atomicamente una proposta verificata di conversione tra ore ordinarie ed EXTRA.';
