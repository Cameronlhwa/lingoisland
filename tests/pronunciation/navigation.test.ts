import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pronunciationSessionReturnPath } from "../../lib/pronunciation/navigation";

describe("pronunciation session return navigation", () => {
  it("returns standalone sessions to the moved practice dashboard", () => {
    assert.equal(pronunciationSessionReturnPath("/app/pronunciation/session/session-1", null), "/app/pronunciation/practice");
  });

  it("keeps Journey sessions on their original map", () => {
    assert.equal(pronunciationSessionReturnPath("/app/pronunciation/session/session-1", "journey-1"), "/app/journey/journey-1");
    assert.equal(pronunciationSessionReturnPath("/hsk/app/pronunciation/session/session-1", "journey-1"), "/hsk/app/journey/journey-1");
  });

  it("keeps a Journey identifier inside a single path segment", () => {
    assert.equal(pronunciationSessionReturnPath("/app/pronunciation/session/session-1", "journey/other?next=home"), "/app/journey/journey%2Fother%3Fnext%3Dhome");
  });
});
