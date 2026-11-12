import {test} from "node:test";
import assert from "node:assert/strict";
import {scryptSync} from "node:crypto";
import {passwordMatches,createTestingSession,validTestingSession,SESSION_SECONDS} from "../../lib/testing/auth";
test("testing password uses a salted hash and rejects incorrect or malformed credentials",async()=>{
 const salt="0123456789abcdef0123456789abcdef",hash=salt+":"+scryptSync("test-password",salt,64).toString("hex");
 assert.equal(await passwordMatches("test-password",hash),true);assert.equal(await passwordMatches("incorrect",hash),false);assert.equal(await passwordMatches("test-password","invalid"),false);
});
test("testing session rejects tampering, expiration, missing secrets and invalid signatures",()=>{
 const secret="a".repeat(64),now=1700000000000,token=createTestingSession(secret,now);
 assert.equal(validTestingSession(token,secret,now),true);
 assert.equal(validTestingSession(token,"b".repeat(64),now),false);
 assert.equal(validTestingSession(token+"x",secret,now),false);
 assert.equal(validTestingSession(token,secret,now+SESSION_SECONDS*1000),false);
 assert.equal(validTestingSession(token,undefined,now),false);
 assert.equal(validTestingSession(undefined,secret,now),false);
});
