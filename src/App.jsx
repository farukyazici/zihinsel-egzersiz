import React, { useEffect, useMemo, useRef, useState } from "react";

// Dört İşlem – 1’den 9’a (Mobil Uyumlu Egzersiz)
// Tek dosya React bileşeni. Tailwind ile stillendi. 
// Özellikler: Zorluk (Kolay/Orta/Zor/Karışık), zamanlayıcı, puan, seri, doğruluk,
// renk kodlu işlemler, sayısal tuş takımı, yazdırılabilir çalışma kâğıdı, 
// karanlık mod, yerel saklama (en iyi skor).

// Renk eşlemesi (Tailwind)
const OP_THEME = {
  "+": {
    ring: "ring-blue-300",
    badge: "bg-blue-100 text-blue-700 border-blue-300",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  "-": {
    ring: "ring-green-300",
    badge: "bg-green-100 text-green-700 border-green-300",
    btn: "bg-green-600 hover:bg-green-700 text-white",
  },
  "×": {
    ring: "ring-orange-300",
    badge: "bg-orange-100 text-orange-700 border-orange-300",
    btn: "bg-orange-600 hover:bg-orange-700 text-white",
  },
  "÷": {
    ring: "ring-purple-300",
    badge: "bg-purple-100 text-purple-700 border-purple-300",
    btn: "bg-purple-600 hover:bg-purple-700 text-white",
  },
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildAllowedOps(difficulty, customOps) {
  if (customOps && customOps.length) return customOps;
  switch (difficulty) {
    case "kolay":
      return ["+", "-"];
    case "orta":
      return ["+", "-", "×"];
    case "zor":
      return ["+", "-", "×", "÷"];
    case "karışık":
    default:
      return ["+", "-", "×", "÷"];
  }
}

function generateQuestion({ difficulty, customOps }) {
  const allowed = buildAllowedOps(difficulty, customOps);
  const op = pickOne(allowed);
  let a = randInt(1, 9);
  let b = randInt(1, 9);
  let displayA = a, displayB = b, answer = 0;

  if (op === "+") {
    answer = a + b;
  } else if (op === "-") {
    // Negatifi engelle: büyük olan başa
    if (b > a) [a, b] = [b, a];
    displayA = a; displayB = b; answer = a - b;
  } else if (op === "×") {
    answer = a * b;
  } else if (op === "÷") {
    // Tam bölünebilirlik için: (a*b) ÷ a = b
    const x = randInt(1, 9);
    const y = randInt(1, 9);
    displayA = x * y; // dividend
    displayB = x;     // divisor
    answer = y;       // quotient (1..9)
  }

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

function statKey(diff, secs) {
  return `dortislem_best_${diff}_${secs}`;
}

export default function DortIslemUygulamasi() {
  const [dark, setDark] = useState(false);
  const [difficulty, setDifficulty] = useState("kolay");
  const [customOps, setCustomOps] = useState([]); // elle seçilen işlemler
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);

  const [q, setQ] = useState(() => generateQuestion({ difficulty }));
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [shake, setShake] = useState(false);
  const [showSheet, setShowSheet] = useState(false); // yazdırma sayfası

  const bestKey = useMemo(() => statKey(difficulty, seconds), [difficulty, seconds]);
  const [best, setBest] = useState(() => {
    const v = localStorage.getItem(bestKey);
    return v ? Number(v) : 0;
  });

  useEffect(() => {
    setBest(() => {
      const v = localStorage.getItem(bestKey);
      return v ? Number(v) : 0;
    });
  }, [bestKey]);

  // Sayaç
  useEffect(() => { setTimeLeft(seconds); }, [seconds]);
  useInterval(() => {
    setTimeLeft((t) => {
      if (t <= 1) {
        setRunning(false);
        // rekoru kaydet
        setBest((prev) => {
          const newBest = Math.max(prev, score);
          localStorage.setItem(bestKey, String(newBest));
          return newBest;
        });
        return 0;
      }
      return t - 1;
    });
  }, 1000, running);

  const opsInUse = useMemo(() => buildAllowedOps(difficulty, customOps), [difficulty, customOps]);
  const theme = OP_THEME[q.op];
  const accuracy = score + wrong === 0 ? 100 : Math.round((score / (score + wrong)) * 100);

  function nextQuestion() {
    setQ(generateQuestion({ difficulty, customOps }));
    setInput("");
  }

  function start() {
    setScore(0); setWrong(0); setStreak(0);
    setTimeLeft(seconds); setRunning(true);
    setQ(generateQuestion({ difficulty, customOps }));
    setShowSheet(false);
  }

  function stop() {
    setRunning(false);
    setBest((prev) => {
      const newBest = Math.max(prev, score);
      localStorage.setItem(bestKey, String(newBest));
      return newBest;
    });
  }

  function checkAnswer() {
    const val = Number(input);
    if (Number.isNaN(val)) return;
    if (val === q.answer) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      nextQuestion();
    } else {
      setWrong((w) => w + 1);
      setStreak(0);
      // salla animasyonu
      setShake(true);
      setTimeout(() => setShake(false), 220);
    }
  }

  // Klavye kısayolları
  useEffect(() => {
    function onKey(e) {
      if (showSheet) return; // yazdırma görünümünde giriş yok
      if (e.key === "Enter") return checkAnswer();
      if (e.key === "Backspace") return setInput((s) => s.slice(0, -1));
      if (/^[0-9]$/.test(e.key)) setInput((s) => (s + e.key).slice(0, 3));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checkAnswer, showSheet]);

  // Çalışma kâğıdı (yazdırma) için veri
  const [sheetCount, setSheetCount] = useState(30);
  const [sheetOps, setSheetOps] = useState(["+", "-", "×", "÷"]);
  const sheetItems = useMemo(() => {
    if (!showSheet) return [];
    const items = [];
    for (let i = 0; i < sheetCount; i++) {
      const it = generateQuestion({ difficulty: "karışık", customOps: sheetOps });
      items.push(it);
    }
    return items;
  }, [showSheet, sheetCount, sheetOps]);

  const containerClass = dark ? "dark" : "";

  return (
    <div className={`${containerClass} min-h-screen print:bg-white`}>
      {/* Ana arka plan */}
      <div className="bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 min-h-screen print:bg-white print:text-black">
        {/* Başlık */}
        <header className="max-w-4xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between print:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dört İşlem – 1’den 9’a</h1>
          {/* <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
              aria-label="Karanlık modu değiştir"
            >
              {dark ? "Açık Mod" : "Karanlık Mod"}
            </button>
          </div> */}
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
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
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
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
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
                    onClick={() => {
                      setCustomOps((prev) => {
                        const has = prev.includes(sym);
                        if (!prev.length) {
                          // baştan özelleştirmeyi açıyoruz
                          return has ? [] : [sym];
                        }
                        return has ? prev.filter((x) => x !== sym) : [...prev, sym];
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-sm ${
                      active
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                        : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
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
                  className="ml-1 px-3 py-1.5 rounded-xl border text-sm bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  Sıfırla
                </button>
              )}
            </div>
          </section>

          {/* Oyun Kartı */}
          <section className="mt-4 print:hidden">
            <div
              className={`rounded-2xl border shadow-sm p-4 sm:p-6 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 ${theme?.ring} ring-1`}
            >
              {/* Üst bilgi */}
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs border ${theme?.badge}`}>
                    İşlem: {q.op}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs border bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600">
                    Zorluk: {difficulty}
                  </span>
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

              {/* Soru Alanı */}
              <div className="mt-6 flex flex-col items-center">
                <div className={`text-5xl sm:text-6xl font-bold tracking-wide ${shake ? "animate-[wiggle_0.22s_ease-in-out]" : ""}`}
                     style={{ fontVariantNumeric: "tabular-nums" }}>
                  <style>{`
                    @keyframes wiggle { 0% { transform: translateX(0); } 25% { transform: translateX(-6px);} 75% { transform: translateX(6px);} 100% { transform: translateX(0);} }
                  `}</style>
                  {q.a} <span className="opacity-70">{q.op}</span> {q.b} =
                </div>

                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="mt-4 text-center w-full max-w-[220px] text-3xl font-semibold rounded-2xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-400"
                  value={input}
                  onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="Cevap"
                  disabled={!running}
                  aria-label="Cevap kutusu"
                />

                {/* Tuş takımı */}
                <div className="grid grid-cols-3 gap-2 mt-4 max-w-xs w-full">
                  {[1,2,3,4,5,6,7,8,9,0].map((n, idx) => (
                    <button
                      key={n + "_key"}
                      onClick={() => setInput((s) => (s + String(n)).slice(0, 3))}
                      disabled={!running}
                      className={`${
                        idx === 9 ? "col-span-3" : ""
                      } rounded-xl py-3 text-lg font-semibold border bg-zinc-50 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-600 disabled:opacity-50`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setInput((s) => s.slice(0, -1))}
                    className="px-4 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-600"
                    disabled={!running}
                  >Sil</button>
                  <button
                    onClick={checkAnswer}
                    className={`px-4 py-2 rounded-xl font-semibold ${theme?.btn}`}
                    disabled={!running}
                  >Onayla</button>
                </div>

                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {!running ? (
                    <button onClick={start} className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">Başlat</button>
                  ) : (
                    <button onClick={stop} className="px-4 py-2 rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 text-white">Durdur</button>
                  )}
                  <button
                    onClick={() => { setShowSheet(true); setRunning(false); }}
                    className="px-4 py-2 rounded-xl font-semibold bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900"
                  >Çalışma Kâğıdı</button>
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
              <div className="rounded-2xl border shadow-sm p-4 sm:p-6 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <h2 className="text-xl font-semibold">Çalışma Kâğıdı Oluştur</h2>
                  <div className="flex gap-2">
                    <button onClick={() => window.print()} className="px-4 py-2 rounded-xl font-semibold bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900">Yazdır</button>
                    <button onClick={() => setShowSheet(false)} className="px-4 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-600">Geri</button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
                  <label className="text-sm">Soru sayısı:</label>
                  <input type="number" min={6} max={120} value={sheetCount}
                         onChange={(e) => setSheetCount(Math.max(6, Math.min(120, Number(e.target.value)||30)))}
                         className="w-24 px-3 py-1.5 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600" />

                  <span className="text-sm">İşlemler:</span>
                  {["+","-","×","÷"].map((sym)=>{
                    const active = sheetOps.includes(sym);
                    return (
                      <button key={sym}
                        onClick={() => setSheetOps((prev)=> prev.includes(sym) ? prev.filter(x=>x!==sym): [...prev, sym])}
                        className={`px-3 py-1.5 rounded-xl border text-sm ${active?"bg-zinc-900 text-white dark:bg-white dark:text-zinc-900":"bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                      >{sym}</button>
                    )
                  })}
                  <button onClick={()=> setSheetOps(["+","-","×","÷"]) } className="px-3 py-1.5 rounded-xl border text-sm bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700">Tümü</button>
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
                      <div key={i}
                        className="border border-zinc-300 print:border-black rounded-xl px-3 py-2 text-lg tracking-wide bg-white text-zinc-900">
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
