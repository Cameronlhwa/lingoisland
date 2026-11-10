import { notFound } from "next/navigation";
import HuahuaHarness from "./HuahuaHarness";

export const metadata = { robots: { index: false, follow: false } };

/** Dev-only page for browser tests of the Huahua UI with mocked APIs. */
export default function HuahuaHarnessPage({ searchParams }: { searchParams: { view?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <HuahuaHarness view={searchParams.view === "onboarding" ? "onboarding" : "settings"} />;
}
