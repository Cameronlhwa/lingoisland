/**
 * Full content for indexable /topics/[slug] pages.
 * Only topics in PRIORITY_TOPIC_SLUGS have entries here.
 * Each page must meet: 150–300 words intro, 12–25 vocab, 6–12 example sentences.
 */

export type VocabItem = { chinese: string; pinyin: string; english: string };
export type ExampleSentence = { chinese: string; pinyin: string; english: string };

export type TopicPageContent = {
  /** Unique explanatory intro (150–300 words). */
  intro: string;
  /** "When you'd use this" section body. */
  whenUse: string;
  vocab: VocabItem[];
  sentences: ExampleSentence[];
  /** Short, unique "Common mistakes / natural phrasing" section. */
  commonMistakes: string;
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function getTopicPageContent(slug: string): TopicPageContent | null {
  const content = TOPIC_PAGE_CONTENT[slug];
  return content ?? null;
}

/** Returns true if content meets minimum for indexing (150–300 words intro, 12–25 vocab, 6–12 sentences). */
export function meetsIndexingMinimum(content: TopicPageContent): boolean {
  const introWords = wordCount(content.intro);
  const vocabOk = content.vocab.length >= 12 && content.vocab.length <= 25;
  const sentencesOk = content.sentences.length >= 6 && content.sentences.length <= 12;
  return introWords >= 150 && introWords <= 300 && vocabOk && sentencesOk;
}

const TOPIC_PAGE_CONTENT: Record<string, TopicPageContent> = {
  "ordering-at-a-restaurant": {
    intro:
      "Ordering at a restaurant in Mandarin is one of the most practical skills for intermediate learners. Whether you're in Taiwan, mainland China, or a Chinese-speaking community, knowing how to ask for the menu, request modifications, and pay the bill will make dining out much smoother. This page focuses on vocabulary and phrases you'll hear and use in real sit-down restaurants—from reading the menu to splitting the check. The sentences are tuned for A2–B2 learners and align with HSK 3–6, so you get real-life language without overwhelming grammar. Use this alongside spaced repetition so the phrases stick.",
    whenUse:
      "You'll use this vocabulary when eating at sit-down restaurants, reading menus, asking about dishes, requesting the bill, and discussing preferences (spicy, vegetarian, allergies). It also helps when making reservations or asking for a table.",
    vocab: [
      { chinese: "菜单", pinyin: "cài dān", english: "menu" },
      { chinese: "点菜", pinyin: "diǎn cài", english: "to order food" },
      { chinese: "服务员", pinyin: "fú wù yuán", english: "waiter / server" },
      { chinese: "招牌菜", pinyin: "zhāo pai cài", english: "signature dish" },
      { chinese: "辣", pinyin: "là", english: "spicy" },
      { chinese: "不辣", pinyin: "bù là", english: "not spicy" },
      { chinese: "味道", pinyin: "wèi dào", english: "taste / flavor" },
      { chinese: "结账", pinyin: "jié zhàng", english: "to pay the bill" },
      { chinese: "打包", pinyin: "dǎ bāo", english: "to take away / doggy bag" },
      { chinese: "推荐", pinyin: "tuī jiàn", english: "to recommend" },
      { chinese: "份", pinyin: "fèn", english: "portion / serving" },
      { chinese: "加辣", pinyin: "jiā là", english: "add spicy" },
      { chinese: "买单", pinyin: "mǎi dān", english: "to pay (bill)" },
      { chinese: "筷子", pinyin: "kuài zi", english: "chopsticks" },
      { chinese: "饮料", pinyin: "yǐn liào", english: "drinks" },
    ],
    sentences: [
      { chinese: "请给我菜单。", pinyin: "Qǐng gěi wǒ cài dān.", english: "Please give me the menu." },
      { chinese: "有什么招牌菜？", pinyin: "Yǒu shén me zhāo pai cài?", english: "What are the signature dishes?" },
      { chinese: "这道菜有点辣。", pinyin: "Zhè dào cài yǒu diǎn là.", english: "This dish is a bit spicy." },
      { chinese: "我们要结账。", pinyin: "Wǒ men yào jié zhàng.", english: "We'd like to pay the bill." },
      { chinese: "可以打包吗？", pinyin: "Kě yǐ dǎ bāo ma?", english: "Can we get this to go?" },
      { chinese: "请推荐一道菜。", pinyin: "Qǐng tuī jiàn yī dào cài.", english: "Please recommend a dish." },
      { chinese: "我们各付各的。", pinyin: "Wǒ men gè fù gè de.", english: "We'll pay separately." },
    ],
    commonMistakes:
      "Avoid saying only '辣' when you mean 'make it spicy'—say '加辣' or '要辣一点'. '买单' and '结账' are both used for paying; '买单' is more casual. Don't confuse '份' (portion) with '个' (piece)—e.g. '一份炒饭' is one order of fried rice.",
  },

  "ordering-bubble-tea": {
    intro:
      "Bubble tea (珍珠奶茶) is everywhere in the Mandarin-speaking world, and ordering it like a local will help you practice numbers, preferences, and quick exchanges. This topic covers the vocabulary you need to customize sugar level, ice, toppings, and size at shops like 50嵐, Coco, or local chains. The phrases here are aimed at A2–B2 learners and match real-life ordering flow: size, sweetness, ice, and add-ons. Learning these in context with example sentences and a short review loop will make your next order smooth and natural.",
    whenUse:
      "Use this when ordering at bubble tea shops, specifying sugar level (无糖, 少糖), ice level (去冰, 少冰), and toppings (珍珠, 椰果). Also useful for asking about popular drinks or sizes.",
    vocab: [
      { chinese: "珍珠奶茶", pinyin: "zhēn zhū nǎi chá", english: "bubble tea" },
      { chinese: "甜度", pinyin: "tián dù", english: "sweetness level" },
      { chinese: "无糖", pinyin: "wú táng", english: "no sugar" },
      { chinese: "少糖", pinyin: "shǎo táng", english: "less sugar" },
      { chinese: "正常甜", pinyin: "zhèng cháng tián", english: "normal sweetness" },
      { chinese: "去冰", pinyin: "qù bīng", english: "no ice" },
      { chinese: "少冰", pinyin: "shǎo bīng", english: "less ice" },
      { chinese: "珍珠", pinyin: "zhēn zhū", english: "tapioca pearls" },
      { chinese: "椰果", pinyin: "yē guǒ", english: "coconut jelly" },
      { chinese: "大杯", pinyin: "dà bēi", english: "large size" },
      { chinese: "中杯", pinyin: "zhōng bēi", english: "medium size" },
      { chinese: "加料", pinyin: "jiā liào", english: "add toppings" },
      { chinese: "去冰少糖", pinyin: "qù bīng shǎo táng", english: "no ice, less sugar" },
      { chinese: "一杯", pinyin: "yī bēi", english: "one cup" },
    ],
    sentences: [
      { chinese: "我要一杯珍珠奶茶。", pinyin: "Wǒ yào yī bēi zhēn zhū nǎi chá.", english: "I want one bubble tea." },
      { chinese: "去冰少糖。", pinyin: "Qù bīng shǎo táng.", english: "No ice, less sugar." },
      { chinese: "甜度可以调吗？", pinyin: "Tián dù kě yǐ tiáo ma?", english: "Can you adjust the sweetness?" },
      { chinese: "大杯多少钱？", pinyin: "Dà bēi duō shǎo qián?", english: "How much is a large?" },
      { chinese: "加珍珠要加钱吗？", pinyin: "Jiā zhēn zhū yào jiā qián ma?", english: "Does adding pearls cost extra?" },
      { chinese: "我要正常甜、少冰。", pinyin: "Wǒ yào zhèng cháng tián, shǎo bīng.", english: "I want normal sweetness, less ice." },
    ],
    commonMistakes:
      "'少糖' is 'less sugar,' not 'no sugar' (无糖). Saying '不要冰' is fine, but '去冰' is the standard phrase in most shops. Order size before toppings: e.g. '大杯珍珠奶茶，少糖去冰'.",
  },

  "checking-into-a-hotel": {
    intro:
      "Checking into a hotel in Mandarin requires a small set of phrases: reservation, ID, room type, and checkout time. This page gives you the vocabulary and sentences you need for a smooth check-in and stay, from asking for a non-smoking room to requesting a late checkout. The content is written for A2–B2 learners and fits HSK 3–6, so you get real-life language without overly formal or textbook phrasing. Pair it with spaced repetition so you remember key words when you travel.",
    whenUse:
      "Use this at hotel front desks when checking in, confirming your reservation, asking about WiFi, breakfast, or checkout time, and when you need extra towels or a late checkout.",
    vocab: [
      { chinese: "入住", pinyin: "rù zhù", english: "check in" },
      { chinese: "退房", pinyin: "tuì fáng", english: "check out" },
      { chinese: "预订", pinyin: "yù dìng", english: "reservation" },
      { chinese: "身份证", pinyin: "shēn fèn zhèng", english: "ID card" },
      { chinese: "护照", pinyin: "hù zhào", english: "passport" },
      { chinese: "单人间", pinyin: "dān rén jiān", english: "single room" },
      { chinese: "双人间", pinyin: "shuāng rén jiān", english: "double room" },
      { chinese: "无烟房", pinyin: "wú yān fáng", english: "non-smoking room" },
      { chinese: "退房时间", pinyin: "tuì fáng shí jiān", english: "checkout time" },
      { chinese: "早餐", pinyin: "zǎo cān", english: "breakfast" },
      { chinese: "WiFi密码", pinyin: "WiFi mì mǎ", english: "WiFi password" },
      { chinese: "钥匙", pinyin: "yào shi", english: "key" },
      { chinese: "房卡", pinyin: "fáng kǎ", english: "room card" },
      { chinese: "行李", pinyin: "xíng li", english: "luggage" },
    ],
    sentences: [
      { chinese: "我有预订。", pinyin: "Wǒ yǒu yù dìng.", english: "I have a reservation." },
      { chinese: "请给我无烟房。", pinyin: "Qǐng gěi wǒ wú yān fáng.", english: "Please give me a non-smoking room." },
      { chinese: "退房时间是几点？", pinyin: "Tuì fáng shí jiān shì jǐ diǎn?", english: "What time is checkout?" },
      { chinese: "早餐在哪里？", pinyin: "Zǎo cān zài nǎ lǐ?", english: "Where is breakfast?" },
      { chinese: "WiFi密码是多少？", pinyin: "WiFi mì mǎ shì duō shǎo?", english: "What is the WiFi password?" },
      { chinese: "可以晚一点退房吗？", pinyin: "Kě yǐ wǎn yī diǎn tuì fáng ma?", english: "Can I check out a bit later?" },
    ],
    commonMistakes:
      "Use '入住' for check-in and '退房' for check-out; don't mix them. '房卡' is more common than '钥匙' in modern hotels. For 'I have a reservation,' '我有预订' is natural; avoid overly formal '我预订了房间' unless writing.",
  },

  "airport-immigration": {
    intro:
      "Airport and immigration vocabulary in Mandarin helps you move through the airport, answer common questions at the border, and handle baggage or transfers. This page covers the phrases and words you'll need from check-in counters to immigration desks, aimed at A2–B2 learners and aligned with HSK 3–6. You'll learn how to say your purpose of visit, duration of stay, and where you're staying in natural, real-life Mandarin. Reviewing these with example sentences and spaced repetition will make your next trip less stressful.",
    whenUse:
      "Use this at the airport for check-in, security, immigration questions (purpose of visit, length of stay), baggage claim, and when asking for directions to your gate or transfer.",
    vocab: [
      { chinese: "护照", pinyin: "hù zhào", english: "passport" },
      { chinese: "签证", pinyin: "qiān zhèng", english: "visa" },
      { chinese: "入境", pinyin: "rù jìng", english: "entry / immigration" },
      { chinese: "出境", pinyin: "chū jìng", english: "exit / departure" },
      { chinese: "登机牌", pinyin: "dēng jī pái", english: "boarding pass" },
      { chinese: "行李", pinyin: "xíng li", english: "luggage" },
      { chinese: "转机", pinyin: "zhuǎn jī", english: "transfer (flight)" },
      { chinese: "旅游", pinyin: "lǚ yóu", english: "travel / tourism" },
      { chinese: "出差", pinyin: "chū chāi", english: "business trip" },
      { chinese: "停留", pinyin: "tíng liú", english: "to stay (duration)" },
      { chinese: "海关", pinyin: "hǎi guān", english: "customs" },
      { chinese: "申报", pinyin: "shēn bào", english: "to declare" },
      { chinese: "登机口", pinyin: "dēng jī kǒu", english: "boarding gate" },
      { chinese: "航班", pinyin: "háng bān", english: "flight" },
    ],
    sentences: [
      { chinese: "我是来旅游的。", pinyin: "Wǒ shì lái lǚ yóu de.", english: "I'm here for tourism." },
      { chinese: "我停留两周。", pinyin: "Wǒ tíng liú liǎng zhōu.", english: "I'm staying two weeks." },
      { chinese: "我要转机去上海。", pinyin: "Wǒ yào zhuǎn jī qù Shàng hǎi.", english: "I'm transferring to Shanghai." },
      { chinese: "登机口在哪里？", pinyin: "Dēng jī kǒu zài nǎ lǐ?", english: "Where is the boarding gate?" },
      { chinese: "有东西要申报吗？", pinyin: "Yǒu dōng xi yào shēn bào ma?", english: "Do you have anything to declare?" },
      { chinese: "我的行李丢了。", pinyin: "Wǒ de xíng li diū le.", english: "My luggage is lost." },
    ],
    commonMistakes:
      "'入境' is entry (into the country); '出境' is exit. For 'I'm here for tourism,' '我是来旅游的' is natural; avoid '我来为了旅游.' When stating duration, use '停留' + time: '停留三天,' not '住三天' at immigration.",
  },

  "asking-for-directions": {
    intro:
      "Asking for directions in Mandarin is a high-value skill for any intermediate learner. This page gives you the vocabulary and sentences you need to understand and give simple directions: left, right, straight, landmarks, and how far. The phrases are tuned for A2–B2 and HSK 3–6, so you get real-life usage without textbook fluff. Learning these with example sentences and a short review loop will make getting around much easier on your next trip.",
    whenUse:
      "Use this when you're lost, asking how to get to a place, or when someone gives you directions and you need to understand 'turn left,' 'go straight,' or 'it's next to the bank.'",
    vocab: [
      { chinese: "请问", pinyin: "qǐng wèn", english: "excuse me / may I ask" },
      { chinese: "怎么走", pinyin: "zěn me zǒu", english: "how to get there" },
      { chinese: "左边", pinyin: "zuǒ bian", english: "left side" },
      { chinese: "右边", pinyin: "yòu bian", english: "right side" },
      { chinese: "直走", pinyin: "zhí zǒu", english: "go straight" },
      { chinese: "拐弯", pinyin: "guǎi wān", english: "to turn" },
      { chinese: "红绿灯", pinyin: "hóng lǜ dēng", english: "traffic light" },
      { chinese: "路口", pinyin: "lù kǒu", english: "intersection" },
      { chinese: "附近", pinyin: "fù jìn", english: "nearby" },
      { chinese: "对面", pinyin: "duì miàn", english: "opposite" },
      { chinese: "旁边", pinyin: "páng biān", english: "next to" },
      { chinese: "远", pinyin: "yuǎn", english: "far" },
      { chinese: "近", pinyin: "jìn", english: "near" },
      { chinese: "地铁站", pinyin: "dì tiě zhàn", english: "subway station" },
    ],
    sentences: [
      { chinese: "请问，地铁站怎么走？", pinyin: "Qǐng wèn, dì tiě zhàn zěn me zǒu?", english: "Excuse me, how do I get to the subway station?" },
      { chinese: "直走，然后左拐。", pinyin: "Zhí zǒu, rán hòu zuǒ guǎi.", english: "Go straight, then turn left." },
      { chinese: "在红绿灯那边。", pinyin: "Zài hóng lǜ dēng nà biān.", english: "It's over by the traffic light." },
      { chinese: "离这里远吗？", pinyin: "Lí zhè lǐ yuǎn ma?", english: "Is it far from here?" },
      { chinese: "就在银行旁边。", pinyin: "Jiù zài yín háng páng biān.", english: "It's right next to the bank." },
      { chinese: "在马路对面。", pinyin: "Zài mǎ lù duì miàn.", english: "It's across the street." },
    ],
    commonMistakes:
      "'怎么走' is 'how do I get there'; for a specific place use '...怎么走.' '左边' and '右边' are 'left side' and 'right side'; when turning, '左拐' / '右拐' are more common than '向左拐' in speech. '附近' means 'nearby,' not 'close the door.'",
  },

  "taking-a-taxi-didi": {
    intro:
      "Taking a taxi or Didi in Mandarin is essential for getting around cities. This page covers the vocabulary and sentences you need to tell the driver your destination, ask about price or meter, and handle common situations like 'please turn on the AC' or 'stop here.' The content is aimed at A2–B2 learners and HSK 3–6, so you get real-life phrases that drivers actually use. Pair this with example sentences and spaced repetition so the words stick when you need them.",
    whenUse:
      "Use this when hailing a taxi or using Didi: telling the driver where to go, asking to stop, confirming the fare, or saying 'turn on the AC' or 'I'm in a hurry.'",
    vocab: [
      { chinese: "出租车", pinyin: "chū zū chē", english: "taxi" },
      { chinese: "滴滴", pinyin: "dī dī", english: "Didi (ride-hail app)" },
      { chinese: "目的地", pinyin: "mù dì dì", english: "destination" },
      { chinese: "请到", pinyin: "qǐng dào", english: "please take me to" },
      { chinese: "停这里", pinyin: "tíng zhè lǐ", english: "stop here" },
      { chinese: "打表", pinyin: "dǎ biǎo", english: "use the meter" },
      { chinese: "多少钱", pinyin: "duō shǎo qián", english: "how much" },
      { chinese: "开空调", pinyin: "kāi kōng tiáo", english: "turn on AC" },
      { chinese: "慢一点", pinyin: "màn yī diǎn", english: "a bit slower" },
      { chinese: "赶时间", pinyin: "gǎn shí jiān", english: "in a hurry" },
      { chinese: "到了", pinyin: "dào le", english: "we're here / arrived" },
      { chinese: "找零", pinyin: "zhǎo líng", english: "change" },
      { chinese: "扫码", pinyin: "sǎo má", english: "scan (QR) to pay" },
      { chinese: "师傅", pinyin: "shī fu", english: "driver (polite)" },
    ],
    sentences: [
      { chinese: "师傅，请到机场。", pinyin: "Shī fu, qǐng dào jī chǎng.", english: "Driver, please take me to the airport." },
      { chinese: "请停这里。", pinyin: "Qǐng tíng zhè lǐ.", english: "Please stop here." },
      { chinese: "打表吗？", pinyin: "Dǎ biǎo ma?", english: "Do you use the meter?" },
      { chinese: "可以开空调吗？", pinyin: "Kě yǐ kāi kōng tiáo ma?", english: "Can you turn on the AC?" },
      { chinese: "我赶时间，麻烦快一点。", pinyin: "Wǒ gǎn shí jiān, má fan kuài yī diǎn.", english: "I'm in a hurry, please go a bit faster." },
      { chinese: "到了，多少钱？", pinyin: "Dào le, duō shǎo qián?", english: "We're here. How much?" },
    ],
    commonMistakes:
      "Calling the driver '师傅' is polite and common. '打表' means using the meter; if you ask '打表吗？' you're asking if they'll use it. '到了' can mean 'we've arrived' (from driver) or 'we're here' (you telling them to stop).",
  },

  "taking-the-subway": {
    intro:
      "Taking the subway in Mandarin opens up every major city. This page gives you the vocabulary and sentences you need to buy tickets, ask for directions to a line or station, and understand announcements like 'next stop' or 'transfer.' The content is written for A2–B2 learners and fits HSK 3–6, so you get real-life language you'll hear on the metro. Use example sentences and spaced repetition to lock in the phrases before your next ride.",
    whenUse:
      "Use this when buying subway tickets, finding the right line or platform, asking which stop to get off, or understanding transfer directions and station names.",
    vocab: [
      { chinese: "地铁", pinyin: "dì tiě", english: "subway" },
      { chinese: "站", pinyin: "zhàn", english: "station" },
      { chinese: "车票", pinyin: "chē piào", english: "ticket" },
      { chinese: "换乘", pinyin: "huàn chéng", english: "transfer" },
      { chinese: "入口", pinyin: "rù kǒu", english: "entrance" },
      { chinese: "出口", pinyin: "chū kǒu", english: "exit" },
      { chinese: "下一站", pinyin: "xià yī zhàn", english: "next stop" },
      { chinese: "开往", pinyin: "kāi wǎng", english: "bound for" },
      { chinese: "方向", pinyin: "fāng xiàng", english: "direction" },
      { chinese: "刷卡", pinyin: "shuā kǎ", english: "swipe card" },
      { chinese: "单程", pinyin: "dān chéng", english: "one-way" },
      { chinese: "往返", pinyin: "wǎng fǎn", english: "round trip" },
      { chinese: "安检", pinyin: "ān jiǎn", english: "security check" },
      { chinese: "请排队", pinyin: "qǐng pái duì", english: "please queue" },
    ],
    sentences: [
      { chinese: "我要买一张去机场的地铁票。", pinyin: "Wǒ yào mǎi yī zhāng qù jī chǎng de dì tiě piào.", english: "I need to buy a subway ticket to the airport." },
      { chinese: "换乘二号线在哪里？", pinyin: "Huàn chéng èr hào xiàn zài nǎ lǐ?", english: "Where do I transfer to Line 2?" },
      { chinese: "下一站是哪里？", pinyin: "Xià yī zhàn shì nǎ lǐ?", english: "What's the next stop?" },
      { chinese: "这个方向对吗？", pinyin: "Zhè ge fāng xiàng duì ma?", english: "Is this the right direction?" },
      { chinese: "到人民广场在哪站下？", pinyin: "Dào Rén mín Guǎng chǎng zài nǎ zhàn xià?", english: "Which stop do I get off for People's Square?" },
      { chinese: "请排队上车。", pinyin: "Qǐng pái duì shàng chē.", english: "Please queue to board." },
    ],
    commonMistakes:
      "'换乘' is transfer; '换乘二号线' means 'transfer to Line 2.' '开往' appears on signs: '开往浦东' means 'bound for Pudong.' Don't confuse '入口' (entrance) and '出口' (exit). '站' is used for both 'station' and 'stop.'",
  },

  "shopping-at-a-supermarket": {
    intro:
      "Shopping at a supermarket in Mandarin is a great way to practice food vocabulary, numbers, and asking where things are. This page covers the words and sentences you need to find aisles, ask for help, and pay at the counter. The content is aimed at A2–B2 learners and HSK 3–6, so you get real-life phrases you'll hear in Carrefour, RT-Mart, or local chains. Learning these with example sentences and a short review loop will make grocery runs much easier.",
    whenUse:
      "Use this when you're in a supermarket looking for items, asking where something is, checking prices, or at the checkout (bagging, payment, receipt).",
    vocab: [
      { chinese: "超市", pinyin: "chāo shì", english: "supermarket" },
      { chinese: "在哪儿", pinyin: "zài nǎ er", english: "where is it" },
      { chinese: "收银台", pinyin: "shōu yín tái", english: "checkout counter" },
      { chinese: "购物车", pinyin: "gòu wù chē", english: "shopping cart" },
      { chinese: "袋子", pinyin: "dài zi", english: "bag" },
      { chinese: "打折", pinyin: "dǎ zhé", english: "on sale / discount" },
      { chinese: "保质期", pinyin: "bǎo zhì qī", english: "expiry date" },
      { chinese: "称重", pinyin: "chēng zhòng", english: "weigh (e.g. produce)" },
      { chinese: "会员", pinyin: "huì yuán", english: "member" },
      { chinese: "刷卡", pinyin: "shuā kǎ", english: "pay by card" },
      { chinese: "扫码", pinyin: "sǎo má", english: "scan to pay" },
      { chinese: "发票", pinyin: "fā piào", english: "receipt" },
      { chinese: "找零", pinyin: "zhǎo líng", english: "change" },
      { chinese: "一共", pinyin: "yī gòng", english: "total" },
    ],
    sentences: [
      { chinese: "牛奶在哪儿？", pinyin: "Niú nǎi zài nǎ er?", english: "Where is the milk?" },
      { chinese: "收银台在哪里？", pinyin: "Shōu yín tái zài nǎ lǐ?", english: "Where is the checkout?" },
      { chinese: "这个打折吗？", pinyin: "Zhè ge dǎ zhé ma?", english: "Is this on sale?" },
      { chinese: "要袋子吗？", pinyin: "Yào dài zi ma?", english: "Do you need a bag?" },
      { chinese: "一共多少钱？", pinyin: "Yī gòng duō shǎo qián?", english: "How much in total?" },
      { chinese: "可以扫码付款吗？", pinyin: "Kě yǐ sǎo má fù kuǎn ma?", english: "Can I pay by scanning?" },
    ],
    commonMistakes:
      "'在哪儿' is casual for 'where is it'; '在哪里' is slightly more formal. '打折' means 'on sale' or 'discount'; '打几折' means 'what discount' (e.g. 打八折 = 20% off). '一共' is 'total'—use it at checkout.",
  },

  "shopping-at-a-convenience-store": {
    intro:
      "Convenience stores (便利商店) in Taiwan and mainland China are full of useful phrases: buying a drink, heating food, asking for a receipt, or paying with WeChat Pay. This page gives you the vocabulary and sentences you need for 7-Eleven, FamilyMart, or local 便利店, aimed at A2–B2 learners and HSK 3–6. You'll learn how to ask to heat something, get a bag, or say 'just this' at the counter. Pair this with example sentences and spaced repetition so the phrases stick.",
    whenUse:
      "Use this when buying items at a convenience store, asking to heat food, getting a bag, asking for a receipt, or paying with cash or phone.",
    vocab: [
      { chinese: "便利店", pinyin: "biàn lì diàn", english: "convenience store" },
      { chinese: "加热", pinyin: "jiā rè", english: "heat up" },
      { chinese: "就这些", pinyin: "jiù zhè xiē", english: "just these" },
      { chinese: "收银台", pinyin: "shōu yín tái", english: "counter" },
      { chinese: "关东煮", pinyin: "guān dōng zhǔ", english: "oden" },
      { chinese: "饭团", pinyin: "fàn tuán", english: "rice ball" },
      { chinese: "矿泉水", pinyin: "kuàng quán shuǐ", english: "bottled water" },
      { chinese: "发票", pinyin: "fā piào", english: "receipt" },
      { chinese: "袋子", pinyin: "dài zi", english: "bag" },
      { chinese: "扫码", pinyin: "sǎo má", english: "scan to pay" },
      { chinese: "会员", pinyin: "huì yuán", english: "member" },
      { chinese: "积分", pinyin: "jī fēn", english: "points" },
      { chinese: "找零", pinyin: "zhǎo líng", english: "change" },
      { chinese: "微波", pinyin: "wēi bō", english: "microwave" },
    ],
    sentences: [
      { chinese: "请帮我加热一下。", pinyin: "Qǐng bāng wǒ jiā rè yī xià.", english: "Please heat this up for me." },
      { chinese: "就这些，谢谢。", pinyin: "Jiù zhè xiē, xiè xie.", english: "Just these, thanks." },
      { chinese: "要袋子吗？", pinyin: "Yào dài zi ma?", english: "Do you need a bag?" },
      { chinese: "可以扫码吗？", pinyin: "Kě yǐ sǎo má ma?", english: "Can I pay by scanning?" },
      { chinese: "有发票吗？", pinyin: "Yǒu fā piào ma?", english: "Do you have a receipt?" },
      { chinese: "这个用微波加热。", pinyin: "Zhè ge yòng wēi bō jiā rè.", english: "Heat this in the microwave." },
    ],
    commonMistakes:
      "'加热' is 'heat up'; '请帮我加热一下' is the natural way to ask. '就这些' means 'just these' (that's all). In Taiwan you'll often hear '需要袋子吗？' for 'do you need a bag.'",
  },

  "buying-tickets-train-bus": {
    intro:
      "Buying tickets for trains or buses in Mandarin is essential for travel. This page covers the vocabulary and sentences you need at ticket windows or machines: one-way, round trip, date, and seat type. The content is aimed at A2–B2 learners and HSK 3–6, so you get real-life phrases used at stations and booking counters. Learning these with example sentences and spaced repetition will make your next trip smoother.",
    whenUse:
      "Use this at train or bus stations when buying tickets, asking for times, one-way vs round trip, or choosing seat type (e.g. window seat, high-speed rail).",
    vocab: [
      { chinese: "车票", pinyin: "chē piào", english: "ticket" },
      { chinese: "单程", pinyin: "dān chéng", english: "one-way" },
      { chinese: "往返", pinyin: "wǎng fǎn", english: "round trip" },
      { chinese: "高铁", pinyin: "gāo tiě", english: "high-speed rail" },
      { chinese: "火车", pinyin: "huǒ chē", english: "train" },
      { chinese: "大巴", pinyin: "dà bā", english: "bus" },
      { chinese: "出发", pinyin: "chū fā", english: "departure" },
      { chinese: "到达", pinyin: "dào dá", english: "arrival" },
      { chinese: "座位", pinyin: "zuò wèi", english: "seat" },
      { chinese: "靠窗", pinyin: "kào chuāng", english: "window seat" },
      { chinese: "几点", pinyin: "jǐ diǎn", english: "what time" },
      { chinese: "还有票吗", pinyin: "hái yǒu piào ma", english: "are there still tickets" },
      { chinese: "售票处", pinyin: "shòu piào chù", english: "ticket office" },
      { chinese: "改签", pinyin: "gǎi qiān", english: "change (ticket)" },
    ],
    sentences: [
      { chinese: "我要一张去北京的高铁票。", pinyin: "Wǒ yào yī zhāng qù Běi jīng de gāo tiě piào.", english: "I want one high-speed rail ticket to Beijing." },
      { chinese: "单程还是往返？", pinyin: "Dān chéng hái shì wǎng fǎn?", english: "One-way or round trip?" },
      { chinese: "明天早上八点还有票吗？", pinyin: "Míng tiān zǎo shang bā diǎn hái yǒu piào ma?", english: "Are there still tickets for tomorrow 8am?" },
      { chinese: "我要靠窗的座位。", pinyin: "Wǒ yào kào chuāng de zuò wèi.", english: "I want a window seat." },
      { chinese: "售票处在哪里？", pinyin: "Shòu piào chù zài nǎ lǐ?", english: "Where is the ticket office?" },
      { chinese: "可以改签吗？", pinyin: "Kě yǐ gǎi qiān ma?", english: "Can I change my ticket?" },
    ],
    commonMistakes:
      "'单程' is one-way, '往返' is round trip. '高铁' is high-speed rail; '火车' is regular train. '还有票吗' is 'are there still tickets?'—useful when asking availability. '改签' is to change the date/time of a ticket.",
  },

  "introducing-yourself": {
    intro:
      "Introducing yourself in Mandarin is a core skill for making friends, networking, or traveling. This page gives you the vocabulary and sentences you need to say your name, where you're from, what you do, and how long you've been learning Chinese. The content is tuned for A2–B2 learners and HSK 3–6, so you get natural, real-life phrasing rather than textbook lines. Use example sentences and spaced repetition to make your next introduction smooth and confident.",
    whenUse:
      "Use this when meeting someone new: saying your name, where you're from, your job or major, and how long you've been studying or living in the area.",
    vocab: [
      { chinese: "叫", pinyin: "jiào", english: "to be called" },
      { chinese: "来自", pinyin: "lái zì", english: "to be from" },
      { chinese: "住在", pinyin: "zhù zài", english: "to live in" },
      { chinese: "工作", pinyin: "gōng zuò", english: "work / job" },
      { chinese: "学生", pinyin: "xué sheng", english: "student" },
      { chinese: "学", pinyin: "xué", english: "to study" },
      { chinese: "专业", pinyin: "zhuān yè", english: "major" },
      { chinese: "认识", pinyin: "rèn shi", english: "to know (someone)" },
      { chinese: "很高兴", pinyin: "hěn gāo xìng", english: "nice to (meet you)" },
      { chinese: "中文", pinyin: "zhōng wén", english: "Chinese (language)" },
      { chinese: "学多久", pinyin: "xué duō jiǔ", english: "how long have you studied" },
      { chinese: "爱好", pinyin: "ài hào", english: "hobby" },
      { chinese: "第一次", pinyin: "dì yī cì", english: "first time" },
      { chinese: "请多关照", pinyin: "qǐng duō guān zhào", english: "please take care of me" },
    ],
    sentences: [
      { chinese: "我叫小明。", pinyin: "Wǒ jiào Xiǎo Míng.", english: "I'm called Xiaoming." },
      { chinese: "我来自美国。", pinyin: "Wǒ lái zì Měi guó.", english: "I'm from the US." },
      { chinese: "很高兴认识你。", pinyin: "Hěn gāo xìng rèn shi nǐ.", english: "Nice to meet you." },
      { chinese: "我学中文两年了。", pinyin: "Wǒ xué Zhōng wén liǎng nián le.", english: "I've been studying Chinese for two years." },
      { chinese: "我是学生，学计算机。", pinyin: "Wǒ shì xué sheng, xué jì suàn jī.", english: "I'm a student, studying computer science." },
      { chinese: "请多关照。", pinyin: "Qǐng duō guān zhào.", english: "Please take care of me." },
    ],
    commonMistakes:
      "'我叫...' is 'I'm called...' (name). '来自' is 'from' (place); don't say '我从美国来' in formal intros—'我来自美国' is standard. '很高兴认识你' is the default 'nice to meet you'; no need to add '很' again.",
  },

  "making-small-talk": {
    intro:
      "Making small talk in Mandarin helps you build rapport with colleagues, neighbors, or new friends. This page covers the vocabulary and sentences you need for weather, weekend plans, and 'how have you been'—tuned for A2–B2 and HSK 3–6. You'll learn natural openers and short responses that keep the conversation going without sounding like a textbook. Use example sentences and spaced repetition so these phrases come out naturally when you need them.",
    whenUse:
      "Use this when starting a casual conversation: asking about the weather, weekend, work, or how someone has been. Also for responding briefly and keeping the chat going.",
    vocab: [
      { chinese: "最近", pinyin: "zuì jìn", english: "recently" },
      { chinese: "怎么样", pinyin: "zěn me yàng", english: "how about / how is it" },
      { chinese: "忙", pinyin: "máng", english: "busy" },
      { chinese: "周末", pinyin: "zhōu mò", english: "weekend" },
      { chinese: "天气", pinyin: "tiān qì", english: "weather" },
      { chinese: "热", pinyin: "rè", english: "hot" },
      { chinese: "冷", pinyin: "lěng", english: "cold" },
      { chinese: "还行", pinyin: "hái xíng", english: "not bad / okay" },
      { chinese: "不错", pinyin: "bù cuò", english: "pretty good" },
      { chinese: "一般", pinyin: "yī bān", english: "so-so" },
      { chinese: "你呢", pinyin: "nǐ ne", english: "and you" },
      { chinese: "打算", pinyin: "dǎ suàn", english: "plan to" },
      { chinese: "有空", pinyin: "yǒu kòng", english: "free (have time)" },
      { chinese: "改天", pinyin: "gǎi tiān", english: "another day" },
    ],
    sentences: [
      { chinese: "最近怎么样？", pinyin: "Zuì jìn zěn me yàng?", english: "How have you been lately?" },
      { chinese: "还行，你呢？", pinyin: "Hái xíng, nǐ ne?", english: "Not bad, and you?" },
      { chinese: "周末有什么打算？", pinyin: "Zhōu mò yǒu shén me dǎ suàn?", english: "Any plans for the weekend?" },
      { chinese: "今天天气不错。", pinyin: "Jīn tiān tiān qì bù cuò.", english: "The weather's nice today." },
      { chinese: "改天有空一起吃饭。", pinyin: "Gǎi tiān yǒu kòng yī qǐ chī fàn.", english: "Let's eat together when we're free." },
      { chinese: "最近比较忙。", pinyin: "Zuì jìn bǐ jiào máng.", english: "I've been pretty busy lately." },
    ],
    commonMistakes:
      "'怎么样' is versatile: '最近怎么样' = how have you been, '天气怎么样' = how's the weather. '还行' and '不错' are both positive but low-key. '你呢' is 'and you?'—very common. '改天' means 'another day,' not 'change the day.'",
  },

  "making-plans-with-friends": {
    intro:
      "Making plans with friends in Mandarin is everyday language you'll use all the time. This page gives you the vocabulary and sentences for suggesting a time, place, or activity and for confirming or changing plans. The content is aimed at A2–B2 learners and HSK 3–6, so you get real-life phrases for texting or talking. Learning these with example sentences and spaced repetition will make arranging meetups much easier.",
    whenUse:
      "Use this when suggesting or confirming plans: time, place, activity, or when you need to reschedule or check if someone is free.",
    vocab: [
      { chinese: "有空", pinyin: "yǒu kòng", english: "free / have time" },
      { chinese: "一起", pinyin: "yī qǐ", english: "together" },
      { chinese: "什么时候", pinyin: "shén me shí hou", english: "when" },
      { chinese: "哪里", pinyin: "nǎ lǐ", english: "where" },
      { chinese: "见面", pinyin: "jiàn miàn", english: "to meet up" },
      { chinese: "约", pinyin: "yuē", english: "to arrange / date" },
      { chinese: "改天", pinyin: "gǎi tiān", english: "another day" },
      { chinese: "到时候", pinyin: "dào shí hou", english: "when the time comes" },
      { chinese: "确定", pinyin: "què dìng", english: "to confirm" },
      { chinese: "没问题", pinyin: "méi wèn tí", english: "no problem" },
      { chinese: "再说", pinyin: "zài shuō", english: "we'll see / talk later" },
      { chinese: "到时候见", pinyin: "dào shí hou jiàn", english: "see you then" },
      { chinese: "放鸽子", pinyin: "fàng gē zi", english: "to stand someone up" },
      { chinese: "准时", pinyin: "zhǔn shí", english: "on time" },
    ],
    sentences: [
      { chinese: "你这周末有空吗？", pinyin: "Nǐ zhè zhōu mò yǒu kòng ma?", english: "Are you free this weekend?" },
      { chinese: "我们一起吃饭吧。", pinyin: "Wǒ men yī qǐ chī fàn ba.", english: "Let's eat together." },
      { chinese: "什么时候见面？", pinyin: "Shén me shí hou jiàn miàn?", english: "When shall we meet?" },
      { chinese: "到时候见。", pinyin: "Dào shí hou jiàn.", english: "See you then." },
      { chinese: "确定了吗？", pinyin: "Què dìng le ma?", english: "Is it confirmed?" },
      { chinese: "改天再约。", pinyin: "Gǎi tiān zài yuē.", english: "Let's arrange for another day." },
    ],
    commonMistakes:
      "'有空' is 'free' (have time). '到时候' means 'when the time comes' or 'then'—'到时候见' is 'see you then.' '放鸽子' is colloquial for standing someone up. '再说' can mean 'we'll talk about it later' or 'we'll see.'",
  },

  "apologizing-naturally": {
    intro:
      "Apologizing naturally in Mandarin goes beyond '对不起.' This page covers the vocabulary and sentences you need to say sorry in different levels of formality, take responsibility, and offer to make it right. The content is tuned for A2–B2 learners and HSK 3–6, so you get real-life phrases that sound natural rather than stiff. Use example sentences and spaced repetition so the right apology comes out when you need it.",
    whenUse:
      "Use this when you've made a mistake, are late, or need to apologize in a casual or slightly more serious context. Also for saying 'my fault' or 'I'll make it up to you.'",
    vocab: [
      { chinese: "对不起", pinyin: "duì bu qǐ", english: "sorry" },
      { chinese: "不好意思", pinyin: "bù hǎo yì si", english: "excuse me / sorry" },
      { chinese: "抱歉", pinyin: "bào qiàn", english: "apologies" },
      { chinese: "我的错", pinyin: "wǒ de cuò", english: "my fault" },
      { chinese: "迟到", pinyin: "chí dào", english: "to be late" },
      { chinese: "下次", pinyin: "xià cì", english: "next time" },
      { chinese: "补", pinyin: "bǔ", english: "to make up for" },
      { chinese: "没关系", pinyin: "méi guān xi", english: "it's okay" },
      { chinese: "没事", pinyin: "méi shì", english: "no big deal" },
      { chinese: "别介意", pinyin: "bié jiè yì", english: "don't mind" },
      { chinese: "是我不对", pinyin: "shì wǒ bù duì", english: "I was wrong" },
      { chinese: "让你久等了", pinyin: "ràng nǐ jiǔ děng le", english: "sorry to keep you waiting" },
      { chinese: "下次不会了", pinyin: "xià cì bù huì le", english: "won't happen again" },
      { chinese: "请原谅", pinyin: "qǐng yuán liàng", english: "please forgive" },
    ],
    sentences: [
      { chinese: "对不起，我来晚了。", pinyin: "Duì bu qǐ, wǒ lái wǎn le.", english: "Sorry, I'm late." },
      { chinese: "不好意思，是我的错。", pinyin: "Bù hǎo yì si, shì wǒ de cuò.", english: "Sorry, it was my fault." },
      { chinese: "让你久等了，抱歉。", pinyin: "Ràng nǐ jiǔ děng le, bào qiàn.", english: "Sorry to keep you waiting." },
      { chinese: "没关系，没事。", pinyin: "Méi guān xi, méi shì.", english: "It's okay, no big deal." },
      { chinese: "下次不会了。", pinyin: "Xià cì bù huì le.", english: "Won't happen again." },
      { chinese: "请原谅我。", pinyin: "Qǐng yuán liàng wǒ.", english: "Please forgive me." },
    ],
    commonMistakes:
      "'不好意思' is lighter than '对不起'; use it for small things. '我的错' is casual 'my fault.' '让你久等了' is the natural way to apologize for making someone wait. '没事' and '没关系' are both 'it's okay'—'没事' is more casual.",
  },

  "numbers-prices": {
    intro:
      "Numbers and prices in Mandarin are used constantly: shopping, bargaining, telling time, and splitting the bill. This page gives you the vocabulary and sentences you need to say prices, ask how much, and understand numbers in real-life situations. The content is aimed at A2–B2 learners and HSK 3–6, so you get practical phrases rather than just number lists. Use example sentences and spaced repetition to lock in the patterns.",
    whenUse:
      "Use this when asking or stating prices, talking about discounts, splitting the bill, or when numbers come up in daily life (time, quantity, amount).",
    vocab: [
      { chinese: "多少钱", pinyin: "duō shǎo qián", english: "how much" },
      { chinese: "块", pinyin: "kuài", english: "yuan (colloquial)" },
      { chinese: "元", pinyin: "yuán", english: "yuan" },
      { chinese: "毛", pinyin: "máo", english: "10 cents" },
      { chinese: "打折", pinyin: "dǎ zhé", english: "discount" },
      { chinese: "便宜", pinyin: "pián yi", english: "cheap" },
      { chinese: "贵", pinyin: "guì", english: "expensive" },
      { chinese: "一共", pinyin: "yī gòng", english: "total" },
      { chinese: "分开付", pinyin: "fēn kāi fù", english: "pay separately" },
      { chinese: "AA制", pinyin: "AA zhì", english: "go Dutch" },
      { chinese: "找零", pinyin: "zhǎo líng", english: "change" },
      { chinese: "收", pinyin: "shōu", english: "to accept (payment)" },
      { chinese: "付", pinyin: "fù", english: "to pay" },
      { chinese: "预算", pinyin: "yù suàn", english: "budget" },
    ],
    sentences: [
      { chinese: "这个多少钱？", pinyin: "Zhè ge duō shǎo qián?", english: "How much is this?" },
      { chinese: "一共一百块。", pinyin: "Yī gòng yī bǎi kuài.", english: "Total is 100 yuan." },
      { chinese: "可以打折吗？", pinyin: "Kě yǐ dǎ zhé ma?", english: "Can you give a discount?" },
      { chinese: "我们分开付吧。", pinyin: "Wǒ men fēn kāi fù ba.", english: "Let's pay separately." },
      { chinese: "太贵了，便宜一点吧。", pinyin: "Tài guì le, pián yi yī diǎn ba.", english: "Too expensive, can you go a bit lower?" },
      { chinese: "收现金吗？", pinyin: "Shōu xiàn jīn ma?", english: "Do you accept cash?" },
    ],
    commonMistakes:
      "'块' is colloquial for yuan; '一百块' = 100 yuan. '毛' is 0.1 yuan (10 cents). 'AA制' means going Dutch. '分开付' is 'pay separately.' Don't confuse '收' (accept) with '付' (pay).",
  },

  "time-dates-schedules": {
    intro:
      "Time, dates, and schedules in Mandarin appear in every conversation: meetings, travel, and daily plans. This page covers the vocabulary and sentences you need to say what time it is, when something happens, and how to reschedule or confirm. The content is tuned for A2–B2 learners and HSK 3–6, so you get real-life phrasing. Use example sentences and spaced repetition so time expressions come out naturally.",
    whenUse:
      "Use this when talking about the time, days of the week, dates, or when arranging or changing schedules (meetings, appointments, travel).",
    vocab: [
      { chinese: "几点", pinyin: "jǐ diǎn", english: "what time" },
      { chinese: "点", pinyin: "diǎn", english: "o'clock" },
      { chinese: "分", pinyin: "fēn", english: "minute" },
      { chinese: "半", pinyin: "bàn", english: "half" },
      { chinese: "早上", pinyin: "zǎo shang", english: "morning" },
      { chinese: "下午", pinyin: "xià wǔ", english: "afternoon" },
      { chinese: "晚上", pinyin: "wǎn shang", english: "evening" },
      { chinese: "星期", pinyin: "xīng qī", english: "week" },
      { chinese: "号", pinyin: "hào", english: "date (day of month)" },
      { chinese: "月", pinyin: "yuè", english: "month" },
      { chinese: "改期", pinyin: "gǎi qī", english: "reschedule" },
      { chinese: "推迟", pinyin: "tuī chí", english: "postpone" },
      { chinese: "提前", pinyin: "tí qián", english: "in advance / earlier" },
      { chinese: "准时", pinyin: "zhǔn shí", english: "on time" },
    ],
    sentences: [
      { chinese: "现在几点？", pinyin: "Xiàn zài jǐ diǎn?", english: "What time is it now?" },
      { chinese: "我们八点半见。", pinyin: "Wǒ men bā diǎn bàn jiàn.", english: "Let's meet at 8:30." },
      { chinese: "会议改期了。", pinyin: "Huì yì gǎi qī le.", english: "The meeting was rescheduled." },
      { chinese: "可以推迟到明天吗？", pinyin: "Kě yǐ tuī chí dào míng tiān ma?", english: "Can we postpone to tomorrow?" },
      { chinese: "请提前十分钟到。", pinyin: "Qǐng tí qián shí fēn zhōng dào.", english: "Please arrive 10 minutes early." },
      { chinese: "下星期五几号？", pinyin: "Xià xīng qī wǔ jǐ hào?", english: "What's the date next Friday?" },
    ],
    commonMistakes:
      "'点半' is half past (e.g. 八点半 = 8:30). '号' is day of month (几号 = what date). '改期' is reschedule; '推迟' is postpone. '提前' can mean 'in advance' or 'earlier' depending on context.",
  },

  "phone-calls-texting": {
    intro:
      "Phone calls and texting in Mandarin use a set of phrases that differ from English: answering, saying 'hold on,' or 'I'll call you back.' This page gives you the vocabulary and sentences you need for real-life calls and messages, aimed at A2–B2 and HSK 3–6. You'll learn how to say 'who's calling,' 'text me,' and 'I'll add you on WeChat.' Use example sentences and spaced repetition so these come out naturally.",
    whenUse:
      "Use this when answering the phone, asking who's calling, saying you'll call back, or when talking about texting, WeChat, or leaving a message.",
    vocab: [
      { chinese: "喂", pinyin: "wéi", english: "hello (phone)" },
      { chinese: "打电话", pinyin: "dǎ diàn huà", english: "to make a call" },
      { chinese: "接电话", pinyin: "jiē diàn huà", english: "to answer the phone" },
      { chinese: "发短信", pinyin: "fā duǎn xìn", english: "to text" },
      { chinese: "微信", pinyin: "wēi xìn", english: "WeChat" },
      { chinese: "等一下", pinyin: "děng yī xià", english: "hold on" },
      { chinese: "打错了", pinyin: "dǎ cuò le", english: "wrong number" },
      { chinese: "回电", pinyin: "huí diàn", english: "call back" },
      { chinese: "留言", pinyin: "liú yán", english: "leave a message" },
      { chinese: "信号", pinyin: "xìn hào", english: "signal" },
      { chinese: "加", pinyin: "jiā", english: "to add (e.g. WeChat)" },
      { chinese: "在吗", pinyin: "zài ma", english: "are you there (text)" },
      { chinese: "收到", pinyin: "shōu dào", english: "got it" },
      { chinese: "马上", pinyin: "mǎ shàng", english: "right away" },
    ],
    sentences: [
      { chinese: "喂，哪位？", pinyin: "Wéi, nǎ wèi?", english: "Hello, who's calling?" },
      { chinese: "请等一下。", pinyin: "Qǐng děng yī xià.", english: "Please hold on." },
      { chinese: "我待会回电给你。", pinyin: "Wǒ dài huì huí diàn gěi nǐ.", english: "I'll call you back later." },
      { chinese: "你加我微信吧。", pinyin: "Nǐ jiā wǒ wēi xìn ba.", english: "Add me on WeChat." },
      { chinese: "在吗？", pinyin: "Zài ma?", english: "Are you there?" },
      { chinese: "收到了，谢谢。", pinyin: "Shōu dào le, xiè xie.", english: "Got it, thanks." },
    ],
    commonMistakes:
      "'喂' is the standard way to answer the phone. '哪位' is 'who's calling?' '打错了' means 'wrong number.' '在吗' is used in chat to mean 'are you there?' '收到' or '收到了' means 'got it' in messages.",
  },

  "asking-for-help-politely": {
    intro:
      "Asking for help politely in Mandarin is essential for travel and daily life. This page covers the vocabulary and sentences you need to ask for assistance without sounding rude or too direct. The content is tuned for A2–B2 and HSK 3–6, so you get real-life phrases like 'could you please...' and 'would it be possible.' Use example sentences and spaced repetition so you can ask for help confidently and politely.",
    whenUse:
      "Use this when you need to ask someone for a favor, directions, or assistance: asking politely, saying 'could you,' and thanking them.",
    vocab: [
      { chinese: "请问", pinyin: "qǐng wèn", english: "excuse me / may I ask" },
      { chinese: "麻烦", pinyin: "má fan", english: "trouble / bother" },
      { chinese: "帮忙", pinyin: "bāng máng", english: "to help" },
      { chinese: "可以...吗", pinyin: "kě yǐ ... ma", english: "could you / is it okay" },
      { chinese: "能...吗", pinyin: "néng ... ma", english: "can you" },
      { chinese: "帮", pinyin: "bāng", english: "to help (verb)" },
      { chinese: "谢谢", pinyin: "xiè xie", english: "thank you" },
      { chinese: "感谢", pinyin: "gǎn xiè", english: "thanks (slightly formal)" },
      { chinese: "不好意思", pinyin: "bù hǎo yì si", english: "excuse me / sorry" },
      { chinese: "打扰", pinyin: "dǎ rǎo", english: "to disturb" },
      { chinese: "劳驾", pinyin: "láo jià", english: "excuse me (polite)" },
      { chinese: "拜托", pinyin: "bài tuō", english: "please (I'm counting on you)" },
      { chinese: "辛苦", pinyin: "xīn kǔ", english: "thanks for your effort" },
      { chinese: "不用谢", pinyin: "bú yòng xiè", english: "you're welcome" },
    ],
    sentences: [
      { chinese: "请问，可以帮我一下吗？", pinyin: "Qǐng wèn, kě yǐ bāng wǒ yī xià ma?", english: "Excuse me, could you help me?" },
      { chinese: "麻烦你了。", pinyin: "Má fan nǐ le.", english: "Sorry to trouble you." },
      { chinese: "能帮我拿一下吗？", pinyin: "Néng bāng wǒ ná yī xià ma?", english: "Could you help me get that?" },
      { chinese: "谢谢，辛苦你了。", pinyin: "Xiè xie, xīn kǔ nǐ le.", english: "Thanks, I appreciate your help." },
      { chinese: "不好意思打扰一下。", pinyin: "Bù hǎo yì si dǎ rǎo yī xià.", english: "Sorry to disturb you." },
      { chinese: "拜托了。", pinyin: "Bài tuō le.", english: "Please, I'm counting on you." },
    ],
    commonMistakes:
      "'请问' softens questions. '麻烦' can be 'trouble' or 'sorry to trouble you' (麻烦你了). '辛苦你了' thanks someone for their effort. '劳驾' is polite 'excuse me,' common in northern China. '拜托' implies you're really counting on them.",
  },

  "customer-service-chat": {
    intro:
      "Customer service chat in Mandarin—whether on Taobao, JD, or a bank app—uses a set of standard phrases. This page gives you the vocabulary and sentences you need to describe a problem, ask for a refund, or get tracking info. The content is aimed at A2–B2 and HSK 3–6, so you get real-life language from live chat and bots. Use example sentences and spaced repetition so you can handle customer service in Mandarin with confidence.",
    whenUse:
      "Use this when chatting with customer service: describing an issue, asking for a refund or exchange, or asking about delivery status.",
    vocab: [
      { chinese: "客服", pinyin: "kè fú", english: "customer service" },
      { chinese: "订单", pinyin: "dìng dān", english: "order" },
      { chinese: "退款", pinyin: "tuì kuǎn", english: "refund" },
      { chinese: "换货", pinyin: "huàn huò", english: "exchange" },
      { chinese: "物流", pinyin: "wù liú", english: "logistics / delivery" },
      { chinese: "快递", pinyin: "kuài dì", english: "express delivery" },
      { chinese: "发货", pinyin: "fā huò", english: "to ship" },
      { chinese: "收到", pinyin: "shōu dào", english: "received" },
      { chinese: "有问题", pinyin: "yǒu wèn tí", english: "there's a problem" },
      { chinese: "联系", pinyin: "lián xì", english: "to contact" },
      { chinese: "回复", pinyin: "huí fù", english: "to reply" },
      { chinese: "稍等", pinyin: "shāo děng", english: "please wait" },
      { chinese: "处理", pinyin: "chǔ lǐ", english: "to process / handle" },
      { chinese: "投诉", pinyin: "tóu sù", english: "to complain" },
    ],
    sentences: [
      { chinese: "我的订单有问题。", pinyin: "Wǒ de dìng dān yǒu wèn tí.", english: "There's a problem with my order." },
      { chinese: "可以退款吗？", pinyin: "Kě yǐ tuì kuǎn ma?", english: "Can I get a refund?" },
      { chinese: "什么时候发货？", pinyin: "Shén me shí hou fā huò?", english: "When will it ship?" },
      { chinese: "物流到哪了？", pinyin: "Wù liú dào nǎ le?", english: "Where is the delivery?" },
      { chinese: "请稍等，我帮您查一下。", pinyin: "Qǐng shāo děng, wǒ bāng nín chá yī xià.", english: "Please wait, I'll check for you." },
      { chinese: "我们会尽快处理。", pinyin: "Wǒ men huì jǐn kuài chǔ lǐ.", english: "We'll handle it as soon as possible." },
    ],
    commonMistakes:
      "'客服' is customer service. '订单' is order. '退款' is refund; '换货' is exchange. '物流' and '快递' both relate to delivery; '物流' is often used for tracking. '稍等' is 'please wait' in chat. '处理' is 'handle' or 'process.'",
  },

  "delivery-takeout-apps": {
    intro:
      "Delivery and takeout apps like 美团, 饿了么, or 外卖 in Taiwan use a lot of specific vocabulary. This page gives you the words and sentences you need to order food, track delivery, and talk to the rider or restaurant. The content is tuned for A2–B2 and HSK 3–6, so you get real-life phrases. Use example sentences and spaced repetition so ordering and delivery go smoothly.",
    whenUse:
      "Use this when ordering on delivery apps, checking delivery status, or communicating with the rider (e.g. where to leave the order, contact-free delivery).",
    vocab: [
      { chinese: "外卖", pinyin: "wài mài", english: "delivery / takeout" },
      { chinese: "下单", pinyin: "xià dān", english: "to place an order" },
      { chinese: "骑手", pinyin: "qí shǒu", english: "delivery rider" },
      { chinese: "配送", pinyin: "pèi sòng", english: "delivery" },
      { chinese: "预计", pinyin: "yù jì", english: "estimated" },
      { chinese: "到了", pinyin: "dào le", english: "arrived" },
      { chinese: "放门口", pinyin: "fàng mén kǒu", english: "leave at the door" },
      { chinese: "无接触", pinyin: "wú jiē chù", english: "contact-free" },
      { chinese: "餐具", pinyin: "cān jù", english: "utensils" },
      { chinese: "不要", pinyin: "bú yào", english: "don't need" },
      { chinese: "备注", pinyin: "bèi zhù", english: "note / remarks" },
      { chinese: "催单", pinyin: "cuī dān", english: "urge order / hurry" },
      { chinese: "好评", pinyin: "hǎo píng", english: "positive review" },
      { chinese: "送餐", pinyin: "sòng cān", english: "deliver food" },
    ],
    sentences: [
      { chinese: "我下单了。", pinyin: "Wǒ xià dān le.", english: "I've placed the order." },
      { chinese: "骑手到哪了？", pinyin: "Qí shǒu dào nǎ le?", english: "Where is the rider?" },
      { chinese: "预计半小时到。", pinyin: "Yù jì bàn xiǎo shí dào.", english: "Estimated to arrive in half an hour." },
      { chinese: "请放门口，无接触配送。", pinyin: "Qǐng fàng mén kǒu, wú jiē chù pèi sòng.", english: "Please leave at the door, contact-free delivery." },
      { chinese: "不要餐具。", pinyin: "Bú yào cān jù.", english: "No utensils needed." },
      { chinese: "备注里写了不要辣。", pinyin: "Bèi zhù lǐ xiě le bú yào là.", english: "I wrote in the notes: no spicy." },
    ],
    commonMistakes:
      "'外卖' is takeout/delivery. '下单' is to place an order. '骑手' is the delivery person. '放门口' is 'leave at the door.' '无接触' is contact-free. '备注' is the notes field when ordering.",
  },
};
