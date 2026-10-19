-- Clear event/notification names for payment reviews:
-- "payment_verified" / "payment_rejected" (previously built by string
-- concatenation as "payment_verifyed"). No real data existed yet.
create or replace function public.admin_review_payment(
  p_payment_id bigint,
  p_decision text,
  p_verified_amount numeric default null,
  p_verified_on date default null,
  p_bank_reference text default null,
  p_reason text default null
)
returns public.commission_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.payment_records%rowtype;
  v_c public.commission_records%rowtype;
  v_to public.commission_status;
  v_total numeric;
  v_event text := case p_decision when 'verify' then 'payment_verified' when 'reject' then 'payment_rejected' end;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_event is null then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  select * into v_p from public.payment_records where id = p_payment_id for update;
  if not found or v_p.status <> 'reported' then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;
  select * into v_c from public.commission_records where id = v_p.commission_id for update;

  if p_decision = 'verify' then
    if p_verified_amount is null or p_verified_amount <= 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
    if p_verified_on is null then raise exception 'invalid_date' using errcode = 'P0001'; end if;
    if nullif(btrim(coalesce(p_bank_reference, '')), '') is null then raise exception 'reference_required' using errcode = 'P0001'; end if;
    update public.payment_records
    set status = 'verified', verified_amount = round(p_verified_amount, 3), verified_on = p_verified_on,
        bank_reference = btrim(p_bank_reference), verified_by = auth.uid(), verified_at = now()
    where id = v_p.id;
    v_total := v_c.amount_verified + round(p_verified_amount, 3);
  else
    if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required' using errcode = 'P0001'; end if;
    update public.payment_records
    set status = 'rejected', rejection_reason = left(btrim(p_reason), 1000), verified_by = auth.uid(), verified_at = now()
    where id = v_p.id;
    v_total := v_c.amount_verified;
  end if;

  v_to := case
    when v_total >= v_c.amount_due then 'payment_verified'::public.commission_status
    when v_c.status = 'disputed' then 'disputed'::public.commission_status
    when exists (select 1 from public.payment_records where commission_id = v_c.id and status = 'reported') then 'payment_reported'::public.commission_status
    else public.commission_due_status(v_c.due_date) end;
  update public.commission_records set amount_verified = v_total, status = v_to where id = v_c.id;

  perform public.log_commission_event(v_c.id, v_event, v_c.status, v_to,
                                      case when p_decision = 'verify' then round(p_verified_amount, 3) else null end,
                                      coalesce(p_bank_reference, p_reason));
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_event, 'payment', v_p.id::text,
          jsonb_build_object('commission_id', v_c.id, 'amount', p_verified_amount, 'reference', p_bank_reference, 'reason', p_reason));
  insert into public.notifications (user_id, type, data)
  values (v_c.seller_id, v_event, jsonb_build_object('commission_id', v_c.id));
  return v_to;
end;
$$;
