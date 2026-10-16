"use client";

import Button, { type ButtonProps } from "@/components/ui/Button";

export default function SecondaryButton(
  props: Omit<ButtonProps, "variant" | "journeyTransition">,
) {
  return <Button variant="secondary" {...props} />;
}
