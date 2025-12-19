import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Settings } from "lucide-react";
import { CompanyRow } from "@/components/dash/CompanyRow";
import airbnb from "@/assets/airbnb.png";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/dash/CopyButton";
import { prisma } from "@/lib/db";

export default async function Dashboard() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const companies = await prisma.company.findMany({
    where: {
      user: { id: session?.user?.id },
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center px-2">
        <div className="text-2xl">Hi, {session?.user?.name.split(" ")[0]}</div>
        <Link href="/dash/settings">
          <Settings className="text-neutral-400 size-6" />
        </Link>
      </div>

      <div className="flex items-center gap-2 pt-4">
        <Input
          type="email"
          value={"companies@sago.lpm.sh"}
          disabled
          className="bg-neutral-50 font-mono text-sm cursor-not-allowed"
        />
        <CopyButton value={"companies@sago.lpm.sh"} />
      </div>

      <div className="mt-4">
        <div className="text-neutral-500 px-2">Companies</div>
        {companies.map((co) => <CompanyRow id={co.id} image={co.logoUrl || ""} name={co.name} key={co.id}/>)}
      </div>
    </div>
  );
}
