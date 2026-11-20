import type { OnboardingAnswers } from "../flow";
import type { AuthoredLesson, BuildPrompt, LessonPhrase } from "./types";
import type { Curriculum, CurriculumPractice, GrammarCard, LessonReading, WritingPractice } from "./curriculum";
import { ADVANCED_TOPICS, TOPIC_ENGLISH, interestDetail, interestMeaning, phrase as w } from "./advancedTopics";

const example = (label: string, hanzi: string, meaning: string) => ({ ...w(hanzi, meaning), label });
const choice = (prompt: string, correct: LessonPhrase, wrong: LessonPhrase, explanation: string, reading?: LessonReading): CurriculumPractice => ({ kind: "choice", prompt, choices: [correct, wrong], correct: correct.id, explanation, reading });
const writing = (prompt: string, sample: LessonPhrase, required: string[], rubric: string, hint: string, reading?: LessonReading): WritingPractice => ({ kind: "writing", prompt, sample, required, rubric, hint, reading });
function build(result: LessonPhrase, pieces: string[]): BuildPrompt {
 const chunks = pieces.map((text, i) => ({ id: `part-${i}`, label: text, pinyin: w(text, "").pinyin }));
 return { prompt: result.meaning, result, chunks, order: chunks.map(c => c.id) };
}

export function advancedFirstLesson(a: OnboardingAnswers, tier: 4 | 5 | 6): AuthoredLesson {
 const goal = a.goal.primary ?? "other", en = TOPIC_ENGLISH[goal];
 // A dinner decision provides interchangeable options; holidays do not.
 const t = goal === "heritage" && tier === 4 ? {
  ...ADVANCED_TOPICS.heritage, label: "family meals",
  a: w("饺子", "dumplings", "jiǎozi"), b: w("面条", "noodles", "miàntiáo"),
  verb: w("吃", "eat", "chī"), quality: w("好吃", "tasty", "hǎochī"),
 } : ADVANCED_TOPICS[goal];
 const A = t.a.hanzi, B = t.b.hanzi, verb = t.verb.hanzi, subject = t.subject;
 const orQuestion = w(`你想${verb}${A}还是${B}？`, `Would you like to ${t.verb.meaning} ${t.a.meaning} or ${t.b.meaning}?`);
 const orStatement = w(`我想${verb}${A}或者${B}。`, `I’d like to ${t.verb.meaning} ${t.a.meaning} or ${t.b.meaning}.`);
 const more = w(`我觉得${A}比${B}更${t.quality.hanzi}。`, `Compared with ${t.b.meaning}, I find ${t.a.meaning} more ${t.quality.meaning}.`);
 const besides = w(`除了${A}以外，${subject}还${verb}${B}。`, `Besides ${t.a.meaning}, we also ${t.verb.meaning} ${t.b.meaning}.`);
 const secondBesides = w(`除了${verb}${A}以外，${subject}还${t.otherAction}。`, `We ${t.verb.meaning} ${t.a.meaning}; we also ${en.otherAction}.`);
 let cards: GrammarCard[], practices: CurriculumPractice[], core: LessonPhrase[], personalized: LessonPhrase[], title: string, note: Curriculum["note"];
 let first = orStatement, second = more, question = orQuestion;
 let reply = w(`我更想${verb}${A}。`, `I’d rather ${t.verb.meaning} ${t.a.meaning}.`);
 let wrongReply = w(`我更想${verb}${B}。`, `I’d rather ${t.verb.meaning} ${t.b.meaning}.`);
 let missionContext = `You’re discussing ${t.label} with Huahua. For this practice, you prefer ${t.a.meaning}.`;
 let missionTask = "Tell Huahua which option you prefer.";
 let discussion: Curriculum["discussion"];
 if (tier === 4) {
  title = "Offer choices and say what you prefer";
  core = [w("还是", "or, when asking someone to choose", "háishi"), w("或者", "or, when stating alternatives", "huòzhě"), w("更", "more / even more", "gèng")];
  const preferB = t.b;
  const compare = w(`我觉得${A}比${preferB.hanzi}更${t.quality.hanzi}。`, `Compared with ${preferB.meaning}, I find ${t.a.meaning} more ${t.quality.meaning}.`);
  personalized = [t.a, preferB, t.quality];
  const q = orQuestion;
  const stmt = goal === "heritage" ? w("我们可以吃饺子或者面条。", "We can have dumplings or noodles.") : orStatement;
  first = stmt; second = compare; question = q;

  cards = [{
   id: "choice-or", format: "contrast", title: "Ask them to choose. Or give options.", explanation: "还是 asks for a choice. 或者 gives alternatives in a statement.",
   examples: [{ ...example("Ask for a choice", q.hanzi, q.meaning), highlight: { hanzi: "还是", pinyin: "hái shì" }, context: "You want the other person to pick one." }, { ...example("State the options", stmt.hanzi, stmt.meaning), highlight: { hanzi: "或者", pinyin: "huò zhě" }, context: "You’re saying what the options are." }],
   takeaway: "Choice question → 还是. Statement with alternatives → 或者.", detail: "These are the two uses we’re practising here.",
   check: choice(`You want Huahua to choose. 你想${verb}${A} ___ ${preferB.hanzi}？`, core[0], core[1], "Use 还是 when asking the listener to choose between alternatives."),
  }, {
   id: "more-comparison", format: "pattern", title: "Say which one you prefer.", explanation: "比 names what you’re comparing with. 更 adds ‘more’ before the quality.",
   examples: [example("One opinion", `我觉得${A}很${t.quality.hanzi}。`, `I think ${t.a.meaning} is ${t.quality.meaning}.`), { ...example("Compare two options", compare.hanzi, compare.meaning), highlight: { hanzi: "更", pinyin: "gèng" } }],
   takeaway: `A + 比 + B + 更 + a quality.`, detail: "更 can also compare with an option already clear from context.",
   check: choice(`Complete the comparison. 我觉得${A}比${preferB.hanzi} ___ ${t.quality.hanzi}。`, core[2], core[1], `更 goes before ${t.quality.hanzi} to mean ‘more ${t.quality.meaning}’.`),
  }];
  const reading: LessonReading = {
   title: "Making a choice together",
   text: `小林问我：“你想${verb}${A}还是${preferB.hanzi}？”我说：“${A}或者${preferB.hanzi}都可以。”小林更喜欢${A}，因为他觉得${A}更${t.quality.hanzi}。最后，我们决定${verb}${A}。${interestDetail(a)}`,
   pinyin: "", translation: `Xiaolin asks whether I’d like to ${t.verb.meaning} ${t.a.meaning} or ${preferB.meaning}. I say either is fine. Xiaolin prefers ${t.a.meaning} because he thinks it is more ${t.quality.meaning}. In the end, we decide on ${t.a.meaning}. ${interestMeaning(a)}`,
  }; reading.pinyin = w(reading.text, "").pinyin;
  practices = [
   choice(`Complete the question. 你想${verb}${A} ___ ${preferB.hanzi}？`, core[0], core[1], "Use 还是 to ask someone to choose between two alternatives."),
   choice(`Complete the comparison. 我觉得${A}比${preferB.hanzi} ___ ${t.quality.hanzi}。`, core[2], core[1], "更 goes before the quality to mean ‘more’."),
   choice(`Ask Huahua which option they want. 你想${verb}${preferB.hanzi} ___ ${A}？`, core[0], core[1], "A direct choice question uses 还是."),
   choice(`Suggest two options for ${goal === "heritage" ? "dinner" : "your plans"}. ${goal === "heritage" ? "我们可以" : "我想"}${verb}${A} ___ ${preferB.hanzi}。`, core[1], core[0], "A statement giving alternatives uses 或者."),
   { kind: "reading", reading },
   choice("小林更喜欢什么？ — Which does Xiaolin prefer?", t.a, preferB, `The story says 小林更喜欢${A}.`, reading),
   choice("Which expression asks for a choice in the story?", core[0], core[1], "小林 uses 还是 to ask which option you want.", reading),
   choice("What do they decide to do in the end?", w(`${verb}${A}`, `Choose ${t.a.meaning}`), w(`${verb}${preferB.hanzi}`, `Choose ${preferB.meaning}`), `The last sentence says 我们决定${verb}${A}.`, reading),
  ];
  note = { title: "Two useful kinds of ‘or’", text: "还是 asks someone to choose. 或者 states alternatives. 更 can show a stronger preference or a greater degree. These words have other uses too; today you practised these specific patterns." };
 } else if (tier === 5) {
  title = "Connect two ideas with ‘besides… also…’";
  core = [w("除了", "besides / apart from", "chúle"), w("以外", "outside / apart from", "yǐwài"), w("还", "also / additionally", "hái")];
  personalized = [t.b, t.extra, t.culture, t.verb]; first = besides; second = secondBesides;
  question = w(`除了${A}以外，你们还${verb}什么？`, `Besides ${t.a.meaning}, what else do you ${t.verb.meaning}?`);
  reply = w(`除了${A}以外，我们还${verb}${B}。`, `Besides ${t.a.meaning}, we also ${t.verb.meaning} ${t.b.meaning}.`);
  wrongReply = w(`我们只${verb}${A}。`, `We only ${t.verb.meaning} ${t.a.meaning}.`);
  missionContext = `Huahua asks about ${t.label}. In this practice, you do both: ${t.a.meaning} and ${t.b.meaning}.`;
  missionTask = "Tell Huahua about the second one too.";
  cards = [{
   id: "besides-frame", format: "pattern", title: "Keep the first idea. Add another.", explanation: "除了…以外 sets up the first item. 还 introduces something additional.",
   examples: [example("Start with one idea", `${subject}${verb}${A}。`, `We ${t.verb.meaning} ${t.a.meaning}.`), example("Add a second idea", besides.hanzi, besides.meaning)],
   takeaway: "除了 + A + 以外，subject + 还 + B.", detail: "With 还, A is included: both A and B are true.",
   check: choice("In this pattern, are both items included?", w("两个都包括", "Both are included"), w("只包括第二个", "Only the second is included"), "还 adds a second item to the first. It does not remove the first one."),
  }, {
   id: "besides-action", format: "pattern", title: "You can add an activity too.", explanation: "The first piece can be an item or an entire activity.",
   examples: [example("Two items", besides.hanzi, besides.meaning), example("Two activities", secondBesides.hanzi, secondBesides.meaning)],
   takeaway: "除了 + first activity + 以外，subject + 还 + second activity.",
   check: choice(`Complete the addition: 除了${A}以外，${subject} ___ ${verb}${B}。`, core[2], w("不", "not"), "还 means ‘also’ and introduces the extra information."),
  }];
  const reading: LessonReading = { title: "More than one way to connect", text: `除了${A}以外，${subject}还${verb}${B}。除了${verb}${A}以外，${subject}还${t.otherAction}。大家觉得，这些活动能让我们更了解彼此，也能帮助我们了解${t.culture.hanzi}。${interestDetail(a)}每个人都有自己的想法，我们会一起讨论。`, pinyin: "", translation: `Besides ${t.a.meaning}, we also ${t.verb.meaning} ${t.b.meaning}. Besides the first activity, we also ${goal === "heritage" ? "visit relatives" : goal === "work" ? "work with colleagues" : goal === "school" ? "discuss things with classmates" : goal === "travel" ? "chat with local people" : "chat with friends"}. Everyone feels these activities help us understand each other and learn about ${t.culture.meaning}. ${interestMeaning(a)} Everyone has their own ideas, and we discuss them together.` }; reading.pinyin = w(reading.text, "").pinyin;
  practices = [
   writing(`Combine these ideas: ${subject}${verb}${A}。 ${subject}也${verb}${B}。`, besides, ["除了", "以外", "还", A, B], "Combine the two supplied facts using 除了…以外…还. Either item may come first. Preserve both facts.", "Use 除了…以外，…还…. Type one full sentence."),
   writing(`Combine these activities: ${subject}${verb}${A}。 ${subject}也${t.otherAction}。`, secondBesides, ["除了", "以外", "还"], `Combine both activities, ${verb}${A} and ${t.otherAction}, without changing their meaning. Either may come first.`, "Put the whole first activity between 除了 and 以外."),
   { kind: "reading", reading },
   choice(`除了${A}以外，他们还${verb}什么？`, t.b, t.a, `The first sentence adds ${B}.`, reading),
   choice("Why do they value these activities?", w("能更了解彼此", "They can understand each other better"), w("不想一起讨论", "They don’t want to discuss things"), "The passage says the activities help them understand one another.", reading),
   writing("你更喜欢哪一种活动？为什么？ — Which activity do you prefer, and why?", w(`我更喜欢${verb}${A}，因为我觉得很有意思。`, `I prefer ${t.a.meaning} because I find it interesting.`), [], "A relevant Mandarin preference and a reason. Either preference or a different related activity is valid. Never grade the opinion itself.", "There’s no single right opinion. Explain yours in Mandarin.", reading),
   writing("除了文中的活动以外，你还想做什么？为什么？ — What else would you like to do, and why?", w(`除了${verb}${A}以外，我还想和朋友聊天，因为我喜欢听不同的想法。`, "Besides the first activity, I’d also like to chat with friends because I enjoy different ideas."), ["除了", "以外", "还"], "Add a related activity and give a reason using the addition pattern. Any reasonable personal opinion is valid.", "Use the addition pattern to add your own idea.", reading),
  ];
  note = { title: "Adding, rather than excluding", text: "Besides can have more than one meaning. In 除了…以外，还…, 还 makes this an addition: both ideas are included. Keep the subject before 还, then add the second action or fact." };
 } else {
  title = "Explore a viewpoint and respond to another";
  core = [w("一方面", "on one hand", "yì fāngmiàn"), w("另一方面", "on the other hand", "lìng yì fāngmiàn"), w("在我看来", "in my view", "zài wǒ kànlái"), w("从……的角度来看", "from the perspective of…", "cóng … de jiǎodù lái kàn"), w("然而", "however", "rán’ér")];
  const opinionWords = ({heritage:[w("传统", "tradition"),w("庆祝", "celebrate")],work:[w("员工", "employees"),w("交流", "communication")],school:[w("学生", "students"),w("基础知识", "foundational knowledge")],travel:[w("计划", "plans"),w("自由时间", "free time")],everyday:[w("联系", "contact"),w("生活", "life")],other:[w("应用", "apps"),w("交流", "communication")]} as const)[goal];
  personalized = [...opinionWords];
  const opinion = w(`在我看来，${t.position}。`, `In my view, ${en.position}.`);
  const twoSides = w(`一方面，${t.benefit}；另一方面，${t.cost}。`, `On one hand, ${en.benefit}; on the other hand, ${en.cost}.`);
  const perspective = w(`从${t.perspective}的角度来看，${t.benefit}。`, `From the perspective of ${en.perspective}, ${en.benefit}.`);
  const however = w(`${t.benefit}。然而，${t.cost}。`, `${en.benefit}. However, ${en.cost}.`);
  first = opinion; second = twoSides; question = w(`${t.issue}你怎么看？`, `${en.issue} What do you think?`);
  reply = w(`在我看来，${t.benefit}。`, `In my view, ${en.benefit}.`); wrongReply = w(`在我看来，这完全没有好处。`, "In my view, there is no benefit at all.");
  missionContext = `You’re discussing ${t.label}. Huahua will raise a concern after your first reply.`;
  missionTask = "Start by explaining one benefit.";
  cards = [{ id: "state-view", format: "pattern", title: "Make it clear this is your view.", explanation: "Start with 在我看来, then give your opinion.", examples: [example("Your viewpoint", opinion.hanzi, opinion.meaning), example("Another person’s viewpoint", `在小林看来，${t.benefit}。`, `In Xiaolin’s view, ${en.benefit}.`)], takeaway: "在我看来 + your opinion.", check: choice("Which expression introduces your own view?", core[2], core[4], "在我看来 explicitly introduces your viewpoint.") },
  { id: "two-sides", format: "contrast", title: "Hold two ideas together.", explanation: "一方面 introduces one consideration. 另一方面 adds another.", examples: [example("One consideration", `一方面，${t.benefit}。`, `On one hand, ${en.benefit}.`), example("Another consideration", `另一方面，${t.cost}。`, `On the other hand, ${en.cost}.`)], takeaway: "一方面…，另一方面….", detail: "The two points can contrast or simply be different aspects.", check: choice("You’ve introduced 一方面. Which expression naturally starts the second aspect?", core[1], core[2], "一方面 and 另一方面 organize two aspects of a topic.") },
  { id: "perspective", format: "pattern", title: "Name whose perspective you’re taking.", explanation: "Put the person or group between 从 and 的角度来看.", examples: [example("A particular perspective", perspective.hanzi, perspective.meaning), example("A different perspective", `从家人的角度来看，理解彼此很重要。`, "From the family’s perspective, understanding each other matters.")], takeaway: "从 + person or group + 的角度来看 + a viewpoint.", check: choice(`Which phrase means ‘from the perspective of ${t.perspective}’?`, w(`从${t.perspective}的角度来看`, "From this group’s perspective"), w("在我看来", "In my view"), "从…的角度来看 names the perspective you’re considering.") },
  { id: "however", format: "change", title: "Add a point that pushes back.", explanation: "然而 introduces a contrast with the previous point.", examples: [example("A benefit", `${t.benefit}。`, "There is a benefit."), example("Add a contrasting point", however.hanzi, however.meaning)], takeaway: "First point. 然而，contrasting point.", detail: "然而 is common in more formal speech and writing.", check: choice("Which expression introduces a contrasting point?", core[4], core[0], "然而 signals a contrast: ‘however’.") }];
  const reading: LessonReading = { title: t.issue, text: `${t.issue}一方面，${t.benefit}；另一方面，${t.cost}。从${t.perspective}的角度来看，他们的需要也值得理解。然而，也要听听别人的想法。${interestDetail(a)}在我看来，${t.position}。这样才能找到合适的办法。`, pinyin: "", translation: `${en.issue} On one hand, ${en.benefit}; on the other hand, ${en.cost}. From the perspective of ${en.perspective}, their needs also deserve understanding. However, we should also listen to others. ${interestMeaning(a)} In the writer’s view, ${en.position}. This helps us find an approach that works for everyone.` }; reading.pinyin = w(reading.text, "").pinyin;
  const passage = w(`${opinion.hanzi}${twoSides.hanzi}`, `${opinion.meaning} ${twoSides.meaning}`);
  practices = [{ kind: "reading", reading },
   choice("作者的主要观点是什么？ — What is the writer’s main position?", w(t.position, "Balance the needs and considerations"), w("只考虑自己的需要就够了", "Only your own needs matter"), "The final opinion balances the different considerations rather than ignoring others.", reading),
   writing("你认同作者的观点吗？为什么？ — Do you agree with the writer? Explain why.", w(`我认同这个观点，因为每个人的情况不同，我们需要理解彼此。`, "I agree because people have different circumstances and need mutual understanding."), [], "A relevant response to the reading with a clear reason. Agreement, disagreement, or a qualified view are all valid. Judge the reasoning and Mandarin expression, not the opinion.", "You may agree or disagree. Give a reason in Mandarin.", reading),
   { ...writing(`Write 2–3 Mandarin sentences about ${t.label}. Use 在我看来, 一方面…另一方面…, and both words: ${opinionWords.map(p => p.hanzi).join("、")}.`, passage, ["在我看来", "一方面", "另一方面", ...opinionWords.map(p => p.hanzi)], "Two or three coherent Mandarin sentences about the topic, giving a view and two considerations. Use both supplied vocabulary items naturally. Accept any defensible viewpoint.", "Sentence 1: your view. Sentence 2 (or 2–3): two aspects. Use 。！？ to end sentences."), minSentences: 2, maxSentences: 3 },
  ];
  const finalReply = w(`我理解你的看法。然而，${t.position}。`, `I understand your view. However, ${en.position}.`);
  const concern = w(`不过，${t.cost}。你会怎么回应？`, `But ${en.cost}. How would you respond?`);
  const offTopic = w("我不想听你的想法。", "I don’t want to hear your view.");
  discussion = { mission: {context:"Huahua has heard your first point and now raises a concern.",task:"Acknowledge the concern and explain a balanced response."}, huahua: concern, choices: [offTopic, finalReply], expectedChoiceId: finalReply.id, responses: { [finalReply.id]: w("谢谢你解释自己的想法。我们可以继续讨论不同的看法。", "Thank you for explaining. We can keep discussing different views.") }, outcomeVisual: { [finalReply.id]: "check" } };
  note = { title: "Make room for different views", text: "在我看来 marks your view. 从…的角度来看 names a perspective. 一方面…另一方面… organizes two aspects, and 然而 introduces a contrast. You can acknowledge another view and still explain your own." };
 }
 const scene = `${missionContext} ${missionTask}`;
 // Supporting words are offered in the same familiarity check, so learners can skip them.
 const supporting = tier === 4 ? [t.verb, w("想", "want to"), w("觉得", "think / feel"), w("比", "than / compared with"), ...(goal === "heritage" ? [w("我们", "we / us", "wǒmen"), w("可以", "can / may", "kěyǐ")] : [])] : tier === 5 ? [t.a] : [];
 const words = Array.from(new Map([...core, ...supporting, ...personalized].map(p => [p.id, p])).values());
 const personalIds = new Set(personalized.map(p => p.id));
 const match = words.map(p => ({ ...p, label: p.meaning, visual: "word" }));
 const firstBuild = build(first, tier === 4 ? [goal === "heritage" ? "我们可以" : "我想", verb + A, "或者", B] : tier === 5 ? ["除了", A, "以外", subject, "还", verb + B] : ["在我看来", t.position]);
 const transferBuild = build(second, tier === 4 ? ["我觉得", A, "比", B, "更", t.quality.hanzi] : tier === 5 ? ["除了", verb + A, "以外", subject, "还", t.otherAction] : ["一方面", t.benefit, "另一方面", t.cost]);
 return {
  id: goal === "heritage" && tier === 4 ? "curriculum-v2-4-heritage-dinner" : `curriculum-v1-${tier}-${goal}`, route: goal === "travel" ? "travel" : goal === "work" || goal === "school" ? "work" : "social", band: tier === 4 ? "intermediate" : "advanced",
  outcome: title, situation: scene, skill: cards[0].explanation, huahuaPose: "coaching", targets: [first, second], match, build: firstBuild, transferBuild, sentenceWords: words, questionWords: [question], starter: w("我", "I"), mission: scene, speakTargetId: first.id, completionLine: title,
  chat: { mission: {context:missionContext,task:missionTask}, huahua: question, choices: [wrongReply, reply], expectedChoiceId: reply.id, responses: { [reply.id]: w("明白了，谢谢你告诉我！", "Got it. Thanks for telling me!") }, outcomeVisual: { [reply.id]: "check" } },
  curriculum: { cards, practices, note, pronunciation: tier === 4, discussion, vocabularyGroups: [{ id: "core", title: "Core expressions", wordIds: words.filter(p => !personalIds.has(p.id)).map(p => p.id) }, { id: "personalized", title: "Words for your goal", wordIds: words.filter(p => personalIds.has(p.id)).map(p => p.id) }] },
  template: { id: `curriculum-${tier}`, tier, scene, teaching: words, incomingTeaching: [], construction: tier === 4 ? "Huahua is asking you to choose. Give the preference described in your situation." : tier === 5 ? "Huahua asks what else you do. Keep the first idea and add the second with 除了…以外…还…." : "Explain the benefit first. Then practise responding thoughtfully when Huahua raises a concern.", shortRoute: false, quizPairs: match },
 };
}
