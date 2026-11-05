// Speaks every sentence of a video script with the open Kokoro voice model (runs on the CPU, no account needed).
// The model weights come from the npm package kokoro-q8-shards and are checked against a fixed SHA-256,
// so the voice is always the same file that was tested.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODEL_SHA = 'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478';
const require = createRequire(import.meta.url);

/** Builds the local model folder once (config, tokenizer and the reassembled weights). */
export function prepareModel(cacheDir) {
  const dir = path.join(cacheDir, 'kokoro-model');
  const onnx = path.join(dir, 'onnx', 'model_quantized.onnx');
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  if (fs.existsSync(onnx) && sha(onnx) === MODEL_SHA) return cacheDir;
  fs.mkdirSync(path.dirname(onnx), { recursive: true });
  for (const f of ['config.json', 'tokenizer.json', 'tokenizer_config.json']) fs.copyFileSync(path.join(HERE, '..', 'assets', 'kokoro', f), path.join(dir, f));
  const shards = path.dirname(require.resolve('kokoro-q8-shards/package.json'));
  const parts = fs.readdirSync(shards).filter(f => /^kokoro-q8\.part\d+\.bin$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  fs.writeFileSync(onnx, Buffer.concat(parts.map(p => fs.readFileSync(path.join(shards, p)))));
  if (sha(onnx) !== MODEL_SHA) { fs.rmSync(onnx, { force: true }); throw new Error('voice model checksum did not match'); }
  return cacheDir;
}

let tts = null;
export async function speakAll(script, outDir, cacheDir) {
  const { env } = await import('@huggingface/transformers');
  const { KokoroTTS } = await import('kokoro-js');
  env.localModelPath = prepareModel(cacheDir);
  env.allowRemoteModels = false;
  if (!tts) tts = await KokoroTTS.from_pretrained('kokoro-model', { dtype: 'q8', device: 'cpu' });
  fs.mkdirSync(outDir, { recursive: true });
  const voice = script.voice || 'af_heart';
  for (const beat of script.beats) {
    for (const [i, s] of beat.sentences.entries()) {
      const text = s.groups.map(g => g[1]).join(' ');
      const audio = await tts.generate(text, { voice, speed: script.speed || 1.06 });
      await audio.save(path.join(outDir, `${beat.id}-${i}.wav`));
    }
  }
}
