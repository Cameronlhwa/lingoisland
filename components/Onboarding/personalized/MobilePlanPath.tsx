import { Clock, Flag } from "lucide-react";
import type { Roadmap } from "@/lib/onboarding/personalized/roadmap";
import styles from "./MobilePlanPath.module.css";

export function MobilePlanPath({roadmap, minutes, goal}:{roadmap:Roadmap;minutes:number;goal:string}) {
 return <div data-testid="mobile-plan-path">
  <p className={styles.intro}>A {roadmap.finalWeek}-week plan built around your goals.</p>
  <div className={styles.chips}><span><Clock size={16} aria-hidden/>{minutes} min a day</span><span><Flag size={16} aria-hidden/>{goal}</span></div>
  <ol className={styles.path} aria-label="Your planned learning milestones">
   {roadmap.stages.map((stage,index)=><li key={`${stage.week}-${index}`} className={styles.stage} data-current={index===0}>
    <span className={styles.node} aria-hidden/>
    <div className={styles.stageCopy}><p className={styles.when}>{index===0?"Start here":`Week ${stage.week}`}</p><p className={styles.title}>{stage.title}</p></div>
   </li>)}
  </ol>
 </div>;
}
