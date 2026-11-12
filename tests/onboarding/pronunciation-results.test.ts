import {test} from "node:test";
import assert from "node:assert/strict";
import {parsePronunciationPieces,alignedPronunciationPieces,pronunciationBand} from "../../lib/onboarding/personalized/firstLesson/pronunciationResults";
import {parseFirstLesson} from "../../lib/onboarding/personalized/flow";
import {EMPTY_FIRST_LESSON} from "../../lib/onboarding/personalized/firstLesson/types";
test("pronunciation colours use actual scores including boundaries and zero",()=>{
 assert.deepEqual([null,0,59,60,79,80,100].map(pronunciationBand),["unscored","practice","practice","close","close","clear","clear"]);
});
test("invalid and missing character scores remain unassessed",()=>{
 const rows=parsePronunciationPieces([{hanzi:"我",score:999},{hanzi:"要",score:"80"},{hanzi:"茶",score:NaN},null,{hanzi:"<script>",score:90}]);
 assert.equal(rows.length,3);assert.ok(rows.every(r=>r.score===null));
 assert.ok(alignedPronunciationPieces("我要茶",[{hanzi:"要",score:90}]).every(r=>r.score===null));
 assert.ok(alignedPronunciationPieces("我要茶",[{hanzi:"我要水",score:90}]).every(r=>r.score===null));
});
test("preserves repeated characters and actual scores across third-attempt reload",()=>{
 const rows=[{hanzi:"谢",pinyin:"xiè",score:42,targetTone:4},{hanzi:"谢",pinyin:"xie",score:65,targetTone:null}];
 assert.deepEqual(alignedPronunciationPieces("谢谢！",rows),rows);
 const attempt={at:new Date().toISOString(),feedback:"retry",characters:rows,overall:42,playbackUrl:"blob:private"};
 const parsed=parseFirstLesson({...EMPTY_FIRST_LESSON,baseline:attempt,latest:attempt,coachRetries:2});
 assert.deepEqual(parsed.latest?.characters,rows);assert.equal(parsed.latest?.overall,42);assert.equal(parsed.latest?.playbackUrl,null);assert.equal(parsed.coachRetries,2);
});
