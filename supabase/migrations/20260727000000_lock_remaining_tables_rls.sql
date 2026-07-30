/*
  # Close the remaining RLS holes (round 2)

  A second probe (after the admin/ownership fix) found more tables left wide open by the same
  blanket USING(true) policy:

    - event_join_requests — CRITICAL: any user could self-insert an APPROVED request (walk into any
      PAID event for free, skipping payment AND the organizer), self-approve their own request,
      forge paid_amount, and read everyone's requests (who paid what).
    - meetup_messages — anyone (even anon) could read every meetup's chat, and post AS someone else.
    - group_reactions — react AS another user.
    - group_channels — create arbitrary channels.
    - location_reviews / posts — readable by the anon key (bundle-key scraping). `posts` is unused
      by the app; locked down anyway.

  Fix: drop ALL policies on each table and rebuild correct owner/member/organizer-scoped ones.
  Writes that impersonate (sender_id / user_id / status) are checked against auth.uid(); join-request
  status changes are limited to the event's organizer. Reads are limited to the people who should see
  them. SECURITY DEFINER Edge Functions (payments-webhook) keep working — they use the service role
  and bypass RLS.

  Run once in the Supabase SQL Editor.
*/

do $$
declare t text; r record;
begin
  foreach t in array array['event_join_requests','group_channels','group_reactions','meetup_messages','location_reviews','posts'] loop
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ══ event_join_requests — the payment/approval gate ═════════════════════════════════════════════
-- READ: the requester, the event's organizer, or an admin.
create policy ejr_select on public.event_join_requests for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.events e where e.id = event_join_requests.event_id and e.user_id = auth.uid())
  or public.is_admin(auth.uid())
);
-- INSERT: only your OWN request, only as 'pending', and you cannot claim you paid — the webhook
-- (service role) is what records a paid request.
create policy ejr_insert on public.event_join_requests for insert to authenticated with check (
  user_id = auth.uid() and status = 'pending' and paid_amount is null
);
-- UPDATE (approve / reject): only the event's organizer or an admin. The requester cannot self-approve.
create policy ejr_update on public.event_join_requests for update to authenticated
  using (exists (select 1 from public.events e where e.id = event_join_requests.event_id and e.user_id = auth.uid()) or public.is_admin(auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_join_requests.event_id and e.user_id = auth.uid()) or public.is_admin(auth.uid()));
-- DELETE (cancel / remove): the requester, the organizer, or an admin.
create policy ejr_delete on public.event_join_requests for delete to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.events e where e.id = event_join_requests.event_id and e.user_id = auth.uid())
  or public.is_admin(auth.uid())
);

-- ══ group_channels — auto-created by clients; renames/deletes are admin-only (anti-griefing) ═════
create policy gc_select on public.group_channels for select to authenticated using (true);
create policy gc_insert on public.group_channels for insert to authenticated with check (true);
create policy gc_update on public.group_channels for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy gc_delete on public.group_channels for delete to authenticated using (public.is_admin(auth.uid()));

-- ══ meetup_messages — meetup members only; sender can't be forged ════════════════════════════════
create policy mm_select on public.meetup_messages for select to authenticated using (
  exists (select 1 from public.meetups m where m.id = meetup_messages.meetup_id and (
    m.user_id = auth.uid()
    or to_jsonb(m.attendees) ? (auth.uid())::text
    or to_jsonb(m.pending_requests) ? (auth.uid())::text))
);
create policy mm_insert on public.meetup_messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from public.meetups m where m.id = meetup_messages.meetup_id and (
    m.user_id = auth.uid() or to_jsonb(m.attendees) ? (auth.uid())::text))
);
create policy mm_delete on public.meetup_messages for delete to authenticated using (
  sender_id = auth.uid()
  or exists (select 1 from public.meetups m where m.id = meetup_messages.meetup_id and m.user_id = auth.uid())
  or public.is_admin(auth.uid())
);

-- ══ group_reactions — approved members of the message's channel; user_id can't be forged ═════════
create policy gr_select on public.group_reactions for select to authenticated using (
  exists (select 1 from public.group_messages gmsg
          join public.group_members gm on gm.channel_id::text = gmsg.channel_id::text
          where gmsg.id = group_reactions.message_id and gm.user_id::text = (auth.uid())::text and gm.status = 'approved')
);
create policy gr_insert on public.group_reactions for insert to authenticated with check (
  user_id::text = (auth.uid())::text
  and exists (select 1 from public.group_messages gmsg
              join public.group_members gm on gm.channel_id::text = gmsg.channel_id::text
              where gmsg.id = group_reactions.message_id and gm.user_id::text = (auth.uid())::text and gm.status = 'approved')
);
create policy gr_delete on public.group_reactions for delete to authenticated using (
  user_id::text = (auth.uid())::text or public.is_admin(auth.uid())
);

-- ══ location_reviews — read when signed in; write your own only ══════════════════════════════════
create policy lr_select on public.location_reviews for select to authenticated using (true);
create policy lr_insert on public.location_reviews for insert to authenticated with check (user_id = auth.uid());
create policy lr_update on public.location_reviews for update to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid())) with check (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy lr_delete on public.location_reviews for delete to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ══ posts — unused by the app; lock to signed-in reads + own-row writes ══════════════════════════
create policy posts_select on public.posts for select to authenticated using (true);
create policy posts_insert on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy posts_update on public.posts for update to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid())) with check (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy posts_delete on public.posts for delete to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

select 'FOMO round-2 lockdown applied ✓' as result;
