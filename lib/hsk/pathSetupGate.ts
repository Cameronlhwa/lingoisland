/**
 * Whether an HSK-track user still needs to answer the curriculum-critical
 * onboarding questions before "My HSK Path" can be built. Used to decide when to
 * show the blocking HskPathSetupModal.
 *
 * The paid-product check is done separately (server layout / entitlements); this
 * is purely about missing curriculum inputs.
 */
export type PathSetupProfile = {
  hsk_target_level?: number | null;
  interests?: string[] | null;
  hsk_personalization_text?: string | null;
  active_curriculum_id?: string | null;
};

export function needsPathSetup(
  profile: PathSetupProfile | null | undefined,
): boolean {
  if (!profile) return true;
  if (profile.active_curriculum_id) return false;
  if (profile.hsk_target_level == null) return true;
  if (!profile.interests || profile.interests.length < 5) return true;
  if (
    typeof profile.hsk_personalization_text !== "string" ||
    profile.hsk_personalization_text.trim().length === 0
  ) {
    return true;
  }
  return false;
}

export const PATH_SETUP_PROFILE_COLUMNS =
  "hsk_target_level, interests, hsk_personalization_text, active_curriculum_id";
