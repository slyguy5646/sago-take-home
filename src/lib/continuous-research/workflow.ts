import { sleep } from "workflow";
import {
  scheduleNewRound,
  updateRound,
  notifyUserOfNewDecision,
  conductResearchRound,
  makeInvestmentDecision,
} from "./steps";

export async function startCompanyResearch(userId: string, company: any) {
  "use workflow";
  while (true) {
    const { lastScrapeRound, newRound } = await scheduleNewRound(company);

    console.log("about to sleep");
    await sleep("1min");

    const { financialInfo, companySentiment, customerInfo } =
      await conductResearchRound(company, lastScrapeRound);

    if (!financialInfo || !companySentiment || !customerInfo) continue;

    const completedRound = await updateRound({
      newRound,
      companySentiment,
      financialInfo,
      customerInfo,
    });

    if (lastScrapeRound) {
      const decision = await makeInvestmentDecision(
        company,
        lastScrapeRound,
        completedRound
      );

      if (!decision.shouldInvest || !decision.outreachMessage) continue;

      await notifyUserOfNewDecision({
        userId,
        company,
        reasoning: decision.reasoning,
        outreachMessage: decision.outreachMessage,
      });

      break;
    }

    console.log("finished research round!");
  }
}
