// Yardımcı: SVG pasta grafik için yay çizer
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", r, r, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
}

function polarToCartesian(cx, cy, r, angleInDegrees) {
  const angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;
  return {
    x: cx + (r * Math.cos(angleInRadians)),
    y: cy + (r * Math.sin(angleInRadians))
  };
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth, provider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getUserBest, setUserBest } from "./firestore";

/**
 * Dört İşlem – 1’den 9’a
 * - Operasyona göre TEMA: Tüm UI, işleme özel renklere bürünür (+ mavi, - yeşil, x turuncu, ÷ mor)
 * - Kontrast garantili metin renkleri (açık/koyu)
 * - Tailwind v3, darkMode:"class"
 * - Renkler CSS değişkenleriyle yönetilir; Tailwind’de var() destekli arbitrary color kullanımı:
 *   bg-[var(--surface)] hover:bg-[var(--key-hover)] border-[var(--border)] ring-[var(--ring)]
 */
// Her işlem için AÇIK/KARANLIK renk şeması
const SCHEMES = {
  light: {
    "+": {
      page: "#EAF3FF", surface: "#FFFFFF", tint: "#DBEAFE", border: "#93C5FD",
      text: "#0F172A", muted: "#334155",
      keyBg: "#DBEAFE", keyHover: "#BFDBFE",
      primary: "#3B82F6", primaryHover: "#2563EB",
      ring: "rgba(59,130,246,0.35)", badgeBg: "#EAF3FF", badgeText: "#215E9E",
    },
    "-": {
      page: "#E9FAF3", surface: "#FFFFFF", tint: "#DCFCE7", border: "#86EFAC",
      text: "#0F172A", muted: "#2F4F3C",
      keyBg: "#D1FAE5", keyHover: "#A7F3D0",
      primary: "#22C55E", primaryHover: "#16A34A",
      ring: "rgba(34,197,94,0.35)", badgeBg: "#E9FAF3", badgeText: "#1B6045",
    },
    "x": {
      page: "#FFF3E6", surface: "#FFFFFF", tint: "#FFE7D1", border: "#FBC38A",
      text: "#0F172A", muted: "#7A4A1C",
      keyBg: "#FFE7D1", keyHover: "#FFD8B0",
      primary: "#F59E0B", primaryHover: "#D97706",
      ring: "rgba(245,158,11,0.35)", badgeBg: "#FFF3E6", badgeText: "#8A5119",
    },
    "÷": {
      page: "#F2EDFF", surface: "#FFFFFF", tint: "#E9E2FF", border: "#C4B5FD",
      text: "#0F172A", muted: "#4B3A8E",
      keyBg: "#E9E2FF", keyHover: "#DCD3FF",
      primary: "#8B5CF6", primaryHover: "#7C3AED",
      ring: "rgba(139,92,246,0.35)", badgeBg: "#F2EDFF", badgeText: "#5A3CA8",
    },
  },
  dark: {
    "+": {
      page: "#0F1520", surface: "#141A24", tint: "#192434", border: "#1F2A3A",
      text: "#E8EAED", muted: "#9FB5D7",
      keyBg: "#1A2332", keyHover: "#223044",
      primary: "#60A5FA", primaryHover: "#3B82F6",
      ring: "rgba(96,165,250,0.35)", badgeBg: "#1B2A42", badgeText: "#BFD8FF",
    },
    "-": {
      page: "#0F1715", surface: "#131C1A", tint: "#182420", border: "#1F2D28",
      text: "#E8EAED", muted: "#ABD9C3",
      keyBg: "#16241F", keyHover: "#1F322B",
      primary: "#34D399", primaryHover: "#22C55E",
      ring: "rgba(52,211,153,0.35)", badgeBg: "#153026", badgeText: "#C9F0DD",
    },
    "x": {
      page: "#16130D", surface: "#1A1711", tint: "#231E14", border: "#2C261B",
      text: "#E8EAED", muted: "#F1C890",
      keyBg: "#2A2116", keyHover: "#352817",
      primary: "#FBBF24", primaryHover: "#F59E0B",
      ring: "rgba(251,191,36,0.35)", badgeBg: "#2A1F12", badgeText: "#FFDCAA",
    },
    "÷": {
      page: "#14111A", surface: "#181420", tint: "#211C2A", border: "#272033",
      text: "#E8EAED", muted: "#D3C7FF",
      keyBg: "#221C31", keyHover: "#2C2440",
      primary: "#A78BFA", primaryHover: "#8B5CF6",
      ring: "rgba(167,139,250,0.35)", badgeBg: "#211B33", badgeText: "#E2D9FF",
    },
  },
};

// Basit yardımcılar
function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
function pickOne(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function buildAllowedOps(difficulty, customOps){
  if (customOps && customOps.length) return customOps;
  switch (difficulty) {
    case "kolay": return ["+","-"];
    case "orta":  return ["+","-","x"];
    case "zor":   return ["+","-","x","÷"];
    default:      return ["+","-","x","÷"];
  }
}
function generateQuestion({difficulty, customOps}){
  const allowed = buildAllowedOps(difficulty, customOps);
  const op = pickOne(allowed);
  let a = randInt(1,9), b = randInt(1,9);
  let displayA=a, displayB=b, answer=0;
  if (op === "+") answer = a+b;
  else if (op === "-"){ if (b>a) [a,b]=[b,a]; displayA=a; displayB=b; answer=a-b; }
  else if (op === "x") answer = a*b;
  else { const x=randInt(1,9), y=randInt(1,9); displayA=x*y; displayB=x; answer=y; }
  return { a:displayA, b:displayB, op, answer };
}
function useInterval(cb, delay, enabled){
  const ref = useRef(cb);
  useEffect(()=>{ ref.current = cb; });
  useEffect(()=>{
    if (!enabled || delay==null) return;
    const id = setInterval(()=>ref.current(), delay);
    return ()=>clearInterval(id);
  },[delay, enabled]);
}
function statKey(diff, secs){ return `dortislem_best_${diff}_${secs}`; }

export default function DortIslemUygulamasi(){
  // Google Auth durumları
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);
  const handleLogin = () => signInWithPopup(auth, provider);
  const handleLogout = () => signOut(auth);
  // Tema
  const getInitialTheme = () => {
    const saved = localStorage.getItem("theme");
    if (saved==="dark"||saved==="light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };
  const [theme,setTheme] = useState(getInitialTheme);
  useEffect(()=>{
    const root = document.documentElement;
    if (theme==="dark") root.classList.add("dark"); else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  },[theme]);

  // Oyun durumları
  const [difficulty,setDifficulty]=useState("kolay");
  const [customOps,setCustomOps]=useState(["+","-","x","÷"]);
  const [seconds,setSeconds]=useState(60);
  const [running,setRunning]=useState(false);

  const [q,setQ]=useState(()=>generateQuestion({difficulty}));
  const [input,setInput]=useState("");
  const inputRef = useRef(null);
  const [score,setScore]=useState(0);
  const [wrong,setWrong]=useState(0);
  const [streak,setStreak]=useState(0);
  const [timeLeft,setTimeLeft]=useState(seconds);
  const [shake,setShake]=useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [showSheet,setShowSheet]=useState(false);
  const [showResult, setShowResult] = useState(false);

  const bestKey = useMemo(()=>statKey(difficulty, seconds),[difficulty,seconds]);
  const [best,setBest]=useState(()=>Number(localStorage.getItem(bestKey)||0));
  useEffect(()=>{ setBest(Number(localStorage.getItem(bestKey)||0)); },[bestKey]);

  // Firestore rekor puan
  const [cloudBest, setCloudBest] = useState(null);
  useEffect(() => {
    if (user) {
      getUserBest(user.uid).then(setCloudBest);
    }
  }, [user, showResult]);

  // Sayaç
  useEffect(()=>setTimeLeft(seconds),[seconds]);
  useInterval(()=>{
    setTimeLeft(t=>{
      if (t<=1){
        setRunning(false);
        setBest(prev=>{
          const nb=Math.max(prev,score);
          localStorage.setItem(bestKey,String(nb));
          // Cloud rekor güncelle
          if (user && (cloudBest === null || score > cloudBest)) {
            setUserBest(user.uid, score);
            setCloudBest(score);
          }
          return nb;
        });
        setTimeout(()=>setShowResult(true), 400);
        return 0;
      }
      return t-1;
    });
  },1000,running);

  // Şema: mevcut operasyona ve temaya göre renkleri yükle
  const scheme = (theme==="dark" ? SCHEMES.dark : SCHEMES.light)[q.op];
  const accuracy = (score+wrong===0) ? 100 : Math.round(score*100/(score+wrong));

  function nextQuestion(){ setQ(generateQuestion({difficulty,customOps})); setInput(""); }
  // Soru değişince input otomatik odaklansın
  useEffect(()=>{
    if(inputRef.current) inputRef.current.focus();
  },[q]);
  function start(){
    setScore(0); setWrong(0); setStreak(0); setTimeLeft(seconds); setRunning(true);
    setQ(generateQuestion({difficulty,customOps})); setShowSheet(false);
  }
  function stop(){
    setRunning(false);
    setBest(prev=>{
      const nb=Math.max(prev,score);
      localStorage.setItem(bestKey,String(nb));
      // Cloud rekor güncelle
      if (user && (cloudBest === null || score > cloudBest)) {
        setUserBest(user.uid, score).then(() => {
          getUserBest(user.uid).then(setCloudBest);
        });
      }
      return nb;
    });
    setTimeout(()=>setShowResult(true), 400);
  }
  function checkAnswer(){
    const val = Number(input);
    if (Number.isNaN(val)) return;
    if (val===q.answer){
      setScore(s=>s+1); setStreak(s=>s+1);
      setShowCheck(true);
      setTimeout(()=>setShowCheck(false), 700);
      nextQuestion();
    }
    else { setWrong(w=>w+1); setStreak(0); setShake(true); setTimeout(()=>setShake(false),220); }
  }

  // Klavye: sadece input'a özel onKeyDown ile yönetilecek

  // Çalışma kâğıdı
  const [sheetCount,setSheetCount]=useState(30);
  const [sheetOps,setSheetOps]=useState(["+","-","x","÷"]);
  const sheetItems = useMemo(()=>{
    if (!showSheet) return [];
    const items=[];
    for (let i=0;i<sheetCount;i++){
      items.push(generateQuestion({difficulty:"karışık", customOps: sheetOps}));
    }
    return items;
  },[showSheet,sheetCount,sheetOps]);

  // CSS değişkenlerini container'a bas
  const cssVars = {
    // Sayfa & kart
    "--page": scheme.page,
    "--surface": scheme.surface,
    "--tint": scheme.tint,
    "--border": scheme.border,
    "--ring": scheme.ring,
    // Metin
    "--text": scheme.text,
    "--muted": scheme.muted,
    // Tuşlar & hover
    "--key-bg": scheme.keyBg,
    "--key-hover": scheme.keyHover,
    // Birincil aksiyon
    "--primary": scheme.primary,
    "--primary-hover": scheme.primaryHover,
    // Rozet
    "--badge-bg": scheme.badgeBg,
    "--badge-text": scheme.badgeText,
  };

  // UX: Giriş kontrolü
  if (loading) return <div className="flex items-center justify-center min-h-screen text-lg">Yükleniyor...</div>;
  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--page)] text-[var(--text)]">
      <button onClick={handleLogin} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-300 bg-white shadow hover:bg-gray-50 text-base font-medium">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
        Google ile Giriş
      </button>
      <p className="mt-4 text-gray-500 text-sm">Giriş yaparak ilerlemeniz ve rozetleriniz bulutta saklanır.</p>
    </div>
  );
  // Giriş yapılmışsa ana uygulama:
  return (
    <div className="min-h-screen print:bg-white">
      <div
        style={cssVars}
        className="min-h-screen print:bg-white print:text-black bg-[var(--page)] text-[var(--text)] dark:text-[var(--text)]"
      >
        {/* Kullanıcı üst barı */}
        <div className="flex items-center justify-end max-w-4xl mx-auto px-4 pt-4 pb-1 gap-3">
          <img src={user.photoURL} alt="Profil" className="w-8 h-8 rounded-full border" />
          <div className="flex flex-col items-end">
            <span className="font-medium text-sm">{user.displayName}</span>
            {cloudBest !== null && (
              <span className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">High Score: <b>{cloudBest}</b></span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-1.5 rounded border text-xs bg-gray-100 hover:bg-gray-200
                       dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
          >
            Çıkış
          </button>
        </div>
        {/* Başlık */}
        <header className="max-w-4xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between print:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dört İşlem – 1’den 9’a</h1>
          <button
            onClick={()=>setTheme(theme==="dark"?"light":"dark")}
            className={`relative flex items-center w-16 h-9 rounded-full border border-[var(--border)] transition-colors duration-200 focus:outline-none ${theme==="dark" ? "bg-[#232B38]" : "bg-[#F1F5F9]"}`}
            aria-label="Tema değiştir"
          >
            {/* Modern Sun Icon (Lucide/Tabler style) */}
            <span className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${theme==="dark" ? "text-gray-400" : "text-yellow-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" fill={theme==="dark" ? "#facc15" : "#fde047"} stroke="none" />
                <g stroke="currentColor">
                  <line x1="12" y1="2" x2="12" y2="4" />
                  <line x1="12" y1="20" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                  <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="4" y2="12" />
                  <line x1="20" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
                  <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
                </g>
              </svg>
            </span>
            {/* Modern Moon Icon (Lucide/Tabler style) */}
            <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${theme==="dark" ? "text-indigo-400" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3c0 .34.02.67.05 1A7 7 0 0 0 21 12.79z" fill={theme==="dark" ? "#6366f1" : "#a5b4fc"}/>
              </svg>
            </span>
            {/* Toggle yuvarlağı */}
            <span className={`absolute top-1/2 -translate-y-1/2 left-1 transition-all duration-200 w-7 h-7 rounded-full shadow ${theme==="dark" ? "translate-x-7 bg-[#232B38] border border-indigo-400" : "bg-white border border-yellow-400"}`}></span>
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
              ].map(d=>(
                <button
                  key={d.k}
                  onClick={()=>setDifficulty(d.k)}
                  className={`px-3 py-1.5 rounded-xl border text-sm
                              ${difficulty===d.k
                                ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white"
                                : "bg-[var(--key-bg)] hover:bg-[var(--key-hover)]"} border-[var(--border)]`}
                >
                  {d.t}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end">
              <label className="text-sm font-medium">Süre:</label>
              {[60,90,120].map(s=>(
                <button
                  key={s}
                  onClick={()=>setSeconds(s)}
                  className={`px-3 py-1.5 rounded-xl border text-sm
                              ${seconds===s
                                ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white"
                                : "bg-[var(--key-bg)] hover:bg-[var(--key-hover)]"} border-[var(--border)]`}
                >
                  {s}s
                </button>
              ))}
            </div>

            {/* Özel işlem seçimi */}
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">İşlemler:</span>
              {["+","-","x","÷"].map(sym=>{
                const active = customOps.length ? customOps.includes(sym) : buildAllowedOps(difficulty,[]).includes(sym);
                return (
                  <button
                    key={sym}
                    onClick={()=>{
                      setCustomOps(prev=>{
                        const has=prev.includes(sym);
                        if (!prev.length) return has?[]:[sym];
                        return has ? prev.filter(x=>x!==sym) : [...prev, sym];
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-sm border-[var(--border)]
                                ${active
                                  ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white"
                                  : "bg-[var(--key-bg)] hover:bg-[var(--key-hover)]"}`}
                    aria-pressed={active}
                  >
                    {sym}
                  </button>
                );
              })}
              {customOps.length>0 && (
                <button
                  onClick={()=>setCustomOps([])}
                  className="ml-1 px-3 py-1.5 rounded-xl border text-sm
                             bg-[var(--key-bg)] hover:bg-[var(--key-hover)] border-[var(--border)]"
                >
                  Sıfırla
                </button>
              )}
            </div>
          </section>

          {/* Oyun Kartı */}
          <section className="mt-4 print:hidden">
            <div
              className={`rounded-2xl border shadow-sm p-4 sm:p-6 ring-1
                          border-[var(--border)] ring-[var(--ring)]
                          bg-gradient-to-br from-[color:var(--tint)] to-[color:var(--surface)]`}
            >
              {/* Üst şerit */}
              <div className="h-1.5 w-full rounded-full mb-4 bg-[var(--primary)]" />

              {/* Üst bilgi */}
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs border
                                   border-[var(--border)]
                                   bg-[var(--badge-bg)] text-[var(--badge-text)]">
                    İşlem: {q.op}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs border
                                   border-[var(--border)]
                                   bg-[var(--key-bg)]">
                    Zorluk: {difficulty}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-xs text-[var(--muted)]">Süre</div>
                    <div className="text-lg font-bold tabular-nums">{timeLeft}s</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-[var(--muted)]">Puan</div>
                    <div className="text-lg font-bold tabular-nums">{score}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-[var(--muted)]">Doğruluk</div>
                    <div className="text-lg font-bold tabular-nums">{accuracy}%</div>
                  </div>
                </div>
              </div>

              {/* Soru */}
              <div className="mt-6 flex flex-col items-center relative">
                <div
                  className={`text-5xl sm:text-6xl font-bold tracking-wide ${shake ? "animate-[wiggle_0.22s_ease-in-out]" : ""}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  <style>{`@keyframes wiggle{0%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}100%{transform:translateX(0)}}`}</style>
                  {q.a} <span className="opacity-70">{q.op}</span> {q.b} =
                </div>
                {showCheck && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 animate-fadein pointer-events-none" />
                    <span className="relative z-10 flex items-center justify-center">
                      <svg width="80" height="80" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-checkmark">
                        <circle cx="28" cy="28" r="26" stroke="#22C55E" strokeWidth="4" fill="white"/>
                        <path d="M18 29L26 37L39 21" stroke="#22C55E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <style>{`
                      @keyframes checkmark-pop {0%{transform:scale(0.7);opacity:0;} 40%{transform:scale(1.1);opacity:1;} 70%{transform:scale(0.95);} 100%{transform:scale(1);opacity:0;}}
                      .animate-checkmark {animation: checkmark-pop 0.7s cubic-bezier(.4,2,.6,1) both;}
                      @keyframes fadein {0%{opacity:0;} 100%{opacity:1;}}
                      .animate-fadein {animation: fadein 0.2s;}
                    `}</style>
                  </div>
                )}

                <input
                  ref={inputRef}
                  inputMode="numeric" pattern="[0-9]*"
                  className="mt-4 text-center w-full max-w-[220px] text-3xl font-semibold rounded-2xl
                             border border-[var(--border)] bg-[var(--surface)]
                             px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  value={input}
                  onChange={e=>setInput(e.target.value.replace(/\D/g,"").slice(0,3))}
                  onKeyDown={e=>{
                    if (e.key==="Enter") { e.preventDefault(); checkAnswer(); }
                    else if (e.key==="Backspace") { e.preventDefault(); setInput(s=>s.slice(0,-1)); }
                  }}
                  placeholder="Cevap" disabled={!running} aria-label="Cevap kutusu"
                />

                {/* Tuş takımı */}
                <div className="grid grid-cols-3 gap-2 mt-4 max-w-xs w-full">
                  {[1,2,3,4,5,6,7,8,9,0].map((n,idx)=>(
                    <button
                      key={n+"_key"}
                      onClick={()=>setInput(s=>(s+String(n)).slice(0,3))}
                      disabled={!running}
                      className={`${idx===9?"col-span-3":""}
                                  rounded-xl py-3 text-lg font-semibold border
                                  bg-[var(--key-bg)] hover:bg-[var(--key-hover)]
                                  border-[var(--border)]
                                  disabled:opacity-50`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={()=>setInput(s=>s.slice(0,-1))}
                    className="px-4 py-2 rounded-xl border
                               bg-[var(--key-bg)] hover:bg-[var(--key-hover)]
                               border-[var(--border)]"
                    disabled={!running}
                  >
                    Sil
                  </button>
                  <button
                    onClick={checkAnswer}
                    className="px-4 py-2 rounded-xl font-semibold
                               bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white"
                    disabled={!running}
                  >
                    Onayla
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {!running ? (
                    <button
                      onClick={start}
                      className="px-4 py-2 rounded-xl font-semibold
                                 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white"
                    >
                      Başlat
                    </button>
                  ) : (
                    <button
                      onClick={stop}
                      className="px-4 py-2 rounded-xl font-semibold
                                 bg-[#EF4444] hover:bg-[#DC3B3B] text-white"
                    >
                      Durdur
                    </button>
                  )}
                  <button
                    onClick={()=>{ setShowSheet(true); setRunning(false); }}
                    className="px-4 py-2 rounded-xl font-semibold
                               bg-[var(--key-bg)] hover:bg-[var(--key-hover)]
                               border border-[var(--border)]"
                  >
                    Çalışma Kâğıdı
                  </button>
                </div>

                {/* Sonuç ekranı artık modal ile gösterilecek */}
      {/* Sonuç Modalı */}
      {showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-[#181A1F] rounded-2xl shadow-xl p-7 max-w-xs w-full text-center relative animate-fadein">
            <button onClick={()=>setShowResult(false)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl">×</button>
            <div className="mb-2 text-lg font-bold">Süre Bitti!</div>
            <div className="flex flex-col items-center gap-2 mb-4">
              {/* Basit pasta grafik */}
              <svg width="90" height="90" viewBox="0 0 36 36" className="mb-1">
                <circle cx="18" cy="18" r="16" fill="#F3F4F6" />
                {/* Pasta grafik: doğru oranı yeşil, yanlış oranı kırmızı */}
                {score+wrong > 0 && (
                  <>
                    {/* Tamamen doğruysa tam yeşil daire */}
                    {score > 0 && wrong === 0 && (
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#22C55E" strokeWidth="3.5" />
                    )}
                    {/* Tamamen yanlışsa tam kırmızı daire */}
                    {wrong > 0 && score === 0 && (
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#EF4444" strokeWidth="3.5" />
                    )}
                    {/* Karışık ise path ile pasta */}
                    {score > 0 && wrong > 0 && (
                      <>
                        <path
                          d={describeArc(18, 18, 16, 0, (score/(score+wrong))*360)}
                          fill="none"
                          stroke="#22C55E"
                          strokeWidth="3.5"
                        />
                        <path
                          d={describeArc(18, 18, 16, (score/(score+wrong))*360, 360)}
                          fill="none"
                          stroke="#EF4444"
                          strokeWidth="3.5"
                        />
                      </>
                    )}
                  </>
                )}
                <text x="18" y="22" textAnchor="middle" fontSize="1.1em" fill="#222" fontWeight="bold">{score}</text>
              </svg>
              <div className="text-xs text-gray-500 dark:text-gray-400">Doğru / Yanlış</div>
            </div>
            <div className="flex flex-col gap-1 text-sm mb-2">
              <div><b>Puan:</b> {score}</div>
              <div><b>Yanlış:</b> {wrong}</div>
              <div><b>Toplam Soru:</b> {score+wrong}</div>
              <div><b>Doğruluk:</b> %{accuracy}</div>
              <div><b>En İyi Skor:</b> {best}</div>
              {cloudBest !== null && <div><b>Bulut Rekoru:</b> {cloudBest}</div>}
            </div>
            <button onClick={()=>{setShowResult(false);start();}} className="mt-2 px-4 py-2 rounded-xl font-semibold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white">Tekrar Oyna</button>
          </div>
          <style>{`
            @keyframes fadein {0%{opacity:0;} 100%{opacity:1;}}
            .animate-fadein {animation: fadein 0.2s;}
          `}</style>
        </div>
      )}
              </div>
            </div>
          </section>

          {/* Yazdırılabilir Çalışma Kâğıdı */}
          {showSheet && (
            <section className="mt-6">
              <div className="rounded-2xl border shadow-sm p-4 sm:p-6
                              bg-[var(--surface)] border-[var(--border)]">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <h2 className="text-xl font-semibold">Çalışma Kâğıdı Oluştur</h2>
                  <div className="flex gap-2">
                    <button onClick={()=>window.print()}
                            className="px-4 py-2 rounded-xl font-semibold
                                       bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white">
                      Yazdır
                    </button>
                    <button onClick={()=>setShowSheet(false)}
                            className="px-4 py-2 rounded-xl border
                                       bg-[var(--key-bg)] hover:bg-[var(--key-hover)]
                                       border-[var(--border)]">
                      Geri
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
                  <label className="text-sm">Soru sayısı:</label>
                  <input
                    type="number" min={6} max={120} value={sheetCount}
                    onChange={e=>setSheetCount(Math.max(6, Math.min(120, Number(e.target.value)||30)))}
                    className="w-24 px-3 py-1.5 rounded-xl border
                               bg-[var(--surface)] border-[var(--border)]"
                  />

                  <span className="text-sm">İşlemler:</span>
                  {["+","-","x","÷"].map(sym=>{
                    const active = sheetOps.includes(sym);
                    return (
                      <button key={sym}
                        onClick={()=>setSheetOps(prev=> prev.includes(sym)? prev.filter(x=>x!==sym): [...prev, sym])}
                        className={`px-3 py-1.5 rounded-xl border text-sm border-[var(--border)]
                                    ${active
                                      ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white"
                                      : "bg-[var(--key-bg)] hover:bg-[var(--key-hover)]"}`}
                      >{sym}</button>
                    )
                  })}
                  <button onClick={()=>setSheetOps(["+","-","x","÷"])}
                          className="px-3 py-1.5 rounded-xl border text-sm
                                     bg-[var(--key-bg)] hover:bg-[var(--key-hover)]
                                     border-[var(--border)]">
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
                    {sheetItems.map((it,i)=>(
                      <div key={i}
                           className="border border-[var(--border)] rounded-xl px-3 py-2 text-lg tracking-wide
                                      bg-[var(--surface)] text-[var(--text)] print:border-black">
                        <div style={{fontVariantNumeric:"tabular-nums"}}
                             className="flex items-center justify-between gap-2">
                          <span className="opacity-70 tabular-nums">{String(i+1).padStart(2,"0")}.</span>
                          <span className="whitespace-nowrap">{it.a} {it.op} {it.b} = ________</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 text-xs opacity-70 print:text-[10pt]">
                    Not: Bölme işlemleri tam sayılı sonuç verir. Çıkarma işlemlerinde negatif sonuç verilmez.
                  </div>
                </div>
              </div>
            </section>
          )}

          <footer className="mt-8 text-center text-xs opacity-70 print:hidden">
            Hazırlayan: <b>Ahmet Aslan</b> • Dikkat ve zihinsel egzersiz aracı (1–9)
          </footer>
        </main>
      </div>
    </div>
  );
}
