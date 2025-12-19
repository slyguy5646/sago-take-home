import { CompanyGetPayload } from "@/generated/prisma/models";
import { sleep } from "workflow";
import { prisma } from "@/lib/db";
import { resend } from "@/lib/resend";
import { ScrapeRound } from "@/generated/prisma/client";
import { generateObject, generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import z from "zod/v4";
import { exa } from "../exa";
import { webSearch } from "@exalabs/ai-sdk";

export async function scheduleNewRound(
  company: CompanyGetPayload<{ include: { founders: true } }>
) {
  "use step";
  // get old round if exists, for the number and info
  const lastScrapeRound = await prisma.scrapeRound.findFirst({
    orderBy: {
      roundNumber: "desc",
    },
    where: {
      companyId: company.id,
    },
  });

  // schedule the "new" round
  const newRound = await prisma.scrapeRound.create({
    data: {
      company: { connect: { id: company.id } },
      roundNumber: (lastScrapeRound?.roundNumber || 0) + 1,
      scheduledFor: new Date(
        new Date().getTime() + 3 * 7 * 24 * 60 * 60 * 1000
      ),
      financialInfo: "",
      sentiment: "",
      customerInfo: "",
    },
  });

  return { lastScrapeRound, newRound };
}

export async function updateRound({
  newRound,
  financialInfo,
  companySentiment,
  customerInfo,
}: {
  newRound: ScrapeRound;
  financialInfo: string;
  companySentiment: string;
  customerInfo: string;
}) {
  "use step";
  const completedRound = await prisma.scrapeRound.update({
    where: { id: newRound.id },
    data: {
      financialInfo: financialInfo || "",
      sentiment: companySentiment || "",
      customerInfo: customerInfo || "",
      completed: true,
    },
  });

  return completedRound;
}

export async function notifyUserOfNewDecision({
  userId,
  company,
  reasoning,
  outreachMessage,
}: {
  userId: string;
  reasoning: string;
  outreachMessage: string;
  company: CompanyGetPayload<{ include: { founders: true } }>;
}) {
  "use step";
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return;

  await resend.emails.send({
    subject: `Updated Investment Decison`,
    to: [user.email],
    from: "Sago <companies@sago.lpm.sh>",
    text: `
        Hi ${user.name.split(" ")[0]},
        
        It looks like ${company.name} might be ready for another look!
        
        Investment reasoning: ${reasoning}

        Template outreach message: ${outreachMessage}

        View more info on Sago: https://sago.lpm.sh/dash/${company.id}
        `,
  });
}

export async function conductResearchRound(
  company: CompanyGetPayload<{ include: { founders: true } }>,
  previousRound?: ScrapeRound | null
) {
  "use step";
  const financialsPrompt = `Find the latest financial information for ${
    company.name
  }, the ${company.industry} startup.

           Company Info:
            Name: ${company.name}
            Description: ${company.description}
            Industry: ${company.industry}
            Website: ${company.website}
            Reason for not investing: ${company.reasonForNotInvesting}
            Logo URL: ${company.logoUrl}
            Founders: ${company.founders
              .map(
                (founder) =>
                  `- Name: ${founder.name}, Bio: ${founder.bio}, Twitter: ${founder.twitter}, Email: ${founder.email}, LinkedIn: ${founder.linkedin}`
              )
              .join("\n")}    
            ${
              previousRound
                ? `Your goal is to basically find any changes since we last evaluated this company's financial information when it was ${previousRound.financialInfo}`
                : ""
            }
    `;

  const sentimentPrompt = `Find the latest financial information for ${
    company.name
  }, the ${company.industry} startup.

           Company Info:
            Name: ${company.name}
            Description: ${company.description}
            Industry: ${company.industry}
            Website: ${company.website}
            Reason for not investing: ${company.reasonForNotInvesting}
            Logo URL: ${company.logoUrl}
            Founders: ${company.founders
              .map(
                (founder) =>
                  `- Name: ${founder.name}, Bio: ${founder.bio}, Twitter: ${founder.twitter}, Email: ${founder.email}, LinkedIn: ${founder.linkedin}`
              )
              .join("\n")}    
            ${
              previousRound
                ? `Your goal is to basically find any changes since we last evaluated this company's financial information when it was ${previousRound.financialInfo}`
                : ""
            }
    `;
  const customersPrompt = `Find the latest customer information for ${
    company.name
  }, the ${
    company.industry
  } startup. List any prominent customers and what they use the product for (guess if you can't find a definitive answer for what a specific customer uses the product for).

           Company Info:
            Name: ${company.name}
            Description: ${company.description}
            Industry: ${company.industry}
            Website: ${company.website}
            Reason for not investing: ${company.reasonForNotInvesting}
            Logo URL: ${company.logoUrl}
            Founders: ${company.founders
              .map(
                (founder) =>
                  `- Name: ${founder.name}, Bio: ${founder.bio}, Twitter: ${founder.twitter}, Email: ${founder.email}, LinkedIn: ${founder.linkedin}`
              )
              .join("\n")}    
            ${
              previousRound
                ? `Your goal is to basically find any changes since we last evaluated this company's cusotmer information when it was ${previousRound.customerInfo}`
                : ""
            }
    `;

  const [financialInfo, companySentiment, customerInfo] = await Promise.all([
    getResearchInfo(financialsPrompt),
    getResearchInfo(sentimentPrompt),
    getResearchInfo(customersPrompt),
  ]);

  console.log("Financial Info: ", financialInfo);
  console.log("Sentiment Info: ", companySentiment);
  console.log("Customer Info", customerInfo);

  return { financialInfo, companySentiment, customerInfo };
}

async function getResearchInfo(prompt: string) {
  "use step";
  const schema = z.object({
    information: z.string(),
  });

  const task = await exa.research.create({
    instructions: prompt,

    outputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Generated schema for Root",
      type: "object",
      properties: {
        information: {
          type: "string",
        },
      },
      required: ["information"],
    },
  });

  console.log("task: ", task);


  const result = await exa.research.pollUntilFinished(task.researchId);

  console.log("result: ", result)

  if (result.status == "completed") {
    const data = result.output.parsed as z.infer<typeof schema>;

    return data.information;
  }

  return null;
}

export async function makeInvestmentDecision(
  company: CompanyGetPayload<{ include: { founders: true } }>,
  oldScrapeRound: ScrapeRound,
  newScrapeRound: ScrapeRound
) {
  "use step";
  const res = await generateText({
    model: anthropic("claude-sonnet-4-5"),
    experimental_output: Output.object({
      schema: z.object({
        shouldInvest: z.boolean(),
        reasoning: z.string(),
        outreachMessage: z.union([z.string(), z.null()]),
      }),
    }),
    tools: {
      webSearch: webSearch({
        numResults: 3,
        userLocation: "US",
        // includeDomains: ["linkedin.com", "crunchbase.com"],
        contents: {
          text: {
            includeHtmlTags: false,
          },
        },
      }),
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
            You are an assistant at a venture capital firm. You help partners make investment decisons about companies they previously chose not to invest in, given new information. You'll be given general company information, financial info, public sentiment about the company, and some information about the company's customers. Your goal is to make an update decision of whether or not to invest. 
            Give your reasoning either way. Also, if your decison is yes, create an outreach message to the founders that could be used.  

            Here is the company information:
            Name: ${company.name}
            Description: ${company.description}
            Industry: ${company.industry}
            Website: ${company.website}
            Previous Reason for not investing: ${company.reasonForNotInvesting}

            Founders: ${company.founders
              .map(
                (founder) =>
                  `- Name: ${founder.name}, Bio: ${founder.bio}, Twitter: ${founder.twitter}, Email: ${founder.email}, LinkedIn: ${founder.linkedin}`
              )
              .join("\n")}

            
            <DateOfPreviousDecision>${oldScrapeRound.updatedAt.toString()}</DateOfPreviousDecision>

            <PreviousInformationWhenInitialDecisonWasMade>
              Financial Info When Initial Decison was Made: ${
                oldScrapeRound.financialInfo
              }
              Company Sentiment Info When Initial Decison was Made: ${
                oldScrapeRound.sentiment
              }
              Company Customer Info When Initial Decison was Made: ${
                oldScrapeRound.customerInfo
              }
            </PreviousInformationWhenInitialDecisonWasMade>


            <UpdatedInformationDate>${newScrapeRound.updatedAt.toString()}</UpdatedInformationDate>

            <UpdatedInformation>
              Updated Financial Info: ${newScrapeRound.financialInfo}
              Updated Company Sentiment Info: ${newScrapeRound.sentiment}
              Updated Company Customer Info: ${newScrapeRound.customerInfo}
            </UpdatedInformation>
          `,
          },
        ],
      },
    ],
  });

  return res.experimental_output;
}
