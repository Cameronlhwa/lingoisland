import { surfacePinyinForText } from "@/lib/pronunciation/surfacePinyin";

export const COURSE_VERSION = 1;
export type CourseActivity = {
  id: string; kind: "teach" | "listen" | "rule" | "speak";
  title: string; text: string; meaning: string; explanation: string;
  tone?: number; previousTone?: number; spokenTones?: [number, number]; writtenPinyin?: string; modelPinyin?: string;
  options?: string[]; answer?: number; cue?: string; chunks?: string[];
};
export type CourseUnit = { id: string; title: string; description: string; activities: CourseActivity[] };

export const TONE_RULE_RECAP = [
  "Two third tones together: the first changes to a second tone (3 + 3 → 2 + 3).",
  "不 (bù): changes to a second tone before a fourth tone.",
  "一 (yī): changes to a second tone before a fourth tone, and usually to a fourth tone before a first, second, or third tone.",
  "一 on its own or in counting usually keeps its first tone: yī. Check the next tone when it joins another syllable.",
];

function example(id: string, title: string, text: string, meaning: string, explanation: string, tone?: number, previousTone?: number): CourseActivity {
  return { id, kind: "teach", title, text, meaning, explanation, tone, previousTone };
}
const listeningWords: Array<[string,string,string,string]> = [
  ["电脑","Computer","4 + 3","A quick fall, then a low third tone."],
  ["朋友","Friend","2 + Neutral","A rising first syllable, then a short, light syllable."],
  ["书包","Schoolbag","1 + 1","Keep both syllables high and steady."],
  ["眼睛","Eyes","3 + Neutral","A low third tone, then a short, higher neutral tone."],
  ["生日","Birthday","1 + 4","High and steady, then a sharp fall."],
  ["故事","Story","4 + Neutral","A falling fourth tone, then a short, low neutral tone."],
  ["老师","Teacher","3 + 1","A low third tone, then a high, steady first tone."],
  ["衣服","Clothes","1 + Neutral","High and steady, then a shorter, lower neutral tone."],
  ["牛奶","Milk","2 + 3","A rising second tone, then a low third tone."],
  ["电话","Telephone","4 + 4","Two clear, quick falling tones."],
];
// These exercises deliberately teach the common neutral-tone readings, not dictionary alternatives.
const listeningPinyin = ["Diàn nǎo","Péng you","Shū bāo","Yǎn jing","Shēng rì","Gù shi","Lǎo shī","Yī fu","Niú nǎi","Diàn huà"];
const ruleQuestions: Array<[string,string,string,string,string[],number,string]> = [
  ["水果","Fruit","___ guǒ","shuǐ guǒ",["shuī","shuí","shuǐ","shuì"],1,"Two third tones together: the first is spoken with a second tone."],
  ["不错","Not bad","___ cuò","bù cuò",["bū","bú","bǔ","bù"],1,"不 changes to second tone before a fourth tone."],
  ["一样","Same / alike","___ yàng","yī yàng",["yī","yí","yǐ","yì"],1,"一 changes to second tone before a fourth tone."],
  ["一张","One sheet / piece","___ zhāng","yī zhāng",["yī","yí","yǐ","yì"],3,"一 changes to fourth tone before a first tone."],
  ["一条","One long item","___ tiáo","yī tiáo",["yī","yí","yǐ","yì"],3,"一 changes to fourth tone before a second tone."],
  ["一本","One book / volume","___ běn","yī běn",["yī","yí","yǐ","yì"],3,"一 changes to fourth tone before a third tone."],
];
const twisters: Array<[string,string,string[]]> = [
  ["妈妈骑马，马慢，妈妈骂马。","Mom rides a horse. The horse is slow, so Mom scolds the horse.",["妈妈骑马","马慢","妈妈骂马"]],
  ["白兔抱白萝卜，白萝卜抱不住。","A white rabbit hugs a white radish, but can't hold on to it.",["白兔抱白萝卜","白萝卜抱不住"]],
  ["四是四，十是十，十四是十四，四十是四十。","Four is four, ten is ten, fourteen is fourteen, and forty is forty.",["四是四","十是十","十四是十四","四十是四十"]],
  ["小猫想买小帽，小帽太小，小猫不要。","The kitten wants to buy a little hat. The hat is too small, so the kitten doesn't want it.",["小猫想买小帽","小帽太小","小猫不要"]],
  ["黑猫灰，灰猫黑，黑猫灰猫追灰猫。","The black cat is grey, the grey cat is black, and the cats chase a grey cat.",["黑猫灰","灰猫黑","黑猫灰猫追灰猫"]],
];
const twisterWrittenPinyin = [
  "Māma qí mǎ, mǎ màn, māma mà mǎ.",
  "Bái tù bào bái luóbo, bái luóbo bào bù zhù.",
  "Sì shì sì, shí shì shí, shísì shì shísì, sìshí shì sìshí.",
  "Xiǎo māo xiǎng mǎi xiǎo mào, xiǎo mào tài xiǎo, xiǎo māo bù yào.",
  "Hēi māo huī, huī māo hēi, hēi māo huī māo zhuī huī māo.",
];

export const COURSE_UNITS: CourseUnit[] = [
  { id:"four-tones",title:"The four tones",description:"You may remember these from your first Chinese lessons. The same syllable can mean something completely different when its tone changes. Listen to mā, má, mǎ, and mà, then try each one at a comfortable pitch.",activities:[
    example("tone-1","First tone — high and steady","妈","Mom","Hold one high, comfortable note, like singing a steady laaaa.",1),
    example("tone-2","Second tone — rising","麻","Hemp","Start around the middle of your range and rise, like a surprised “Really?”",2),
    example("tone-3","Third tone — find the low part","马","Horse","In everyday connected speech, third tone often stays low. On its own it can dip and rise. Try a low, sleepy “uhhh”; focus on the low part without straining or forcing a rise.",3),
    example("tone-4","Fourth tone — a quick fall","骂","To scold","Start high and drop quickly, like a firm “No!”",4),
  ]},
  { id:"neutral-tone",title:"The light neutral tone",description:"The neutral tone has no tone mark. It is short and light, with a pitch shaped by the preceding tone: lower after most tones, but higher after third tone.",activities:[
    example("neutral-1","After first tone: drop down","妈妈","Mom","The first syllable is high and steady. Make the neutral syllable shorter and lower.",5,1),
    example("neutral-2","After second tone: come back down","什么","What","After the rise, the neutral syllable is short, light, and lower.",5,2),
    example("neutral-3","After third tone: go up","我们","We / us","After the low third tone, the neutral syllable is usually higher. Keep it short and light.",5,3),
    example("neutral-4","After fourth tone: stay low","爸爸","Dad","After the sharp fall, keep the neutral syllable short and low.",5,4),
  ]},
  { id:"hear-and-say",title:"Hear it, then say it",description:"Listen first, identify the tone pair, then try the word yourself. If you miss it, listen and try again. After two misses, we’ll show the answer and explain it.",activities:listeningWords.map(([text,meaning,pair,explanation],index)=>{
    const distractors=["1 + 1","2 + 3","4 + Neutral","3 + 1","4 + 4"].filter(value=>value!==pair).slice(0,3);
    const answer=index%4;
    const options=[...distractors]; options.splice(answer,0,pair);
    const spokenTones=pair.split(" + ").map(value=>value==="Neutral"?5:Number(value)) as [number,number];
    return {id:`listen-${index+1}`,kind:"listen",title:`Tone pair ${index+1}`,text,meaning,options,answer,explanation,spokenTones,modelPinyin:listeningPinyin[index]};
  })},
  { id:"tone-changes",title:"How tones change",description:"The written tone and the spoken tone can differ. Learn the three common rules, then apply them.",activities:[
    {...example("rule-third","Two third tones together","可以","Can / may","The first third tone becomes a rising second tone: 3 + 3 is spoken 2 + 3."),writtenPinyin:"kě yǐ",spokenTones:[2,3]},
    {...example("rule-bu","不 before fourth tone","不是","Is not / no","不 is usually bù. Before a fourth tone it becomes bú, so the spoken pair is 2 + 4."),writtenPinyin:"bù shì",spokenTones:[2,4]},
    {...example("rule-yi-4","一 before fourth tone","一定","Definitely / certainly","Like 不, 一 becomes second tone before a fourth tone. On its own or in counting, 一 usually stays yī."),writtenPinyin:"yī dìng",spokenTones:[2,4]},
    {...example("rule-yi-1","一 before first tone","一天","One day","Before first, second, or third tone, 一 usually becomes fourth tone."),writtenPinyin:"yī tiān",spokenTones:[4,1]},
    {...example("rule-yi-2","一 before second tone","一年","One year","Check the next tone. Before second tone, 一 becomes fourth tone."),writtenPinyin:"yī nián",spokenTones:[4,2]},
    {...example("rule-yi-3","一 before third tone","一起","Together","Before third tone, 一 becomes fourth tone. Keep the third tone low in connected speech."),writtenPinyin:"yī qǐ",spokenTones:[4,3]},
    ...ruleQuestions.map(([text,meaning,cue,writtenPinyin,options,answer,explanation],index):CourseActivity=>({id:`rule-quiz-${index+1}`,kind:"rule",title:`Apply the rule ${index+1}`,text,meaning,cue,writtenPinyin,options,answer,explanation})),
  ]},
  {id:"tone-challenge",title:"The tone challenge",description:"Chinese tongue twisters are called 绕口令 (ràokǒulìng). Accuracy comes before speed. Listen in chunks, then record the full line.",activities:twisters.map(([text,meaning,chunks],index)=>({id:`challenge-${index+1}`,kind:"speak",title:`Tongue twister ${index+1}`,text,meaning,chunks,writtenPinyin:twisterWrittenPinyin[index],explanation:"Go slowly. After recording, listen again and pay attention to syllables highlighted as needing work. Keep each phrase together, then try again. You can move on and revisit this challenge."}))},
];
export const COURSE_ACTIVITIES = COURSE_UNITS.flatMap(unit=>unit.activities);
export function findActivity(id:string) { return COURSE_ACTIVITIES.find(activity=>activity.id===id); }
export function unitForActivity(id:string) { return COURSE_UNITS.find(unit=>unit.activities.some(activity=>activity.id===id)); }
export function spokenPinyin(activity:CourseActivity) { return activity.modelPinyin??surfacePinyinForText(activity.text); }
