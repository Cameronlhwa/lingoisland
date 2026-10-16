"use client";

import Button, { type ButtonProps } from "@/components/ui/Button";

export default function PrimaryButton(
  props: Omit<ButtonProps, "variant">,
) {
  return <Button variant="primary" {...props} />;
}
