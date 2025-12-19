import { CompanyGetPayload } from "@/generated/prisma/models";
import { sleep } from "workflow";
import { prisma } from "./db";
import { conductResearchRound, makeInvestmentDecision } from "./ai";
import { resend } from "./resend";

export async function startCompanyResearch(
  userId: string,
  company: CompanyGetPayload<{ include: { founders: true } }>
) {
  "use workflow";
  while (true) {
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

    console.log("about to sleep");
    await sleep("10min");

    const { financialInfo, companySentiment, customerInfo } =
      await conductResearchRound(company, lastScrapeRound);

    const completedRound = await prisma.scrapeRound.update({
      where: { id: newRound.id },
      data: {
        financialInfo: financialInfo || "",
        sentiment: companySentiment || "",
        customerInfo: customerInfo || "",
        completed: true,
      },
    });

    if (lastScrapeRound) {
      const decision = await makeInvestmentDecision(
        company,
        lastScrapeRound,
        completedRound
      );

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
        
        Investment reasoning: ${decision.reasoning}

        Template outreach message: ${decision.outreachMessage}

        View more info on Sago: https://sago.lpm.sh/dash/${company.id}
        `,
      });

      break;
    }

    console.log("finished research round!");
  }
}
