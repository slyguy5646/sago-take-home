import { NextRequest, NextResponse } from "next/server";
import { resend, WebhookPayload } from "@/lib/resend";
import {} from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ListAttachmentsResponseSuccess } from "resend";
import { webSearch } from "@exalabs/ai-sdk";
import {
  checkIfUserIsWatchingCompanyAlready,
  newCompanyResearch,
} from "@/lib/ai";
import { FilePart } from "ai";

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

      console.log("URL: ", attachments?.data[0].download_url);

      console.log(attachments?.data[0].download_url);

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

  // get the file's contents

  let files: Array<FilePart> = [];

  if (attachments) {
    for (const attachment of attachments.data) {
      const response = await fetch(attachment.download_url);
      if (!response.ok) {
        console.log(`Failed to download ${attachment.filename}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      files.push({
        type: "file",
        data: `data:${attachment.content_type};base64,${buffer.toString(
          "base64"
        )}`,
        mediaType: attachment.content_type,
        filename: attachment.filename,
      });
    }
  }

  // console.log(files);

  // return new NextResponse();

  const status = await checkIfUserIsWatchingCompanyAlready({
    userId,
    emailData,
    emailBody,
    files,
  });

  console.log("status: ", status);

  switch (status) {
    // if the company already is being watched
    case "TRUE":
      break;

    // if company is not being watched
    case "FALSE":
      const data = await newCompanyResearch({
        userId,
        emailData,
        emailBody,
        files,
      });

      await prisma.company.create({
        data: {
          name: data.name,
          description: data.description,
          industry: data.industry,
          website: data.website,
          founders: {
            createMany: {
              data: [
                ...data.founders.map((founder) => ({
                  name: founder.name,
                  bio: founder.bio,
                  twitter: founder.twitter,
                  email: founder.email,
                  linkedin: founder.linkedin,
                })),
              ],
            },
          },
          user: {
            connect: { id: userId },
          },
        },
      });

      await resend.emails.send({
        from: "Sago <companies@sago.lpm.sh>",
        to: emailData.from,
        subject: `Added company: ${data.name} to your watchlist`,
        headers: {
          "In-Reply-To": emailData.message_id,
        },
        text:
          "We've added the company you emailed about to your watchlist!\n\n" +
          `Company Name: ${data.name}\n` +
          `Description: ${data.description}\n` +
          `Industry: ${data.industry}\n` +
          (data.website ? `Website: ${data.website}\n` : "") +
          "Best,\nThe Sago Team",
      });

      console.log("Found company data: ", data);

      break;

    // if email is not about a company
    case "NOT_COMPANY":
      return new NextResponse();
      break;
  }

  // const research = await initialCompanyResearch();
}
