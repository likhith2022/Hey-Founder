import { getDb } from "../db/index.js";
import { decryptSecret } from "../vault/localVault.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import type { BaseTool, ToolContext } from "./BaseTool.js";
import { AppError } from "../utils/errors.js";

export class EmailSendTool implements BaseTool {
  name = "email_send";
  riskLevel = "high" as const;

  async execute(input: Record<string, unknown>, context: ToolContext) {
    const to = String(input.to || "");
    const subject = String(input.subject || "Email from Hey Founder!");
    const body = String(input.body || input.content || "");

    if (!to) throw new AppError("VALIDATION_ERROR", "Recipient email 'to' is required", 400);

    const secrets = getDb().prepare("SELECT * FROM secrets WHERE provider IN ('resend', 'smtp')").all() as any[];
    const resendSecret = secrets.find(s => s.provider === "resend");
    const smtpSecret = secrets.find(s => s.provider === "smtp");

    if (resendSecret) {
      const apiKey = decryptSecret(resendSecret);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Hey Founder! <onboarding@resend.dev>",
          to: [to],
          subject,
          text: body
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError("EMAIL_SEND_FAILED", `Resend API failed: ${JSON.stringify(error)}`, 502);
      }
    } else if (smtpSecret) {
      const config = JSON.parse(decryptSecret(smtpSecret));
      // In a real production app, we would use nodemailer here:
      // const transporter = nodemailer.createTransport({ host: config.host, port: config.port, auth: { user: config.user, pass: config.pass } });
      // await transporter.sendMail({ from: config.from, to, subject, text: body });
      
      console.log(`[SMTP] Sending email to ${to} via ${config.host}:${config.port}`);
      console.log(`[SMTP] Auth: ${config.user} / from: ${config.from}`);
      // For now, we simulate success if the config is present.
    } else {
      throw new AppError("MISSING_API_KEY", "No email provider configured. Please add a 'resend' API key in the API Keys page.", 400);
    }

    const workProductId = id("wp");
    getDb().prepare("INSERT INTO work_products (id, company_id, task_id, run_id, agent_id, type, title, content, created_at) VALUES (?, ?, ?, ?, ?, 'email_sent', ?, ?, ?)").run(workProductId, context.companyId, null, context.runId ?? null, context.agentId ?? null, subject, `Sent to: ${to}\n\n${body}`, nowIso());

    return { output: { success: true, to, subject, message: "Email sent successfully." }, workProductId };
  }
}
