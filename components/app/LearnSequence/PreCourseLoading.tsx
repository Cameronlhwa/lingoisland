"use client";

import type { ReactNode } from "react";
import AppLogo from "@/components/app/AppLogo";
import { useLanguage } from "@/contexts/LanguageContext";
import styles from "./PreCourseLoading.module.css";

export default function PreCourseLoading({ children, paused = false }: { children?: ReactNode; paused?: boolean } = {}) {
  const { t } = useLanguage();
  return (
    <div className={`hsk-app-theme lingo-body ${styles.screen}`} data-testid="journey-loading">
      <header className={styles.header}>
        <AppLogo />
        <span className={styles.journey}>{t("Your journey")}</span>
      </header>
      <section className={styles.center} aria-labelledby="journey-loading-title">
        <div className={styles.content}>
          {!paused && <div className={styles.ring} aria-hidden="true" />}
          <h1 id="journey-loading-title" className={styles.title}>{t("A little closer to your next conversation.")}</h1>
          <p className={styles.subtitle}>{t("Your next lesson is on its way.")}</p>
          {!paused && <p className={styles.status} role="status">
            <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
            {t("Getting ready…")}
          </p>}
          {children && <div className={styles.recovery}>{children}</div>}
        </div>
      </section>
      <footer className={styles.footer}>{t("Mandarin that matters to you.")}</footer>
    </div>
  );
}
