/**
 * Transactional email, sent through Resend's HTTP API (the same service Lenga Maps
 * uses). With no RESEND_API_KEY the send is skipped and logged, never thrown, so a
 * missing key can't break sign-up.
 *
 * Copy style: plain, warm, no em dashes in customer-facing text.
 */
import type { User } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase/server";
import { DAILY_MAP_LIMIT } from "@/lib/quota-rules";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://cartomapper.online").replace(/\/$/, "");
const FROM = process.env.RESEND_FROM || "CartoMapper <hello@cartomapper.online>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set; skipped:", msg.subject);
    return false;
  }
  try {
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) console.error("[email] Resend refused:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function welcomeEmail(to: string, firstName?: string | null): EmailMessage {
  const name = firstName?.trim() || "there";
  const cta = `${APP_URL}/create`;
  const text = `Hi ${name},

Welcome to CartoMapper. Your account is ready.

Describe any place on Earth in a sentence, add whatever data you have (a spreadsheet, a report, a list of towns), and CartoMapper draws it the way a printed atlas would: real terrain, rivers, place names and a legend that means something.

It's free. You can make up to ${DAILY_MAP_LIMIT} new maps a day, change them as often as you like, and download print-ready PDF and SVG files with no watermark. Every map is saved to My maps.

Make your first map: ${cta}

Happy mapping,
The CartoMapper team`;

  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Georgia,'Times New Roman',serif;">
<div style="display:none;max-height:0;overflow:hidden;">Your account is ready. Make up to ${DAILY_MAP_LIMIT} atlas-grade maps a day, free.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe5e2;">
  <tr><td style="background:#0e2620;padding:14px 20px;">
    <img src="${APP_URL}/brand/cartomapper-logo-reversed.png" alt="CartoMapper" width="220" style="display:block;border:0;max-width:220px;height:auto;">
  </td></tr>
  <tr><td style="padding:32px 32px 32px;">
    <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#111614;font-weight:600;">Welcome, ${esc(name)}.</h1>
    <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#46504c;">
      Your CartoMapper account is ready. Describe any place on Earth in a sentence, add whatever data you have, and
      CartoMapper draws it the way a printed atlas would: real terrain, rivers, place names and a legend that means something.
    </p>
    <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#46504c;">
      It's <strong style="color:#111614;">free</strong>. Make up to <strong style="color:#111614;">${DAILY_MAP_LIMIT} new maps a day</strong>,
      change them as often as you like, and download print-ready PDF and SVG files with no watermark.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#8b2e26;border-radius:999px;">
      <a href="${cta}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Make your first map</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="border-top:1px solid #dfe5e2;padding:18px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#7a7266;">
    You're receiving this because you created a CartoMapper account with ${esc(to)}. Questions? Just reply.
  </td></tr>
</table>
</td></tr></table></body></html>`;

  return { to, subject: `Welcome to CartoMapper, ${name}`, html, text };
}

/** A short email carrying a password-recovery code. */
export function resetCodeEmail(to: string, code: string, firstName?: string | null): EmailMessage {
  const name = firstName?.trim() || "there";
  const text = `Hi ${name},

Your CartoMapper code to reset your password is: ${code}

Enter it on the reset page, along with your new password. The code works once and expires in an hour.

If you didn't ask for this, you can ignore this email; your password stays the same.

The CartoMapper team`;
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Georgia,'Times New Roman',serif;">
<div style="display:none;max-height:0;overflow:hidden;">Your code: ${code}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dfe5e2;">
  <tr><td style="background:#0e2620;padding:14px 20px;">
    <img src="${APP_URL}/brand/cartomapper-logo-reversed.png" alt="CartoMapper" width="200" style="display:block;border:0;max-width:200px;height:auto;">
  </td></tr>
  <tr><td style="padding:32px;">
    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#111614;font-weight:600;">Reset your password</h1>
    <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#46504c;">
      Hi ${esc(name)}, here is your code. Enter it on the reset page with your new password.
    </p>
    <p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:34px;letter-spacing:10px;font-weight:bold;color:#1f5c4d;">${esc(code)}</p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#7a7266;">
      The code works once and expires in an hour. If you didn't ask for this, ignore this email; your password stays the same.
    </p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
  return { to, subject: `Your CartoMapper code: ${code}`, html, text };
}

/**
 * Send the welcome email once per new account. The profile row is claimed first
 * (welcome_email_sent_at set only where it's still empty), so two calls can never
 * send twice; accounts older than an hour are never "welcomed".
 */
export async function sendWelcomeIfNew(user: User): Promise<boolean> {
  const sb = getServiceSupabase();
  if (!sb || !user.email) return false;
  const age = Date.now() - new Date(user.created_at ?? 0).getTime();
  if (!(age >= 0 && age < 60 * 60 * 1000)) return false;

  const { data: claimed } = await sb
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("welcome_email_sent_at", null)
    .select("id");
  if (!claimed?.length) return false;

  const sent = await sendEmail(welcomeEmail(user.email, user.user_metadata?.first_name as string | undefined));
  // Couldn't send: release the claim so a later sign-in can try again.
  if (!sent) await sb.from("profiles").update({ welcome_email_sent_at: null }).eq("id", user.id);
  return sent;
}
