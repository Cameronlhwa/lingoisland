import localFont from "next/font/local";

// Self-hosted so builds never depend on fetching from Google Fonts.
// Variable-weight latin subset of Nunito (SIL Open Font License).
export const nunito = localFont({
  src: "./nunito-latin-variable.woff2",
  weight: "200 1000",
  style: "normal",
  display: "swap",
  variable: "--font-home-display",
});
