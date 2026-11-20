import type { AuthoredLesson, BuildPrompt, LessonPhrase, MatchPair } from "./types";
import type { CurriculumPractice, GrammarCard } from "./curriculum";
import type { GoalKey } from "../goals";
import { pinyin } from "pinyin-pro";

export type CourseTier = 1 | 2 | 3 | 4 | 5 | 6;
export const COURSE_REVISION = "budget-v1";
export const NEW_ITEM_LIMIT = 5;
export const courseWord = (hanzi: string, meaning: string): LessonPhrase => ({ id: hanzi, hanzi, meaning, pinyin: pinyin(hanzi) });
const word = courseWord;
const W = {
 ni: word("你", "you"), wo: word("我", "I / me"), hao: word("好", "good / greeting"), everyone: word("大家", "everyone"),
 hui: word("会", "know how to"), bu: word("不", "not"), ma: word("吗", "yes/no question particle"), neng: word("能", "be able to under the circumstances"),
 want: word("想", "want to"), haishi: word("还是", "or, asking for a choice"), huozhe: word("或者", "or, stating alternatives"),
 except: word("除了", "besides / apart from"), outside: word("以外", "apart from"), also: word("还", "also / additionally"), like: word("喜欢", "like"),
 one: word("一方面", "on one hand"), other: word("另一方面", "on the other hand"), very: word("很", "very / links a description"),
};
type Pair = readonly [string, string, string, string];
// Each phrase is a teachable lexical unit, not an arbitrary sentence bundled to evade the budget.
const PEOPLE: Record<GoalKey, readonly Pair[]> = {
 heritage: [["奶奶","Grandma","妈妈","Mum"],["爸爸","Dad","爷爷","Grandpa"]],
 work: [["经理","manager","同事","colleague"],["老板","boss","客户","client"]],
 school: [["老师","teacher","同学","classmate"],["校长","principal","教授","professor"]],
 travel: [["导游","tour guide","司机","driver"],["店员","shop assistant","服务员","server"]],
 everyday: [["朋友","friend","邻居","neighbour"],["阿姨","Auntie","叔叔","Uncle"]],
 other: [["朋友","friend","老师","teacher"],["邻居","neighbour","同学","classmate"]],
};
const ACTIONS: Record<GoalKey, readonly Pair[]> = {
 heritage: [["做饭","cook","唱歌","sing"],["跳舞","dance","画画","draw"]],
 work: [["打字","type","翻译","translate"],["编程","program","设计","design"]],
 school: [["画画","draw","写字","write characters"],["唱歌","sing","游泳","swim"]],
 travel: [["游泳","swim","开车","drive"],["滑雪","ski","骑车","cycle"]],
 everyday: [["做饭","cook","游泳","swim"],["跳舞","dance","唱歌","sing"]],
 other: [["做饭","cook","唱歌","sing"],["画画","draw","游泳","swim"]],
};
const PLANS: Record<GoalKey, readonly Pair[]> = {
 heritage: [["回家","go home","做饭","cook"],["唱歌","sing","跳舞","dance"]],
 work: [["开会","attend a meeting","加班","work overtime"],["出差","travel for work","上班","go to work"]],
 school: [["上课","attend class","复习","revise"],["学习","study","考试","take an exam"]],
 travel: [["出发","set off","入住","check in"],["登机","board a plane","退房","check out"]],
 everyday: [["跑步","run","做饭","cook"],["散步","take a walk","购物","shop"]],
 other: [["回家","go home","学习","study"],["跑步","run","做饭","cook"]],
};
const OPTIONS: Record<GoalKey, readonly { pair: Pair; verb: LessonPhrase; context: string }[]> = {
 heritage: [{pair:["饺子","dumplings","面条","noodles"],verb:word("吃","eat"),context:"You’re deciding what to eat with your family."},{pair:["米饭","rice","包子","steamed buns"],verb:word("吃","eat"),context:"You’re planning a family meal."}],
 work: [{pair:["茶","tea","咖啡","coffee"],verb:word("喝","drink"),context:"You’re choosing a drink with a colleague."},{pair:["果汁","juice","热水","hot water"],verb:word("喝","drink"),context:"You’re choosing refreshments at work."}],
 school: [{pair:["历史","history","地理","geography"],verb:word("学","study"),context:"You’re choosing a subject to study."},{pair:["物理","physics","化学","chemistry"],verb:word("学","study"),context:"You’re discussing subject choices."}],
 travel: [{pair:["地铁","the subway","公交车","the bus"],verb:word("坐","take"),context:"You’re choosing how to get there."},{pair:["火车","the train","飞机","a plane"],verb:word("坐","take"),context:"You’re planning transport for a trip."}],
 everyday: [{pair:["电影","a film","演出","a live show"],verb:word("看","watch"),context:"You’re making evening plans with a friend."},{pair:["电视","TV","动画片","a cartoon"],verb:word("看","watch"),context:"You’re deciding what to watch."}],
 other: [{pair:["茶","tea","咖啡","coffee"],verb:word("喝","drink"),context:"You’re choosing a drink with a friend."},{pair:["果汁","juice","热水","hot water"],verb:word("喝","drink"),context:"You’re deciding what to drink."}],
};
const INTERESTS: Record<GoalKey, readonly Pair[]> = {
 heritage: [["书法","calligraphy","京剧","Beijing opera"],["国画","Chinese painting","民歌","folk songs"]],
 work: [["设计","design","编程","programming"],["营销","marketing","管理","management"]],
 school: [["历史","history","地理","geography"],["物理","physics","化学","chemistry"]],
 travel: [["海滩","beaches","古城","old towns"],["湖泊","lakes","山谷","valleys"]],
 everyday: [["音乐","music","电影","films"],["摄影","photography","运动","sport"]],
 other: [["音乐","music","电影","films"],["摄影","photography","书法","calligraphy"]],
};
const ASPECTS: Record<GoalKey, readonly {pair:Pair; context:string}[]> = {
 heritage:[{pair:["热闹","lively","累","tiring"],context:"Describe two sides of a large family gathering."},{pair:["温暖","warm","忙","busy"],context:"Describe a holiday spent with your family."}],
 work:[{pair:["灵活","flexible","孤独","lonely"],context:"Describe two sides of working from home."},{pair:["高效","efficient","累","tiring"],context:"Describe an intensive work session."}],
 school:[{pair:["有趣","interesting","难","difficult"],context:"Describe two sides of a course you’re taking."},{pair:["有用","useful","累","tiring"],context:"Describe an intensive study session."}],
 travel:[{pair:["方便","convenient","贵","expensive"],context:"Describe two sides of taking a taxi."},{pair:["便宜","inexpensive","慢","slow"],context:"Describe two sides of a long bus journey."}],
 everyday:[{pair:["开心","happy / enjoyable","累","tiring"],context:"Describe a busy day out with friends."},{pair:["安静","quiet","无聊","boring"],context:"Describe an afternoon spent at home."}],
 other:[{pair:["有用","useful","难","difficult"],context:"Describe two sides of learning a new skill."},{pair:["有趣","interesting","贵","expensive"],context:"Describe a new hobby."}],
};
export type BudgetCourse = AuthoredLesson & { budget: {
 revision: typeof COURSE_REVISION; tier: CourseTier; variant: number; goal: GoalKey;
 grammarIds: string[]; topicIds: string[]; prerequisiteIds: string[];
 // Explicit vocabulary for all learner-facing Chinese, including distractors and Huahua's replies.
 words: LessonPhrase[]; probes: Extract<CurriculumPractice,{kind:"choice"}>[];
}};
export function makeBudgetCourse(tier: CourseTier, goal: GoalKey, variant = 0): BudgetCourse {
 variant = variant === 1 ? 1 : 0;
 let grammar: LessonPhrase[], prerequisites: LessonPhrase[], topic: LessonPhrase[], title: string, context: string;
 const pair = (p:Pair) => [word(p[0],p[1]),word(p[2],p[3])];
 if(tier===1){grammar=[W.ni,W.hao,W.everyone];prerequisites=[];topic=pair(PEOPLE[goal][variant]);title="Greet someone. Greet everyone.";context="You’re greeting someone in a situation that matters to you.";}
 else if(tier===2){grammar=[W.hui,W.bu,W.ma];prerequisites=[W.wo,W.ni];topic=pair(ACTIONS[goal][variant]);title="Say what you know how to do.";context="Talk about two skills connected to your interests.";}
 else if(tier===3){grammar=[W.neng];prerequisites=[W.wo,W.ni,W.bu,W.ma];topic=pair(PLANS[goal][variant]);title="Say what’s possible.";context="Your schedule allows one plan, but prevents the other.";}
 else if(tier===4){const option=OPTIONS[goal][variant];grammar=[W.haishi,W.huozhe];prerequisites=[W.wo,W.ni,W.want,option.verb];topic=pair(option.pair);title="Ask for a choice. Give alternatives.";context=option.context;}
 else if(tier===5){grammar=[W.except,W.outside,W.also];prerequisites=[W.wo,W.like];topic=pair(INTERESTS[goal][variant]);title="Keep one idea. Add another.";context="Tell Huahua about two things you like in your chosen topic.";}
 else{const aspect=ASPECTS[goal][variant];grammar=[W.one,W.other];prerequisites=[W.very];topic=pair(aspect.pair);title="Describe two sides of a situation.";context=aspect.context;}
 const [A,B]=topic, all=Array.from(new Map([...grammar,...prerequisites,...topic].map(w=>[w.id,w])).values());
 const phrase=(pieces:LessonPhrase[],meaning:string,punctuation=""):LessonPhrase => {
  const hanzi=pieces.map(w=>w.hanzi).join("")+punctuation;
  return word(hanzi,meaning);
 };
 const build=(pieces:LessonPhrase[],meaning:string):BuildPrompt=>{const chunks=pieces.map((w,i)=>({id:`part-${i}`,label:w.hanzi,pinyin:w.pinyin,meaning:w.meaning}));return {prompt:meaning,chunks,order:chunks.map(w=>w.id),result:phrase(pieces,meaning)};};
 const choice=(prompt:string,correct:LessonPhrase,wrong:LessonPhrase,explanation:string):Extract<CurriculumPractice,{kind:"choice"}>=>({kind:"choice",prompt,choices: [correct,wrong].sort((a,b)=>a.id.localeCompare(b.id,"zh")),correct:correct.id,explanation});
 let first:BuildPrompt, second:BuildPrompt, question:LessonPhrase, right:LessonPhrase, wrong:LessonPhrase, explanation:string, takeaway:string, checks:Extract<CurriculumPractice,{kind:"choice"}>[], mission:string;
 if(tier===1){
  first=build([A,W.hao],`Hello, ${A.meaning}!`);second=build([B,W.hao],`Hello, ${B.meaning}!`);
  question=phrase([W.ni,W.hao],"Hello!","！");right=second.result;wrong=first.result;
  explanation="Put the person or group first, then 好. Change who you greet; keep the same pattern.";takeaway="Person or group + 好.";
  checks=[choice("You’re greeting a group. Choose the greeting.",phrase([W.everyone,W.hao],"Hello, everyone!"),phrase([W.ni,W.hao],"Hello!"),"大家 means everyone."),choice(`Greet ${B.meaning}.`,second.result,first.result,"Choose the person named in the situation.")];mission=`Greet ${B.meaning}.`;
 } else if(tier===2 || tier===3){
  const modal=tier===2?W.hui:W.neng;
  first=build([W.wo,modal,A],tier===2?`I know how to ${A.meaning}.`:`I can ${A.meaning}; the circumstances allow it.`);
  second=build([W.wo,W.bu,modal,B],tier===2?`I don’t know how to ${B.meaning}.`:`I can’t ${B.meaning}; the circumstances prevent it.`);
  question=phrase([W.ni,modal,B,W.ma],`Can you ${B.meaning}?`,"？");right=second.result;wrong=phrase([W.wo,modal,B],`I can ${B.meaning}.`);
  explanation=tier===2?"会 goes before a learned skill. Put 不 before 会 to say you don’t know how. Add 吗 at the end to ask a yes/no question.":"能 goes before an action when the circumstances allow it. 不 before 能 means they prevent it. Reuse the familiar 吗 question ending.";
  takeaway=tier===2?"会 / 不会 / 会…吗？ describe learned ability.":"能 / 不能 describe what the circumstances allow.";
  checks=[choice(tier===2?`You learned to ${A.meaning}. 我 ___ ${A.hanzi}。`:`Your schedule allows you to ${A.meaning}. 我 ___ ${A.hanzi}。`,modal,phrase([W.bu,modal],"cannot"),"Choose the positive form for this situation."),choice(tier===2?`You haven’t learned to ${B.meaning}.`:`A scheduling conflict prevents you from being able to ${B.meaning}.`,second.result,wrong,"Use the negative form for this situation.")];mission=tier===2?`For this practice, you haven’t learned to ${B.meaning}. Tell Huahua.`:`For this practice, a scheduling conflict prevents you from being able to ${B.meaning}. Tell Huahua.`;
 } else if(tier===4){
  const verb=OPTIONS[goal][variant].verb;
  first=build([W.wo,W.want,verb,A,W.huozhe,B],`I’d like to ${verb.meaning} ${A.meaning} or ${B.meaning}.`);
  second=build([W.ni,W.want,verb,A,W.haishi,B],`Would you like to ${verb.meaning} ${A.meaning} or ${B.meaning}?`);
  question=phrase([W.ni,W.want,verb,A,W.haishi,B],second.result.meaning,"？");right=phrase([W.wo,W.want,verb,A],`I’d like ${A.meaning}.`);wrong=phrase([W.wo,W.want,verb,B],`I’d like ${B.meaning}.`);
  explanation="还是 asks someone to choose between alternatives. 或者 gives alternatives in a statement.";takeaway="Choice question: 还是. Statement of alternatives: 或者.";
  checks=[choice(`Ask Huahua to choose. 你想${verb.hanzi}${A.hanzi} ___ ${B.hanzi}？`,W.haishi,W.huozhe,"Use 还是 in a direct choice question."),choice(`State two alternatives. 我想${verb.hanzi}${A.hanzi} ___ ${B.hanzi}。`,W.huozhe,W.haishi,"Use 或者 to state alternatives.")];mission=`For this practice, choose ${A.meaning}.`;
 } else if(tier===5){
  first=build([W.except,A,W.outside,W.wo,W.also,W.like,B],`Besides ${A.meaning}, I also like ${B.meaning}.`);
  second=build([W.except,B,W.outside,W.wo,W.also,W.like,A],`Besides ${B.meaning}, I also like ${A.meaning}.`);
  question=phrase([W.except,A,W.outside,W.wo,W.also,W.like,B],first.result.meaning,"。");right=second.result;wrong=phrase([W.wo,W.like,B],`I like ${B.meaning}.`);
  explanation="除了…以外 sets up one item. 还 adds another. Both items are included.";takeaway="除了 + A + 以外，subject + 还 + action + B.";
  checks=[choice(`Add another interest. 除了${A.hanzi}以外，我 ___ 喜欢${B.hanzi}。`,W.also,W.outside,"还 introduces the additional item."),choice(`Start with ${A.meaning}, then add ${B.meaning}.`,first.result,second.result,"The first item follows 除了. The additional item comes after 还 and the action.")];mission=`Huahua shared two interests. Reply with both of yours, starting with ${B.meaning}, then adding ${A.meaning}.`;
 } else {
  first=build([W.one,W.very,A,W.other,W.very,B],`On one hand, it’s ${A.meaning}; on the other, it’s ${B.meaning}.`);
  second=build([W.one,W.very,B,W.other,W.very,A],`On one hand, it’s ${B.meaning}; on the other, it’s ${A.meaning}.`);
  question=phrase([W.one,W.very,A,W.other,W.very,B],first.result.meaning,"。");right=second.result;wrong=phrase([W.one,W.very,B,W.one,W.very,A],"The first-aspect expression is repeated.");
  explanation="一方面 introduces one aspect. 另一方面 introduces another. The two aspects can contrast or simply be different.";takeaway="一方面…，另一方面… organizes two aspects.";
  checks=[choice(`Introduce the second aspect. 一方面很${A.hanzi}， ___ 很${B.hanzi}。`,W.other,W.one,"另一方面 introduces the second aspect."),choice(`Introduce the first aspect. ___ 很${A.hanzi}，另一方面很${B.hanzi}。`,W.one,W.other,"一方面 introduces the first aspect.")];mission=`Use both expressions. Start with “${B.meaning}”, then add “${A.meaning}”.`;
 }
 const examples=[first.result,second.result].map((p,i)=>({...p,hanzi:p.hanzi.replace("以外我","以外，我").replace("另一方面","，另一方面")+(tier===1?"！":tier===4&&i===1?"？":"。"),label:i===0?"First example":"Same family, another example"}));
 // At most two teaching cards; related forms are taught together, with two checks total.
 const cards:GrammarCard[]=[{id:`family-${tier}`,format:tier===4?"contrast":"pattern",title,explanation,examples,takeaway,check:checks[0]}];
 if(tier===2){cards.push({id:"ability-question",format:"exchange",title:"Ask about the same skill.",explanation:"Add 吗 to ask. A question about 你 gets an answer about 我.",examples:[{...question,label:"Huahua asks"},{...right,label:"You answer"}],takeaway:"The same ability pattern works as a statement, negative, or question.",check:checks[1]});}
 const practices:CurriculumPractice[]=[...(tier===2?[]:[checks[1]]),{kind:"build",build:first},{kind:"build",build:second}];
 const match:MatchPair[]=all.map(w=>({...w,label:w.meaning,visual:"word"}));
 // Echo a familiar item rather than introducing a new acknowledgement phrase after the learner replies.
 const response=tier===1?phrase([W.hao],"Good!","！"):tier===2||tier===3?phrase([W.wo,grammar[0],A],first.result.meaning,"。"):tier===4?phrase([A],A.meaning,"！"):tier===5?first.result:second.result;
 const id=`${COURSE_REVISION}-${tier}-${goal}-${variant}`;
 return {id,route:goal==="travel"?"travel":goal==="work"||goal==="school"?"work":"social",band:tier===1?"beginner":tier<4?"elementary":tier===4?"intermediate":"advanced",outcome:title,situation:context,skill:explanation,huahuaPose:"coaching",targets:[first.result,second.result],match,build:first,transferBuild:second,sentenceWords:all,questionWords:all,starter:tier===1?W.ni:tier===6?W.one:W.wo,mission:mission,speakTargetId:first.result.id,completionLine:"You used your new language in a conversation.",chat:{mission:{context,task:mission},huahua:question,choices:[wrong,right].sort((a,b)=>a.id.localeCompare(b.id,"zh")),expectedChoiceId:right.id,responses:{[right.id]:response},outcomeVisual:{[right.id]:"check"}},curriculum:{cards,practices,pronunciation:tier<=4,note:{title:"One useful pattern to keep",text:takeaway},vocabularyGroups:[{id:"core",title:"Grammar and supporting words",wordIds:[...grammar,...prerequisites].map(w=>w.id)},{id:"personalized",title:"Words for your goal",wordIds:topic.map(w=>w.id)}]},template:{id:`budget-${tier}`,tier,scene:context,teaching:all,incomingTeaching:[],construction:explanation,shortRoute:true,quizPairs:match},budget:{revision:COURSE_REVISION,tier,variant,goal,grammarIds:grammar.map(w=>w.id),topicIds:topic.map(w=>w.id),prerequisiteIds:prerequisites.map(w=>w.id),words:all,probes:checks}};
}
