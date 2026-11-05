# Video render

Renders short vertical cartoon videos with [Hypit](https://github.com/hypit-ai/hypit), the open Kokoro voice
model and synthesised music. Jobs arrive sealed and finished videos are sealed again before they are stored
on the `out` branch, so nothing readable is kept here.

- `scene/` the cartoon scene component (TypeScript, built against Hypit)
- `tools/` job runner, voice, audio mix and source writer
- `.github/workflows/render.yml` the render job

Hypit is used under the Hypit Open Source License. Kokoro is Apache-2.0. Fonts are SIL Open Font License.
