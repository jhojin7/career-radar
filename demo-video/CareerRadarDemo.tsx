import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  MapPin,
  Radar,
  Sparkles,
  X,
} from "lucide-react";
import type {CSSProperties, ReactNode} from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const palette = {
  background: "#f7f6f0",
  foreground: "#18211e",
  card: "#fffefa",
  primary: "#174f43",
  primaryLight: "#e4efea",
  muted: "#eceee7",
  mutedForeground: "#65716c",
  accent: "#ed7658",
  border: "#d9ddd5",
  emerald: "#26715e",
};

const font = '"Avenir Next", "Segoe UI", sans-serif';

const recommendations = [
  {
    employer: "Synthetic Cloud",
    role: "Platform Engineer",
    fit: 91,
    verdict: "Strong Fit",
    location: "Seoul",
    mode: "Hybrid",
    featured: true,
  },
  {
    employer: "Orbit Systems",
    role: "Developer Experience Engineer",
    fit: 84,
    verdict: "Strong Fit",
    location: "Seoul",
    mode: "Remote",
  },
  {
    employer: "Northstar Labs",
    role: "Cloud Infrastructure Engineer",
    fit: 76,
    verdict: "Strong Fit",
    location: "Seoul",
    mode: "Hybrid",
  },
  {
    employer: "Morrow Technologies",
    role: "Backend Platform Engineer",
    fit: 72,
    verdict: "Good Fit",
    location: "Seoul",
    mode: "Onsite",
  },
];

export function CareerRadarDemo() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({
    frame,
    fps,
    config: {damping: 18, mass: 0.9, stiffness: 105},
  });
  const appScale = interpolate(entrance, [0, 1], [0.965, 1]);
  const appOpacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const modalProgress = spring({
    frame: frame - 150,
    fps,
    config: {damping: 20, mass: 0.85, stiffness: 125},
  });
  const modalOpen = interpolate(modalProgress, [0, 1], [0, 1]);
  const focusZoom = interpolate(frame, [305, 400], [1, 1.025], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 14% 12%, rgba(237,118,88,.17), transparent 27%), radial-gradient(circle at 86% 78%, rgba(23,79,67,.16), transparent 31%), #e9ebe4",
        color: palette.foreground,
        fontFamily: font,
        overflow: "hidden",
      }}
    >
      <Grain />
      <NarrativeCaption frame={frame} />
      <div
        style={{
          position: "absolute",
          inset: "92px 105px 84px",
          borderRadius: 32,
          boxShadow: "0 42px 110px rgba(25, 46, 39, 0.2), 0 8px 28px rgba(25, 46, 39, 0.1)",
          overflow: "hidden",
          transform: `scale(${appScale * focusZoom})`,
          opacity: appOpacity,
          transformOrigin: frame > 305 ? "62% 55%" : "50% 50%",
          background: palette.background,
          border: "1px solid rgba(255,255,255,.8)",
        }}
      >
        <BrowserChrome />
        <Dashboard frame={frame} />
        {frame >= 142 && (
          <DetailModal frame={frame} progress={modalOpen} />
        )}
      </div>
      <Cursor frame={frame} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 70,
          pointerEvents: "none",
          background: palette.background,
          opacity: interpolate(frame, [436, 449], [0, 0.1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
}

function BrowserChrome() {
  return (
    <div
      style={{
        height: 58,
        background: "#f1f1ec",
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 22px",
        borderBottom: `1px solid ${palette.border}`,
      }}
    >
      <div style={{display: "flex", gap: 9}}>
        {["#f16c5d", "#edb844", "#5bbd64"].map((color) => (
          <div key={color} style={{width: 13, height: 13, borderRadius: "50%", background: color}} />
        ))}
      </div>
      <div
        style={{
          flex: 1,
          maxWidth: 600,
          height: 34,
          margin: "0 auto",
          borderRadius: 10,
          border: `1px solid ${palette.border}`,
          background: "rgba(255,255,255,.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: palette.mutedForeground,
          letterSpacing: 0.1,
        }}
      >
        career-radar.app
      </div>
      <div style={{width: 52}} />
    </div>
  );
}

function Dashboard({frame}: {frame: number}) {
  const cardHover = interpolate(frame, [110, 132, 148], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{height: "calc(100% - 58px)", background: palette.background}}>
      <header
        style={{
          height: 78,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 54px",
          borderBottom: `1px solid ${palette.border}`,
          background: "rgba(247,246,240,.92)",
        }}
      >
        <div style={{display: "flex", alignItems: "center", gap: 14, fontWeight: 700, fontSize: 20}}>
          <span
            style={{
              width: 42,
              height: 42,
              display: "grid",
              placeItems: "center",
              borderRadius: 15,
              color: "#fff",
              background: palette.primary,
            }}
          >
            <Radar size={23} strokeWidth={2.1} />
          </span>
          Career Radar
        </div>
        <Pill text="Onboarding complete" tone="success" />
      </header>

      <div style={{padding: "42px 58px 52px"}}>
        <div style={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28}}>
          <div>
            <div style={{display: "flex", alignItems: "center", gap: 8, color: palette.accent, fontSize: 13, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase"}}>
              <Sparkles size={15} fill={palette.accent} />
              Evidence first
            </div>
            <h1 style={{fontSize: 38, lineHeight: 1.1, letterSpacing: -1.7, margin: "12px 0 8px", fontWeight: 700}}>
              Job Recommendations
            </h1>
            <p style={{fontSize: 16, margin: 0, color: palette.mutedForeground}}>
              Deterministic Fit Scores, backed by the evidence in your profile.
            </p>
          </div>
          <div style={{display: "flex", alignItems: "center", gap: 10}}>
            <Pill text="Eligible 12" tone="dark" />
            <Pill text="Review Required 2" />
            <Pill text="Excluded 4" />
          </div>
        </div>

        <div style={{display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18}}>
          {recommendations.map((item, index) => {
            const show = spring({
              frame: frame - 24 - index * 7,
              fps: 30,
              config: {damping: 18, stiffness: 120},
            });
            return (
              <RecommendationCard
                item={item}
                key={item.role}
                progress={show}
                hover={index === 0 ? cardHover : 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({
  item,
  progress,
  hover,
}: {
  item: (typeof recommendations)[number];
  progress: number;
  hover: number;
}) {
  return (
    <div
      style={{
        borderRadius: 21,
        border: `1px solid ${hover ? "rgba(23,79,67,.46)" : palette.border}`,
        background: palette.card,
        padding: "23px 25px 20px",
        transform: `translateY(${interpolate(progress, [0, 1], [22, -hover * 3])}px)`,
        opacity: progress,
        boxShadow: hover ? "0 16px 34px rgba(23,79,67,.12)" : "0 2px 4px rgba(24,33,30,.02)",
      }}
    >
      <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16}}>
        <div>
          <p style={{fontSize: 14, color: palette.mutedForeground, margin: 0}}>{item.employer}</p>
          <h3 style={{fontSize: 20, margin: "5px 0 0", letterSpacing: -0.4}}>{item.role}</h3>
        </div>
        <div
          style={{
            width: 66,
            height: 66,
            display: "grid",
            placeItems: "center",
            borderRadius: 18,
            background: palette.primary,
            color: "#fff",
          }}
        >
          <div style={{textAlign: "center"}}>
            <div style={{fontSize: 26, lineHeight: 1, fontWeight: 700}}>{item.fit}</div>
            <div style={{fontSize: 9, marginTop: 5, textTransform: "uppercase", letterSpacing: 1.2}}>Fit</div>
          </div>
        </div>
      </div>
      <div style={{display: "flex", gap: 18, alignItems: "center", marginTop: 18, fontSize: 13, color: palette.mutedForeground}}>
        <IconLabel icon={<MapPin size={14} />} text={item.location} />
        <IconLabel icon={<BriefcaseBusiness size={14} />} text={item.mode} />
        {item.featured && <IconLabel icon={<CalendarDays size={14} />} text="Aug 31" />}
      </div>
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20}}>
        <Pill text={item.verdict} tone={item.fit >= 75 ? "success" : "default"} />
        <span style={{fontSize: 13, fontWeight: 700, color: palette.primary, display: "flex", alignItems: "center", gap: 4}}>
          View evidence <ChevronRight size={14} />
        </span>
      </div>
    </div>
  );
}

function DetailModal({frame, progress}: {frame: number; progress: number}) {
  const scoreStart = 194;
  const scoreProgress = interpolate(frame, [scoreStart, scoreStart + 48], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const evidenceProgress = spring({
    frame: frame - 260,
    fps: 30,
    config: {damping: 18, stiffness: 105},
  });
  const scroll = interpolate(frame, [308, 385], [0, -112], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scores = [
    ["Technical fit", 100],
    ["Experience fit", 100],
    ["Career direction", 64],
    ["Work conditions", 100],
  ] as const;

  return (
    <div
      style={{
        position: "absolute",
        inset: 58,
        top: 136,
        background: `rgba(24,33,30,${0.35 * progress})`,
        backdropFilter: `blur(${5 * progress}px)`,
        display: "grid",
        placeItems: "center",
        padding: 38,
        opacity: progress,
      }}
    >
      <div
        style={{
          width: 950,
          height: 660,
          borderRadius: 28,
          background: palette.card,
          boxShadow: "0 30px 90px rgba(0,0,0,.24)",
          overflow: "hidden",
          transform: `translateY(${interpolate(progress, [0, 1], [45, 0])}px) scale(${interpolate(progress, [0, 1], [0.965, 1])})`,
        }}
      >
        <div style={{padding: "32px 38px 46px", transform: `translateY(${scroll}px)`}}>
          <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between"}}>
            <div>
              <p style={{fontSize: 14, color: palette.mutedForeground, margin: 0}}>Synthetic Cloud</p>
              <h2 style={{fontSize: 31, margin: "5px 0 13px", letterSpacing: -0.8}}>Platform Engineer</h2>
              <Pill text="Strong Fit · 91" tone="success" />
            </div>
            <div style={{width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", color: palette.mutedForeground}}>
              <X size={20} />
            </div>
          </div>

          <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 13, marginTop: 27}}>
            {scores.map(([label, score], index) => {
              const itemProgress = interpolate(scoreProgress, [index * 0.13, 0.55 + index * 0.1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const value = Math.round(score * itemProgress);
              return (
                <div key={label} style={{borderRadius: 15, background: palette.muted, padding: "16px 16px 14px"}}>
                  <div style={{fontSize: 12, color: palette.mutedForeground}}>{label}</div>
                  <div style={{fontSize: 29, fontWeight: 700, marginTop: 4}}>{value}</div>
                  <div style={{height: 4, borderRadius: 99, marginTop: 9, background: "rgba(23,79,67,.12)", overflow: "hidden"}}>
                    <div style={{height: "100%", width: `${score * itemProgress}%`, borderRadius: 99, background: index === 2 ? palette.accent : palette.primary}} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 27}}>
            <InsightColumn
              frame={frame}
              progress={evidenceProgress}
              title="Strengths"
              entries={[
                ["Required TypeScript skill matched", "Profile: TypeScript"],
                ["Experience meets the 3–5 year range", "Resume: Software Engineer, 2020–2024"],
                ["Seoul and hybrid preferences align", "Posting: Seoul · Hybrid work"],
              ]}
            />
            <InsightColumn
              frame={frame}
              progress={evidenceProgress}
              title="Gaps & uncertainties"
              entries={[
                ["Career direction partially overlaps", "Goal: Build developer platforms"],
                ["GCP is preferred, not required", "Profile: GCP"],
                ["Closing date should be confirmed", "Posting: Applications close Aug 31"],
              ]}
              muted
            />
          </div>

          <div style={{marginTop: 26}}>
            <h3 style={{fontSize: 17, margin: "0 0 12px"}}>Job Posting evidence</h3>
            <div
              style={{
                borderRadius: 14,
                borderLeft: `4px solid ${palette.primary}`,
                background: palette.muted,
                padding: "15px 17px",
              }}
            >
              <div style={{fontSize: 10, fontWeight: 800, color: palette.mutedForeground, letterSpacing: 1.1, textTransform: "uppercase"}}>
                Responsibilities
              </div>
              <div style={{fontSize: 14, marginTop: 5}}>“Build developer platform services using TypeScript.”</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightColumn({
  progress,
  title,
  entries,
  muted = false,
}: {
  frame: number;
  progress: number;
  title: string;
  entries: Array<[string, string]>;
  muted?: boolean;
}) {
  return (
    <div>
      <h3 style={{fontSize: 17, margin: "0 0 12px"}}>{title}</h3>
      <div style={{display: "grid", gap: 9}}>
        {entries.map(([text, evidence], index) => {
          const item = interpolate(progress, [index * 0.16, 0.56 + index * 0.16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={text}
              style={{
                display: "grid",
                gridTemplateColumns: "22px 1fr",
                gap: 9,
                borderRadius: 13,
                background: muted ? "#f1f0eb" : "#edf3ef",
                padding: "12px 13px",
                opacity: item,
                transform: `translateY(${(1 - item) * 8}px)`,
              }}
            >
              <div
                style={{
                  width: 19,
                  height: 19,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  background: muted ? "#dde0da" : palette.primary,
                  color: muted ? palette.mutedForeground : "#fff",
                }}
              >
                <Check size={12} strokeWidth={3} />
              </div>
              <div>
                <div style={{fontSize: 13, fontWeight: 600}}>{text}</div>
                <div style={{fontSize: 10.5, color: palette.mutedForeground, marginTop: 4}}>Evidence: {evidence}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NarrativeCaption({frame}: {frame: number}) {
  const first = captionOpacity(frame, 8, 82);
  const second = captionOpacity(frame, 176, 252);
  const third = captionOpacity(frame, 326, 430);
  const copy = frame < 150
    ? ["Rank the right opportunities.", "Not with guesses—with your evidence."]
    : frame < 305
      ? ["See why it fits.", "Every score stays explainable."]
      : ["Your career, in focus.", "Evidence-backed. Deterministic. Yours."];
  const opacity = frame < 150 ? first : frame < 305 ? second : third;
  const alignRight = frame >= 305;

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 20,
        top: 26,
        left: alignRight ? "auto" : 112,
        right: alignRight ? 116 : "auto",
        color: palette.foreground,
        opacity,
        textAlign: alignRight ? "right" : "left",
      }}
    >
      <div style={{fontSize: 20, fontWeight: 750, letterSpacing: -0.3}}>{copy[0]}</div>
      <div style={{fontSize: 13, color: palette.mutedForeground, marginTop: 3}}>{copy[1]}</div>
    </div>
  );
}

function Cursor({frame}: {frame: number}) {
  const p1 = interpolate(frame, [56, 116], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const p2 = interpolate(frame, [282, 350], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const start = {x: 1500, y: 765};
  const click = {x: 855, y: 410};
  const evidence = {x: 1115, y: 675};
  const first = bezierPoint(start, {x: 1360, y: 610}, {x: 1030, y: 475}, click, p1);
  const second = bezierPoint(click, {x: 940, y: 515}, {x: 1045, y: 610}, evidence, p2);
  const position = frame < 282 ? first : second;
  const cursorOpacity = interpolate(frame, [36, 52, 420, 438], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clickPulse = interpolate(frame, [133, 139, 151], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const settlePulse = interpolate(frame, [345, 351, 362], [0, 0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = Math.max(clickPulse, settlePulse);

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 60,
        left: position.x,
        top: position.y,
        opacity: cursorOpacity,
        filter: "drop-shadow(0 2px 2px rgba(0,0,0,.25))",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -15 - pulse * 10,
          top: -15 - pulse * 10,
          width: 30 + pulse * 20,
          height: 30 + pulse * 20,
          borderRadius: "50%",
          border: `2px solid rgba(237,118,88,${0.7 * pulse})`,
          background: `rgba(237,118,88,${0.12 * pulse})`,
        }}
      />
      <svg width="29" height="37" viewBox="0 0 29 37" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 2L25.5 20.5L15.2 22.2L10.2 32.8L2 2Z" fill="white" stroke="#17201D" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Pill({text, tone = "default"}: {text: string; tone?: "default" | "success" | "dark"}) {
  const styles: Record<string, CSSProperties> = {
    default: {background: "transparent", border: `1px solid ${palette.border}`, color: palette.mutedForeground},
    success: {background: palette.primaryLight, border: "1px solid rgba(38,113,94,.16)", color: palette.emerald},
    dark: {background: palette.primary, border: `1px solid ${palette.primary}`, color: "#fff"},
  };
  return (
    <span
      style={{
        ...styles[tone],
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "7px 11px",
        fontSize: 11.5,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function IconLabel({icon, text}: {icon: ReactNode; text: string}) {
  return <span style={{display: "flex", alignItems: "center", gap: 6}}>{icon}{text}</span>;
}

function Grain() {
  return (
    <AbsoluteFill
      style={{
        opacity: 0.16,
        pointerEvents: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.10'/%3E%3C/svg%3E\")",
        mixBlendMode: "multiply",
      }}
    />
  );
}

function captionOpacity(frame: number, start: number, end: number) {
  return interpolate(frame, [start, start + 12, end - 14, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function bezierPoint(
  start: {x: number; y: number},
  control1: {x: number; y: number},
  control2: {x: number; y: number},
  end: {x: number; y: number},
  progress: number,
) {
  const inverse = 1 - progress;
  return {
    x: inverse ** 3 * start.x
      + 3 * inverse ** 2 * progress * control1.x
      + 3 * inverse * progress ** 2 * control2.x
      + progress ** 3 * end.x,
    y: inverse ** 3 * start.y
      + 3 * inverse ** 2 * progress * control1.y
      + 3 * inverse * progress ** 2 * control2.y
      + progress ** 3 * end.y,
  };
}
