import Image from "next/image";
import { redirect } from "next/navigation";

export default async function Home() {
  redirect("/sign-in");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black"></div>
  );
}
