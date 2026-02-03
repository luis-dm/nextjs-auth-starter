export const dynamic = "force-dynamic"; // This disables SSG and ISR

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // If not logged in, redirect to login page
  if (!session) {
    redirect("/login");
  }

  // If logged in, redirect to facility page
  redirect("/org/facility");
}
