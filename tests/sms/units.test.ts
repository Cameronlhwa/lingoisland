import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, it } from "node:test";
import {
  cleanCodeInput,
  generateVerificationCode,
  hashVerificationCode,
  isWellFormedCode,
  verificationCodeMatches,
} from "../../lib/sms/codes";
import { detectSmsKeyword } from "../../lib/sms/keywords";
import { redactSmsText } from "../../lib/sms/log";
import { buildWelcomeMessage } from "../../lib/sms/huahua/welcome";
import { verificationCodeMessage } from "../../lib/sms/messages";
import { maskPhoneNumber, normalizePhoneNumber, parsePhoneForSms } from "../../lib/sms/phone";
import { estimateSmsSegments, fitToSmsSegments } from "../../lib/sms/segments";
import { TelnyxSmsProvider, verifyTelnyxSignature } from "../../lib/sms/telnyx";

describe("E.164 normalization", () => {
  const supported = ["US", "CA"];

  it("normalizes national input using the selected country", () => {
    assert.deepEqual(parsePhoneForSms("(416) 555-0123", "CA", supported), {
      ok: true,
      e164: "+14165550123",
      country: "CA",
    });
  });

  it("accepts international input regardless of the selected country", () => {
    const result = parsePhoneForSms("+1 650 253 0000", "CA", supported);
    assert.equal(result.ok && result.e164, "+16502530000");
    assert.equal(result.ok && result.country, "US");
  });

  it("rejects invalid numbers", () => {
    assert.deepEqual(parsePhoneForSms("12345", "US", supported), { ok: false, reason: "invalid" });
    assert.deepEqual(parsePhoneForSms("", "US", supported), { ok: false, reason: "invalid" });
    assert.deepEqual(parsePhoneForSms("not a phone", "US", supported), { ok: false, reason: "invalid" });
  });

  it("rejects countries we cannot text", () => {
    assert.deepEqual(parsePhoneForSms("+44 7911 123456", "US", supported), {
      ok: false,
      reason: "unsupported_country",
    });
  });

  it("rejects numbers that cannot receive SMS", () => {
    assert.deepEqual(parsePhoneForSms("+1 800 555 0100", "US", supported), {
      ok: false,
      reason: "not_mobile",
    });
  });

  it("keeps the prototype strict E.164 normalizer", () => {
    assert.equal(normalizePhoneNumber(" +1 (416) 555-0123 "), "+14165550123");
    assert.throws(() => normalizePhoneNumber("4165550123"));
  });

  it("masks numbers for display and logs", () => {
    assert.equal(maskPhoneNumber("+14165559212"), "+1 ••• ••• 9212");
    assert.ok(!maskPhoneNumber("+447911123456").includes("7911123"));
    assert.ok(maskPhoneNumber("+447911123456").endsWith("3456"));
    assert.equal(maskPhoneNumber(""), "");
  });

  it("redacts phone numbers and codes from log text", () => {
    const redacted = redactSmsText("send to +14165559212 failed with code 123456");
    assert.ok(!redacted.includes("9212"));
    assert.ok(!redacted.includes("123456"));
  });
});

describe("verification codes", () => {
  const secret = "s".repeat(48);
  const input = { userId: "user-1", phoneNumber: "+14165550123", code: "042517" };

  it("generates 6-digit numeric codes, including leading zeros", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const code = generateVerificationCode();
      assert.match(code, /^\d{6}$/);
      codes.add(code);
    }
    assert.ok(codes.size > 490, "codes should not repeat often");
  });

  it("hashes without storing the plaintext code", () => {
    const hash = hashVerificationCode(secret, input);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.ok(!hash.includes(input.code));
  });

  it("binds the hash to the user, number, and secret", () => {
    const hash = hashVerificationCode(secret, input);
    assert.ok(verificationCodeMatches(secret, hash, input));
    assert.ok(!verificationCodeMatches(secret, hash, { ...input, code: "042518" }));
    assert.ok(!verificationCodeMatches(secret, hash, { ...input, userId: "user-2" }));
    assert.ok(!verificationCodeMatches(secret, hash, { ...input, phoneNumber: "+14165550124" }));
    assert.ok(!verificationCodeMatches("t".repeat(48), hash, input));
    assert.ok(!verificationCodeMatches(secret, "expired", input));
  });

  it("validates and cleans user input", () => {
    assert.equal(cleanCodeInput("123 456"), "123456");
    assert.equal(cleanCodeInput("123-456"), "123456");
    assert.ok(isWellFormedCode("000123"));
    assert.ok(!isWellFormedCode("12345"));
    assert.ok(!isWellFormedCode("12345a"));
    assert.ok(!isWellFormedCode(123456));
  });

  it("keeps the code message in a single GSM-7 segment", () => {
    const estimate = estimateSmsSegments(verificationCodeMessage("123456", 10));
    assert.equal(estimate.encoding, "GSM-7");
    assert.equal(estimate.segments, 1);
  });
});

describe("SMS segment estimation", () => {
  it("counts GSM-7 messages", () => {
    assert.deepEqual(estimateSmsSegments("a".repeat(160)), { encoding: "GSM-7", units: 160, segments: 1 });
    assert.equal(estimateSmsSegments("a".repeat(161)).segments, 2);
    assert.equal(estimateSmsSegments("a".repeat(306)).segments, 2);
    assert.equal(estimateSmsSegments("a".repeat(307)).segments, 3);
  });

  it("counts GSM-7 extended characters as two units", () => {
    assert.equal(estimateSmsSegments("€".repeat(80)).units, 160);
    assert.equal(estimateSmsSegments("€".repeat(81)).segments, 2);
  });

  it("uses UCS-2 for Mandarin", () => {
    assert.deepEqual(estimateSmsSegments("你".repeat(70)), { encoding: "UCS-2", units: 70, segments: 1 });
    assert.equal(estimateSmsSegments("你".repeat(71)).segments, 2);
    assert.equal(estimateSmsSegments("你".repeat(134)).segments, 2);
    assert.equal(estimateSmsSegments("你".repeat(135)).segments, 3);
  });

  it("counts emoji as surrogate pairs that never straddle segments", () => {
    assert.equal(estimateSmsSegments("👋").units, 2);
    // 66 units then an emoji (2 units) must start the next part.
    assert.equal(estimateSmsSegments("你".repeat(66) + "👋" + "你".repeat(67)).segments, 3);
  });

  it("fits every welcome variant in three segments", () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      for (const subscribed of [true, false]) {
        const estimate = estimateSmsSegments(buildWelcomeMessage({ level, subscribed }));
        assert.equal(estimate.encoding, "UCS-2");
        assert.ok(estimate.segments <= 3, `level ${level} subscribed=${subscribed}: ${estimate.segments}`);
      }
    }
  });

  it("leaves short replies untouched", () => {
    assert.equal(fitToSmsSegments("你好！今天怎么样？", 2), "你好！今天怎么样？");
  });

  it("trims long replies to the segment budget", () => {
    const long = "我们今天学习新的词语。".repeat(30);
    const fitted = fitToSmsSegments(long, 2);
    assert.ok(estimateSmsSegments(fitted).segments <= 2);
    assert.ok(fitted.endsWith("。"), "prefers a sentence boundary");
  });

  it("never splits a surrogate pair or emoji sequence", () => {
    const long = "👨‍👩‍👧".repeat(60);
    const fitted = fitToSmsSegments(long, 1);
    assert.ok(estimateSmsSegments(fitted).segments <= 1);
    assert.ok(!/[\uD800-\uDBFF]$/.test(fitted.replace(/…$/, "")), "no dangling high surrogate");
    assert.equal(fitted.replace(/…$/, "").length % "👨‍👩‍👧".length, 0, "whole graphemes only");
  });

  it("adds an ellipsis when no sentence boundary is available", () => {
    const fitted = fitToSmsSegments("你".repeat(300), 2);
    assert.ok(fitted.endsWith("…"));
    assert.ok(estimateSmsSegments(fitted).segments <= 2);
  });
});

describe("keywords", () => {
  it("detects carrier keywords only as whole messages", () => {
    assert.equal(detectSmsKeyword("STOP"), "stop");
    assert.equal(detectSmsKeyword(" stop. "), "stop");
    assert.equal(detectSmsKeyword("Unsubscribe"), "stop");
    assert.equal(detectSmsKeyword("START"), "start");
    assert.equal(detectSmsKeyword("unstop"), "start");
    assert.equal(detectSmsKeyword("HELP"), "help");
    assert.equal(detectSmsKeyword("please stop correcting me"), null);
    assert.equal(detectSmsKeyword("yes"), null);
    assert.equal(detectSmsKeyword("你好"), null);
  });
});

describe("Telnyx webhook signatures", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const rawPublicKey = publicKey.export({ format: "der", type: "spki" }).subarray(12);

  function signed(body: string, timestamp = String(Math.floor(Date.now() / 1000))) {
    const signature = sign(null, Buffer.from(`${timestamp}|${body}`), privateKey).toString("base64");
    return { signature, timestamp };
  }

  it("accepts valid signatures and rejects tampering or stale timestamps", () => {
    const previous = process.env.TELNYX_PUBLIC_KEY;
    process.env.TELNYX_PUBLIC_KEY = rawPublicKey.toString("base64");
    try {
      const body = JSON.stringify({ data: { id: "evt_1" } });
      const ok = signed(body);
      assert.equal(verifyTelnyxSignature(body, ok.signature, ok.timestamp), true);
      assert.equal(verifyTelnyxSignature(body + " ", ok.signature, ok.timestamp), false);
      assert.equal(verifyTelnyxSignature(body, "bm90LWEtc2lnbmF0dXJl", ok.timestamp), false);

      const stale = signed(body, String(Math.floor(Date.now() / 1000) - 600));
      assert.equal(verifyTelnyxSignature(body, stale.signature, stale.timestamp), false);
    } finally {
      process.env.TELNYX_PUBLIC_KEY = previous;
    }
  });

  it("never accepts unsigned webhooks in production", async () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = { node: env.NODE_ENV, allow: env.SMS_WEBHOOK_ALLOW_UNSIGNED, key: env.TELNYX_PUBLIC_KEY };
    env.NODE_ENV = "production";
    env.SMS_WEBHOOK_ALLOW_UNSIGNED = "true";
    env.TELNYX_PUBLIC_KEY = rawPublicKey.toString("base64");
    try {
      const request = new Request("https://example.com/api/sms/webhook", { method: "POST" });
      await assert.rejects(
        new TelnyxSmsProvider().parseWebhook(request, JSON.stringify({ data: { id: "evt" } })),
        /Invalid Telnyx webhook signature/,
      );
    } finally {
      env.NODE_ENV = previous.node;
      env.SMS_WEBHOOK_ALLOW_UNSIGNED = previous.allow;
      env.TELNYX_PUBLIC_KEY = previous.key;
    }
  });
});
