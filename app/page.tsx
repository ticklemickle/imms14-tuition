"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

/* ===== 학기 기간 ===== */
const SEMESTER_START = new Date("2025-09-02T00:00:00+09:00");
const SEMESTER_END = new Date("2025-12-20T23:59:59+09:00");

/* ===== 요일/분 단위 수업 계획 (수=3h, 토=6h) ===== */
const CLASS_DAY_PLANS = [
  { weekday: 3, minutes: 180 }, // 수요일 3시간
  { weekday: 6, minutes: 360 }, // 토요일 6시간
] as const;

/* ===== 등록금/총시간/단가 ===== */
const TOTAL_HOURS = 132;
const TOTAL_SECS = TOTAL_HOURS * 3600; // 132h = 475,200s
const PER_SEC = 22.09; // 초당 22.09원
const FIXED_TUITION = 10_500_000;

/* ===== 유틸 ===== */
function nextWeekdayOnOrAfter(base: Date, weekday: number): Date {
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    0,
    0,
    0
  );
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function sessionStartOn(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function fmtDuration(min: number) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}시간 ${mm}분` : `${mm}분`;
}
const fmtKRW0 = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const fmtKRW2 = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* ===== 핵심: 가변 분 단위로 경과 수업 초 산출 ===== */
function elapsedSecondsByPlan(now: Date): number {
  if (now <= SEMESTER_START) return 0;
  const endBound = now < SEMESTER_END ? now : SEMESTER_END;

  let elapsed = 0;
  for (const plan of CLASS_DAY_PLANS) {
    const d = nextWeekdayOnOrAfter(SEMESTER_START, plan.weekday);
    while (d <= endBound) {
      const s = sessionStartOn(d);
      const e = new Date(s.getTime() + plan.minutes * 60 * 1000);

      if (endBound >= e) {
        elapsed += plan.minutes * 60; // 완전히 지난 수업
      } else if (endBound > s) {
        elapsed += Math.floor((endBound.getTime() - s.getTime()) / 1000); // 진행 중
      }
      d.setDate(d.getDate() + 7); // 다음 주 동일 요일
    }
  }
  return elapsed;
}

/* ===== 컴포넌트 ===== */
export default function Page() {
  const [now, setNow] = useState(new Date());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setHydrated(true), 0); // ✅ 동기 호출 제거

    let raf: number;
    const tick = () => {
      setNow(new Date());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, []);

  // 계산
  const calc = useMemo(() => {
    const elapsedSec = elapsedSecondsByPlan(now);
    const capped = clamp(elapsedSec, 0, TOTAL_SECS);
    const ratio = TOTAL_SECS > 0 ? capped / TOTAL_SECS : 0;

    const used = PER_SEC * capped;
    const remain = FIXED_TUITION - used;
    const perMin = PER_SEC * 60;

    return {
      ratio,
      used,
      remain,
      usedKRW0: fmtKRW0.format(used),
      usedKRW2: fmtKRW2.format(used),
      remainKRW0: fmtKRW0.format(remain),
      remainKRW2: fmtKRW2.format(remain),
      pctText: `${Math.round(ratio * 100)}%`,
      timeLeftText: `남은 수업시간 ${fmtDuration((TOTAL_SECS - capped) / 60)}`,
      rateText: `현재 속도: 분당 약 ${fmtKRW0.format(
        perMin
      )} • 초당 약 ${PER_SEC.toFixed(2)}원`,
      scheduleText: `수업: 수 3시간 / 토 6시간 • 총 ${TOTAL_HOURS}시간`,
    };
  }, [now]);

  // 진행바 CSS 변수 즉시 반영 (프레임마다 업데이트)
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty(
      "--progress",
      String(calc.ratio)
    );
  }, [calc.ratio, hydrated]);

  return (
    <div className={styles.wrap}>
      <header>
        <div className={styles.logo} aria-hidden="true">
          <div className={styles.cone}></div>
          <div className={styles.scoop}>
            <div className={styles.shine}></div>
          </div>
          <div className={styles.drip}></div>
        </div>
        <div>
          <h1>
            등록금이 살살 녹는다 <span aria-hidden="true">🍦</span>
          </h1>
          {hydrated ? (
            <div className={styles.tag} role="status" aria-live="polite">
              <b>{calc.pctText}</b> 만큼 사용 중 •{" "}
              <span>{calc.timeLeftText}</span>
            </div>
          ) : (
            <div className={styles.tag} aria-hidden="true">
              <b>0%</b> 만큼 사용 중 • <span>남은 수업시간 계산 중…</span>
            </div>
          )}
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.col}>
          <div className={styles.inputs}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Time is gold</h2>

            <div>
              <strong>이번 학기 등록금:</strong>{" "}
              <span>{fmtKRW0.format(FIXED_TUITION)}</span>
            </div>

            {hydrated && (
              <>
                <div className={styles.hint}>{calc.scheduleText}</div>
                <div className={styles.hint}>{calc.rateText}</div>
              </>
            )}
          </div>

          <div className={styles.viz}>
            <div className={styles.bar} aria-hidden="true">
              <div className={styles.fill}></div>
            </div>

            {/* 정수/소수 표시를 모두 제공: 소수(실시간) + 정수(요약) */}
            {hydrated ? (
              <div className={styles.stats}>
                <div className={styles.pill}>
                  <span className={styles.hint}>지금까지 사용된 등록금</span>
                  <span className={styles.num} title={calc.usedKRW0}>
                    {calc.usedKRW2}
                  </span>
                </div>
                <div className={styles.pill}>
                  <span className={styles.hint}>남은 등록금</span>
                  <span className={styles.num} title={calc.remainKRW0}>
                    {calc.remainKRW2}
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.stats} aria-hidden="true">
                <div className={styles.pill}>
                  <span className={styles.hint}>지금까지 사용된 등록금</span>
                  <span className={styles.num}>—</span>
                </div>
                <div className={styles.pill}>
                  <span className={styles.hint}>남은 등록금</span>
                  <span className={styles.num}>—</span>
                </div>
              </div>
            )}

            <div className={styles.puddle} aria-hidden="true"></div>
            <p className={styles.hint}>⏱️ 여러분의 시간은 소중하니깐</p>
          </div>
        </div>
      </section>

      <footer>
        만든이: <a href="">JunHyun Lee</a> • 테마: 임스덕
      </footer>
    </div>
  );
}
