import type { HuahuaTurn, TurnMode } from "./ai";
import type { HskLevel } from "./scaffolding";
import type { Vocab } from "./wordComfort";

// Deterministic Huahua texts used when the model is unavailable, times out,
// returns invalid output, or lacks context. They make no claims beyond the
// facts passed in.

function turn(message: string, pinyin: string, translation: string, targetVocab: Vocab[] = []): HuahuaTurn {
  return {
    message,
    pinyin,
    translation,
    targetVocab,
    detectedDifficulty: null,
    correction: null,
    wordComfortUpdates: [],
    conversationState: "practicing",
    suggestedNextAction: "continue",
    safety: "safe",
  };
}

export function fallbackReply(level: HskLevel): HuahuaTurn {
  if (level <= 2) {
    return turn(
      "抱歉，我现在没法好好回复。等一下再发给我吧！",
      "Bàoqiàn, wǒ xiànzài méi fǎ hǎohǎo huífù. Děng yíxià zài fā gěi wǒ ba!",
      "Sorry, I can't reply properly right now. Text me again in a bit!",
    );
  }
  return turn(
    "抱歉，我暂时没法回复。过一会儿再发给我吧！",
    "Bàoqiàn, wǒ zànshí méi fǎ huífù. Guò yíhuìr zài fā gěi wǒ ba!",
    "Sorry, I can't reply right now. Try texting me again in a minute!",
  );
}

/**
 * Opener from real material only. `journeyName` is set only when the learner
 * actually completed that Journey step.
 */
export function fallbackOpener(input: { level: HskLevel; vocab: Vocab[]; journeyName?: string | null }): HuahuaTurn {
  const word = input.vocab.find((vocab) => vocab.hanzi);
  if (!word) {
    return turn("你好！今天过得怎么样？", "Nǐ hǎo! Jīntiān guò de zěnmeyàng?", "Hi! How's your day going?");
  }
  const gloss = word.english ? ` (${word.english})` : "";
  if (input.journeyName) {
    return turn(
      `你好！你刚学了「${word.hanzi}」。用它说一句话，好吗？`,
      `Nǐ hǎo! Nǐ gāng xué le "${word.pinyin ?? word.hanzi}". Yòng tā shuō yí jù huà, hǎo ma?`,
      `Hi! You just learned "${word.hanzi}"${gloss} in ${input.journeyName}. Can you make a sentence with it?`,
      [word],
    );
  }
  return turn(
    `你好！我们练习一下「${word.hanzi}」吧。你能用它说一句话吗？`,
    `Nǐ hǎo! Wǒmen liànxí yíxià "${word.pinyin ?? word.hanzi}" ba. Nǐ néng yòng tā shuō yí jù huà ma?`,
    `Hi! Let's practice "${word.hanzi}"${gloss}. Can you make a sentence with it?`,
    [word],
  );
}

export function fallbackFor(mode: TurnMode, level: HskLevel, vocab: Vocab[], journeyName?: string | null) {
  return mode === "opener" ? fallbackOpener({ level, vocab, journeyName }) : fallbackReply(level);
}
