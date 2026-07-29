import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CircleAlert,
  Cloud,
  Database,
  FileCheck2,
  FileText,
  Gauge,
  MapPin,
  MonitorCog,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserCheck,
  Workflow,
} from "lucide-react";
import type {CSSProperties, ReactNode} from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {
  presentationScenes,
  subtitleCues,
} from "./presentation-data";

const C = {
  ink: "#18211e",
  green: "#174f43",
  green2: "#286e5e",
  mint: "#dcebe5",
  cream: "#f7f6f0",
  paper: "#fffefa",
  coral: "#ed7658",
  sand: "#e9e6dc",
  muted: "#65716c",
  line: "#d9ddd5",
  yellow: "#f2c66d",
  red: "#a94d43",
};

const FONT = '"Apple SD Gothic Neo", "Avenir Next", "Segoe UI", sans-serif';

export function CareerRadarPresentation() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const currentScene = presentationScenes.find((scene) => seconds >= scene.start && seconds < scene.end)
    ?? presentationScenes.at(-1)!;

  return (
    <AbsoluteFill style={{fontFamily: FONT, background: C.cream, color: C.ink, overflow: "hidden"}}>
      <BackgroundAtmosphere frame={frame} />
      <SceneSequence start={0} end={10}><IntroScene /></SceneSequence>
      <SceneSequence start={10} end={25}><ProblemScene /></SceneSequence>
      <SceneSequence start={25} end={40}><ScopeScene /></SceneSequence>
      <SceneSequence start={40} end={60}><JourneyScene /></SceneSequence>
      <SceneSequence start={60} end={85}><ArchitectureScene /></SceneSequence>
      <SceneSequence start={85} end={105}><DesignScene /></SceneSequence>
      <SceneSequence start={105} end={116}><ProductScreenshotScene kind="collection" /></SceneSequence>
      <SceneSequence start={116} end={128}><ProductScreenshotScene kind="recommendations" /></SceneSequence>
      <SceneSequence start={128} end={143}><ProductScreenshotScene kind="evidence" /></SceneSequence>
      <SceneSequence start={143} end={154}><GuardrailsScene /></SceneSequence>
      <SceneSequence start={154} end={167}><RoadmapScene /></SceneSequence>
      <SceneSequence start={167} end={175}><OutroScene /></SceneSequence>
      <TopRail scene={currentScene.label} seconds={seconds} />
      <BurnedInSubtitle seconds={seconds} />
    </AbsoluteFill>
  );
}

function SceneSequence({start, end, children}: {start: number; end: number; children: ReactNode}) {
  return (
    <Sequence from={start * 30} durationInFrames={(end - start) * 30}>
      <SceneFade duration={(end - start) * 30}>{children}</SceneFade>
    </Sequence>
  );
}

function SceneFade({children, duration}: {children: ReactNode; duration: number}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 14, duration - 14, duration - 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
}

function IntroScene() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = spring({frame, fps, config: {damping: 16, stiffness: 80, mass: 1.1}});
  const rings = [0, 1, 2].map((index) => {
    const phase = ((frame / fps) * 0.28 + index / 3) % 1;
    return {scale: 0.45 + phase * 1.65, opacity: (1 - phase) * 0.28};
  });
  return (
    <Frame>
      <div style={{display: "grid", gridTemplateColumns: "1.05fr .95fr", alignItems: "center", height: "100%"}}>
        <div style={{paddingLeft: 90, transform: `translateY(${(1 - reveal) * 30}px)`, opacity: reveal}}>
          <Eyebrow>NIPA / KSTA Google Study Jam PBL</Eyebrow>
          <h1 style={{fontSize: 112, lineHeight: 0.9, letterSpacing: -6.5, margin: "28px 0 24px", fontWeight: 800}}>
            Career<br /><span style={{color: C.green}}>Radar</span>
          </h1>
          <p style={{fontSize: 29, lineHeight: 1.5, color: C.muted, maxWidth: 750, margin: 0}}>
            이력서와 희망 조건으로<br />
            <b style={{color: C.ink}}>근거가 보이는 채용공고 추천</b>
          </p>
        </div>
        <div style={{position: "relative", height: 720, display: "grid", placeItems: "center"}}>
          {rings.map((ring, index) => (
            <div key={index} style={{
              position: "absolute",
              width: 420,
              height: 420,
              border: `3px solid ${C.green}`,
              borderRadius: "50%",
              transform: `scale(${ring.scale})`,
              opacity: ring.opacity,
            }} />
          ))}
          <div style={{
            width: 310,
            height: 310,
            borderRadius: 90,
            display: "grid",
            placeItems: "center",
            color: "white",
            background: `linear-gradient(145deg, ${C.green2}, ${C.green})`,
            boxShadow: "0 45px 100px rgba(23,79,67,.28)",
            transform: `rotate(${interpolate(frame, [0, 300], [-8, 4])}deg) scale(${0.85 + reveal * 0.15})`,
          }}>
            <Radar size={160} strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </Frame>
  );
}

function ProblemScene() {
  const frame = useCurrentFrame();
  const cards = [
    {label: "기술 스택", value: "TypeScript · GCP", icon: <Sparkles size={27} />},
    {label: "요구 경력", value: "3–5 years", icon: <BriefcaseBusiness size={27} />},
    {label: "근무 조건", value: "Seoul · Hybrid", icon: <MapPin size={27} />},
    {label: "고용 형태", value: "Full-time?", icon: <CircleAlert size={27} />},
    {label: "직무 방향", value: "Platform · DevEx", icon: <Target size={27} />},
  ];
  return (
    <Frame>
      <SectionHeader eyebrow="Problem" title={<>공고는 많고,<br /><Accent>비교는 반복됩니다.</Accent></>} />
      <div style={{position: "absolute", right: 90, top: 185, width: 830, height: 670}}>
        {cards.map((card, index) => {
          const enter = spring({frame: frame - index * 18, fps: 30, config: {damping: 17, stiffness: 100}});
          const rotations = [-4, 3, -1.5, 4.5, -3];
          return (
            <div key={card.label} style={{
              position: "absolute",
              left: 80 + (index % 2) * 340 + (index === 4 ? 160 : 0),
              top: 25 + Math.floor(index / 2) * 180,
              width: 330,
              height: 145,
              padding: 24,
              borderRadius: 25,
              background: C.paper,
              border: `1px solid ${C.line}`,
              boxShadow: "0 18px 45px rgba(24,33,30,.09)",
              transform: `translateY(${(1 - enter) * 50}px) rotate(${rotations[index]}deg)`,
              opacity: enter,
            }}>
              <div style={{display: "flex", alignItems: "center", gap: 10, color: C.green}}>{card.icon}<b style={{fontSize: 18}}>{card.label}</b></div>
              <div style={{fontSize: 25, marginTop: 20, fontWeight: 700}}>{card.value}</div>
            </div>
          );
        })}
      </div>
      <div style={{position: "absolute", left: 95, bottom: 210, display: "flex", gap: 17}}>
        <Tag>반복 비교</Tag><Tag>근거 부족</Tag><Tag>결과 불신</Tag>
      </div>
    </Frame>
  );
}

function ScopeScene() {
  const frame = useCurrentFrame();
  const capabilities = [
    {title: "Profile", detail: "PDF 이력서 → 확인 가능한 초안", icon: <FileText size={37} />},
    {title: "Targets", detail: "직무 · 지역 · 근무 형태", icon: <Target size={37} />},
    {title: "Job Pool", detail: "수집 · 정규화 · 중복 제거", icon: <Database size={37} />},
    {title: "Recommendations", detail: "Fit Score · 제외 · 근거", icon: <Gauge size={37} />},
  ];
  const scroll = interpolate(frame, [60, 400], [0, -1060], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Frame>
      <div style={{display: "grid", gridTemplateColumns: ".92fr 1.08fr", gap: 70, alignItems: "center", height: "100%"}}>
        <div style={{paddingLeft: 90}}>
          <Eyebrow>Product Scope</Eyebrow>
          <h2 style={titleStyle}>프로필부터<br /><Accent>근거 기반 추천까지</Accent></h2>
          <div style={{display: "grid", gap: 14, marginTop: 35}}>
            {capabilities.map((item, index) => {
              const show = spring({frame: frame - index * 15, fps: 30, config: {damping: 18, stiffness: 110}});
              return (
                <div key={item.title} style={{
                  display: "grid",
                  gridTemplateColumns: "62px 1fr",
                  alignItems: "center",
                  gap: 17,
                  opacity: show,
                  transform: `translateX(${(1 - show) * -25}px)`,
                }}>
                  <div style={{width: 62, height: 62, display: "grid", placeItems: "center", borderRadius: 19, background: C.mint, color: C.green}}>{item.icon}</div>
                  <div><b style={{fontSize: 22}}>{item.title}</b><div style={{fontSize: 17, color: C.muted, marginTop: 3}}>{item.detail}</div></div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{height: 750, borderRadius: 34, overflow: "hidden", border: `1px solid ${C.line}`, background: C.paper, boxShadow: "0 30px 80px rgba(24,33,30,.15)", transform: "rotate(1.1deg)"}}>
          <Img
            src={staticFile("01-workspace-full.jpg")}
            style={{width: "100%", height: "auto", transform: `translateY(${scroll}px)`}}
          />
        </div>
      </div>
    </Frame>
  );
}

function JourneyScene() {
  const frame = useCurrentFrame();
  const nodes = [
    {label: "PDF 이력서", sub: "Upload", icon: <Upload size={33} />},
    {label: "Profile Draft", sub: "Gemini extract", icon: <Sparkles size={33} />},
    {label: "사용자 확인", sub: "Candidate Profile", icon: <UserCheck size={33} />},
    {label: "Search Targets", sub: "Role · Location · Mode", icon: <Target size={33} />},
    {label: "Job Pool", sub: "Normalize · Deduplicate", icon: <Database size={33} />},
    {label: "추천과 근거", sub: "Score · Evidence", icon: <FileCheck2 size={33} />},
  ];
  return (
    <Frame>
      <CenteredHeader eyebrow="Core Flow" title="한 번의 프로필 확인이, 전체 추천의 기준이 됩니다." />
      <div style={{position: "absolute", left: 110, right: 110, top: 410, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 22}}>
        <div style={{position: "absolute", left: 110, right: 110, top: 60, height: 5, borderRadius: 99, background: C.sand}} />
        <div style={{
          position: "absolute",
          left: 110,
          top: 60,
          width: `${interpolate(frame, [30, 500], [0, 80], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}%`,
          height: 5,
          borderRadius: 99,
          background: `linear-gradient(90deg, ${C.green}, ${C.coral})`,
        }} />
        {nodes.map((node, index) => {
          const show = spring({frame: frame - 25 - index * 55, fps: 30, config: {damping: 16, stiffness: 105}});
          return (
            <div key={node.label} style={{position: "relative", textAlign: "center", opacity: show, transform: `translateY(${(1 - show) * 28}px)`}}>
              <div style={{width: 122, height: 122, margin: "0 auto 24px", borderRadius: 37, background: index === 5 ? C.green : C.paper, color: index === 5 ? "white" : C.green, border: `2px solid ${index === 5 ? C.green : C.line}`, display: "grid", placeItems: "center", boxShadow: "0 16px 40px rgba(24,33,30,.08)"}}>{node.icon}</div>
              <b style={{fontSize: 20}}>{node.label}</b>
              <div style={{fontSize: 13.5, color: C.muted, marginTop: 7, lineHeight: 1.4}}>{node.sub}</div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

function ArchitectureScene() {
  const frame = useCurrentFrame();
  const pulse = 0.5 + Math.sin(frame / 14) * 0.5;
  const services = [
    {title: "Vertex AI Gemini", sub: "사실 · 근거 추출", icon: <Sparkles size={31} />, color: C.coral},
    {title: "Firestore", sub: "구조화 데이터", icon: <Database size={31} />, color: C.green2},
    {title: "Cloud Storage", sub: "원본 PDF · 공고", icon: <Cloud size={31} />, color: "#527ca7"},
  ];
  return (
    <Frame>
      <SectionHeader eyebrow="GCP Architecture" title={<>웹과 배치는 분리하고,<br /><Accent>데이터와 로직은 공유합니다.</Accent></>} compact />
      <div style={{position: "absolute", right: 55, top: 135, width: 1150, height: 760}}>
        <ArchitectureLine x1={225} y1={220} x2={260} y2={205} progress={frame / 50} />
        <ArchitectureLine x1={225} y1={565} x2={260} y2={550} progress={(frame - 35) / 50} dashed />
        <ArchitectureLine x1={410} y1={270} x2={410} y2={485} progress={(frame - 65) / 80} dashed />
        <ArchitectureLine x1={560} y1={205} x2={690} y2={205} progress={(frame - 95) / 70} />
        <ArchitectureLine x1={560} y1={550} x2={690} y2={550} progress={(frame - 125) / 70} />
        <ArchitectureNode x={0} y={155} title="사용자" sub="Browser" icon={<UserCheck size={34} />} />
        <ArchitectureNode x={260} y={140} title="Cloud Run Service" sub="React / Vite + Hono API" icon={<Cloud size={36} />} wide />
        <ArchitectureNode x={0} y={500} title="Cloud Scheduler" sub="예약 트리거" icon={<MonitorCog size={32} />} />
        <ArchitectureNode x={260} y={485} title="Cloud Run Job" sub="Collection worker" icon={<Workflow size={32} />} wide strong />
        <div style={{position: "absolute", left: 430, top: 355, padding: "7px 11px", borderRadius: 999, background: C.paper, border: `1px solid ${C.line}`, color: C.coral, fontSize: 12.5, fontWeight: 800}}>
          수동 실행
        </div>
        <div style={{position: "absolute", left: 690, top: 50, width: 460, height: 650, boxSizing: "border-box", borderRadius: 30, border: `1px solid ${C.line}`, background: "rgba(255,254,250,.5)"}}>
          <div style={{position: "absolute", left: 28, top: 25, color: C.green, fontSize: 14, fontWeight: 850, letterSpacing: 1.4, textTransform: "uppercase"}}>
            Shared Data &amp; AI
          </div>
        </div>
        {services.map((service, index) => (
          <ArchitectureNode key={service.title} {...service} x={825} y={125 + index * 190} wide delay={105 + index * 30} />
        ))}
        <div style={{position: "absolute", left: 680, top: 195, width: 14, height: 14, borderRadius: "50%", background: C.coral, boxShadow: `0 0 0 ${10 + pulse * 10}px rgba(237,118,88,.12)`}} />
        <div style={{position: "absolute", left: 680, top: 540, width: 14, height: 14, borderRadius: "50%", background: C.coral, boxShadow: `0 0 0 ${10 + pulse * 10}px rgba(237,118,88,.12)`}} />
      </div>
      <div style={{position: "absolute", left: 95, bottom: 185, maxWidth: 600}}>
        <Callout icon={<Workflow size={25} />} text="웹 서비스와 Scheduler가 동일한 Cloud Run Job을 실행" />
      </div>
    </Frame>
  );
}

function DesignScene() {
  const frame = useCurrentFrame();
  const left = spring({frame, fps: 30, config: {damping: 18, stiffness: 90}});
  const right = spring({frame: frame - 45, fps: 30, config: {damping: 18, stiffness: 90}});
  return (
    <Frame>
      <CenteredHeader eyebrow="Core Design" title="AI는 읽고, 규칙은 판단합니다." />
      <div style={{position: "absolute", left: 130, right: 130, top: 330, display: "grid", gridTemplateColumns: "1fr 130px 1fr", alignItems: "center"}}>
        <DesignPanel progress={left} icon={<Sparkles size={49} />} kicker="Vertex AI Gemini" title="비정형 문장에서" accent="사실과 근거 추출" items={["경력 · 기술", "공고 요구사항", "원문 인용"]} />
        <div style={{display: "grid", placeItems: "center", color: C.coral}}>
          <ArrowRight size={65} strokeWidth={1.5} />
        </div>
        <DesignPanel progress={right} icon={<ShieldCheck size={49} />} kicker="Application Rules" title="검증 가능한 규칙으로" accent="점수와 상태 계산" items={["Fit Score", "Excluded", "Review Required"]} strong />
      </div>
      <div style={{position: "absolute", left: 280, right: 280, bottom: 165, display: "flex", justifyContent: "center", gap: 20}}>
        <Tag>같은 입력</Tag><ArrowRight size={27} color={C.muted} /><Tag>같은 점수</Tag><ArrowRight size={27} color={C.muted} /><Tag>같은 순위</Tag>
      </div>
    </Frame>
  );
}

function ProductScreenshotScene({kind}: {kind: "collection" | "recommendations" | "evidence"}) {
  const frame = useCurrentFrame();
  const config = {
    collection: {
      eyebrow: "Working Product · 01",
      title: "Collection Run과 Job Pool",
      image: "02-collection-run.jpg",
      accent: "6 discovered · 4 normalized · 2 duplicates",
    },
    recommendations: {
      eyebrow: "Working Product · 02",
      title: "Fit Score로 정렬된 추천",
      image: "03-recommendations.jpg",
      accent: "Technical 40 · Experience 25 · Direction 25 · Conditions 10",
    },
    evidence: {
      eyebrow: "Working Product · 03",
      title: "점수에서 원문 근거까지",
      image: "04-recommendation-detail.jpg",
      accent: "Technical · Experience · Direction · Conditions",
    },
  }[kind];
  const imageEnter = spring({frame: frame - 10, fps: 30, config: {damping: 20, stiffness: 90}});
  const zoom = interpolate(frame, [0, kind === "evidence" ? 450 : 360], [1.01, kind === "evidence" ? 1.085 : 1.055], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursor = kind === "collection"
    ? {x: interpolate(frame, [80, 260], [1480, 1220], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), y: interpolate(frame, [80, 260], [680, 460], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}
    : kind === "recommendations"
      ? {x: interpolate(frame, [70, 260], [1480, 805], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), y: interpolate(frame, [70, 260], [720, 700], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}
      : {x: interpolate(frame, [90, 330], [1480, 1120], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), y: interpolate(frame, [90, 330], [740, 610], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})};
  return (
    <Frame>
      <div style={{position: "absolute", left: 95, top: 120, zIndex: 5}}>
        <Eyebrow>{config.eyebrow}</Eyebrow>
        <h2 style={{fontSize: 49, letterSpacing: -2, margin: "15px 0 0"}}>{config.title}</h2>
      </div>
      <div style={{position: "absolute", right: 100, top: 145, zIndex: 5}}><Tag>{config.accent}</Tag></div>
      <div style={{
        position: "absolute",
        left: 95,
        right: 95,
        top: 225,
        height: 690,
        borderRadius: 31,
        overflow: "hidden",
        background: C.paper,
        border: `1px solid ${C.line}`,
        boxShadow: "0 35px 90px rgba(24,33,30,.18)",
        opacity: imageEnter,
        transform: `translateY(${(1 - imageEnter) * 25}px)`,
      }}>
        <Img src={staticFile(config.image)} style={{width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`}} />
      </div>
      <PresentationCursor x={cursor.x} y={cursor.y} pulse={interpolate(frame, [250, 270, 300], [0, 1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})} />
    </Frame>
  );
}

function GuardrailsScene() {
  const frame = useCurrentFrame();
  const review = spring({frame, fps: 30, config: {damping: 18, stiffness: 90}});
  const excluded = spring({frame: frame - 35, fps: 30, config: {damping: 18, stiffness: 90}});
  return (
    <Frame>
      <CenteredHeader eyebrow="Guardrails" title="모호함과 명확한 위반을 구분합니다." />
      <div style={{position: "absolute", left: 95, right: 95, top: 305, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28}}>
        <ScreenshotCard progress={review} image="05-review-required.jpg" badge="Review Required" badgeColor={C.yellow} caption="근무 형태가 불명확하면 자동 제외하지 않습니다." />
        <ScreenshotCard progress={excluded} image="06-excluded.jpg" badge="Excluded" badgeColor={C.coral} caption="계약직 조건을 위반하면 점수가 높아도 제외합니다." />
      </div>
    </Frame>
  );
}

function RoadmapScene() {
  const frame = useCurrentFrame();
  const items = [
    {num: "01", title: "지원 준비", detail: "지원서 맞춤화 · 면접 준비 · 상태 관리", icon: <FileCheck2 size={41} />},
    {num: "02", title: "데이터 확장", detail: "채용 API · 기술 격차 분석", icon: <BarChart3 size={41} />},
    {num: "03", title: "운영 관찰", detail: "BigQuery · Cloud Monitoring", icon: <MonitorCog size={41} />},
  ];
  return (
    <Frame>
      <SectionHeader eyebrow="Next" title={<>추천에서 끝나지 않는<br /><Accent>구직 의사결정 도구로</Accent></>} />
      <div style={{position: "absolute", right: 100, top: 205, width: 840, display: "grid", gap: 22}}>
        {items.map((item, index) => {
          const show = spring({frame: frame - index * 35, fps: 30, config: {damping: 17, stiffness: 95}});
          return (
            <div key={item.num} style={{display: "grid", gridTemplateColumns: "70px 86px 1fr", alignItems: "center", gap: 20, padding: "26px 30px", background: index === 0 ? C.green : C.paper, color: index === 0 ? "white" : C.ink, border: `1px solid ${index === 0 ? C.green : C.line}`, borderRadius: 27, boxShadow: "0 18px 45px rgba(24,33,30,.08)", transform: `translateX(${(1 - show) * 55}px)`, opacity: show}}>
              <span style={{fontSize: 16, color: index === 0 ? C.mint : C.coral, fontWeight: 800}}>{item.num}</span>
              <div style={{width: 72, height: 72, borderRadius: 22, display: "grid", placeItems: "center", background: index === 0 ? "rgba(255,255,255,.12)" : C.mint, color: index === 0 ? "white" : C.green}}>{item.icon}</div>
              <div><b style={{fontSize: 27}}>{item.title}</b><div style={{fontSize: 17, color: index === 0 ? "rgba(255,255,255,.7)" : C.muted, marginTop: 5}}>{item.detail}</div></div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

function OutroScene() {
  const frame = useCurrentFrame();
  const reveal = spring({frame, fps: 30, config: {damping: 18, stiffness: 75}});
  const traits = ["Evidence-backed", "Deterministic", "User-controlled"];
  return (
    <Frame>
      <div style={{height: "100%", display: "grid", placeItems: "center", textAlign: "center", transform: `scale(${0.94 + reveal * 0.06})`, opacity: reveal}}>
        <div>
          <div style={{width: 122, height: 122, margin: "0 auto 32px", borderRadius: 39, display: "grid", placeItems: "center", background: C.green, color: "white", boxShadow: "0 24px 70px rgba(23,79,67,.25)"}}><Radar size={67} /></div>
          <h2 style={{fontSize: 86, letterSpacing: -4.5, margin: 0}}>Your career, <Accent>in focus.</Accent></h2>
          <p style={{fontSize: 26, color: C.muted, margin: "22px 0 40px"}}>AI의 속도와 사용자의 판단을 연결합니다.</p>
          <div style={{display: "flex", justifyContent: "center", gap: 14}}>
            {traits.map((trait, index) => <Tag key={trait} strong={index === 0}>{trait}</Tag>)}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Frame({children}: {children: ReactNode}) {
  return <AbsoluteFill style={{padding: "70px 70px 135px"}}>{children}</AbsoluteFill>;
}

function BackgroundAtmosphere({frame}: {frame: number}) {
  const x = 15 + Math.sin(frame / 180) * 5;
  const y = 22 + Math.cos(frame / 240) * 6;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(circle at ${x}% ${y}%, rgba(237,118,88,.14), transparent 27%), radial-gradient(circle at 84% 76%, rgba(23,79,67,.13), transparent 31%), ${C.cream}`,
    }}>
      <div style={{position: "absolute", inset: 0, opacity: 0.09, mixBlendMode: "multiply", backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E\")"}} />
    </AbsoluteFill>
  );
}

function TopRail({scene, seconds}: {scene: string; seconds: number}) {
  return (
    <div style={{position: "absolute", left: 72, right: 72, top: 32, zIndex: 80, display: "grid", gridTemplateColumns: "240px 1fr 90px", alignItems: "center", gap: 24}}>
      <div style={{display: "flex", alignItems: "center", gap: 11, fontWeight: 800, fontSize: 16}}><Radar size={23} color={C.green} /> Career Radar</div>
      <div style={{height: 3, borderRadius: 99, background: "rgba(24,33,30,.1)", overflow: "hidden"}}><div style={{height: "100%", width: `${seconds / 175 * 100}%`, background: `linear-gradient(90deg, ${C.green}, ${C.coral})`}} /></div>
      <div style={{fontSize: 13, color: C.muted, textAlign: "right", textTransform: "uppercase", letterSpacing: 1.1}}>{scene}</div>
    </div>
  );
}

function BurnedInSubtitle({seconds}: {seconds: number}) {
  const cue = subtitleCues.find((item) => seconds >= item.start && seconds < item.end);
  if (!cue) return null;
  const local = seconds - cue.start;
  const opacity = Math.min(1, local / 0.18, (cue.end - seconds) / 0.18);
  return (
    <div style={{position: "absolute", left: 170, right: 170, bottom: 34, zIndex: 100, display: "flex", justifyContent: "center", opacity}}>
      <div style={{maxWidth: 1480, padding: "17px 30px 18px", borderRadius: 18, background: "rgba(24,33,30,.88)", color: "white", fontSize: 24, lineHeight: 1.38, fontWeight: 650, letterSpacing: -0.2, textAlign: "center", boxShadow: "0 14px 35px rgba(0,0,0,.18)"}}>
        {cue.text}
      </div>
    </div>
  );
}

function SectionHeader({eyebrow, title, compact = false}: {eyebrow: string; title: ReactNode; compact?: boolean}) {
  return <div style={{position: "absolute", left: 95, top: compact ? 160 : 205, maxWidth: compact ? 680 : 760}}><Eyebrow>{eyebrow}</Eyebrow><h2 style={{...titleStyle, fontSize: compact ? 55 : 67}}>{title}</h2></div>;
}

function CenteredHeader({eyebrow, title}: {eyebrow: string; title: ReactNode}) {
  return <div style={{position: "absolute", left: 180, right: 180, top: 150, textAlign: "center"}}><Eyebrow>{eyebrow}</Eyebrow><h2 style={{fontSize: 55, letterSpacing: -2.5, margin: "18px 0 0", lineHeight: 1.15}}>{title}</h2></div>;
}

function Eyebrow({children}: {children: ReactNode}) {
  return <div style={{fontSize: 14, color: C.coral, fontWeight: 850, textTransform: "uppercase", letterSpacing: 2.1}}>{children}</div>;
}

function Accent({children}: {children: ReactNode}) {
  return <span style={{color: C.green}}>{children}</span>;
}

function Tag({children, strong = false}: {children: ReactNode; strong?: boolean}) {
  return <span style={{display: "inline-flex", alignItems: "center", minHeight: 42, padding: "0 17px", borderRadius: 999, background: strong ? C.green : C.paper, color: strong ? "white" : C.ink, border: `1px solid ${strong ? C.green : C.line}`, fontSize: 15, fontWeight: 750, boxShadow: "0 8px 20px rgba(24,33,30,.06)"}}>{children}</span>;
}

function Callout({icon, text}: {icon: ReactNode; text: string}) {
  return <div style={{display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 19, border: `1px solid ${C.line}`, background: C.paper, boxShadow: "0 12px 30px rgba(24,33,30,.06)", fontSize: 17, lineHeight: 1.45, color: C.muted}}><span style={{color: C.green}}>{icon}</span>{text}</div>;
}

function ArchitectureNode({x, y, title, sub, icon, wide = false, strong = false, color = C.green, delay = 0}: {x: number; y: number; title: string; sub: string; icon: ReactNode; wide?: boolean; strong?: boolean; color?: string; delay?: number}) {
  const frame = useCurrentFrame();
  const show = spring({frame: frame - delay, fps: 30, config: {damping: 17, stiffness: 95}});
  return (
    <div style={{position: "absolute", left: x, top: y, width: wide ? 300 : 225, minHeight: 130, boxSizing: "border-box", padding: 22, borderRadius: 24, background: strong ? C.green : C.paper, color: strong ? "white" : C.ink, border: `1px solid ${strong ? C.green : C.line}`, boxShadow: "0 18px 45px rgba(24,33,30,.09)", opacity: show, transform: `scale(${0.88 + show * 0.12})`}}>
      <div style={{color: strong ? C.mint : color}}>{icon}</div>
      <b style={{display: "block", fontSize: 19, marginTop: 13}}>{title}</b>
      <div style={{fontSize: 13.5, marginTop: 4, color: strong ? "rgba(255,255,255,.68)" : C.muted}}>{sub}</div>
    </div>
  );
}

function ArchitectureLine({x1, y1, x2, y2, progress, dashed = false}: {x1: number; y1: number; x2: number; y2: number; progress: number; dashed?: boolean}) {
  const p = Math.max(0, Math.min(1, progress));
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  return <div style={{position: "absolute", left: x1, top: y1, width: length * p, height: 3, transformOrigin: "left center", transform: `rotate(${angle}deg)`, borderTop: dashed ? `3px dashed ${C.coral}` : "none", background: dashed ? "transparent" : C.green, opacity: dashed ? 0.65 : 0.45}} />;
}

function DesignPanel({progress, icon, kicker, title, accent, items, strong = false}: {progress: number; icon: ReactNode; kicker: string; title: string; accent: string; items: string[]; strong?: boolean}) {
  return (
    <div style={{minHeight: 410, padding: "38px 42px", borderRadius: 35, background: strong ? C.green : C.paper, color: strong ? "white" : C.ink, border: `1px solid ${strong ? C.green : C.line}`, boxShadow: "0 30px 80px rgba(24,33,30,.12)", opacity: progress, transform: `translateY(${(1 - progress) * 38}px)`}}>
      <div style={{color: strong ? C.mint : C.coral}}>{icon}</div>
      <div style={{fontSize: 14, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: strong ? "rgba(255,255,255,.62)" : C.muted, marginTop: 25}}>{kicker}</div>
      <div style={{fontSize: 29, marginTop: 10, lineHeight: 1.35}}>{title}<br /><b style={{color: strong ? C.yellow : C.green}}>{accent}</b></div>
      <div style={{display: "flex", gap: 10, marginTop: 31, flexWrap: "wrap"}}>{items.map((item) => <span key={item} style={{padding: "9px 13px", borderRadius: 12, fontSize: 14, background: strong ? "rgba(255,255,255,.1)" : C.mint, color: strong ? "white" : C.green}}>{item}</span>)}</div>
    </div>
  );
}

function PresentationCursor({x, y, pulse}: {x: number; y: number; pulse: number}) {
  return (
    <div style={{position: "absolute", zIndex: 30, left: x, top: y, filter: "drop-shadow(0 2px 2px rgba(0,0,0,.24))"}}>
      <div style={{position: "absolute", left: -16 - pulse * 9, top: -16 - pulse * 9, width: 32 + pulse * 18, height: 32 + pulse * 18, borderRadius: "50%", border: `2px solid rgba(237,118,88,${pulse * .8})`, background: `rgba(237,118,88,${pulse * .13})`}} />
      <svg width="30" height="39" viewBox="0 0 29 37" fill="none"><path d="M2 2L25.5 20.5L15.2 22.2L10.2 32.8L2 2Z" fill="white" stroke="#17201D" strokeWidth="2.4" strokeLinejoin="round" /></svg>
    </div>
  );
}

function ScreenshotCard({progress, image, badge, badgeColor, caption}: {progress: number; image: string; badge: string; badgeColor: string; caption: string}) {
  return (
    <div style={{borderRadius: 30, overflow: "hidden", background: C.paper, border: `1px solid ${C.line}`, boxShadow: "0 28px 70px rgba(24,33,30,.13)", opacity: progress, transform: `translateY(${(1 - progress) * 30}px)`}}>
      <div style={{height: 390, overflow: "hidden"}}><Img src={staticFile(image)} style={{width: "100%", height: "100%", objectFit: "cover"}} /></div>
      <div style={{padding: "22px 27px 25px"}}>
        <span style={{display: "inline-flex", padding: "7px 11px", borderRadius: 999, background: badgeColor, color: badge === "Excluded" ? "white" : C.ink, fontSize: 13, fontWeight: 800}}>{badge}</span>
        <div style={{fontSize: 18, marginTop: 13, color: C.muted}}>{caption}</div>
      </div>
    </div>
  );
}

const titleStyle: CSSProperties = {
  fontSize: 67,
  letterSpacing: -3.4,
  lineHeight: 1.12,
  margin: "22px 0 0",
  fontWeight: 800,
};
