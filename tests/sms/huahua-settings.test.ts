import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  deleteHuahuaHistory,
  getHuahuaOverview,
  recordCountryInterest,
  updateHuahuaPreferences,
  validatePreferencesPatch,
} from "../../lib/sms/huahua/settings";
import { SmsPhoneError } from "../../lib/sms/phoneService";
import { connectLearner, createSmsTestContext, deliverWebhook, inboundText } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createSmsTestContext>>;
let ctx: Ctx;

before(async () => {
  ctx = await createSmsTestContext();
});

const ALL = ["friendly_friend", "focused_coach", "accountability_partner", "professional_partner"];

describe("preference validation", () => {
  it("maps website fields to stored preferences", () => {
    assert.deepEqual(
      validatePreferencesPatch(
        {
          persona: "focused_coach",
          correctionMode: "hint_first",
          daysPerWeek: 6,
          preferredDays: [5, 1, 1],
          openersPerWeek: null,
          deliveryWindows: [{ start: 420, end: 600 }],
          timezone: "America/Vancouver",
        },
        ALL,
      ),
      {
        persona: "focused_coach",
        correction_mode: "hint_first",
        days_per_week: 6,
        preferred_days: [1, 5],
        openers_per_week: null,
        delivery_windows: [{ start: 480, end: 600 }],
        timezone: "America/Vancouver",
      },
    );
  });

  it("rejects invalid values", () => {
    for (const patch of [
      { persona: "pirate" },
      { correctionMode: "harsh" },
      { daysPerWeek: 0 },
      { preferredDays: [7] },
      { deliveryWindows: [{ start: 1300, end: 1380 }] },
      { timezone: "Mars/Base" },
      {},
    ]) {
      assert.throws(() => validatePreferencesPatch(patch, ALL), SmsPhoneError, JSON.stringify(patch));
    }
  });

  it("only lets subscribers choose non-default personas", () => {
    assert.throws(
      () => validatePreferencesPatch({ persona: "focused_coach" }, ["friendly_friend"]),
      (error: unknown) => error instanceof SmsPhoneError && error.status === 403,
    );
  });
});

describe("Huahua overview", () => {
  it("shows the learner's own conversations, usage, and plan without provider details", async () => {
    const mine = await connectLearner(ctx);
    const theirs = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(mine.phone, "我的消息"));
    await deliverWebhook(ctx, inboundText(theirs.phone, "别人的消息"));

    const overview = await getHuahuaOverview(ctx.deps, mine.userId);
    const json = JSON.stringify(overview);
    assert.match(json, /我的消息/);
    assert.doesNotMatch(json, /别人的消息/);
    assert.doesNotMatch(json, new RegExp(theirs.phone.slice(-7)));
    assert.doesNotMatch(json, new RegExp(mine.phone.slice(-7)), "own number is masked");
    assert.doesNotMatch(json, /telnyx|segment/i);
    assert.equal(overview.plan.subscribed, true);
    assert.equal(overview.usage.showUpgrade, false);
    assert.deepEqual(overview.countries.enabled, ["CA", "US"]);
    assert.equal(overview.preferences.timezone, "America/Toronto");
  });

  it("updates preferences and returns the new overview", async () => {
    const learner = await connectLearner(ctx);
    const overview = await updateHuahuaPreferences(ctx.deps, learner.userId, {
      persona: "accountability_partner",
      daysPerWeek: 7,
    });
    assert.equal(overview.preferences.persona, "accountability_partner");
    assert.equal(overview.preferences.openersPerWeek, 5, "6–7 days → 5 texts a week");
  });

  it("deletes history from the overview", async () => {
    const learner = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(learner.phone, "删除我"));
    const after = await deleteHuahuaHistory(ctx.deps, learner.userId, true);
    assert.doesNotMatch(JSON.stringify(after.threads), /删除我/);
  });

  it("records interest only for countries that aren't available yet", async () => {
    const userId = await ctx.createUser();
    assert.deepEqual(await recordCountryInterest(ctx.deps, userId, "sg"), { ok: true, country: { code: "SG", name: "Singapore" } });
    await assert.rejects(recordCountryInterest(ctx.deps, userId, "CA"), SmsPhoneError);
    await assert.rejects(recordCountryInterest(ctx.deps, userId, "ZZ"), SmsPhoneError);
  });
});
