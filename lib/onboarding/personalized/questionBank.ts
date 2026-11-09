// Curated, deterministic calibration bank. Content is reviewed by hand; no
// live AI generation. Vocabulary per level stays within that HSK band so
// early levels are never overestimated.

import type { InternalLevel } from "./levels";
import type { TopicFamily } from "./goals";

export type QuestionType = "meaning" | "complete" | "response" | "word_choice";
export type AssessmentTopic = "general" | TopicFamily;

export type BankChoice = {
  id: string;
  /** Chinese choice (Simplified). Omitted for English meaning choices. */
  zh?: string;
  /** English choice text (meaning questions). */
  en?: string;
};

export type BankQuestion = {
  id: string;
  level: InternalLevel;
  topic: AssessmentTopic;
  type: QuestionType;
  /** Simplified Chinese prompt; "___" marks a blank. */
  zh: string;
  /** Optional overrides; otherwise derived with opencc / pinyin-pro. */
  traditional?: string;
  pinyin?: string;
  /** English meaning of the completed prompt (shown only after answering, if at all). */
  translation: string;
  /** English situation for word_choice questions. */
  context?: string;
  choices: BankChoice[];
  answer: string;
  /** 1 = easiest within its level. */
  difficulty: 1 | 2 | 3;
  /** Diagnostic weight multiplier (role weight is applied separately). */
  weight: number;
  /** Internal review note. Never shown to learners. */
  explanation: string;
  active: boolean;
};

type Draft = Omit<BankQuestion, "weight" | "active" | "difficulty" | "choices" | "answer"> & {
  difficulty?: 1 | 2 | 3;
  weight?: number;
  active?: boolean;
  /** First choice is the correct one; display order is shuffled per attempt. */
  options: Array<string>;
};

function build(draft: Draft): BankQuestion {
  const ids = ["a", "b", "c", "d"];
  const choices: BankChoice[] = draft.options.map((option, index) =>
    draft.type === "meaning" ? { id: ids[index], en: option } : { id: ids[index], zh: option },
  );
  const { options: _options, ...rest } = draft;
  return {
    ...rest,
    choices,
    answer: "a",
    difficulty: draft.difficulty ?? 2,
    weight: draft.weight ?? 1,
    active: draft.active ?? true,
  };
}

const DRAFTS: Draft[] = [
  // ── Pre-HSK (0): single high-frequency words, always shown with pinyin ──
  { id: "l0-nihao", level: 0, topic: "general", type: "meaning", zh: "你好", translation: "Hello", options: ["Hello", "Thank you", "Goodbye"], difficulty: 1, explanation: "Most common greeting." },
  { id: "l0-xiexie", level: 0, topic: "general", type: "meaning", zh: "谢谢", translation: "Thank you", options: ["Thank you", "Sorry", "Hello"], difficulty: 1, explanation: "Basic courtesy word." },
  { id: "l0-zaijian", level: 0, topic: "general", type: "word_choice", zh: "", context: "You are leaving and want to say goodbye.", translation: "Goodbye", options: ["再见", "你好", "谢谢"], difficulty: 1, explanation: "Picks the farewell among three greetings." },
  { id: "l0-mama", level: 0, topic: "family", type: "meaning", zh: "妈妈", translation: "Mom", options: ["Mom", "Dad", "Friend"], difficulty: 1, explanation: "Core family word." },
  { id: "l0-cha", level: 0, topic: "everyday", type: "meaning", zh: "茶", translation: "Tea", options: ["Tea", "Water", "Rice"], difficulty: 1, explanation: "Common everyday noun." },
  { id: "l0-laoshi", level: 0, topic: "school", type: "meaning", zh: "老师", translation: "Teacher", options: ["Teacher", "Student", "Doctor"], difficulty: 1, explanation: "Classroom word." },
  { id: "l0-zhongguo", level: 0, topic: "travel", type: "meaning", zh: "中国", translation: "China", options: ["China", "Japan", "America"], difficulty: 1, explanation: "Country name most learners recognize." },
  { id: "l0-gongzuo", level: 0, topic: "work", type: "meaning", zh: "工作", translation: "Work", options: ["Work", "Sleep", "Eat"], difficulty: 2, explanation: "Common verb and noun for work." },
  { id: "l0-wo", level: 0, topic: "general", type: "meaning", zh: "我", translation: "I or me", options: ["I or me", "You", "He"], difficulty: 1, explanation: "First-person pronoun." },
  { id: "l0-reply-nihao", level: 0, topic: "general", type: "response", zh: "你好！", translation: "Hello!", options: ["你好！", "对不起！", "再见！"], difficulty: 2, explanation: "Mirror greeting." },
  { id: "l0-san", level: 0, topic: "general", type: "meaning", zh: "三", translation: "Three", options: ["Three", "Ten", "Five"], difficulty: 1, explanation: "Basic number." },
  { id: "l0-shui", level: 0, topic: "travel", type: "meaning", zh: "水", translation: "Water", options: ["Water", "Tea", "Milk"], difficulty: 1, explanation: "Ordering basics while traveling." },

  // ── HSK 1 ──
  { id: "l1-shi", level: 1, topic: "general", type: "complete", zh: "我___中国人。", translation: "I am Chinese.", options: ["是", "在", "有"], difficulty: 1, explanation: "是 for identity." },
  { id: "l1-name", level: 1, topic: "general", type: "response", zh: "你叫什么名字？", translation: "What is your name?", options: ["我叫王明。", "我很好，谢谢。", "不客气。"], difficulty: 1, explanation: "Name question." },
  { id: "l1-mingtian", level: 1, topic: "general", type: "meaning", zh: "明天见！", translation: "See you tomorrow!", options: ["See you tomorrow!", "See you today!", "Good morning!"], difficulty: 2, explanation: "明天 vs 今天." },
  { id: "l1-price", level: 1, topic: "travel", type: "word_choice", zh: "", context: "You want to ask how much something costs.", translation: "How much is it?", options: ["多少钱？", "几点？", "在哪儿？"], difficulty: 2, explanation: "Question words for price, time, place." },
  { id: "l1-doctor", level: 1, topic: "work", type: "complete", zh: "他在医院工作，他是___。", translation: "He works at a hospital. He is a doctor.", options: ["医生", "学生", "老师"], difficulty: 2, explanation: "Workplace to job." },
  { id: "l1-school", level: 1, topic: "school", type: "complete", zh: "我是学生，我在___学习汉语。", translation: "I am a student. I study Chinese at school.", options: ["学校", "饭店", "商店"], difficulty: 2, explanation: "Place nouns." },
  { id: "l1-daughter", level: 1, topic: "family", type: "meaning", zh: "这是我女儿。", translation: "This is my daughter.", options: ["This is my daughter.", "This is my mom.", "This is my friend."], difficulty: 2, explanation: "Family member noun." },
  { id: "l1-tea", level: 1, topic: "everyday", type: "response", zh: "你喜欢喝茶吗？", translation: "Do you like drinking tea?", options: ["喜欢，我很喜欢。", "我是老师。", "明天见。"], difficulty: 1, explanation: "Yes/no question with 吗." },
  { id: "l1-plane", level: 1, topic: "travel", type: "complete", zh: "我们坐___去北京。", translation: "We are taking a plane to Beijing.", options: ["飞机", "医院", "椅子"], difficulty: 2, explanation: "坐 plus transport." },
  { id: "l1-time", level: 1, topic: "everyday", type: "response", zh: "现在几点？", translation: "What time is it now?", options: ["三点。", "三个人。", "很好。"], difficulty: 2, explanation: "几点 vs measure word." },
  { id: "l1-you", level: 1, topic: "family", type: "complete", zh: "我___两个儿子。", translation: "I have two sons.", options: ["有", "是", "在"], difficulty: 2, explanation: "有 for possession." },
  { id: "l1-shop", level: 1, topic: "everyday", type: "meaning", zh: "我想去商店买东西。", translation: "I want to go to the store to buy things.", options: ["I want to go to the store to buy things.", "I want to go to school to study.", "I want to go home to sleep."], difficulty: 3, explanation: "Short sentence comprehension." },
  { id: "l1-job", level: 1, topic: "work", type: "response", zh: "你做什么工作？", translation: "What work do you do?", options: ["我是老师。", "我在家。", "我很好。"], difficulty: 2, explanation: "Job question." },

  // ── HSK 2 ──
  { id: "l2-yijing", level: 2, topic: "general", type: "complete", zh: "我___吃饭了，不饿。", translation: "I have already eaten, so I am not hungry.", options: ["已经", "因为", "可是"], difficulty: 2, explanation: "已经 with 了." },
  { id: "l2-suoyi", level: 2, topic: "general", type: "complete", zh: "因为下雨了，___我们不去了。", translation: "Because it is raining, we are not going.", options: ["所以", "但是", "还是"], difficulty: 2, explanation: "因为…所以 pattern." },
  { id: "l2-airport", level: 2, topic: "travel", type: "response", zh: "你什么时候去机场？", translation: "When are you going to the airport?", options: ["明天早上去。", "坐出租车去。", "在机场旁边。"], difficulty: 2, explanation: "什么时候 asks time, not manner." },
  { id: "l2-company", level: 2, topic: "work", type: "meaning", zh: "我在一家公司工作。", translation: "I work at a company.", options: ["I work at a company.", "I am looking for a job.", "My company is very big."], difficulty: 1, explanation: "Measure word 家 for companies." },
  { id: "l2-exam", level: 2, topic: "school", type: "complete", zh: "明天有考试，我要好好___。", translation: "There is an exam tomorrow, so I need to prepare well.", options: ["准备", "送", "卖"], difficulty: 2, explanation: "准备 for exams." },
  { id: "l2-cheap", level: 2, topic: "travel", type: "complete", zh: "这个宾馆太贵了，有没有___一点儿的？", translation: "This hotel is too expensive. Is there a cheaper one?", options: ["便宜", "漂亮", "快乐"], difficulty: 2, explanation: "Contrast with 贵." },
  { id: "l2-older", level: 2, topic: "family", type: "meaning", zh: "我哥哥比我大三岁。", translation: "My older brother is three years older than me.", options: ["My older brother is three years older than me.", "My older brother is three years old.", "I have three older brothers."], difficulty: 3, explanation: "比 comparison." },
  { id: "l2-sport", level: 2, topic: "everyday", type: "response", zh: "你喜欢什么运动？", translation: "What sports do you like?", options: ["我喜欢游泳。", "我喜欢红色。", "我是学生。"], difficulty: 1, explanation: "运动 category." },
  { id: "l2-help", level: 2, topic: "work", type: "word_choice", zh: "", context: "A coworker helped you. What do you say?", translation: "Thank you for your help.", options: ["谢谢你的帮助。", "没关系。", "请进。"], difficulty: 2, explanation: "Thanks vs reply to apology." },
  { id: "l2-zhengzai", level: 2, topic: "everyday", type: "complete", zh: "我正在___电视，等一下给你打电话。", translation: "I am watching TV. I will call you in a moment.", options: ["看", "听", "说"], difficulty: 1, explanation: "看电视 collocation." },
  { id: "l2-teacher", level: 2, topic: "school", type: "response", zh: "老师，这个问题我不懂。", translation: "Teacher, I do not understand this question.", options: ["没关系，我再说一遍。", "不客气，再见。", "我也是学生。"], difficulty: 2, explanation: "Natural teacher reply." },
  { id: "l2-birthday", level: 2, topic: "family", type: "complete", zh: "今天是我妈妈的___，我给她买了一件衣服。", translation: "Today is my mom's birthday. I bought her some clothes.", options: ["生日", "考试", "事情"], difficulty: 2, explanation: "生日 in context." },

  // ── HSK 3 ──
  { id: "l3-suiran", level: 3, topic: "general", type: "complete", zh: "虽然很累，___他还是去上班了。", translation: "Although he was tired, he still went to work.", options: ["但是", "因为", "如果"], difficulty: 2, explanation: "虽然…但是 pattern." },
  { id: "l3-anpai", level: 3, topic: "work", type: "complete", zh: "经理让我___明天的会议。", translation: "The manager asked me to arrange tomorrow's meeting.", options: ["安排", "满意", "担心"], difficulty: 2, explanation: "安排 with 会议." },
  { id: "l3-chengji", level: 3, topic: "school", type: "complete", zh: "我的数学___越来越好了。", translation: "My math grades are getting better and better.", options: ["成绩", "环境", "护照"], difficulty: 2, explanation: "成绩 for grades." },
  { id: "l3-huzhao", level: 3, topic: "travel", type: "complete", zh: "别忘了带___，出国的时候要用。", translation: "Do not forget your passport. You need it to go abroad.", options: ["护照", "菜单", "作业"], difficulty: 1, explanation: "Travel documents." },
  { id: "l3-jieri", level: 3, topic: "family", type: "complete", zh: "春节是中国最重要的___。", translation: "Spring Festival is the most important holiday in China.", options: ["节日", "文化", "历史"], difficulty: 2, explanation: "节日 vs related abstract nouns." },
  { id: "l3-manyi", level: 3, topic: "travel", type: "response", zh: "这家饭馆的菜怎么样？", translation: "How is the food at this restaurant?", options: ["又便宜又好吃，我很满意。", "我是坐地铁来的。", "明天下午三点。"], difficulty: 2, explanation: "又…又 evaluation." },
  { id: "l3-yuelaiyue", level: 3, topic: "general", type: "meaning", zh: "天气越来越冷了。", translation: "The weather is getting colder and colder.", options: ["The weather is getting colder and colder.", "The weather was cold yesterday.", "It is not cold today."], difficulty: 1, explanation: "越来越 pattern." },
  { id: "l3-weekend", level: 3, topic: "everyday", type: "response", zh: "你周末一般做什么？", translation: "What do you usually do on weekends?", options: ["我一般一边听音乐一边打扫房间。", "我上个月去了上海。", "我的房间在二楼。"], difficulty: 3, explanation: "Habitual 一般 and 一边…一边." },
  { id: "l3-jiejue", level: 3, topic: "work", type: "word_choice", zh: "", context: "You want to tell your boss the problem has been solved.", translation: "The problem has been solved.", options: ["问题已经解决了。", "问题越来越多了。", "我对这个问题不感兴趣。"], difficulty: 2, explanation: "解决 with 已经." },
  { id: "l3-chule", level: 3, topic: "school", type: "meaning", zh: "除了数学以外，我还喜欢历史。", translation: "Besides math, I also like history.", options: ["Besides math, I also like history.", "I like math but not history.", "I do not like math or history."], difficulty: 3, explanation: "除了…以外…还 inclusion." },
  { id: "l3-huanjing", level: 3, topic: "family", type: "complete", zh: "爷爷奶奶家附近有很多树，___特别好。", translation: "There are many trees near my grandparents' home, so the environment is especially nice.", options: ["环境", "成绩", "护照"], difficulty: 2, explanation: "环境 in a home context." },

  // ── HSK 4 ──
  { id: "l4-kehu", level: 4, topic: "work", type: "complete", zh: "我们下周和___签合同。", translation: "Next week we will sign the contract with the client.", options: ["客户", "导游", "亲戚"], difficulty: 2, explanation: "客户 with 合同." },
  { id: "l4-jishi", level: 4, topic: "general", type: "complete", zh: "即使工作很忙，他___每天坚持锻炼。", translation: "Even when work is busy, he still exercises every day.", options: ["也", "才", "就"], difficulty: 3, explanation: "即使…也 pattern." },
  { id: "l4-tuichi", level: 4, topic: "travel", type: "complete", zh: "由于天气原因，我们的航班___了。", translation: "Because of the weather, our flight was delayed.", options: ["推迟", "打折", "申请"], difficulty: 2, explanation: "推迟 with 航班." },
  { id: "l4-qinqi", level: 4, topic: "family", type: "complete", zh: "春节的时候，我们全家会去看望___。", translation: "During Spring Festival, our whole family visits relatives.", options: ["亲戚", "客户", "导游"], difficulty: 1, explanation: "看望亲戚 collocation." },
  { id: "l4-zhuanye", level: 4, topic: "school", type: "complete", zh: "他的___是国际关系，明年就要毕业了。", translation: "His major is international relations, and he graduates next year.", options: ["专业", "质量", "传统"], difficulty: 2, explanation: "专业 for a major." },
  { id: "l4-plan", level: 4, topic: "work", type: "response", zh: "你觉得这个计划怎么样？", translation: "What do you think of this plan?", options: ["我觉得不错，不过有些地方还需要再讨论一下。", "我是去年毕业的。", "他的专业是法律。"], difficulty: 2, explanation: "Opinion with a hedge." },
  { id: "l4-bujin", level: 4, topic: "travel", type: "meaning", zh: "这家店的东西不仅质量好，而且价格也很合理。", translation: "This shop's goods are not only good quality but also reasonably priced.", options: ["This shop's goods are not only good quality but also reasonably priced.", "This shop's goods are cheap but poor quality.", "This shop only sells expensive goods."], difficulty: 2, explanation: "不仅…而且 pattern." },
  { id: "l4-zunzhong", level: 4, topic: "family", type: "word_choice", zh: "", context: "At a family dinner, you want to say you respect the old traditions.", translation: "I really respect these traditions.", options: ["我很尊重这些传统。", "这些传统浪费时间。", "这些传统已经推迟了。"], difficulty: 2, explanation: "尊重 with 传统." },
  { id: "l4-jiran", level: 4, topic: "general", type: "complete", zh: "既然你已经决定了，___就按你的想法去做吧。", translation: "Since you have already decided, go ahead and do it your way.", options: ["那", "虽然", "而且"], difficulty: 3, explanation: "既然…那 pattern." },
  { id: "l4-yali", level: 4, topic: "everyday", type: "response", zh: "我最近压力特别大，常常睡不好。", translation: "I have been really stressed lately and often sleep badly.", options: ["那你要注意休息，别太辛苦了。", "祝你生日快乐！", "这个价格很合理。"], difficulty: 1, explanation: "Empathetic reply." },
  { id: "l4-shenqing", level: 4, topic: "school", type: "complete", zh: "我打算毕业以后___去国外读书。", translation: "I plan to apply to study abroad after I graduate.", options: ["申请", "推迟", "浪费"], difficulty: 2, explanation: "申请 for school applications." },
  { id: "l4-hobby", level: 4, topic: "everyday", type: "complete", zh: "我对摄影很感兴趣，___有空就出去拍照。", translation: "I am very interested in photography, so whenever I have time I go out to take photos.", options: ["一", "才", "再"], difficulty: 3, explanation: "一…就 pattern." },

  // ── HSK 5 ──
  { id: "l5-tanpan", level: 5, topic: "work", type: "complete", zh: "这次___的结果对公司的发展非常关键。", translation: "The outcome of this negotiation is critical to the company's growth.", options: ["谈判", "风俗", "行程"], difficulty: 2, explanation: "谈判 in business." },
  { id: "l5-yuqi", level: 5, topic: "general", type: "complete", zh: "与其在家里等消息，___自己去问清楚。", translation: "Rather than waiting at home for news, it is better to go ask yourself.", options: ["不如", "何况", "毕竟"], difficulty: 3, explanation: "与其…不如 pattern." },
  { id: "l5-yuding", level: 5, topic: "travel", type: "complete", zh: "我已经在网上___了酒店，到了直接入住就行。", translation: "I already booked the hotel online, so we can check in as soon as we arrive.", options: ["预订", "承担", "显示"], difficulty: 1, explanation: "预订 for bookings." },
  { id: "l5-fengsu", level: 5, topic: "family", type: "complete", zh: "每个地区都有自己独特的___习惯。", translation: "Every region has its own unique customs.", options: ["风俗", "利润", "效率"], difficulty: 2, explanation: "风俗习惯 collocation." },
  { id: "l5-nanguai", level: 5, topic: "everyday", type: "complete", zh: "他学了三年中文，又在北京住过，___说得这么流利。", translation: "He studied Chinese for three years and lived in Beijing, so no wonder he speaks so fluently.", options: ["难怪", "尽管", "何况"], difficulty: 2, explanation: "难怪 for an explained result." },
  { id: "l5-guandian", level: 5, topic: "school", type: "complete", zh: "这篇论文的___很新颖，论证也很充分。", translation: "This paper's argument is original, and the reasoning is thorough.", options: ["观点", "贷款", "行程"], difficulty: 3, explanation: "Academic vocabulary." },
  { id: "l5-budget", level: 5, topic: "work", type: "response", zh: "这个方案的成本是不是太高了？", translation: "Is the cost of this proposal too high?", options: ["确实偏高，我们可以考虑调整一下预算。", "我已经预订好酒店了。", "这是我们家乡的风俗。"], difficulty: 2, explanation: "Business reasoning reply." },
  { id: "l5-zhujian", level: 5, topic: "family", type: "meaning", zh: "随着年龄的增长，他逐渐理解了父母的辛苦。", translation: "As he grew older, he gradually understood how hard his parents worked.", options: ["As he grew older, he gradually understood how hard his parents worked.", "When he was young, he lived far from his parents.", "His parents have worked hard for many years."], difficulty: 2, explanation: "随着 and 逐渐." },
  { id: "l5-xingcheng", level: 5, topic: "travel", type: "response", zh: "听说你下个月要去云南旅行？", translation: "I heard you are traveling to Yunnan next month?", options: ["对，行程已经安排好了，就差订机票了。", "对，我在研究市场情况。", "我觉得这个观点很有道理。"], difficulty: 2, explanation: "就差 for a remaining step." },
  { id: "l5-disagree", level: 5, topic: "school", type: "word_choice", zh: "", context: "In a class discussion, you want to disagree politely.", translation: "I understand your view, but mine is a bit different.", options: ["我理解你的观点，不过我的看法有点儿不同。", "你说的完全没有意义。", "我毕竟是学生。"], difficulty: 2, explanation: "Polite disagreement register." },
  { id: "l5-jinguan", level: 5, topic: "general", type: "complete", zh: "___他经验不多，可是工作效率很高。", translation: "Even though he does not have much experience, he works very efficiently.", options: ["尽管", "难怪", "与其"], difficulty: 3, explanation: "尽管…可是 concession." },

  // ── HSK 6 ──
  { id: "l6-quanheng", level: 6, topic: "work", type: "complete", zh: "公司需要___利弊之后再做决定。", translation: "The company needs to weigh the pros and cons before deciding.", options: ["权衡", "倡导", "传承"], difficulty: 2, explanation: "权衡利弊 collocation." },
  { id: "l6-qijin", level: 6, topic: "school", type: "complete", zh: "这个领域的研究___为止还没有定论。", translation: "Research in this field has not reached a conclusion so far.", options: ["迄今", "从此", "以往"], difficulty: 3, explanation: "迄今为止 fixed phrase." },
  { id: "l6-bodajingshen", level: 6, topic: "family", type: "complete", zh: "中华文化___，需要一代代人去传承。", translation: "Chinese culture is broad and profound, and each generation needs to carry it on.", options: ["博大精深", "一目了然", "层出不穷"], difficulty: 2, explanation: "Chengyu for culture." },
  { id: "l6-cengchu", level: 6, topic: "everyday", type: "complete", zh: "新技术___，让人目不暇接。", translation: "New technologies keep emerging, more than one can keep up with.", options: ["层出不穷", "举足轻重", "博大精深"], difficulty: 2, explanation: "Chengyu for continual emergence." },
  { id: "l6-meibusheng", level: 6, topic: "travel", type: "complete", zh: "这里的风景___，难怪游客络绎不绝。", translation: "The scenery here is breathtaking, so no wonder visitors keep coming.", options: ["美不胜收", "不言而喻", "举足轻重"], difficulty: 2, explanation: "Chengyu for scenery." },
  { id: "l6-buyan", level: 6, topic: "general", type: "meaning", zh: "这个问题的重要性不言而喻。", translation: "The importance of this issue is self-evident.", options: ["The importance of this issue is self-evident.", "Nobody wants to discuss this issue.", "This issue is not important at all."], difficulty: 2, explanation: "不言而喻 meaning." },
  { id: "l6-guling", level: 6, topic: "work", type: "response", zh: "关于这个合作方案，您还有什么顾虑吗？", translation: "Do you have any remaining concerns about this partnership proposal?", options: ["我主要担心后期的成本控制。", "这个景点美不胜收。", "他在这个行业举足轻重。"], difficulty: 2, explanation: "Formal business register." },
  { id: "l6-juzu", level: 6, topic: "work", type: "complete", zh: "这家企业在行业中具有___的地位。", translation: "This company holds a pivotal position in the industry.", options: ["举足轻重", "层出不穷", "美不胜收"], difficulty: 3, explanation: "举足轻重 with 地位." },
  { id: "l6-yimu", level: 6, topic: "school", type: "word_choice", zh: "", context: "In a seminar, you want to say the data clearly shows the trend.", translation: "The data shows the trend at a glance.", options: ["数据显示，这个趋势一目了然。", "这个趋势博大精深。", "这个趋势美不胜收。"], difficulty: 2, explanation: "一目了然 for clarity." },
  { id: "l6-zhenzhuo", level: 6, topic: "general", type: "complete", zh: "他做事一向谨慎，任何决定都要反复___。", translation: "He is always careful and weighs every decision again and again.", options: ["斟酌", "拓展", "倡导"], difficulty: 3, explanation: "斟酌 for deliberation." },
  { id: "l6-nianyefan", level: 6, topic: "family", type: "response", zh: "过年的时候你们家还保留哪些传统？", translation: "Which traditions does your family still keep at New Year?", options: ["我们家一直保留着吃年夜饭和守岁的习俗。", "这个方案还需要斟酌。", "数据显示趋势一目了然。"], difficulty: 2, explanation: "Cultural vocabulary in a family context." },
];

export const QUESTION_BANK: readonly BankQuestion[] = DRAFTS.map(build);

const BY_ID = new Map(QUESTION_BANK.map((question) => [question.id, question]));

export function getQuestion(id: string): BankQuestion | null {
  return BY_ID.get(id) ?? null;
}

export function activeQuestions(): BankQuestion[] {
  return QUESTION_BANK.filter((question) => question.active);
}

export const QUESTION_TYPE_PROMPTS: Record<QuestionType, string> = {
  meaning: "What does this mean?",
  complete: "Choose the word that completes the sentence.",
  response: "Choose the most natural reply.",
  word_choice: "Choose what you would say.",
};
