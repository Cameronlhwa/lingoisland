import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { SMS_CONSENT_VERSION } from "../../lib/sms/consent";
import { SMS_WELCOME_MESSAGE } from "../../lib/sms/messages";
import {
  disconnectPhone,
  resendVerification,
  sendWelcome,
  setTextingPaused,
  SmsPhoneError,
  startVerification,
  verifyPhoneCode,
} from "../../lib/sms/phoneService";
import { SmsSendError } from "../../lib/sms/types";
import { createSmsTestContext } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createSmsTestContext>>;

let ctx: Ctx;
let phoneCounter = 0;

/** Fresh, valid Toronto numbers so tests do not collide. */
function nextPhone() {
  phoneCounter += 1;
  return `+1416${String(2000000 + phoneCounter)}`;
}

function start(userId: string, phoneNumber: string, overrides: Record<string, unknown> = {}) {
  return startVerification(ctx.deps, {
    userId,
    ip: `10.0.0.${phoneCounter % 250}`,
    country: "CA",
    phoneNumber,
    consent: true,
    consentVersion: SMS_CONSENT_VERSION,
    source: "account_settings",
    ...overrides,
  });
}

function verify(userId: string, code: string | null, confirmTransfer = false) {
  return verifyPhoneCode(ctx.deps, {
    userId,
    code,
    confirmTransfer,
    displayName: "Cam",
    languageLevel: "A2",
  });
}

async function expectSmsError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SmsPhoneError, `expected SmsPhoneError, got ${error}`);
    assert.equal(error.code, code);
    return true;
  });
}

async function verifiedUser(phone = nextPhone()) {
  const userId = await ctx.createUser();
  await start(userId, phone);
  await verify(userId, ctx.provider.lastCode());
  return { userId, phone };
}

function sentTo(phone: string) {
  return ctx.provider.sent.filter((message) => message.to === phone);
}

async function ageLastSend(userId: string, seconds: number) {
  await ctx.db.query(
    `update sms_phone_verifications set last_sent_at = now() - make_interval(secs => $2)
     where user_id = $1 and verified_at is null and invalidated_at is null`,
    [userId, seconds],
  );
}

before(async () => {
  ctx = await createSmsTestContext();
});

describe("starting verification", () => {
  it("texts a 6-digit code and stores only its hash", async () => {
    const userId = await ctx.createUser();
    const phone = nextPhone();
    const result = await start(userId, phone);

    const code = ctx.provider.lastCode();
    assert.match(code ?? "", /^\d{6}$/);
    assert.equal(sentTo(phone).length, 1);
    assert.equal(result.state.pending?.maskedNumber.endsWith(phone.slice(-4)), true);
    assert.ok(!JSON.stringify(result.state).includes(phone), "state never exposes the full number");

    const { rows } = await ctx.db.query<{ code_hash: string; expires_at: Date }>(
      "select code_hash, expires_at from sms_phone_verifications where user_id = $1",
      [userId],
    );
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].code_hash, code);
    assert.ok(!rows[0].code_hash.includes(code!));
    const ttlMs = rows[0].expires_at.getTime() - Date.now();
    assert.ok(ttlMs > 9 * 60_000 && ttlMs <= 10 * 60_000, "expires in about 10 minutes");
  });

  it("requires explicit consent for the current consent version", async () => {
    const userId = await ctx.createUser();
    await expectSmsError(start(userId, nextPhone(), { consent: false }), "consent_required");
    await expectSmsError(start(userId, nextPhone(), { consent: "true" }), "consent_required");
    await expectSmsError(start(userId, nextPhone(), { consentVersion: "old" }), "consent_required");
  });

  it("validates numbers and supported countries", async () => {
    const userId = await ctx.createUser();
    await expectSmsError(start(userId, "555"), "invalid_phone");
    await expectSmsError(start(userId, "+44 7911 123456"), "unsupported_country");
    await expectSmsError(start(userId, "+1 800 555 0100"), "not_mobile");
  });

  it("is unavailable when SMS is not configured", async () => {
    const userId = await ctx.createUser();
    const deps = { ...ctx.deps, config: { ...ctx.deps.config, enabled: false } };
    await assert.rejects(
      startVerification(deps, {
        userId,
        ip: null,
        country: "CA",
        phoneNumber: nextPhone(),
        consent: true,
        consentVersion: SMS_CONSENT_VERSION,
        source: "onboarding",
      }),
      (error: unknown) => error instanceof SmsPhoneError && error.code === "sms_unavailable",
    );
  });

  it("rate-limits sends per user", async () => {
    const userId = await ctx.createUser();
    for (let i = 0; i < 5; i += 1) await start(userId, nextPhone());
    await expectSmsError(start(userId, nextPhone()), "rate_limited");
  });

  it("rate-limits sends per phone number across accounts", async () => {
    const phone = nextPhone();
    for (let i = 0; i < 5; i += 1) await start(await ctx.createUser(), phone);
    await expectSmsError(start(await ctx.createUser(), phone), "rate_limited");
  });

  it("records a delivery failure when the provider rejects the code", async () => {
    const userId = await ctx.createUser();
    ctx.provider.failNextSend(new SmsSendError("rejected", { notSent: true }));
    await expectSmsError(start(userId, nextPhone()), "send_failed");
    const { rows } = await ctx.db.query<{ delivery_status: string }>(
      "select delivery_status from sms_phone_verifications where user_id = $1",
      [userId],
    );
    assert.equal(rows[0].delivery_status, "send_failed");
  });
});

describe("resending codes", () => {
  it("enforces a cooldown, then replaces the old code", async () => {
    const userId = await ctx.createUser();
    const phone = nextPhone();
    await start(userId, phone);
    const firstCode = ctx.provider.lastCode()!;

    await expectSmsError(resendVerification(ctx.deps, { userId, ip: null }), "cooldown");

    await ageLastSend(userId, 31);
    await resendVerification(ctx.deps, { userId, ip: null });
    const secondCode = ctx.provider.lastCode()!;
    assert.equal(sentTo(phone).length, 2);

    if (firstCode !== secondCode) {
      await expectSmsError(verify(userId, firstCode), "incorrect_code");
    }
    const result = await verify(userId, secondCode);
    assert.equal(result.state.contact?.status, "active");
  });

  it("caps the number of codes per verification", async () => {
    const userId = await ctx.createUser();
    const deps = { ...ctx.deps, config: { ...ctx.deps.config, maxSendsPerVerification: 2 } };
    await start(userId, nextPhone());
    await ageLastSend(userId, 31);
    await resendVerification(deps, { userId, ip: null });
    await ageLastSend(userId, 31);
    await expectSmsError(resendVerification(deps, { userId, ip: null }), "send_limit");
  });

  it("requires a pending verification", async () => {
    await expectSmsError(resendVerification(ctx.deps, { userId: await ctx.createUser(), ip: null }), "no_pending");
  });
});

describe("verifying codes", () => {
  it("activates the number, records consent, and sends the welcome once", async () => {
    const userId = await ctx.createUser();
    const phone = nextPhone();
    await start(userId, phone, { source: "onboarding" });
    const result = await verify(userId, ctx.provider.lastCode());

    assert.equal(result.state.contact?.status, "active");
    assert.equal(result.state.pending, null);
    assert.ok(result.state.contact?.verifiedAt);
    assert.ok(result.state.contact?.consentAt);

    const { rows } = await ctx.db.query<{
      consent_source: string;
      consent_version: string;
      welcome_sent_at: Date | null;
      display_name: string;
      language_level: string;
    }>("select * from sms_contacts where user_id = $1 and status <> 'released'", [userId]);
    assert.equal(rows[0].consent_source, "onboarding");
    assert.equal(rows[0].consent_version, SMS_CONSENT_VERSION);
    assert.ok(rows[0].welcome_sent_at);
    assert.equal(rows[0].display_name, "Cam");
    assert.equal(rows[0].language_level, "A2");

    const welcomes = sentTo(phone).filter((message) => message.body === SMS_WELCOME_MESSAGE);
    assert.equal(welcomes.length, 1);
  });

  it("treats a duplicate submit after success as success without a second welcome", async () => {
    const userId = await ctx.createUser();
    const phone = nextPhone();
    await start(userId, phone);
    const code = ctx.provider.lastCode();
    await verify(userId, code);
    const again = await verify(userId, code);

    assert.equal(again.alreadyVerified, true);
    assert.equal(again.state.contact?.status, "active");
    assert.equal(sentTo(phone).filter((m) => m.body === SMS_WELCOME_MESSAGE).length, 1);
  });

  it("rejects malformed codes without using an attempt", async () => {
    const userId = await ctx.createUser();
    await start(userId, nextPhone());
    await expectSmsError(verify(userId, "12ab"), "invalid_code");
    const { rows } = await ctx.db.query<{ attempt_count: number }>(
      "select attempt_count from sms_phone_verifications where user_id = $1",
      [userId],
    );
    assert.equal(rows[0].attempt_count, 0);
  });

  it("counts wrong codes and locks after five attempts", async () => {
    const userId = await ctx.createUser();
    await start(userId, nextPhone());
    const code = ctx.provider.lastCode()!;
    const wrong = code === "000000" ? "111111" : "000000";

    for (let remaining = 4; remaining >= 1; remaining -= 1) {
      await assert.rejects(verify(userId, wrong), (error: unknown) => {
        assert.ok(error instanceof SmsPhoneError);
        assert.equal(error.code, "incorrect_code");
        assert.equal(error.extra.attemptsRemaining, remaining);
        return true;
      });
    }
    await expectSmsError(verify(userId, wrong), "too_many_attempts");
    // Even the right code is refused once attempts are exhausted.
    await expectSmsError(verify(userId, code), "too_many_attempts");
  });

  it("rejects expired codes", async () => {
    const userId = await ctx.createUser();
    await start(userId, nextPhone());
    await ctx.db.query(
      "update sms_phone_verifications set expires_at = now() - interval '1 second' where user_id = $1",
      [userId],
    );
    await expectSmsError(verify(userId, ctx.provider.lastCode()), "expired");
  });

  it("does not send a code again for a number that is already active", async () => {
    const { userId, phone } = await verifiedUser();
    const before = sentTo(phone).length;
    const result = await start(userId, phone);
    assert.equal(result.alreadyActive, true);
    assert.equal(sentTo(phone).length, before);
  });
});

describe("number ownership", () => {
  it("does not reveal or silently take over another account's number", async () => {
    const owner = await verifiedUser();
    const other = await ctx.createUser();

    const started = await start(other, owner.phone);
    assert.equal(started.alreadyActive, false, "start looks the same as for any number");
    const code = ctx.provider.lastCode();

    await expectSmsError(verify(other, code), "transfer_required");
    const { rows: stillOwned } = await ctx.db.query<{ user_id: string; status: string }>(
      "select user_id, status from sms_contacts where phone_number = $1 and status <> 'released'",
      [owner.phone],
    );
    assert.deepEqual(stillOwned, [{ user_id: owner.userId, status: "active" }]);

    const moved = await verify(other, code, true);
    assert.equal(moved.transferred, true);
    assert.equal(moved.state.contact?.status, "active");

    const { rows } = await ctx.db.query<{ user_id: string; status: string; release_reason: string | null }>(
      "select user_id, status, release_reason from sms_contacts where phone_number = $1 order by created_at",
      [owner.phone],
    );
    assert.deepEqual(rows, [
      { user_id: owner.userId, status: "released", release_reason: "transferred" },
      { user_id: other, status: "active", release_reason: null },
    ]);
  });

  it("replaces a learner's number only after the new one is verified", async () => {
    const { userId, phone: oldPhone } = await verifiedUser();
    const newPhone = nextPhone();
    await start(userId, newPhone);

    const { rows: during } = await ctx.db.query<{ phone_number: string; status: string }>(
      "select phone_number, status from sms_contacts where user_id = $1 and status <> 'released'",
      [userId],
    );
    assert.deepEqual(during, [{ phone_number: oldPhone, status: "active" }], "old number keeps working");

    const result = await verify(userId, ctx.provider.lastCode());
    assert.equal(result.replaced, true);
    assert.ok(result.state.contact?.maskedNumber.endsWith(newPhone.slice(-4)));
    assert.equal(sentTo(newPhone).filter((m) => m.body === SMS_WELCOME_MESSAGE).length, 1);

    const { rows } = await ctx.db.query<{ status: string; release_reason: string }>(
      "select status, release_reason from sms_contacts where phone_number = $1",
      [oldPhone],
    );
    assert.deepEqual(rows, [{ status: "released", release_reason: "replaced" }]);
  });

  it("invalidates the previous pending code when a new number is entered", async () => {
    const userId = await ctx.createUser();
    await start(userId, nextPhone());
    const firstCode = ctx.provider.lastCode();
    await start(userId, nextPhone());
    const secondCode = ctx.provider.lastCode();
    if (firstCode !== secondCode) {
      await expectSmsError(verify(userId, firstCode), "incorrect_code");
    }
    const { rows } = await ctx.db.query<{ open: number }>(
      `select count(*)::int as open from sms_phone_verifications
       where user_id = $1 and verified_at is null and invalidated_at is null`,
      [userId],
    );
    assert.equal(rows[0].open, 1);
  });
});

describe("welcome idempotency", () => {
  it("never sends a second welcome for the same contact", async () => {
    const { userId, phone } = await verifiedUser();
    const { rows } = await ctx.db.query<{ id: string }>(
      "select id from sms_contacts where user_id = $1 and status = 'active'",
      [userId],
    );
    const again = await sendWelcome(ctx.deps, userId, rows[0].id);
    assert.equal(again.status, "skipped");
    assert.equal(sentTo(phone).filter((m) => m.body === SMS_WELCOME_MESSAGE).length, 1);
  });

  it("keeps verification successful when the welcome text fails", async () => {
    const userId = await ctx.createUser();
    const phone = nextPhone();
    await start(userId, phone);
    const code = ctx.provider.lastCode();
    ctx.provider.failNextSend(new SmsSendError("timeout", { notSent: false }));
    const result = await verify(userId, code);
    assert.equal(result.state.contact?.status, "active");
    assert.equal(result.state.contact?.welcomeSentAt, null);
    assert.equal(sentTo(phone).filter((m) => m.body === SMS_WELCOME_MESSAGE).length, 0);
  });
});

describe("pause, resume, and disconnect", () => {
  it("pauses and resumes an active number", async () => {
    const { userId } = await verifiedUser();
    const paused = await setTextingPaused(ctx.deps, userId, true);
    assert.equal(paused.state.contact?.status, "paused");
    const resumed = await setTextingPaused(ctx.deps, userId, false);
    assert.equal(resumed.state.contact?.status, "active");
  });

  it("does not reactivate an opted-out number from the website", async () => {
    const { userId } = await verifiedUser();
    await ctx.db.query(
      "update sms_contacts set status = 'opted_out', opted_out_at = now() where user_id = $1 and status = 'active'",
      [userId],
    );
    await expectSmsError(setTextingPaused(ctx.deps, userId, false), "text_start_required");
  });

  it("disconnects the number and keeps the audit trail", async () => {
    const { userId, phone } = await verifiedUser();
    const result = await disconnectPhone(ctx.deps, userId);
    assert.equal(result.state.contact, null);
    const { rows } = await ctx.db.query<{ status: string; consent_at: Date | null; release_reason: string }>(
      "select status, consent_at, release_reason from sms_contacts where phone_number = $1",
      [phone],
    );
    assert.equal(rows[0].status, "released");
    assert.equal(rows[0].release_reason, "disconnected");
    assert.ok(rows[0].consent_at, "consent timestamp is preserved");
  });
});

describe("database access", () => {
  it("does not let client roles call SMS functions", async () => {
    const { rows } = await ctx.db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated', 'public.sms_complete_verification(uuid, uuid, boolean, text, text)', 'execute') as allowed",
    );
    assert.equal(rows[0].allowed, false);
    const { rows: anon } = await ctx.db.query<{ allowed: boolean }>(
      "select has_function_privilege('anon', 'public.sms_rate_limit_consume(jsonb)', 'execute') as allowed",
    );
    assert.equal(anon[0].allowed, false);
  });

  it("removes the prototype policies that let clients create contacts", async () => {
    const { rows } = await ctx.db.query<{ policyname: string; cmd: string }>(
      "select policyname, cmd from pg_policies where tablename in ('sms_contacts', 'sms_messages') order by policyname",
    );
    assert.ok(rows.every((row) => row.cmd === "SELECT"), JSON.stringify(rows));
  });

  it("refuses an active contact without verification and consent", async () => {
    const userId = await ctx.createUser();
    await assert.rejects(
      ctx.db.query(
        "insert into sms_contacts (user_id, phone_number, status) values ($1, $2, 'active')",
        [userId, nextPhone()],
      ),
      /sms_contacts_verified_consent_check/,
    );
  });
});
