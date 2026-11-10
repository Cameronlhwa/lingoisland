// "Where you'll be": a week-by-week path from the first lesson to the plan's
// milestone, so the learner sees the result, not just lesson one. The last
// stage is deliberately the big, concrete picture (Stewart's feedback: the
// paywall undersold by only showing "hello" and food words).
//
// Weeks come from the plan's fixed path length (always 12 weeks), so the
// chart, stage cards, and headline stay aligned.

import type { OnboardingAnswers } from "./flow";
import { timingHasEvent } from "./painPoints";
import type { LearningPlan, MilestoneKey } from "./plan";

export type RoadmapStage = { week: number; when: string; title: string };
export type Roadmap = { heading: string; note: string; stages: RoadmapStage[]; finalWeek: number; finalTitle: string };

type Stages = readonly [string, string, string, string];

// {topic} is the learner's first topic, lowercased ("clients", "food").
// Kept short on purpose: each line has to be read at a glance.
const PATHS: Record<MilestoneKey, { starter: Stages; builder?: Stages }> = {
  business: {
    starter: [
      "Introduce yourself: name, role, company",
      "Small talk at work: lunch, weekends, times",
      "Follow colleagues\u2019 chats and answer questions",
      "Chat with clients in Mandarin, no English needed",
    ],
    builder: [
      "Talk about your work with confidence",
      "Join meeting small talk instead of staying quiet",
      "Ask clients about {topic} and follow the answers",
      "Run a whole client conversation in Mandarin",
    ],
  },
  heritage: {
    starter: [
      "Greet family and say how you are",
      "Talk about food and your day",
      "Follow the family chatter and jump in",
      "Talk with your grandparents, no English needed",
    ],
    builder: [
      "Say back what you already understand",
      "Ask relatives about their lives",
      "Share your stories at family meals",
      "A whole family dinner in Mandarin",
    ],
  },
  travel: {
    starter: [
      "Hello, thank you, and \u201chow much?\u201d",
      "Order food exactly how you want it",
      "Taxis, metro, directions and hotels",
      "A full day of your trip in Mandarin",
    ],
    builder: [
      "Order and ask without pointing",
      "Handle transport, hotels and shopping",
      "Small talk with drivers and hosts",
      "Real conversations with locals",
    ],
  },
  school: {
    starter: [
      "Classroom basics: ask, answer, clarify",
      "Chat with classmates about classes",
      "Follow class and ask your own questions",
      "Keep up in group conversations",
    ],
  },
  beginner: {
    starter: [
      "Greetings, your name, how you are",
      "Numbers, times, food and daily questions",
      "Short chats about yourself and {topic}",
      "Chat about yourself and {topic} in Mandarin",
    ],
  },
  early: {
    starter: [
      "Say the words you know out loud",
      "Talk about your day and {topic}",
      "Follow everyday speech at natural speed",
      "Easy conversations about {topic}",
    ],
  },
  intermediate: {
    starter: [
      "Fill the gaps when talking about {topic}",
      "Explain your opinions in more detail",
      "Follow fast, natural speech",
      "Talk about {topic} with ease",
    ],
  },
  advanced: {
    starter: [
      "Put complex ideas into Mandarin",
      "Use the phrasing natives actually use",
      "Explain and debate abstract topics",
      "Precise, natural Mandarin about {topic}",
    ],
  },
};

function topicFor(plan: LearningPlan): string {
  return plan.interests[0]?.toLowerCase() ?? "everyday life";
}

function daysPhrase(plan: LearningPlan): string {
  if (plan.daysVary) return "a few days a week";
  return plan.daysLabel === "every day" ? "every day" : `${plan.daysLabel} a week`;
}

/** Stage weeks: 1, about a third of the way, about two thirds, then the milestone. */
export function roadmapWeeks(finalWeek: number): [number, number, number, number] {
  const last = Math.max(4, finalWeek);
  const second = Math.max(2, Math.round(last * 0.3));
  const third = Math.max(second + 1, Math.round(last * 0.65));
  return [1, second, Math.min(third, last - 1), last];
}

export function buildRoadmap(answers: OnboardingAnswers, plan: LearningPlan): Roadmap {
  const path = PATHS[plan.milestone.key];
  const stages = plan.level >= 2 && path.builder ? path.builder : path.starter;
  const topic = topicFor(plan);
  const fill = (text: string) => text.replace(/\{topic\}/g, topic);
  const weeks = roadmapWeeks(plan.milestone.weeks[1]);
  const event = timingHasEvent(answers.usingPain.timing) ? answers.usingPain.upcomingText : null;
  const roadmapStages = stages.map((title, index) => ({
    week: weeks[index],
    when: index === stages.length - 1 ? `By week ${weeks[index]}` : `Week ${weeks[index]}`,
    title: fill(title),
  }));
  const final = roadmapStages[roadmapStages.length - 1];
  return {
    heading: "Where you\u2019ll be",
    note: event
      ? `At ${plan.minutesPerDay} minutes a day, ${daysPhrase(plan)}, with what you need for ${event} built in.`
      : `At ${plan.minutesPerDay} minutes a day, ${daysPhrase(plan)}.`,
    stages: roadmapStages,
    finalWeek: final.week,
    finalTitle: final.title,
  };
}
