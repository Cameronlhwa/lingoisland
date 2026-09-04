import "server-only";

import { NextResponse } from "next/server";
import { getEntitlements, type ProductAccess } from "@/lib/entitlements";

/**
 * Returns a standardized 403 response if a signed-in user lacks the requested
 * product. Call this in every product API after authentication and before
 * reading or mutating product data.
 */
export async function denyWithoutProductAccess(
  userId: string,
  product: ProductAccess,
): Promise<NextResponse | null> {
  const entitlements = await getEntitlements(userId);
  const allowed =
    product === "core" ? entitlements.isIslandsPro : entitlements.isHskPro;
  if (allowed) return null;

  const label = product === "core" ? "Islands" : "HSK Prep";
  return NextResponse.json(
    {
      error: `A ${label} subscription is required`,
      code: "PRODUCT_ACCESS_REQUIRED",
      product,
    },
    { status: 403 },
  );
}
