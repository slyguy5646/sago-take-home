import { webSearch } from "@exalabs/ai-sdk";
import { FilePart, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ListAttachmentsResponseSuccess, Webhook } from "resend";
import { WebhookPayload } from "./resend";
import { prisma } from "./db";

export async function checkIfUserIsWatchingCompanyAlready({
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
  "use step";

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      companies: true,
    },
  });

  attachments?.data[0].download_url;

  const files = attachments?.data.map(
    (a) =>
      ({
        type: "file",
        data: a.download_url,
        mediaType: a.content_type,
        filename: a.filename,
      } satisfies FilePart)
  );

  const { object } = await generateObject({
    model: openai("gpt-5"),
    schema: z.object({
      isWatching: z.enum(["TRUE", "FALSE", "NOT_COMPANY"]),
    }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
            Your goal is the determine if the user is already watching/montioring the company mentioned in the email information below. You will be given a list of company names and brief descriptions about them and an email/attachments in that email that may contain information about a company. If the email is about a company that the user is already watching, return true. If not, return false. Always err on the side of false if you're unsure. Be heavily influenced by the company's name rather than the description. Let me give you an example: if the email specifically mentions "Airbnb" and the user is watching "Airbnb Inc.", you should return true, even if the description is different.

            Here are the companies the user is already watching:
            ${user?.companies
              .map(
                (company) => `- ${company.name}: ${company.description || ""}`
              )
              .join("\n")}

            Here is the email information:
            Subject: ${emailData.subject}
            Body: ${emailBody}

            <IMPORTANT>
            Return "NOT_COMPANY" if the email is not about a company at all.
            </IMPORTANT>
          `,
          },
          ...(files ? files : []),
        ],
      },
    ],
  });

  return object.isWatching;
}

export async function newCompanyResearch() {
  "use step";

  const { object } = await generateObject({
    model: openai("gpt-5"),
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(z.string()),
        steps: z.array(z.string()),
      }),
    }),
    prompt: "Generate a lasagna recipe.",
  });
}
