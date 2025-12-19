import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/sign-in");

  const company = await prisma.company.findUnique({
    where: {
      id,
    },
    include: {
      founders: true,
      scrapeRounds: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!company) redirect("/dash");

  return (
    <div className="space-y-8">
      {/* Header with back button */}
      <div className="flex  gap-4">
        <Link href="/dash" className="pt-1">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{company.name}</h1>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mt-1"
            >
              <Globe className="size-3" />
              {company.website.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          )}
        </div>
      </div>

      {/* Company Information */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">About</h2>
        {company.description ? (
          <p className="text-neutral-700 leading-relaxed">
            {company.description}
          </p>
        ) : (
          <p className="text-neutral-500 text-sm">No description available</p>
        )}
      </section>

      {/* Founders Section */}
      {company.founders.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Founders</h2>
          <div className="space-y-3">
            {company.founders.map((founder) => (
              <div
                key={founder.id}
                className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900">
                      {founder.name}
                    </p>
                    {founder.bio && (
                      <p className="text-sm text-neutral-600 mt-1">
                        {founder.bio}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {founder.email && (
                        <a
                          href={`mailto:${founder.email}`}
                          className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                        >
                          <Mail className="size-3" />
                          {founder.email}
                        </a>
                      )}
                      {founder.linkedin && (
                        <a
                          href={founder.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-500 hover:text-neutral-700"
                        >
                          LinkedIn
                        </a>
                      )}
                      {founder.twitter && (
                        <a
                          href={founder.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-500 hover:text-neutral-700"
                        >
                          Twitter
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Research Rounds Section */}
      {company.scrapeRounds.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Research Updates</h2>
          <div className="space-y-3">
            {company.scrapeRounds.map((round) => (
              <div
                key={round.id}
                className="border border-neutral-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-neutral-900">
                        Research Round {round.roundNumber}
                      </p>
                      {round.completed && (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 mt-2">
                      {round.financialInfo}
                    </p>
                    <p className="text-xs text-neutral-400 mt-2">
                      {new Date(round.updatedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reason for Not Investing Section */}
      {company.reasonForNotInvesting && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Reason for Not Investing</h2>
          <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
            <p className="text-neutral-700 leading-relaxed">
              {company.reasonForNotInvesting}
            </p>
          </div>
        </section>
      )}

      {/* Company Metadata */}
      <section className="border-t border-neutral-200 pt-8">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-4">
          Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Added
            </p>
            <p className="text-sm text-neutral-900">
              {new Date(company.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Last Updated
            </p>
            <p className="text-sm text-neutral-900">
              {new Date(company.updatedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
