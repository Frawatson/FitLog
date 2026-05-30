// Static legal pages served at /privacy and /terms.
//
// These are intentionally plain HTML — no React, no SPA bundle — so the
// pages load instantly, are crawlable, and survive even if the web
// bundle is broken. The CSP in server/index.ts allows inline styles, so
// the embedded <style> block is fine.
//
// NOTE: the copy below is a working draft. Before App Store / Play
// Store submission, have a qualified attorney review it for your
// specific jurisdiction. The on-page disclaimer reflects that.

const LAST_UPDATED = "May 28, 2026";

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · Gbolo</title>
<meta name="description" content="${title} for Gbolo Fitness and Nutrition." />
<meta name="theme-color" content="#1B3A27" />
<link rel="icon" href="/favicon.ico" />
<style>
  :root { --brand: #1B3A27; --accent: #00D084; --text: #0F1A12; --muted: #5C6B5F; --bg: #FFFFFF; --surface: #F7F8F7; --line: #E5E8E5; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.6; }
  header { border-bottom: 1px solid var(--line); }
  header .wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
  header a { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; color: var(--text); }
  header .logo { width: 36px; height: 36px; border-radius: 10px; background: var(--brand); position: relative; }
  header .logo::after { content: ""; position: absolute; top: 13px; left: 13px; width: 10px; height: 10px; border-radius: 999px; background: var(--accent); }
  header .brand { font-weight: 700; font-size: 18px; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 24px 96px; }
  h1 { font-size: 32px; margin: 0 0 8px; }
  .updated { color: var(--muted); font-size: 14px; margin: 0 0 32px; }
  h2 { font-size: 20px; margin: 40px 0 12px; }
  p, li { font-size: 16px; }
  ul { padding-left: 20px; }
  a { color: var(--brand); }
  .disclaimer { margin-top: 48px; padding: 16px 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--muted); font-size: 14px; }
  footer { border-top: 1px solid var(--line); }
  footer .wrap { max-width: 720px; margin: 0 auto; padding: 24px; color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
  footer a { color: var(--muted); }
  footer .spacer { flex: 1; }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <a href="/">
      <div class="logo"></div>
      <span class="brand">Gbolo</span>
    </a>
  </div>
</header>
<main>
  <h1>${title}</h1>
  <p class="updated">Last updated: ${LAST_UPDATED}</p>
  ${body}
</main>
<footer>
  <div class="wrap">
    <a href="/">Home</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <span class="spacer"></span>
    <span>© 2026 Gbolo Fitness &amp; Nutrition</span>
  </div>
</footer>
</body>
</html>`;
}

export function privacyHtml(): string {
  const body = `
<h2>1. Information we collect</h2>
<ul>
  <li><strong>Account information.</strong> Email address and display name when you register.</li>
  <li><strong>Optional profile data.</strong> Age, sex, height, weight, weight goal, training experience, fitness goal, and activity level — used to compute personalized calorie and macro targets.</li>
  <li><strong>Activity logs.</strong> Workouts (exercises, sets, reps, weights), runs, body weight entries over time, and food log entries.</li>
  <li><strong>Photos.</strong> Food photos you submit for AI macro estimation, optional profile avatar, and optional photos attached to social posts.</li>
  <li><strong>Location.</strong> Only while you are actively recording a run, and only with your explicit permission. Used to map the route, compute distance, and estimate pace.</li>
  <li><strong>Notification preferences.</strong> Whether you have opted into workout reminders or streak alerts, and the time of day you have chosen.</li>
  <li><strong>Technical data.</strong> Session cookies and authentication tokens used to keep you signed in, plus standard server logs (timestamps, request paths) used for security and debugging.</li>
</ul>

<h2>2. How we use it</h2>
<ul>
  <li>To provide the core fitness, run, and nutrition tracking features.</li>
  <li>To estimate calories and macros from a food photo you submit (the image is sent to a third-party AI provider for analysis — see Section 3).</li>
  <li>To send transactional email such as confirmation links and password reset codes (via the email provider in Section 3).</li>
  <li>To deliver the local notifications you opt into.</li>
  <li>To maintain account security, prevent abuse, and improve reliability.</li>
</ul>
<p>We do not sell your personal information. We do not show third-party advertising.</p>

<h2>3. Third-party services we use</h2>
<ul>
  <li><strong>OpenAI-compatible vision API.</strong> When you submit a food photo, the image bytes are sent to an OpenAI-compatible inference endpoint to estimate calories and macros. The provider's own retention policies apply at their end.</li>
  <li><strong>Resend.</strong> Transactional email (account confirmation, password reset). Your email address is shared for the purpose of sending the message.</li>
  <li><strong>Railway.</strong> Server hosting and the Postgres database that holds your account data and activity logs.</li>
  <li><strong>Expo / Apple / Google.</strong> Native app delivery, push notification infrastructure, and platform crash reporting if you have it enabled in your device settings.</li>
</ul>
<p>Each provider has its own privacy policy on its website.</p>

<h2>4. Data retention and deletion</h2>
<p>We keep your account data while your account is active. You can request a copy of your data any time using <strong>Export Data</strong> in Settings, which produces a CSV file. You can permanently delete your account from <strong>Profile → Delete Account</strong>; deletion is irreversible and removes your account record along with all associated workouts, runs, food logs, body weight history, posts, and comments.</p>

<h2>5. Security</h2>
<p>Passwords are stored as bcrypt hashes — we cannot read your password. All network traffic between the app and our servers is encrypted with TLS. Session cookies are <code>httpOnly</code> and marked <code>Secure</code> in production. No system is perfectly secure; if you believe your account has been compromised, change your password and email <a href="mailto:support@gbolo.fit">support@gbolo.fit</a> immediately.</p>

<h2>6. Children</h2>
<p>Gbolo is not directed to children under 13. We do not knowingly collect personal information from anyone under 13. If you believe a child has provided us their information, email <a href="mailto:support@gbolo.fit">support@gbolo.fit</a> and we will delete it.</p>

<h2>7. Changes to this policy</h2>
<p>We may update this policy from time to time. Material changes will be announced in the app or via email. The "Last updated" date above always reflects the current version.</p>

<h2>8. Contact</h2>
<p>Questions or requests: <a href="mailto:support@gbolo.fit">support@gbolo.fit</a>.</p>

<div class="disclaimer">
  This document is provided as a working draft. It is not legal advice. Before launching in any jurisdiction, have a qualified attorney review it for your specific situation.
</div>
`;
  return layout("Privacy Policy", body);
}

export function termsHtml(): string {
  const body = `
<h2>1. Acceptance</h2>
<p>By creating a Gbolo account or using the Gbolo apps, you agree to these terms. If you do not agree, do not use the service.</p>

<h2>2. Eligibility</h2>
<p>You must be at least 13 years old to use Gbolo. By creating an account you confirm you meet this requirement and that the information you provide is accurate.</p>

<h2>3. Your account</h2>
<p>You are responsible for keeping your password secure and for activity that happens under your account. Notify us at <a href="mailto:support@gbolo.fit">support@gbolo.fit</a> as soon as you suspect unauthorized access. You may delete your account from <strong>Profile → Delete Account</strong> at any time.</p>

<h2>4. Acceptable use</h2>
<p>You agree not to:</p>
<ul>
  <li>Use Gbolo to harass, threaten, impersonate, or violate the rights of others.</li>
  <li>Upload content that is unlawful, infringing, or that depicts minors in a sexual context.</li>
  <li>Attempt to break, probe, or overload the service — including scraping, automated abuse, or bypassing rate limits.</li>
  <li>Reverse engineer the app or access non-public APIs except as permitted by law.</li>
  <li>Misrepresent food photo submissions or AI output as medical or professional dietary advice.</li>
</ul>
<p>We may suspend or terminate accounts that violate these rules.</p>

<h2>5. Your content</h2>
<p>You own the content you log and post (workouts, runs, food entries, photos, posts, comments). By submitting content you grant Gbolo a non-exclusive, worldwide license to store, display, process, and back up that content for the purpose of operating the service. You can delete your content at any time; deletion ends our license for the deleted content (with reasonable allowance for backup retention).</p>

<h2>6. AI-generated content</h2>
<p>Food photo analysis is performed by an AI model and is provided as an estimate. Macro and calorie values are approximate and may be wrong. Always review and edit values before saving if accuracy matters to you. Gbolo is not responsible for outcomes that result from relying on AI-generated estimates.</p>

<h2>7. Fitness disclaimer</h2>
<p>Gbolo is a tracking and reminder tool. It is not a substitute for professional medical, nutritional, or fitness advice. Consult a qualified healthcare provider before beginning any new exercise or diet program, especially if you have a medical condition, are pregnant, or are recovering from injury.</p>

<h2>8. Service availability</h2>
<p>The service is provided "as is" and "as available." We do not guarantee uninterrupted service, freedom from bugs, or that data will never be lost. We make reasonable efforts to maintain backups and uptime but offer no formal SLA.</p>

<h2>9. Intellectual property</h2>
<p>The Gbolo name, logo, app design, and software are owned by us. These terms do not grant you any right to use the Gbolo brand outside of using the app itself.</p>

<h2>10. Limitation of liability</h2>
<p>To the maximum extent permitted by law, Gbolo and its operators are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits or lost data, arising out of or related to your use of the service. Our total liability for any claim arising out of these terms is limited to the greater of (a) the amount you paid us in the twelve months before the claim, or (b) USD 50.</p>

<h2>11. Changes to these terms</h2>
<p>We may update these terms from time to time. Material changes will be announced in the app or via email. Continued use of the service after the changes take effect constitutes acceptance.</p>

<h2>12. Termination</h2>
<p>You may stop using Gbolo and delete your account at any time. We may suspend or terminate accounts that violate these terms or that pose a security risk. Sections that by their nature should survive termination (intellectual property, limitation of liability, etc.) will survive.</p>

<h2>13. Contact</h2>
<p>Questions about these terms: <a href="mailto:support@gbolo.fit">support@gbolo.fit</a>.</p>

<div class="disclaimer">
  This document is provided as a working draft. It is not legal advice. Before launching in any jurisdiction, have a qualified attorney review it for your specific situation.
</div>
`;
  return layout("Terms of Service", body);
}
