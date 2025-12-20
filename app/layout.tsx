import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lingo Island - From textbook Mandarin to your Mandarin",
  description:
    "Overcome the intermediate plateau. Daily review, stories, and topic-based vocab for A2-B2 learners.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
