"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/sign-in";
          },
        },
      });
    } catch (error) {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="destructive"
      onClick={handleSignOut}
      disabled={isLoading}
      className="gap-2"
    >
      <LogOut className="size-4" />
      {isLoading ? "Signing out..." : "Sign Out"}
    </Button>
  );
}
