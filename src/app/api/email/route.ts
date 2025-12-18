import { NextRequest, NextResponse } from "next/server";
import { resend, WebhookPayload } from "@/lib/resend";
import {} from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ListAttachmentsResponseSuccess } from "resend";
import { webSearch } from "@exalabs/ai-sdk";
import { checkIfUserIsWatchingCompanyAlready } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();

    const result = (await resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id")!,
        timestamp: req.headers.get("svix-timestamp")!,
        signature: req.headers.get("svix-signature")!,
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    })) as WebhookPayload;

    if (result.type == "email.received") {
      const user = await prisma.user.findUnique({
        where: {
          email: result.data.from,
        },
      });

      if (!user) return new NextResponse();

      console.log("Found user:", user.name);
      const emailData = result.data;
      console.log("Received email:", emailData);

      let attachments: ListAttachmentsResponseSuccess | null = null;

      const { data: emailBody, error } = await resend.emails.receiving.get(
        emailData.email_id
      );

      if (error) {
        console.log("Error fetching email body:", error);
        return new NextResponse();
      }

      if (emailData.attachments.length > 0) {
        const { data: atchments, error } =
          await resend.emails.receiving.attachments.list({
            emailId: emailData.email_id,
          });

        if (error || !atchments) {
          console.log("Error fetching attachments:", error);
          return new NextResponse();
        }

        attachments = atchments;
      }

      workflow({
        userId: user.id,
        emailData: emailData,
        emailBody: emailBody.text!,
        attachments,
      });
    }

    return new NextResponse();
  } catch {
    return new NextResponse("Invalid webhook", { status: 400 });
  }
}

async function workflow({
  userId,
  emailData,
  emailBody,
  attachments,
}: {
  userId: string;
  emailData: WebhookPayload["data"];
  emailBody: string;
  attachments?: ListAttachmentsResponseSuccess | null;
}) {
  "use workflow";

  const status = await checkIfUserIsWatchingCompanyAlready({
    userId,
    emailData,
    emailBody,
    attachments,
  });

  console.log("status: ", status);

  // const research = await initialCompanyResearch();
}
