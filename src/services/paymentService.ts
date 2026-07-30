import { supabase } from '../lib/supabase';

/* ============================================================================
   FOMO — payments client service

   Thin client wrapper over the payment Edge Functions + the two new tables
   (seller_accounts, payments). The client never talks to the payment provider
   (Grow/Meshulam) directly and never holds the secret key — every real action
   goes through an Edge Function that runs with the service-role key.

   The client can only READ its own seller account (RLS); all writes to
   seller_accounts / payments happen server-side.
   ============================================================================ */

export type SellerStatus = 'pending' | 'active' | 'restricted' | 'disabled';

export interface SellerAccount {
  id: string;
  user_id: string;
  provider: string;
  account_id: string | null;
  status: SellerStatus;
  payouts_enabled: boolean;
  details: Record<string, any>;
}

/** The organizer's payout account, or null if they've never started onboarding. */
export async function getMySellerAccount(userId: string): Promise<SellerAccount | null> {
  const { data, error } = await supabase
    .from('seller_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[payments] getMySellerAccount failed:', error);
    return null;
  }
  return (data as SellerAccount) ?? null;
}

/** True when the organizer can actually receive money (KYC passed + payouts on). */
export function isSellerReady(account: SellerAccount | null): boolean {
  return !!account && account.status === 'active' && account.payouts_enabled;
}

export interface OnboardingResult {
  /** Hosted onboarding URL to open in the system browser (bank + ID + KYC). */
  url?: string;
  /** Human-readable Hebrew error to show the organizer. */
  error?: string;
}

/**
 * Starts (or resumes) seller onboarding at the payment provider. Creates the
 * seller_accounts row server-side if needed and returns the provider's hosted
 * onboarding link. Needs the `payments-onboard-seller` Edge Function + Grow keys
 * to be configured; until then it returns a clear "not configured" message.
 */
export async function startSellerOnboarding(): Promise<OnboardingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('payments-onboard-seller', { body: {} });
    if (error) return { error: readFnError(error) };
    if (data?.url) return { url: data.url as string };
    return { error: data?.error || 'שירות התשלומים עדיין לא מוגדר. נסה שוב מאוחר יותר.' };
  } catch (e) {
    console.error('[payments] startSellerOnboarding failed:', e);
    return { error: 'שגיאה בחיבור לשירות התשלומים. בדוק את החיבור ונסה שוב.' };
  }
}

export interface CheckoutRequest {
  eventId: string;
  ticketLabel: string;
  quantity: number;
  // NOTE: the unit price is NOT sent — the Edge Function derives it server-side from the
  // event's ticket_types so a tampered client can't pay less than the real price.
}

export interface CheckoutResult {
  /** Hosted payment-page URL to open for the buyer, or an error. */
  url?: string;
  paymentId?: string;
  error?: string;
}

/**
 * Creates a checkout session for a ticket purchase. The Edge Function looks up the real
 * price, computes the platform fee + seller share, records a `payments` row (status
 * `created`), and returns the provider's hosted payment-page URL. Replaces the mock flow
 * in BookingFlow. Needs `payments-create-checkout` + Grow keys.
 */
export async function createTicketCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
  try {
    const { data, error } = await supabase.functions.invoke('payments-create-checkout', { body: req });
    if (error) return { error: readFnError(error) };
    if (data?.url) return { url: data.url as string, paymentId: data.paymentId };
    return { error: data?.error || 'לא ניתן לפתוח תשלום כרגע. נסה שוב מאוחר יותר.' };
  } catch (e) {
    console.error('[payments] createTicketCheckout failed:', e);
    return { error: 'שגיאה בפתיחת התשלום. בדוק את החיבור ונסה שוב.' };
  }
}

export type PaymentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'refunded' | 'released';

/** Reads the current status of a payment (RLS lets the buyer read their own). Used by
    BookingFlow to poll after the buyer is sent to the hosted payment page. */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
  const { data, error } = await supabase
    .from('payments').select('status').eq('id', paymentId).maybeSingle();
  if (error) { console.error('[payments] getPaymentStatus failed:', error); return null; }
  return (data?.status as PaymentStatus) ?? null;
}

/** Open an external (provider-hosted) URL. Matches the app's convention for https
    links so the Expo wrapper can hand it to the system browser. */
export function openHostedUrl(url: string): void {
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) window.location.href = url; // popup blocked / WebView — navigate instead
}

/** supabase.functions.invoke wraps non-2xx bodies in a FunctionsHttpError; pull the message. */
function readFnError(error: unknown): string {
  const anyErr = error as { message?: string; context?: { error?: string } };
  return anyErr?.context?.error || anyErr?.message || 'שירות התשלומים אינו זמין כרגע.';
}
