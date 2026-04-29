import type { BaseTool, ToolContext, ToolResult } from "./BaseTool.js";
import { AppError } from "../utils/errors.js";
import { decryptSecret } from "../vault/localVault.js";
import { getDb } from "../db/index.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";

export class EmailOutreachTool implements BaseTool {
  name = "email_outreach";
  riskLevel = "medium" as const; // Outreach has reputational risk

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const to = String(input.to ?? "");
    const subject = String(input.subject ?? "");
    const body = String(input.body ?? "");
    const leadId = input.lead_id ? String(input.lead_id) : null;

    if (!to || !subject || !body) {
      throw new AppError("VALIDATION_ERROR", "Recipient, subject, and body are required", 400);
    }

    const db = getDb();
    
    // Check for Resend API Key first
    const resendSecret = db.prepare("SELECT * FROM secrets WHERE provider = 'resend'").get() as any;
    
    if (resendSecret) {
      const apiKey = decryptSecret(resendSecret);
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Acme <onboarding@resend.dev>", // Default for free tier, should be configurable
            to: [to],
            subject: subject,
            text: body
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (leadId) {
            db.prepare("UPDATE leads SET status = 'contacted', updated_at = ? WHERE id = ?").run(nowIso(), leadId);
          }
          return { output: { success: true, messageId: data.id, message: "Email sent successfully via Resend." } };
        } else {
          const err = await response.json();
          return { output: { success: false, error: err } };
        }
      } catch (err) {
        console.error("Resend send failed", err);
      }
    }

    // Fallback: SMTP (Simulated if no key, but would use nodemailer in real prod)
    // For now, if no key, we return a "Simulated" result
    return { 
      output: { 
        success: true, 
        simulated: true, 
        message: "SMTP not configured. Email simulated (check logs). Connect Resend in API Keys for real outreach.",
        content: { to, subject, body }
      } 
    };
  }
}
