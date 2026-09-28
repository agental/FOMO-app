import { supabase } from '../lib/supabase';
import { loadValue, saveValue, removeValue } from '../utils/warmCache';

/*
  Launch Mode — the pre-launch countdown + referral system, entirely backend-driven.

  A single Supabase row (app_config) decides whether launch mode is on, when launch happens, the
  reward tiers, and whether to show social proof. Admin/reviewer accounts and users granted a bypass
  or early access skip it. The countdown is anchored to SERVER time (never the device clock).

  Everything here FAILS OPEN: if the state can't be fetched (offline / error), we return null and the
  caller sends the user straight into the app — launch mode must never lock anyone out.
*/

export interface RewardTier {
  count: number;   // referrals needed
  reward: string;  // human label (Hebrew)
}

export interface LaunchState {
  serverNowMs: number;   // server clock at fetch time (ms epoch)
  perfAtMs: number;      // performance.now() at fetch time (monotonic anchor, immune to clock changes)
  launchEnabled: boolean;
  launchAtMs: number | null;
  rewardTiers: RewardTier[];
  socialProofEnabled: boolean;
  signupCount: number | null;
  referralCode: string | null;
  referralCount: number;
  referredBy: string | null;
  earlyAccess: boolean;
  launchBypass: boolean;
  isAdmin: boolean;
}

const REF_KEY = 'pendingReferral';

/** The public web origin used for referral links. Query-param on root (Netlify has no SPA fallback,
 *  so a /path link would 404 — see the audit). */
const REFERRAL_ORIGIN = 'https://fomo-tal.netlify.app';

/** Read the launch state in one round-trip. Returns null on any failure (fail-open). */
export async function fetchLaunchState(): Promise<LaunchState | null> {
  try {
    const { data, error } = await supabase.rpc('get_launch_state');
    if (error || !data) return null;
    const d = data as Record<string, unknown>;
    const launchAt = d.launch_at ? Date.parse(String(d.launch_at)) : null;
    const serverNow = d.server_now ? Date.parse(String(d.server_now)) : Date.now();
    return {
      serverNowMs: Number.isFinite(serverNow) ? serverNow : Date.now(),
      perfAtMs: perfNow(),
      launchEnabled: !!d.launch_enabled,
      launchAtMs: launchAt != null && Number.isFinite(launchAt) ? launchAt : null,
      rewardTiers: normalizeTiers(d.reward_tiers),
      socialProofEnabled: !!d.social_proof_enabled,
      signupCount: typeof d.signup_count === 'number' ? d.signup_count : null,
      referralCode: (d.referral_code as string | null) ?? null,
      referralCount: typeof d.referral_count === 'number' ? d.referral_count : 0,
      referredBy: (d.referred_by as string | null) ?? null,
      earlyAccess: !!d.early_access,
      launchBypass: !!d.launch_bypass,
      isAdmin: !!d.is_admin,
    };
  } catch {
    return null;
  }
}

/** Should the launch screen be shown to this user right now? Server-decided; time from server. */
export function shouldShowLaunch(s: LaunchState): boolean {
  if (!s.launchEnabled) return false;
  if (s.isAdmin || s.launchBypass || s.earlyAccess) return false; // bypass roles skip the wait
  if (s.launchAtMs == null) return true;                          // enabled but no date = "coming soon"
  return currentServerMs(s) < s.launchAtMs;                       // still before the launch moment
}

/** Estimated current server time, advanced by a MONOTONIC clock so a user changing their device
 *  clock after load can't shorten (or freeze) the countdown. */
export function currentServerMs(s: LaunchState): number {
  return s.serverNowMs + (perfNow() - s.perfAtMs);
}

/** Milliseconds until launch (>= 0). Null when there's no date yet ("coming soon"). */
export function msUntilLaunch(s: LaunchState): number | null {
  if (s.launchAtMs == null) return null;
  return Math.max(0, s.launchAtMs - currentServerMs(s));
}

/** A shareable referral link for the given code (query param on root — Netlify-safe). */
export function buildReferralLink(code: string): string {
  return `${REFERRAL_ORIGIN}/?ref=${encodeURIComponent(code)}`;
}

// ── Referral attribution ─────────────────────────────────────────────────────────────────────────

/** Capture a `?ref=CODE` from the current URL and stash it (survives the OAuth reload), then strip it
 *  from the address bar so it isn't re-shared. Call as early as possible on boot. */
export function captureReferralFromUrl(): void {
  try {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (!code) return;
    saveValue(REF_KEY, code.trim().toUpperCase());
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch { /* ignore */ }
}

/** Attribute a pending referral once the user is authenticated. Server-verified: it guards
 *  self-referral / double-claim and increments the referrer's counter (never the client). */
export async function claimPendingReferral(): Promise<void> {
  const code = loadValue<string | null>(REF_KEY, null);
  if (!code) return;
  try {
    const { error } = await supabase.rpc('claim_referral', { p_code: code });
    // Clear on any DEFINITIVE server outcome (ok / self / already / notfound). Only a transport
    // error leaves it pending for the next attempt.
    if (!error) removeValue(REF_KEY);
  } catch { /* network error → keep for next attempt */ }
}

// ── helpers ────────────────────────────────────────────────────────────────────────────────────

function perfNow(): number {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function normalizeTiers(raw: unknown): RewardTier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      const o = t as Record<string, unknown>;
      return { count: Number(o?.count), reward: String(o?.reward ?? '') };
    })
    .filter((t) => Number.isFinite(t.count) && t.count > 0 && t.reward)
    .sort((a, b) => a.count - b.count);
}
