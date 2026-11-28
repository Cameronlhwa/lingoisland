import Image from "next/image";
import styles from "./LessonRecap.module.css";

export function LessonRecap({ title, text }: { title: string; text: string }) {
  return <>
    <div className={styles.heading}>
      <Image src="/onboarding/huahua/04-follow-the-exchange.png" alt="" width={64} height={64} className={styles.mascot}/>
      <h1>{title}</h1>
    </div>
    <div className={styles.examples}>
      {text.split("\n").filter(Boolean).map((line, index) => {
        const [hanzi, ...translation] = line.split(/\s+—\s+/);
        const [meaning, hint] = translation.join(" — ").split(/\s+(?=Use this when)/);
        return <div key={line} className={styles.bubble} data-tone={index % 3}>
          <p className={styles.hanzi} lang="zh-CN">{hanzi}</p>
          {meaning && <p className={styles.meaning}>{meaning}</p>}
          {hint && <p className={styles.hint}>{hint}</p>}
        </div>;
      })}
    </div>
  </>;
}
