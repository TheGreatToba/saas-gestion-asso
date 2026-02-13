/**
 * Service d'envoi d'emails (vérification d'inscription, invitations).
 * En dev sans SMTP configuré, le lien est loggé en console.
 */

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.APP_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173");

export function getConfirmEmailUrl(token: string): string {
  const base = FRONTEND_URL.replace(/\/$/, "");
  return `${base}/confirm-email?token=${encodeURIComponent(token)}`;
}

export function getAcceptInviteUrl(token: string): string {
  const base = FRONTEND_URL.replace(/\/$/, "");
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envoie un email. Si SMTP n'est pas configuré (SMTP_HOST absent),
 * log le contenu en console (dev / test).
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { to, subject, html } = options;
  const smtpHost = process.env.SMTP_HOST;

  if (smtpHost) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT ?? "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? "noreply@socialaid.org",
        to,
        subject,
        html,
        text: options.text ?? html.replace(/<[^>]+>/g, ""),
      });
    } catch (err) {
      console.error("[email] SMTP send failed:", err);
      throw err;
    }
  } else {
    // Dev / pas de SMTP : log le lien ou le texte pour faciliter les tests
    console.log("[email] (no SMTP) would send:", { to, subject });
    const linkMatch = html.match(/href="([^"]+)"/);
    if (linkMatch?.[1]) {
      console.log("[email] Lien:", linkMatch[1]);
    }
  }
}

/**
 * Template email "Confirmez votre adresse email" (inscription).
 */
export async function sendConfirmEmailEmail(to: string, confirmUrl: string): Promise<void> {
  const subject = "Confirmez votre adresse email – SocialAid";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>Bonjour,</p>
  <p>Vous venez de créer un compte sur SocialAid. Pour activer votre compte, cliquez sur le lien ci-dessous :</p>
  <p><a href="${confirmUrl}" style="color: #2563eb;">Activer mon compte</a></p>
  <p>Si le lien ne s'ouvre pas, copiez-collez cette adresse dans votre navigateur :</p>
  <p style="word-break: break-all;">${confirmUrl}</p>
  <p>Ce lien expire sous 24 heures. Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.</p>
  <p>— L'équipe SocialAid</p>
</body>
</html>`;
  await sendEmail({ to, subject, html });
}

/**
 * Template email "Vous êtes invité à rejoindre SocialAid".
 */
export async function sendInvitationEmail(to: string, inviteUrl: string): Promise<void> {
  const subject = "Invitation à rejoindre SocialAid";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>Bonjour,</p>
  <p>Vous avez été invité à rejoindre la plateforme SocialAid. Pour activer votre compte et définir votre mot de passe, cliquez sur le lien ci-dessous :</p>
  <p><a href="${inviteUrl}" style="color: #2563eb;">Accepter l'invitation et créer mon mot de passe</a></p>
  <p>Si le lien ne s'ouvre pas, copiez-collez cette adresse dans votre navigateur :</p>
  <p style="word-break: break-all;">${inviteUrl}</p>
  <p>Ce lien expire sous 7 jours.</p>
  <p>— L'équipe SocialAid</p>
</body>
</html>`;
  await sendEmail({ to, subject, html });
}
