/**
 * Shared "glossy" visual tokens for the HSK prep funnel (landing page +
 * onboarding wizard + plan reveal). Same LingoIsland palette (navy #071E2E,
 * blue #2176AE, accent aqua #59C6DE→#2F9FD1, light blue #D6EEF8) as before — the change is
 * depth (gradients, layered shadows, glass surfaces) instead of flat fills.
 */

export const HSK_PAGE_GRADIENT =
  "radial-gradient(120% 100% at 50% -10%, #ffffff 0%, #EAF6FB 35%, #D6EEF8 70%, #C2E4F0 100%)";

export const HSK_SECTION_TINT_GRADIENT =
  "linear-gradient(180deg, #F7FBFD 0%, #EEF6FA 100%)";

export const HSK_CARD_SHADOW =
  "0 1px 2px rgba(7,30,46,0.05), 0 20px 40px -16px rgba(33,118,174,0.28)";

export const HSK_CARD_SHADOW_HOVER =
  "0 1px 2px rgba(7,30,46,0.06), 0 28px 56px -16px rgba(33,118,174,0.38)";

export const HSK_CARD_BORDER = "1px solid rgba(33,118,174,0.08)";

/** Blue-aqua accent — vertical glossy gradient, lighter top → hero blue bottom. */
export const LINGO_ACCENT_GRADIENT =
  "linear-gradient(180deg, #59C6DE 0%, #2176AE 100%)";

/** Dimensional variant with a mid stop for glossy chips and buttons. */
export const LINGO_ACCENT_GRADIENT_GLOSSY =
  "linear-gradient(180deg, #59C6DE 0%, #3A9FD0 42%, #2176AE 100%)";

export const LINGO_ACCENT_TINT = "rgba(89, 198, 222, 0.12)";
export const LINGO_ACCENT_BORDER = "rgba(33, 118, 174, 0.16)";
export const LINGO_ACCENT_SURFACE =
  "linear-gradient(160deg, #EAF6FB 0%, #DCEEF6 100%)";

export const LINGO_ACCENT_SHADOW =
  "0 12px 28px rgba(33,118,174,0.22), inset 0 1px 0 rgba(255,255,255,0.18)";

export const LINGO_ACCENT_CHIP_SHADOW =
  "0 4px 10px -4px rgba(33,118,174,0.35), inset 0 1px 0 rgba(255,255,255,0.22)";

export const LINGO_ACCENT_BTN_SHADOW =
  "0 12px 28px rgba(33,118,174,0.22), inset 0 1px 0 rgba(255,255,255,0.18)";

export const LINGO_ACCENT_BTN_SHADOW_HOVER =
  "0 16px 34px rgba(33,118,174,0.28), inset 0 1px 0 rgba(255,255,255,0.22)";

export const HSK_BADGE_GRADIENT = LINGO_ACCENT_GRADIENT_GLOSSY;

export const HSK_BADGE_SHADOW = "0 10px 22px -6px rgba(33,118,174,0.5)";

export const HSK_BTN_GRADIENT =
  "linear-gradient(135deg, #12314a 0%, #071E2E 100%)";

export const HSK_BTN_SHADOW = "0 14px 28px -8px rgba(7,30,46,0.45)";

export const HSK_BTN_SHADOW_HOVER = "0 18px 36px -8px rgba(7,30,46,0.55)";

export const HSK_ACCENT_GRADIENT = LINGO_ACCENT_GRADIENT;

export const HSK_ACCENT_SHADOW = "0 10px 24px -8px rgba(33,118,174,0.45)";
