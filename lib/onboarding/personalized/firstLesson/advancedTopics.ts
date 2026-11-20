import type { GoalKey } from "../goals";
import { effectiveInterestKeys } from "../goals";
import type { OnboardingAnswers } from "../flow";
import type { LessonPhrase } from "./types";
import { pinyin } from "pinyin-pro";

/** Vetted topic language is shared by the reading, writing task and discussion. */
export const phrase = (hanzi: string, meaning: string, pronunciation?: string): LessonPhrase => ({
  id: hanzi, hanzi, meaning, pinyin: pronunciation ?? pinyin(hanzi, { toneType: "symbol" }),
});
export type AdvancedTopic = {
  label: string; a: LessonPhrase; b: LessonPhrase; verb: LessonPhrase; quality: LessonPhrase;
  extra: LessonPhrase; culture: LessonPhrase; subject: string; otherAction: string;
  issue: string; benefit: string; cost: string; perspective: string; position: string;
};
const w = phrase;
export const ADVANCED_TOPICS: Record<GoalKey, AdvancedTopic> = {
  heritage: { label: "family traditions", a: w("春节", "Chinese New Year", "Chūnjié"), b: w("中秋节", "Mid-Autumn Festival", "Zhōngqiū Jié"), verb: w("庆祝", "celebrate"), quality: w("重要", "important"), extra: w("亲戚", "relatives", "qīnqi"), culture: w("文化", "culture"), subject: "我们家", otherAction: "看亲戚", issue: "传统文化应该随着时代改变吗？", benefit: "传统让家人保持联系", cost: "有些习惯不适合现在的生活", perspective: "年轻人", position: "应该保留传统的意义，也可以改变庆祝的方式" },
  work: { label: "work and teamwork", a: w("线上会议", "online meetings"), b: w("线下会议", "in-person meetings"), verb: w("参加", "attend"), quality: w("方便", "convenient"), extra: w("同事", "colleagues"), culture: w("合作", "collaboration"), subject: "我们", otherAction: "和同事合作", issue: "公司应该让员工自己选择工作地点吗？", benefit: "自由选择让工作安排更灵活", cost: "团队交流可能变少", perspective: "员工", position: "应该给员工选择，也要安排团队交流的时间" },
  school: { label: "study choices", a: w("中文课", "Chinese classes"), b: w("文化课", "culture classes"), verb: w("参加", "attend"), quality: w("有趣", "interesting"), extra: w("同学", "classmates"), culture: w("讨论", "discussion"), subject: "我们", otherAction: "和同学讨论", issue: "学生应该自己决定学习的内容吗？", benefit: "自己选择能提高学习兴趣", cost: "学生可能忽略重要的基础知识", perspective: "学生", position: "应该让学生选择感兴趣的内容，也要学好基础知识" },
  travel: { label: "travel plans", a: w("地铁", "the subway"), b: w("公交车", "the bus"), verb: w("坐", "take"), quality: w("方便", "convenient"), extra: w("当地人", "local people"), culture: w("城市", "city"), subject: "我们", otherAction: "和当地人聊天", issue: "旅行应该做好所有计划吗？", benefit: "提前计划可以节省时间", cost: "计划太满会错过意外的发现", perspective: "游客", position: "应该提前安排重要的事情，也给自己留一些自由时间" },
  everyday: { label: "plans with friends", a: w("电影", "movies"), b: w("演出", "live shows"), verb: w("看", "watch"), quality: w("有趣", "interesting"), extra: w("朋友", "friends"), culture: w("生活", "life"), subject: "我们", otherAction: "和朋友聊天", issue: "朋友应该每天在网上聊天吗？", benefit: "网上聊天让大家保持联系", cost: "消息太多可能影响自己的生活", perspective: "朋友", position: "保持联系很重要，也要尊重每个人的时间" },
  other: { label: "learning and daily life", a: w("中文", "Chinese"), b: w("英文", "English"), verb: w("学", "learn"), quality: w("有用", "useful"), extra: w("朋友", "friends"), culture: w("文化", "culture"), subject: "我们", otherAction: "和朋友聊天", issue: "学习语言应该只用手机应用吗？", benefit: "手机应用让练习更方便", cost: "只用应用可能缺少真实的交流", perspective: "学习者", position: "应该用应用打好基础，也要找机会和别人交流" },
};

// Selected interests enrich the case study without accepting free text as generated content.
const INTEREST_DETAILS: Record<string, string> = {
  food: "一起吃饭也能让交流变得自然。", restaurants: "在餐厅和别人交流也是旅行的一部分。",
  technology: "新技术让交流方便，也带来了新的问题。", finance: "费用也是做决定时要考虑的问题。",
  clients: "面对客户时，也要了解对方真正的需要。", meetings: "开会时听到不同意见，也能帮助大家做决定。",
  traditions: "不同的家庭可能有不同的习惯。", family_conversations: "和家人谈谈，也能听到不同的想法。",
  science: "讨论时，找到可靠的证据也很重要。", engineering: "实际的条件也会影响最后的选择。",
  transportation: "交通的选择也会影响时间和体验。", hotels: "住宿的安排也需要一点灵活性。",
  friends: "朋友之间也需要理解不同的选择。", hobbies: "每个人的兴趣不同，合适的选择也不同。",
};
export function interestDetail(a: OnboardingAnswers): string {
  return effectiveInterestKeys(a.goal.primary, a.interests?.keys ?? []).map(k => INTEREST_DETAILS[k]).find(Boolean) ?? "每个人的情况不同，选择也不必完全一样。";
}

export const TOPIC_ENGLISH: Record<GoalKey, {issue:string;benefit:string;cost:string;perspective:string;position:string;otherAction:string}> = {
 heritage:{issue:"Should traditional culture change with the times?",benefit:"traditions keep families connected",cost:"some customs do not fit modern life",perspective:"young people",position:"we should preserve the meaning of traditions while allowing the way we celebrate to change",otherAction:"visit relatives"},
 work:{issue:"Should companies let employees choose where they work?",benefit:"freedom of choice makes work arrangements more flexible",cost:"team communication may decrease",perspective:"employees",position:"employees should have a choice, and teams should also make time to communicate",otherAction:"collaborate with colleagues"},
 school:{issue:"Should students decide what they study?",benefit:"making their own choices can increase students’ interest in learning",cost:"students may neglect important foundational knowledge",perspective:"students",position:"students should choose content that interests them while also building solid foundations",otherAction:"discuss things with classmates"},
 travel:{issue:"Should every part of a trip be planned?",benefit:"planning ahead can save time",cost:"an overfull schedule can mean missing unexpected discoveries",perspective:"travellers",position:"we should arrange the important things in advance while leaving ourselves some free time",otherAction:"chat with local people"},
 everyday:{issue:"Should friends chat online every day?",benefit:"online chat helps people stay in touch",cost:"too many messages may interfere with our own lives",perspective:"friends",position:"staying in touch matters, and we should also respect each person’s time",otherAction:"chat with friends"},
 other:{issue:"Should language learning rely only on mobile apps?",benefit:"mobile apps make practice more convenient",cost:"using only apps may leave too little real communication",perspective:"language learners",position:"we should use apps to build foundations and also find opportunities to communicate with others",otherAction:"chat with friends"},
};

const INTEREST_MEANINGS: Record<string, string> = {
 food:"Eating together can also make communication feel more natural.",restaurants:"Talking with others at restaurants is also part of travelling.",
 technology:"New technology makes communication convenient and also brings new problems.",finance:"Cost is another factor to consider when making decisions.",
 clients:"When dealing with clients, we should understand what they really need.",meetings:"Hearing different opinions in meetings can also help people make decisions.",
 traditions:"Different families may have different customs.",family_conversations:"Talking with family can also introduce us to different ideas.",
 science:"Finding reliable evidence is also important in a discussion.",engineering:"Practical conditions can also affect the final choice.",
 transportation:"Transport choices can also affect our time and experience.",hotels:"Accommodation arrangements also need some flexibility.",
 friends:"Friends also need to understand different choices.",hobbies:"People have different interests, so the right choice differs too.",
};
export function interestMeaning(a: OnboardingAnswers): string {
 return effectiveInterestKeys(a.goal.primary,a.interests?.keys??[]).map(k=>INTEREST_MEANINGS[k]).find(Boolean)??"Everyone’s circumstances differ, so their choices do not have to be identical.";
}
