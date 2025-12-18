import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { CopyButton } from "@/components/dash/CopyButton";
import { SignOutButton } from "@/components/dash/SignOutButton";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return <div>Not authenticated</div>;
  }

  const user = session.user;
  const emailLocal = user.email.split("@")[0];
  const forwardingEmail = `${emailLocal}+companysago@forward.sago.app`;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-neutral-500 mt-2">
          Manage your account and preferences
        </p>
      </div>

      {/* Account Information Section */}
      <section className="space-y-6">
        <div className="border-b border-neutral-200 pb-4">
          <h2 className="text-xl font-semibold text-neutral-900">
            Account Information
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Your account details and profile information
          </p>
        </div>

        <div className="grid gap-6">
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Full Name
            </Label>
            <Input
              id="name"
              type="text"
              value={user.name || ""}
              disabled
              className="mt-2 bg-neutral-50 cursor-not-allowed"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="bg-neutral-50 cursor-not-allowed"
              />
              {user.emailVerified && (
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded whitespace-nowrap">
                  Verified
                </span>
              )}
            </div>
          </div>

          {user.createdAt && (
            <div>
              <Label htmlFor="created" className="text-sm font-medium">
                Member Since
              </Label>
              <Input
                id="created"
                type="text"
                value={new Date(user.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                disabled
                className="mt-2 bg-neutral-50 cursor-not-allowed"
              />
            </div>
          )}
        </div>
      </section>

      {/* Company Forwarding Email Section */}
      <section className="space-y-6">
        <div className="border-b border-neutral-200 pb-4">
          <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
            <Mail className="size-5" />
            Company Forwarding Email
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Forward company information and investment opportunities to this
            email address
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Use this email address to forward company information, pitch decks,
            or any details about companies you're tracking for potential
            investment.
          </p>

          <div className="flex items-center gap-2">
            <Input
              type="email"
              value={forwardingEmail}
              disabled
              className="bg-neutral-50 font-mono text-sm cursor-not-allowed"
            />
            <CopyButton value={forwardingEmail} />
          </div>
        </div>
      </section>

     <div className="w-full justify-end flex">
       <SignOutButton />
     </div>
    </div>
  );
}
