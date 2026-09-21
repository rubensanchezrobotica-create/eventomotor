import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomePage from "@/components/public/HomePage";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PreviewHomePage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return <HomePage />;
}
