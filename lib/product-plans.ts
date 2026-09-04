/**
 * Product entitlements encoded on profiles.plan (no extra columns required):
 * - free  — neither product
 * - pro   — Islands only (legacy Stripe / manual grants)
 * - hsk   — HSK Prep only
 * - both  — Islands + HSK Prep
 */
export type ProductPlan = "free" | "pro" | "hsk" | "both";
export type BillableProduct = "core" | "hsk";

export function parseProductPlan(value: string | null | undefined): ProductPlan {
  if (value === "pro" || value === "hsk" || value === "both") return value;
  return "free";
}

export function hasIslandsAccess(plan: string | null | undefined): boolean {
  const p = parseProductPlan(plan);
  return p === "pro" || p === "both";
}

export function hasHskAccess(plan: string | null | undefined): boolean {
  const p = parseProductPlan(plan);
  return p === "hsk" || p === "both";
}

export function hasAnyProAccess(plan: string | null | undefined): boolean {
  return parseProductPlan(plan) !== "free";
}

/** Merge a newly purchased product into the existing plan. */
export function grantProduct(
  current: string | null | undefined,
  product: BillableProduct,
): ProductPlan {
  const islands = hasIslandsAccess(current) || product === "core";
  const hsk = hasHskAccess(current) || product === "hsk";
  if (islands && hsk) return "both";
  if (islands) return "pro";
  if (hsk) return "hsk";
  return "free";
}

/** Remove one product; leave the other intact if present. */
export function revokeProduct(
  current: string | null | undefined,
  product: BillableProduct,
): ProductPlan {
  const islands = hasIslandsAccess(current) && product !== "core";
  const hsk = hasHskAccess(current) && product !== "hsk";
  if (islands && hsk) return "both";
  if (islands) return "pro";
  if (hsk) return "hsk";
  return "free";
}

export function productLabel(product: BillableProduct): string {
  return product === "hsk" ? "HSK Prep" : "Islands";
}
