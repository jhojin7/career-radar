import {mkdir, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";

import {subtitleCues} from "./presentation-data";

const output = resolve("artifacts/presentation/career-radar-presentation.ko.srt");

function timestamp(seconds: number) {
  const totalMilliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

const srt = subtitleCues
  .map((cue, index) => `${index + 1}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text}`)
  .join("\n\n");

await mkdir(dirname(output), {recursive: true});
await writeFile(output, `${srt}\n`, "utf8");
console.info(output);
