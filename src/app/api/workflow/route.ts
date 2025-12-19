import { startCompanyResearch } from "@/lib/continuous-research/workflow";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(req: NextRequest) {
  const user = await prisma.user.findFirst();

  if (!user) return new NextResponse();
  
  const company = await prisma.company.findFirst({
    include: { founders: true },
  });

  if (!company) return new NextResponse();

  await start(startCompanyResearch, [user.id, company]);

  return new NextResponse();
}
