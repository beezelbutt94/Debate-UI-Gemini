-- Compensating transaction for a campaign whose amplification never
-- reached the ad platform.
--
-- consume_credits() (0001_init.sql) decrements active_credits and creates
-- the campaign row in one transaction, on the assumption that the caller
-- then hands off to the distribution gateway. When that hand-off fails,
-- the credits have already been spent on nothing. Without this function
-- the only options at the call site are to leak the user's credits or to
-- issue a non-atomic multi-statement "undo" that can itself fail halfway
-- and leave the ledger disagreeing with the balance.
--
-- Idempotent: only a campaign still in 'pending' is refundable, and the
-- status flip and the balance restore happen in the same statement-level
-- transaction, so a retried call is a no-op rather than a double refund.

create or replace function public.fail_campaign_and_refund(
  p_campaign_id bigint,
  p_reason text
)
returns public.campaign_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaign_logs;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'refund_reason_required';
  end if;

  -- Locking the row first makes two concurrent refunds of the same
  -- campaign serialize; the second one finds status <> 'pending' and
  -- returns without touching the balance.
  select * into v_campaign
    from public.campaign_logs
    where id = p_campaign_id
    for update;

  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;

  if v_campaign.status <> 'pending' then
    -- Already settled (refunded, or the ad actually went live). Return
    -- current state so the caller can report it without re-crediting.
    return v_campaign;
  end if;

  update public.campaign_logs
    set status = 'failed'
    where id = p_campaign_id
    returning * into v_campaign;

  update public.users
    set active_credits = active_credits + v_campaign.credits_charged,
        updated_at = now()
    where id = v_campaign.user_id;

  insert into public.credit_ledger (user_id, delta, reason, campaign_log_id)
    values (
      v_campaign.user_id,
      v_campaign.credits_charged,
      'campaign_failed_refund:' || left(p_reason, 200),
      v_campaign.id
    );

  return v_campaign;
end;
$$;

-- Server-only. The API route that charged the credits is the one that
-- refunds them; a client must never be able to hand itself credits by
-- naming a campaign id.
revoke all on function public.fail_campaign_and_refund(bigint, text) from public, anon, authenticated;
grant execute on function public.fail_campaign_and_refund(bigint, text) to service_role;
