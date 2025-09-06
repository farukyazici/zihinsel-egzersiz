import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Dört İşlem – 1’den 9’a (Açık Mod Kontrast Yükseltilmiş)
 * Tailwind v3 + darkMode:"class"
 */

// İşleme göre pastel–material vurgu paleti
const OP_THEME = {
  "+": {
    ring: "ring-[#9EC9FF]",
    badge: "bg-[#EAF3FF] text-[#215E9E] border-[#CFE3FF]",
    btn: "bg-[#3B82F6] hover:bg-[#2F74E8] text-[#F2F6FB]",
  },
  "-": {
    ring: "ring-[#AEE1C6]",
    badge: "bg-[#E9FAF3] text-[#1B6045] border-[#C9F0DD]",
    btn: "bg-[#22C55E] hover:bg-[#19B354] text-[#F2F6FB]",
  },
  "×": {
    ring: "ring-[#FFD6A6]",
    badge: "bg-[#FFF3E6] text-[#8A5119] border-[#FFE3BF]",
    btn: "bg-[#F59E0B] hover:bg-[#E28F05] text-[#FCFEFF]",
  },
  "÷": {
    ring: "ring-[#D6C7FF]",
    badge: "bg-[#F2EDFF] text-[#5A3CA8] border-[#E2D9FF]",
    btn: "bg-[#8B5CF6] hover:bg-[#7B4BEA] text-[#F7F9FF]",
  },
};

// Utils
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function buildAllowedOps(difficulty, customOps) {
  if (customOps && customOps.length) return customOps;
  switch (difficulty) {
    case "kolay": return ["+", "-"];
    case "orta": return ["+", "-", "×"];
    case "zor": return ["+", "-", "×", "÷"];
    default: return ["+", "-", "×", "÷"];
  }
}
function generateQuestion({ difficulty, customOps }) {
  const allowed = buildAllowedOps(difficulty, customOps);
  const op = pickOne(allowed);
  let a = randInt(1, 9), b = randInt(1, 9);
  let displayA = a, displayB = b, answer = 0;
  if (op === "+") answer = a + b;
  else if (op === "-") { if (b > a) [a, b] = [b, a]; displayA=a; displayB=b; answer=a-b; }
  else if (op === "×") answer = a * b;
  else { const x = randInt(1, 9), y = randInt(1, 9); displayA=x*y; displayB=x; answer=y; }
  return { a: displayA, b: displayB, op, answer };
}
function useInterval(callback, delay, enabled) {
  const savedRef = useRef(callback);
  useEffect(() => { savedRef.current = callback; });
  useEffect(() => {
    if (!enabled || delay == null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay, enabled]);
}
function statKey(diff, secs) { return `dortislem_best_${diff}_${secs}`; }

export default function DortIslemUygulamasi() {
  // Tema
  const getInitialTheme = () => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Oyun state
  const [difficulty, setDifficulty] = useState("kolay");
  const [customOps, setCustomOps] = useState([]);
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);

  const [q, setQ] = useState(() => generateQuestion({ difficulty }));
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [shake, setShake] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const bestKey = useMemo(() => statKey(difficulty, seconds), [difficulty, seconds]);
  const [best, setBest] = useState(() => Number(localStorage.getItem(bestKey) || 0));
  useEffect(() => { setBest(Number(localStorage.getItem(bestKey) || 0)); }, [bestKey]);

  // Sayaç
  useEffect(() => setTimeLeft(seconds), [seconds]);
  useInterval(() => {
    setTimeLeft((t) => {
      if (t <= 1) {
        setRunning(false);
        setBest((prev) => {
          const nb = Math.max(prev, score);
          localStorage.setItem(bestKey, String(nb));
          return nb;
        });
        return 0;
      }
      return t - 1;
    });
  }, 1000, running);

  const themeColors = OP_THEME[q.op];
  const accuracy = score + wrong === 0 ? 100 : Math.round((score / (score + wrong)) * 100);

  function nextQuestion() { setQ(generateQuestion({ difficulty, customOps })); setInput(""); }
  function start() {
    setScore(0); setWrong(0); setStreak(0);
    setTimeLeft(seconds); setRunning(true);
    setQ(generateQuestion({ difficulty, customOps })); setShowSheet(false);
  }
  function stop() {
    setRunning(false);
    setBest((prev) => {
      const nb = Math.max(prev, score);
      localStorage.setItem(bestKey, String(nb));
      return nb;
    });
  }
  function checkAnswer() {
    const val = Number(input);
    if (Number.isNaN(val)) return;
    if (val === q.answer) { setScore((s) => s + 1); setStreak((s) => s + 1); nextQuestion(); }
    else { setWrong((w) => w + 1); setStreak(0); setShake(true); setTimeout(() => setShake(false), 220); }
  }

  // Klavye
  useEffect(() => {
    function onKey(e) {
      if (showSheet) return;
      if (e.key === "Enter") return checkAnswer();
      if (e.key === "Backspace") return setInput((s) => s.slice(0, -1));
      if (/^[0-9]$/.test(e.key)) setInput((s) => (s + e.key).slice(0, 3));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checkAnswer, showSheet]);

  // Çalışma kâğıdı
  const [sheetCount, setSheetCount] = useState(30);
  const [sheetOps, setSheetOps] = useState(["+", "-", "×", "÷"]);
  const sheetItems = useMemo(() => {
    if (!showSheet) return [];
    const items = [];
    for (let i = 0; i < sheetCount; i++) {
      items.push(generateQuestion({ difficulty: "karışık", customOps: sheetOps }));
    }
    return items;
  }, [showSheet, sheetCount, sheetOps]);

  return (
    <div className="min-h-screen print:bg-white">
      {/* Açık mod: gri-200 (#E5E7EB) zemin; koyu mod sabit */}
      <div className="bg-[#E5E7EB] text-[#111827] dark:bg-[#111418] dark:text-[#E8EAED] min-h-screen print:bg-white print:text-black">
        {/* Başlık */}
        <header className="max-w-4xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between print:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dört İşlem – 1’den 9’a</h1>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="px-3 py-1.5 rounded-xl border border-[#94A3B8] dark:border-[#2B3038] bg-[#CBD5E1] dark:bg-[#20262D] hover:bg-[#94A3B8] dark:hover:bg-[#252B33] text-[#111827] dark:text-[#E8EAED] text-sm"
            aria-label="Tema değiştir"
          >
            {theme === "dark" ? "Açık Mod" : "Karanlık Mod"}
          </button>
        </header>

        {/* İçerik */}
        <main className="max-w-4xl mx-auto px-4 pb-24 print:pb-0">
          {/* Kontroller */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 print:hidden">
            <div className="flex flex-wrap gap-2 items-center">
              <label className="text-sm font-medium">Zorluk:</label>
              {[
                { k: "kolay", t: "Kolay" },
                { k: "orta", t: "Orta" },
                { k: "zor", t: "Zor" },
                { k: "karışık", t: "Karışık" },
              ].map((d) => (
                <button
                  key={d.k}
                  onClick={() => setDifficulty(d.k)}
                  className={`px-3 py-1.5 rounded-xl border text-sm ${
                    difficulty === d.k
                      ? "bg-[#2B3441] text-[#EAF0F6] dark:bg-[#EAF0F6] dark:text-[#1C242D]"
                      : "bg-[#E5E7EB] dark:bg-[#1A2128] border-[#94A3B8] dark:border-[#2B3038] hover:bg-[#CBD5E1] dark:hover:bg-[#20272F] text-[#111827] dark:text-[#E8EAED]"
                  }`}
                >
                  {d.t}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end">
              <label className="text-sm font-medium">Süre:</label>
              {[60, 90, 120].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeconds(s)}
                  className={`px-3 py-1.5 rounded-xl border text-sm ${
                    seconds === s
                      ? "bg-[#2B3441] text-[#EAF0F6] dark:bg-[#EAF0F6] dark:text-[#1C242D]"
                      : "bg-[#E5E7EB] dark:bg-[#1A2128] border-[#94A3B8] dark:border-[#2B3038] hover:bg-[#CBD5E1] dark:hover:bg-[#20272F] text-[#111827] dark:text-[#E8EAED]"
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>

            {/* Özel işlem seçimi */}
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">İşlemler:</span>
              {["+", "-", "×", "÷"].map((sym) => {
                const active = customOps.length
                  ? customOps.includes(sym)
                  : buildAllowedOps(difficulty, []).includes(sym);
                return (
                  <button
                    key={sym}
                    onClick={() =>
                      setCustomOps((prev) => {
                        const has = prev.includes(sym);
                        if (!prev.length) return has ? [] : [sym];
                        return has ? prev.filter((x) => x !== sym) : [...prev, sym];
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl border text-sm ${
                      active
                        ? "bg-[#2B3441] text-[#EAF0F6] dark:bg-[#EAF0F6] dark:text-[#1C242D]"
                        : "bg-[#E5E7EB] dark:bg-[#1A2128] border-[#94A3B8] dark:border-[#2B3038] hover:bg-[#CBD5E1] dark:hover:bg-[#20272F] text-[#111827] dark:text-[#E8EAED]"
                    }`}
                    aria-pressed={active}
                  >
                    {sym}
                  </button>
                );
              })}
              {customOps.length > 0 && (
                <button
                  onClick={() => setCustomOps([])}
                  className="ml-1 px-3 py-1.5 rounded-xl border text-sm bg-[#CBD5E1] dark:bg-[#20262D] border-[#94A3B8] dark:border-[#2B3038] hover:bg-[#94A3B8] dark:hover:bg-[#252B33] text-[#111827] dark:text-[#E8EAED]"
                >
                  Sıfırla
                </button>
              )}
            </div>
          </section>

          {/* Oyun Kartı */}
          <section className="mt-4 print:hidden">
            <div className={`rounded-2xl border shadow-sm p-4 sm:p-6 bg-white dark:bg-[#181C20] border-[#D1D5DB] dark:border-[#272B33] ${themeColors?.ring} ring-1`}>
              {/* Üst bilgi */}
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs border ${themeColors?.badge}`}>İşlem: {q.op}</span>
                  <span className="px-2.5 py-1 rounded-full text-xs border bg-[#E5E7EB] dark:bg-[#232830] border-[#D1D5DB] dark:border-[#2B3038]">Zorluk: {difficulty}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-xs opacity-70">Süre</div>
                    <div className="text-lg font-bold tabular-nums">{timeLeft}s</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs opacity-70">Puan</div>
                    <div className="text-lg font-bold tabular-nums">{score}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs opacity-70">Doğruluk</div>
                    <div className="text-lg font-bold tabular-nums">{accuracy}%</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs opacity-70">En İyi</div>
                    <div className="text-lg font-bold tabular-nums">{best}</div>
                  </div>
                </div>
              </div>

              {/* Soru */}
              <div className="mt-6 flex flex-col items-center">
                <div
                  className={`text-5xl sm:text-6xl font-bold tracking-wide ${shake ? "animate-[wiggle_0.22s_ease-in-out]" : ""}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  <style>{`@keyframes wiggle{0%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}100%{transform:translateX(0)}}`}</style>
                  {q.a} <span className="opacity-70">{q.op}</span> {q.b} =
                </div>

                <input
                  inputMode="numeric" pattern="[0-9]*"
                  className="mt-4 text-center w-full max-w-[220px] text-3xl font-semibold rounded-2xl border border-[#D1D5DB] dark:border-[#2B3038] bg-white dark:bg-[#11161B] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#C9D7FF]"
                  value={input}
                  onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="Cevap" disabled={!running} aria-label="Cevap kutusu"
                />

                {/* Tuş takımı */}
                <div className="grid grid-cols-3 gap-2 mt-4 max-w-xs w-full">
                  {[1,2,3,4,5,6,7,8,9,0].map((n, idx) => (
                    <button
                      key={n+"_key"}
                      onClick={() => setInput((s) => (s + String(n)).slice(0, 3))}
                      disabled={!running}
                      className={`${idx===9?"col-span-3":""} rounded-xl py-3 text-lg font-semibold border bg-[#CBD5E1] dark:bg-[#20262D] border-[#94A3B8] dark:border-[#2B3038] hover:bg-[#94A3B8] dark:hover:bg-[#252B33] text-[#111827] dark:text-[#E8EAED] disabled:opacity-50`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setInput((s) => s.slice(0, -1))}
                    className="px-4 py-2 rounded-xl border bg-[#CBD5E1] dark:bg-[#20262D] border-[#94A3B8] dark:border-[#2B3038] hover:bg-[#94A3B8] dark:hover:bg-[#252B33] text-[#111827] dark:text-[#E8EAED]"
                    disabled={!running}
                  >
                    Sil
                  </button>
                  <button
                    onClick={checkAnswer}
                    className={`px-4 py-2 rounded-xl font-semibold ${themeColors?.btn}`}
                    disabled={!running}
                  >
                    Onayla
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {!running ? (
                    <button onClick={start} className="px-4 py-2 rounded-xl font-semibold bg-[#10B981] hover:bg-[#0EA371] text-white">Başlat</button>
                  ) : (
                    <button onClick={stop} className="px-4 py-2 rounded-xl font-semibold bg-[#EF4444] hover:bg-[#DC3B3B] text-white">Durdur</button>
                  )}
                  <button
                    onClick={() => { setShowSheet(true); setRunning(false); }}
                    className="px-4 py-2 rounded-xl font-semibold bg-[#2B3441] hover:bg-[#242C37] text-[#EAF0F6] dark:bg-[#EAF0F6] dark:text-[#1C242D]"
                  >
                    Çalışma Kâğıdı
                  </button>
                </div>

                {timeLeft === 0 && (
                  <div className="mt-4 text-center text-sm opacity-80">
                    Süre bitti. Puanınız: <b>{score}</b> – En iyi: <b>{best}</b>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Yazdırılabilir Çalışma Kâğıdı */}
          {showSheet && (
            <section className="mt-6">
              <div className="rounded-2xl border shadow-sm p-4 sm:p-6 bg-white dark:bg-[#181C20] border-[#D1D5DB] dark:border-[#272B33]">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <h2 className="text-xl font-semibold">Çalışma Kâğıdı Oluştur</h2>
                  <div className="flex gap-2">
                    <button onClick={() => window.print()} className="px-4 py-2 rounded-xl font-semibold bg-[#2B3441] hover:bg-[#242C37] text-[#EAF0F6] dark:bg-[#EAF0F6] dark:text-[#1C242D]">Yazdır</button>
                    <button onClick={() => setShowSheet(false)} className="px-4 py-2 rounded-xl border bg-[#CBD5E1] dark:bg-[#20262D] border-[#94A3B8] dark:border-[#2B3038] hover:bg-[#94A3B8] dark:hover:bg-[#252B33] text-[#111827] dark:text-[#E8EAED]">Geri</button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
                  <label className="text-sm">Soru sayısı:</label>
                  <input
                    type="number" min={6} max={120} value={sheetCount}
                    onChange={(e) => setSheetCount(Math.max(6, Math.min(120, Number(e.target.value) || 30)))}
                    className="w-24 px-3 py-1.5 rounded-xl border bg-white dark:bg-[#11161B] border-[#D1D5DB] dark:border-[#2B3038]"
                  />

                  <span className="text-sm">İşlemler:</span>
                  {["+","-","×","÷"].map((sym)=>{
                    const active = sheetOps.includes(sym);
                    return (
                      <button key={sym}
                        onClick={() => setSheetOps((prev)=> prev.includes(sym) ? prev.filter(x=>x!==sym): [...prev, sym])}
                        className={`px-3 py-1.5 rounded-xl border text-sm ${
                          active
                            ? "bg-[#2B3441] text-[#EAF0F6] dark:bg-[#EAF0F6] dark:text-[#1C242D]"
                            : "bg-[#E5E7EB] dark:bg-[#1A2128] border-[#94A3B8] dark:border-[#2B3038] hover:bg-[#CBD5E1] dark:hover:bg-[#20272F] text-[#111827] dark:text-[#E8EAED]"
                        }`}
                      >{sym}</button>
                    )
                  })}
                  <button onClick={()=> setSheetOps(["+","-","×","÷"]) } className="px-3 py-1.5 rounded-xl border text-sm bg-[#CBD5E1] dark:bg-[#20262D] border-[#94A3B8] dark:border-[#2B3038] hover:bg-[#94A3B8] dark:hover:bg-[#252B33] text-[#111827] dark:text-[#E8EAED]">
                    Tümü
                  </button>
                </div>

                {/* Baskı başlığı */}
                <div className="mt-6 print:mt-0">
                  <div className="flex justify-between text-sm print:text-base">
                    <div>
                      <div><b>Ad Soyad:</b> __________________________</div>
                      <div className="mt-1"><b>Tarih:</b> ____ / ____ / ______</div>
                    </div>
                    <div>
                      <div><b>Süre:</b> ______ dk</div>
                      <div className="mt-1"><b>Puan:</b> ______ / {sheetCount}</div>
                    </div>
                  </div>

                  {/* Soru ızgarası */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
                    {sheetItems.map((it, i) => (
                      <div key={i} className="border border-[#D1D5DB] print:border-black rounded-xl px-3 py-2 text-lg tracking-wide bg-white text-[#111827]">
                        <div style={{ fontVariantNumeric: "tabular-nums" }} className="flex items-center justify-between gap-2">
                          <span className="opacity-70 tabular-nums">{String(i+1).padStart(2,"0")}.</span>
                          <span className="whitespace-nowrap">{it.a} {it.op} {it.b} = ________</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 text-xs opacity-60 print:text-[10pt]">
                    Not: Bölme işlemleri tam sayılı sonuç verir. Çıkarma işlemlerinde negatif sonuç verilmez.
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Alt bilgi */}
          <footer className="mt-8 text-center text-xs opacity-70 print:hidden">
            Hazırlayan: <b>Ahmet Aslan</b> • Dikkat ve zihinsel egzersiz aracı (1–9)
          </footer>
        </main>
      </div>
    </div>
  );
}
