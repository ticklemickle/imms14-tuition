"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

/* ===== 학기 기간 ===== */
const SEMESTER_START = new Date("2025-09-02T00:00:00+09:00");
const SEMESTER_END = new Date("2025-12-20T23:59:59+09:00");

/* ===== 등록금(고정) ===== */
const FIXED_TUITION = 10_500_000;

/* ===== 전체 기간(초) =====
   학기 시작~종료까지의 '실제 경과 초'를 기준으로 선형 차감 */
const DURATION_SECS = Math.max(
  1,
  Math.floor((SEMESTER_END.getTime() - SEMESTER_START.getTime()) / 1000)
);

/* ===== 유틸 ===== */
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

/* ===== 핵심: 학기 전체 기간을 기준으로 경과 초 산출(선형) ===== */
function elapsedSecondsLinear(now: Date): number {
  if (now <= SEMESTER_START) return 0;
  const endBound = now < SEMESTER_END ? now : SEMESTER_END;
  return Math.floor((endBound.getTime() - SEMESTER_START.getTime()) / 1000);
}

/* ===== 컴포넌트 ===== */
export default function Page() {
  const [now, setNow] = useState(new Date());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let raf: number;
    let didHydrate = false;

    const tick = () => {
      if (!didHydrate) {
        didHydrate = true;
        setHydrated(true);
      }
      setNow(new Date());
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 계산: 학기 전체 기간 기준으로 초당 실시간 차감
  const calc = useMemo(() => {
    const elapsedSec = elapsedSecondsLinear(now);
    const capped = clamp(elapsedSec, 0, DURATION_SECS);
    const ratio = DURATION_SECS > 0 ? capped / DURATION_SECS : 0;

    // 초당 단가는 전체 기간을 기준으로 산출
    const perSec = FIXED_TUITION / DURATION_SECS;

    const used = perSec * capped;
    const remain = FIXED_TUITION - used;
    const perMin = perSec * 60;

    const secsLeft = DURATION_SECS - capped;

    return {
      ratio,
      used,
      remain,
      usedKRW0: fmtKRW0.format(used),
      remainKRW0: fmtKRW0.format(remain),
      pctText: `${Math.round(ratio * 100)}%`,
      rateText: `현재 속도: 분당 약 ${fmtKRW0.format(
        perMin
      )} • 초당 약 ${perSec.toFixed(2)}원`,
      scheduleText: `기간: 2025-09-02 ~ 2025-12-20`,
    };
  }, [now]);

  // 진행바 CSS 변수 즉시 반영
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty(
      "--progress",
      String(calc.ratio)
    );
  }, [calc.ratio, hydrated]);

  return (
    <div className={styles.wrap}>
      {/* 이미지 영역 추가 */}
      <img src="/immsDuck.png" alt="임스덕" className={styles.artwork} />
      <header>
        {/* <div className={styles.logo} aria-hidden="true">
          <div className={styles.cone}></div>
          <div className={styles.scoop}>
            <div className={styles.shine}></div>
          </div>
          <div className={styles.drip}></div>
        </div> */}
        <div>
          <h1>
            등록금이 녹는 체감 속도 <span aria-hidden="true"></span>
          </h1>
          {hydrated ? (
            <div className={styles.tag} role="status" aria-live="polite">
              <b>{calc.pctText}</b> 만큼 지나갔넹
            </div>
          ) : (
            <div className={styles.tag} aria-hidden="true">
              <b>0%</b> 만큼 사용 중 • <span>남은 시간 계산 중…</span>
            </div>
          )}
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.col}>
          <div className={styles.inputs}>
            <strong>Time is gold 💰</strong>

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

            {hydrated ? (
              <div className={styles.stats}>
                <div className={styles.pill}>
                  <span className={styles.hint}>사용된 등록금</span>
                  <span className={styles.num} title={calc.usedKRW0}>
                    {calc.usedKRW0}
                  </span>
                </div>
                <div className={styles.pill}>
                  <span className={styles.hint}>남은 등록금</span>
                  <span className={styles.num} title={calc.remainKRW0}>
                    {calc.remainKRW0}
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
        만든이: <span style={{ color: "var(--accent)" }}>JunHyun Lee</span> •
        테마: <span style={{ color: "var(--accent)" }}>임스덕</span>
      </footer>
    </div>
  );
}
