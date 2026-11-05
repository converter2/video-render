import { assertAttributes, assertEmptyElement, createMarkupSurfaceFacet, textAttribute } from "@hypit/hypit/markup";
import { canonicalize, sameType } from "@hypit/hypit/protocol";
import { sealGraphFragment } from "@hypit/hypit/author";
import type { ProducerPackage } from "@hypit/hypit/producer";
import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { FragmentOperation } from "@hypit/hypit/author";
import type { ModuleManifest, TypeRef } from "@hypit/hypit/protocol";
import type { StructuredSurfaceHandler, SurfaceResolvedReference } from "@hypit/hypit/markup";
import { compositionTypes } from "@hypit/composition";
import { mediaTypes } from "@hypit/media";
import type { FontStackRef } from "@hypit/media";
import type { Timeline } from "@hypit/timeline";
import { timelineTypes } from "@hypit/timeline";
import { spatialTypes } from "@hypit/spatial";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalInstantFor, temporalTypes } from "@hypit/temporal";
import type { TemporalInstant, TemporalWindow } from "@hypit/temporal";
import { resolveTemporalInstantReference, resolveTemporalWindowReference, resolveTemporalContext,
  temporalContextAttributeVocabulary, temporalInstantAttributeNames, temporalInstantAttributeVocabulary,
  temporalWindowAttributeNames, temporalWindowAttributeVocabulary } from "@hypit/temporal/markup";
import { renderScene } from "./render.js";
import type { SceneOptions, Beat } from "./render.js";

const module = { name: "@autoposter/scene", version: "1" } as const;
const types = Object.fromEntries(["Options", "Beat", "Beats"].map(name => [name, { module, name }])) as Record<"Options" | "Beat" | "Beats", TypeRef>;
const producers = Object.fromEntries(["empty", "append", "render"].map(name => [name, { module, name }])) as Record<"empty" | "append" | "render", { module: typeof module; name: string }>;
export const manifest: ModuleManifest = { format: "hypit.module@1", ...module,
  dependencies: [compositionTypes.visualTrack, mediaTypes.fontStack, timelineTypes.timeline, spatialTypes.frame, temporalTypes.instant].map(type => ({ module: type.module })),
  types: Object.values(types).map(type => ({ name: type.name })), capabilities: [], producers: [
    { name: "empty", inputs: [], outputs: [{ name: "messages", type: types.Beats }], needs: [] },
    { name: "append", inputs: [{ name: "messages", type: types.Beats }, { name: "message", type: types.Beat },
      { name: "at", type: temporalTypes.instant }, { name: "timeline", type: timelineTypes.timeline }], outputs: [{ name: "messages", type: types.Beats }], needs: [] },
    { name: "render", inputs: [{ name: "messages", type: types.Beats }, { name: "options", type: types.Options },
      { name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
      { name: "window", type: temporalTypes.window }, { name: "font", type: mediaTypes.fontStack }, { name: "display", type: mediaTypes.fontStack }], outputs: [{ name: "visual", type: compositionTypes.visualTrack }], needs: [] },
  ],
};
const inline = <T>(record: { value: { kind: string; value?: unknown } } | undefined): T => {
  if (record?.value.kind !== "inline") throw new Error("MOT scene inputs must be inline values.");
  return record.value.value as T;
};
const value = (data: unknown) => ({ kind: "inline" as const, value: canonicalize(data) });
const component: ProducerPackage & AdmissionPackage = { producers: [
  { producer: producers.empty, handler: () => ({ outputs: { messages: value([]) }, needs: {} }) },
  { producer: producers.append, handler: ({ inputs }) => {
    const message = inline<Omit<Beat, "at">>(inputs.message), at = inline<TemporalInstant>(inputs.at);
    const messages = inline<Beat[]>(inputs.messages);
    assertTemporalInstantFor(at, { subjectId: message.id, timeline: inline<Timeline>(inputs.timeline) });
    if (messages.some(item => item.id === message.id) || (messages.at(-1)?.at.frame ?? -1) > at.frame) throw new Error("MOT beats need unique ids and chronological times.");
    return { outputs: { messages: value([...messages, { ...message, at }]) }, needs: {} };
  } },
  { producer: producers.render, handler: ({ inputs }) => ({ outputs: { visual: value(renderScene(inline<Timeline>(inputs.timeline),
    inline<SpatialFrame>(inputs.within), inline<TemporalWindow>(inputs.window), inline<FontStackRef>(inputs.font), inline<FontStackRef>(inputs.display),
    inline<Beat[]>(inputs.messages), inline<SceneOptions>(inputs.options))) }, needs: {} }) },
] };

export const decodeSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "within", "font", "display", "brand", "source", "captions", "theme", "mascot", "cover-text", "cover-number", "cover-frames", "transition-frames", ...temporalWindowAttributeNames]);
  const id = textAttribute(element, "id"), context = resolveTemporalContext({ element, resolveReference });
  const window = resolveTemporalWindowReference({ element, resolveReference });
  const reference = (name: string, type: TypeRef): SurfaceResolvedReference => {
    const raw = element.attributes[name];
    if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${name} must be a reference.`);
    const found = resolveReference(raw.path);
    if (found === undefined || !sameType(found.type, type)) throw new Error(`${name} has the wrong Type.`);
    return found;
  };
  const options: SceneOptions = { id, brand: textAttribute(element, "brand"), source: element.attributes["source"] === undefined ? "" : textAttribute(element, "source"), transitionFrames: Number(element.attributes["transition-frames"] ?? "10"),
    captions: element.attributes["captions"] === undefined ? "" : textAttribute(element, "captions"),
    theme: element.attributes["theme"] === undefined ? "" : textAttribute(element, "theme"),
    mascot: element.attributes["mascot"] === undefined ? "car" : textAttribute(element, "mascot"),
    coverText: element.attributes["cover-text"] === undefined ? "" : textAttribute(element, "cover-text"),
    coverNumber: element.attributes["cover-number"] === undefined ? "" : textAttribute(element, "cover-number"),
    coverFrames: Number(element.attributes["cover-frames"] ?? "0") };
  const records = [{ id: `${id}.options`, type: types.Options, value: value(options), range: element.range }];
  const inputs = [{ name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
    { name: "font", type: mediaTypes.fontStack }, { name: "display", type: mediaTypes.fontStack }, { name: "window", type: temporalTypes.window }, { name: "options", type: types.Options }];
  const bindings: Record<string, SurfaceResolvedReference["ref"]> = { timeline: context.timeline.ref, within: reference("within", spatialTypes.frame).ref,
    font: reference("font", mediaTypes.fontStack).ref, display: reference("display", mediaTypes.fontStack).ref, window: window.ref, options: { kind: "record", id: `${id}.options` } };
  const input = (name: string) => ({ kind: "fragment-input" as const, name });
  const operation = (name: string) => ({ kind: "fragment-operation" as const, operation: name });
  const operations: FragmentOperation[] = [{ id: "empty", producer: producers.empty, inputs: {}, result: { kind: "output", name: "messages" } }];
  let previous = "empty", index = 0;
  for (const child of element.children) {
    if (child.kind === "text") { if (child.value.trim()) throw new Error("MOT Scene accepts Beat children."); continue; }
    if (child.name.split(":").at(-1) !== "Beat") throw new Error("MOT Scene accepts Beat children.");
    const fields = ["kicker", "title", "value", "label", "items", "note", "cues", "variants", "bubble", "plate", "tone", "parts", "image"] as const;
    assertAttributes(child, ["id", "kind", ...fields, ...temporalInstantAttributeNames]); assertEmptyElement(child);
    const messageId = textAttribute(child, "id"), kind = textAttribute(child, "kind");
    if (!["hook", "stat", "bars", "rank", "columns", "list", "showcase", "close"].includes(kind)) throw new Error(`Beat kind ${kind} is not known.`);
    const opt = (name: string) => { const raw = child.attributes[name]; return raw === undefined ? "" : textAttribute(child, name); };
    const at = resolveTemporalInstantReference({ element: child, resolveReference });
    const key = `message-${++index}`;
    records.push({ id: `${id}.${key}`, type: types.Beat, value: value({ id: messageId, kind, ...Object.fromEntries(fields.map(f => [f, opt(f)])) }), range: child.range });
    inputs.push({ name: key, type: types.Beat }, { name: `${key}-at`, type: temporalTypes.instant });
    bindings[key] = { kind: "record", id: `${id}.${key}` }; bindings[`${key}-at`] = at.ref;
    operations.push({ id: key, producer: producers.append, inputs: { messages: operation(previous), message: input(key), at: input(`${key}-at`), timeline: input("timeline") }, result: { kind: "output", name: "messages" } });
    previous = key;
  }
  if (!index) throw new Error("MOT Scene requires a Beat.");
  operations.push({ id: "render", producer: producers.render, inputs: { messages: operation(previous), options: input("options"),
    timeline: input("timeline"), within: input("within"), font: input("font"), display: input("display"), window: input("window") }, result: { kind: "output", name: "visual" } });
  const fragment = sealGraphFragment({ inputs, operations, exports: [{ name: "visual", type: compositionTypes.visualTrack, root: operation("render") }] });
  return { records, fragments: [fragment], components:
    [{ id, fragment: fragment.id, inputs: bindings, outputs: { visual: `${id}.visual` }, range: element.range }], exports: [`${id}.visual`] };
};
const declaration = { name: "scene", tag: "Scene", mode: "structured" as const,
  outputs: [compositionTypes.visualTrack, ...Object.values(types)],
  vocabulary: { summary: "A data-led statistics explainer whose beats replace one another on authored times.", attributes: [
    ...temporalContextAttributeVocabulary, ...temporalWindowAttributeVocabulary,
    ...["id", "brand", "within", "font", "display"].map(name => ({ name, kind: "expression" as const, required: true, summary: name })),
    { name: "source", kind: "literal" as const, required: false, summary: "Small source line at the bottom." },
    { name: "transition-frames", kind: "literal" as const, required: false, summary: "Exit duration of each beat; defaults to 10 frames." },
    { name: "captions", kind: "literal" as const, required: false, summary: "startFrame~endFrame~text groups separated by |." },
    { name: "theme", kind: "literal" as const, required: false, summary: "bg1,bg2,highlight,mascotBody colours." },
    { name: "mascot", kind: "literal" as const, required: false, summary: "car or buddy." },
    ...["cover-text", "cover-number", "cover-frames"].map(name => ({ name, kind: "literal" as const, required: false, summary: "Opening cover (thumbnail) settings." })),
  ], children: [{ tag: "Beat", cardinality: "many" as const, summary: "One full-frame state: hook, stat, bars, rank, columns, list, showcase or close.", attributes: [
    ...["id", "kind"].map(name => ({ name, kind: "literal" as const, required: true, summary: name })),
    ...["kicker", "title", "value", "label", "items", "note", "cues", "variants", "bubble", "plate", "tone", "parts", "image"].map(name => ({ name, kind: "literal" as const, required: false, summary: name })),
    ...temporalInstantAttributeVocabulary,
  ] }], ports: [{ name: "visual", type: compositionTypes.visualTrack, summary: "The complete explainer scene." }],
    example: '<mot:Scene id="stats" timeline={clock.timeline} within={canvas.bounds} font={body} display={display} during={clock.window} brand="plateo" source="DVSA"><mot:Beat id="a" kind="stat" value="71.8%" label="pass first time" at={a}/></mot:Scene>',
  },
};
export const hypitPackage = { format: "hypit.package@1" as const, modules: [{ manifest }],
  facets: [createProducerPackageFacet(component), createAdmissionPackageFacet(component),
    createMarkupSurfaceFacet({ module, declaration, handler: decodeSurface })] };
export default hypitPackage;
import { createAdmissionPackageFacet } from "@hypit/hypit/admission";
import { createProducerPackageFacet } from "@hypit/hypit/producer";
