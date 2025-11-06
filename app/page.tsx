"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

// ===== 하드코딩된 수업 일정 =====
const SEMESTER_START = new Date("2025-09-02T00:00:00+09:00");
const SEMESTER_END = new Date("2025-12-20T23:59:59+09:00");
const CLASS_DAYS = [1, 3, 5]; // 월(1), 수(3), 금(5)
const CLASS_START = { hour: 9, minute: 0 };
const CLASS_MINUTES = 120;
const HOLIDAYS = ["2025-09-15", "2025-09-16"];

// ===== 타입 정의 =====
interface Session {
  start: Date;
  end: Date;
}

interface ClassTotals {
  totalMin: number;
  elapsedMin: number;
  inSession: boolean;
  currentSession: Session | null;
}

// ===== 유틸 =====
function isHoliday(d: Date): boolean {
  return HOLIDAYS.includes(d.toISOString().slice(0, 10));
}

function sessionRangeOn(date: Date): Session | null {
  const day = date.getDay();
  if (!CLASS_DAYS.includes(day) || isHoliday(date)) return null;

  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    CLASS_START.hour,
    CLASS_START.minute,
    0
  );
  const end = new Date(start.getTime() + CLASS_MINUTES * 60 * 1000);

  if (end < SEMESTER_START || start > SEMESTER_END) return null;
  return { start, end };
}

function walkDates(start: Date, end: Date, cb: (d: Date) => void): void {
  const d = new Date(start);
  while (d <= end) {
    cb(new Date(d));
    d.setDate(d.getDate() + 1);
  }
}

function computeClassTotals(now = new Date()): ClassTotals {
  let totalMin = 0;
  let elapsedMin = 0;
  let inSession = false;
  let currentSession: Session | null = null;

  walkDates(SEMESTER_START, SEMESTER_END, (d) => {
    const s = sessionRangeOn(d);
    if (!s) return;
    totalMin += CLASS_MINUTES;

    if (now >= s.end) {
      elapsedMin += CLASS_MINUTES;
    } else if (now > s.start && now < s.end) {
      elapsedMin += Math.floor((now.getTime() - s.start.getTime()) / 60000);
      inSession = true;
      currentSession = s;
    }
  });

  return { totalMin, elapsedMin, inSession, currentSession };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}시간 ${mm}분` : `${mm}분`;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${da}`;
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

// ===== 메인 컴포넌트 =====
export default function Page() {
  const [tuitionInput, setTuitionInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("tuitionKRW") ?? "";
  });

  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const calc = useMemo(() => {
    const raw = (tuitionInput || "").toString().replace(/,/g, "");
    const tuition = Number(raw);
    const { totalMin, elapsedMin, inSession, currentSession } =
      computeClassTotals(now);

    const totalSec = Math.max(1, totalMin * 60);
    let elapsedSec = elapsedMin * 60;

    if (inSession && currentSession?.start) {
      elapsedSec += Math.floor(
        (now.getTime() - currentSession.start.getTime()) / 1000
      );
    }

    const ratio = clamp(totalSec > 0 ? elapsedSec / totalSec : 0, 0, 1);
    const safeTuition = Number.isFinite(tuition) && tuition > 0 ? tuition : 0;
    const used = safeTuition * ratio;
    const remain = safeTuition - used;
    const perSec = safeTuition / totalSec;
    const perMin = perSec * 60;

    return {
      ratio,
      usedKRW: fmtKRW0.format(used),
      remainKRW: fmtKRW0.format(remain),
      pctText: `${Math.round(ratio * 100)}%`,
      timeLeftText: `남은 수업시간 ${fmtDuration(totalMin - elapsedMin)}`,
      rateText: `현재 속도: 분당 약 ${fmtKRW0.format(
        perMin
      )} • 초당 약 ${fmtKRW2.format(perSec)} 감소`,
      scheduleText: `학기: ${ymd(SEMESTER_START)} ~ ${ymd(
        SEMESTER_END
      )} • 요일: 월/수/금 • 매회 ${CLASS_MINUTES}분`,
    };
  }, [tuitionInput, now]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--progress",
      String(calc.ratio)
    );
  }, [calc.ratio]);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  function showToast(msg: string): void {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  }

  function saveTuition(): void {
    localStorage.setItem("tuitionKRW", tuitionInput);
    showToast("저장되었습니다 ✅");
  }

  function resetAll(): void {
    localStorage.removeItem("tuitionKRW");
    setTuitionInput("");
    showToast("초기화 완료 🧹");
  }

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
          <div className={styles.tag} role="status" aria-live="polite">
            <b>{calc.pctText}</b> 만큼 사용 중 •{" "}
            <span>{calc.timeLeftText}</span>
          </div>
        </div>
      </header>

      <section className={styles.card} aria-labelledby="calcTitle">
        <div className={styles.col}>
          <div className={styles.inputs}>
            <h2 id="calcTitle" style={{ margin: "0 0 4px", fontSize: 18 }}>
              나의 달콤-씁쓸 계산기
            </h2>
            <div>
              <label htmlFor="tuition">이번 학기 등록금 (₩)</label>
              <input
                id="tuition"
                type="number"
                inputMode="decimal"
                placeholder="예: 10,000,000"
                min={0}
                step={1000}
                value={tuitionInput}
                onChange={(e) => setTuitionInput(e.target.value)}
              />
              <p className={styles.hint}>
                * 수업 총 시간/날짜는 하드코딩된 학사일정으로 자동 계산됩니다.
              </p>
            </div>

            <div className={styles.rowActions}>
              <button
                className={styles.btn}
                type="button"
                onClick={saveTuition}
              >
                저장
              </button>
              <button
                className={`${styles.btn} ${styles.secondary}`}
                type="button"
                onClick={resetAll}
              >
                초기화
              </button>
            </div>

            <div className={styles.hint}>{calc.scheduleText}</div>
            <div className={styles.hint}>{calc.rateText}</div>
            {toast && <div className={styles.hint}>{toast}</div>}
          </div>

          <div className={styles.viz}>
            <div className={styles.bar} aria-hidden="true">
              <div className={styles.fill}></div>
            </div>
            <div className={styles.stats} aria-live="polite">
              <div className={styles.pill}>
                <span className={styles.hint}>지금까지 사용된 등록금</span>
                <span className={styles.num} id="used">
                  {calc.usedKRW}
                </span>
              </div>
              <div className={styles.pill}>
                <span className={styles.hint}>남은 등록금</span>
                <span className={styles.num} id="remain">
                  {calc.remainKRW}
                </span>
              </div>
            </div>
            <div className={styles.puddle} aria-hidden="true"></div>
            <p className={styles.hint}>
              ⏱️ 수업시간 기준으로 초당 감소를 실시간 반영합니다.
            </p>
          </div>
        </div>
      </section>

      <footer>
        만든이: <a href="#">Andy</a> • 테마: 바닐라 아이스크림
      </footer>
    </div>
  );
}
