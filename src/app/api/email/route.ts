import { NextRequest, NextResponse } from "next/server";
import { resend, WebhookPayload } from "@/lib/resend";
import {} from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ListAttachmentsResponseSuccess } from "resend";
import { webSearch } from "@exalabs/ai-sdk";
import {
  checkIfUserIsWatchingCompanyAlready,
  conductResearchRound,
  newCompanyResearch,
  updatePreviousCompany,
} from "@/lib/ai";
import { FilePart } from "ai";
import { start } from "workflow/api";
import { Company } from "@/generated/prisma/client";
import { CompanyGetPayload } from "@/generated/prisma/models";
import { startCompanyResearch } from "@/lib/continuous-research";

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

      const company = await updateOrStartTrackingCompany({
        userId: user.id,
        emailData: emailData,
        emailBody: emailBody.text!,
        attachments,
      });

      if (!company) return new NextResponse();

      await start(startCompanyResearch, [user.id, company]);
    }

    return new NextResponse();
  } catch {
    return new NextResponse("Invalid webhook", { status: 400 });
  }
}

async function updateOrStartTrackingCompany({
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

  const { isWatching, companyName } = await checkIfUserIsWatchingCompanyAlready(
    {
      userId,
      emailData,
      emailBody,
      files,
    }
  );

  console.log("status: ", isWatching);

  let company: CompanyGetPayload<{ include: { founders: true } }> | null = null;

  switch (isWatching) {
    // if the company already is being watched
    case "TRUE":
      if (!companyName) return null;
      const previousCompany = await prisma.company.findFirst({
        where: {
          name: {
            equals: companyName,
            mode: "insensitive",
          },
          userId: userId,
        },
        include: {
          founders: true,
        },
      });

      if (!previousCompany) return null;

      const updatedCompanyData = await updatePreviousCompany({
        company: previousCompany,
        emailData,
        emailBody,
        files,
      });

      company = await prisma.company.update({
        where: {
          id: previousCompany.id,
        },
        data: {
          name: updatedCompanyData.name,
          description: updatedCompanyData.description,
          industry: updatedCompanyData.industry,
          website: updatedCompanyData.website,
          reasonForNotInvesting: updatedCompanyData.reasonForNotInvesting,
          logoUrl: updatedCompanyData.logoUrl,
          founders: {
            createMany: {
              data: [
                ...updatedCompanyData.founders.map((founder) => ({
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
        include: { founders: true },
      });

      await resend.emails.send({
        from: "Sago <companies@sago.lpm.sh>",
        to: emailData.from,
        subject: `Updated company: ${updatedCompanyData.name} on your watchlist`,
        headers: {
          "In-Reply-To": emailData.message_id,
        },
        text:
          "We've updated the company you emailed about on your watchlist!\n\n" +
          `Company Name: ${updatedCompanyData.name}\n` +
          `Description: ${updatedCompanyData.description}\n` +
          `Industry: ${updatedCompanyData.industry}\n` +
          (updatedCompanyData.website
            ? `Website: ${updatedCompanyData.website}\n`
            : "") +
          "Best,\nThe Sago Team",
      });

      return null;

      break;

    // if company is not being watched
    case "FALSE":
      const newCompanyData = await newCompanyResearch({
        userId,
        emailData,
        emailBody,
        files,
      });

      company = await prisma.company.create({
        data: {
          name: newCompanyData.name,
          description: newCompanyData.description,
          industry: newCompanyData.industry,
          website: newCompanyData.website,
          reasonForNotInvesting: newCompanyData.reasonForNotInvesting,
          logoUrl: newCompanyData.logoUrl,
          founders: {
            createMany: {
              data: [
                ...newCompanyData.founders.map((founder) => ({
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
        include: { founders: true },
      });

      await resend.emails.send({
        from: "Sago <companies@sago.lpm.sh>",
        to: emailData.from,
        subject: `Added company: ${newCompanyData.name} to your watchlist`,
        headers: {
          "In-Reply-To": emailData.message_id,
        },
        text:
          "We've added the company you emailed about to your watchlist!\n\n" +
          `Company Name: ${newCompanyData.name}\n` +
          `Description: ${newCompanyData.description}\n` +
          `Industry: ${newCompanyData.industry}\n` +
          (newCompanyData.website
            ? `Website: ${newCompanyData.website}\n`
            : "") +
          "Best,\nThe Sago Team",
      });

      console.log("Found company data: ", newCompanyData);

      break;

    // if email is not about a company
    case "NOT_COMPANY":
      return null;
      break;
  }

  return company;
}
