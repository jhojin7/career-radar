import {Composition} from "remotion";

import {CareerRadarDemo} from "./CareerRadarDemo";
import {CareerRadarPresentation} from "./CareerRadarPresentation";
import {PRESENTATION_DURATION_FRAMES, PRESENTATION_FPS} from "./presentation-data";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="CareerRadarDemo"
        component={CareerRadarDemo}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="CareerRadarPresentation"
        component={CareerRadarPresentation}
        durationInFrames={PRESENTATION_DURATION_FRAMES}
        fps={PRESENTATION_FPS}
        width={1920}
        height={1080}
      />
    </>
  );
}
