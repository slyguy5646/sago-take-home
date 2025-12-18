import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_KEY);

export interface WebhookPayload {
  created_at: string;
  data: Data;
  type: string;
}

interface Data {
  attachments: any[];
  bcc: any[];
  cc: any[];
  created_at: string;
  email_id: string;
  from: string;
  message_id: string;
  subject: string;
  to: string[];
}
