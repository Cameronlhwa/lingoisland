import {test} from "node:test";
import assert from "node:assert/strict";
import {initialState,parseFirstLesson} from "../../lib/onboarding/personalized/flow";
import {updatedFirstLesson} from "../../lib/onboarding/personalized/firstLesson/curriculum";
import {GOALS} from "../../lib/onboarding/personalized/goals";
for(const [level,core] of [["basic_conversations",["还是","或者"]],["familiar_topics",["除了","以外","还"]],["complex_topics",["一方面","另一方面"]]] as const)test(`${level}: keep the grammar family and two goal items without extra reading or composition`,()=>{
 const personal=new Set<string>();
 for(const goal of GOALS){const a=initialState(new Date(),"test").answers;a.level.selfReport=level;a.goal.primary=goal.key;const l=updatedFirstLesson(a)!,c=l.curriculum!;
 core.forEach(id=>assert.ok(c.vocabularyGroups[0].wordIds.includes(id)));assert.equal(c.vocabularyGroups[1].wordIds.length,2);personal.add(c.vocabularyGroups[1].wordIds.join("|"));
 assert.ok(c.cards.length<=2);assert.ok(c.practices.every(p=>p.kind==="choice"||p.kind==="build"));assert.equal(c.discussion,undefined);
 assert.equal(c.pronunciation,level==="basic_conversations");
 if(level==="basic_conversations")for(const id of ["更","比","觉得"])assert.ok(!l.match.some(w=>w.id===id));
 if(level==="complex_topics")for(const id of ["在我看来","然而"])assert.ok(!l.match.some(w=>w.id===id));
 }assert.ok(personal.size>=5);
});
test("legacy drafts remain bounded while old course checkpoints cannot match revised course IDs",()=>{
 const p=parseFirstLesson({phase:"discussion",writingResponses:{"practice:1":"我的看法。","<script>":"bad","practice:2":"中".repeat(900)}});
 assert.equal(p.writingResponses!["practice:2"].length,600);assert.equal(p.writingResponses!["<script>"],undefined);
 const a=initialState(new Date(),"test").answers;a.level.selfReport="complex_topics";assert.ok(updatedFirstLesson(a)!.id.startsWith("budget-v1-"));
});
