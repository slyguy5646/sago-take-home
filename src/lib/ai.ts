import { webSearch } from "@exalabs/ai-sdk";
import {
  FilePart,
  generateObject,
  Output,
  generateText,
  stepCountIs,
} from "ai";
import { z } from "zod/v4";
import { WebhookPayload } from "./resend";
import { prisma } from "./db";
import { anthropic } from "@ai-sdk/anthropic";
import { exa } from "./exa";
import { CompanyGetPayload } from "@/generated/prisma/models";
import { ScrapeRound } from "@/generated/prisma/client";

export async function checkIfUserIsWatchingCompanyAlready({
  userId,
  emailData,
  emailBody,
  files,
}: {
  userId: string;
  emailData: WebhookPayload["data"];
  emailBody: string;
  files?: FilePart[] | null;
}) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      companies: true,
    },
  });

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-5"),
    schema: z.object({
      isWatching: z.enum(["TRUE", "FALSE", "NOT_COMPANY"]),
      companyName: z.union([z.string(), z.null()]),
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
            If the email is about a company the user is already watching, return "TRUE" and the company name as provided to you.
            Return "FALSE" if the email is about a company the user is not watching.
            Return "NOT_COMPANY" if the email is not about a company at all.
            </IMPORTANT>
          `,
          },
          ...(files ? files : []),
        ],
      },
    ],
  });

  return object;
}

export async function newCompanyResearch({
  userId,
  emailData,
  emailBody,
  files,
}: {
  userId: string;
  emailData: WebhookPayload["data"];
  emailBody: string;
  files?: FilePart[] | null;
}) {
  const res = await generateText({
    model: anthropic("claude-sonnet-4-5"),
    onStepFinish: async (step) => {
      console.log("Step finished:", step.content);
      console.log("Step", step.sources);
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
            You are an assistant for a venture capital firm. You are part of a greater system where a VC sends an email with company information and the company information is ingested into a system. This system continually checks the company for progress and notifies the VC if they should be recondsidered for investment.

            You goal now is to extract company information from the provided email information/attachments and any web information you can find. You should find the name of the company, any logo url they have on their website, a brief description, their industry, their website url, and information on the founders including the following: name, a brief bio, twitter url, email address, and linkedin url. Also, the VC should've included it but extract a reason for not investing in the company if it's available.

            Here is the email information:
            Subject: ${emailData.subject}
            Body: ${emailBody}

            Make sure to check the web for anything you can't find in the email or attachments.

            Please return the information in the proper format.
          `,
          },
          ...(files ? files : []),
        ],
      },
    ],
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

    toolChoice: "required",

    experimental_output: Output.object({
      schema: z.object({
        name: z.string(),
        logoUrl: z.union([z.string(), z.null()]),
        description: z.string(),
        industry: z.string(),
        website: z.union([z.string(), z.null()]),
        reasonForNotInvesting: z.union([z.string(), z.null()]),
        founders: z.array(
          z.object({
            name: z.string(),
            bio: z.union([z.string(), z.null()]),
            twitter: z.union([z.string(), z.null()]),
            email: z.union([z.string(), z.null()]),
            linkedin: z.union([z.string(), z.null()]),
          })
        ),
      }),
    }),
    stopWhen: stepCountIs(3),
  });

  console.log(res.finishReason);

  return res.experimental_output;
}

export async function updatePreviousCompany({
  company,
  emailData,
  emailBody,
  files,
}: {
  company: CompanyGetPayload<{
    include: { founders: true };
  }>;
  emailData: WebhookPayload["data"];
  emailBody: string;
  files?: FilePart[] | null;
}) {
  const res = await generateText({
    model: anthropic("claude-sonnet-4-5"),
    onStepFinish: async (step) => {
      console.log("Step finished:", step.content);
      console.log("Step", step.sources);
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
            You are an assistant for a venture capital firm. You are part of a greater system where a VC sends an email with company information and the company information is ingested into a system. This system continually checks the company for progress and notifies the VC if they should be recondsidered for investment.

            Your goal now is to extract updated company information from the provided previous information and new information from this email information/attachments and any web information you can find. You should find the name of the company, any logo url they have on their website, a brief description, their industry, their website url, and information on the founders including the following: name, a brief bio, twitter url, email address, and linkedin url. Also, the VC should've included it but extract a reason for not investing in the company if it's available. Err on the side of staying with previous data if you're unsure.

            Here is the previous company information:
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

            Here is the email information:
            Subject: ${emailData.subject}
            Body: ${emailBody}

            Make sure to check the web for anything you can't find in the email or attachments.

            Please return the information in the proper format.
          `,
          },
          ...(files ? files : []),
        ],
      },
    ],
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

    toolChoice: "required",

    experimental_output: Output.object({
      schema: z.object({
        name: z.string(),
        logoUrl: z.union([z.string(), z.null()]),
        description: z.string(),
        industry: z.string(),
        website: z.union([z.string(), z.null()]),
        reasonForNotInvesting: z.union([z.string(), z.null()]),
        founders: z.array(
          z.object({
            name: z.string(),
            bio: z.union([z.string(), z.null()]),
            twitter: z.union([z.string(), z.null()]),
            email: z.union([z.string(), z.null()]),
            linkedin: z.union([z.string(), z.null()]),
          })
        ),
      }),
    }),
    stopWhen: stepCountIs(3),
  });

  return res.experimental_output;
}

// export async function findLinkedInProfile(name: string): Promise<string | null> {
//   "use step";

//   const searchResult = await webSearch({
//     query: `LinkedIn profile of ${name}`,
//     numResults: 1,
//   });

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

  return { financialInfo, companySentiment, customerInfo };
}

async function getResearchInfo(prompt: string) {
  const schema = z.object({
    information: z.string(),
  });

  const task = await exa.research.create({
    instructions: prompt,

    outputSchema: schema.toJSONSchema(),
  });

  const result = await exa.research.pollUntilFinished(task.researchId);

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
  const res = await generateObject({
    model: anthropic("claude-sonnet-4-5"),
    schema: z.object({
      shouldInvest: z.boolean(),
      reasoning: z.string(),
      outreachMessage: z.union([z.string(), z.null()]),
    }),
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

  return res.object
}
