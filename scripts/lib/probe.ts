import { FFPROBE, run } from './common';

export type VideoProbe = {
  width: number;
  height: number;
  duration: number;
  fps: number;
  /** 디코딩 가능한 첫 오디오 스트림의 전역 인덱스 (없으면 null) */
  audioIndex: number | null;
  hdr: boolean;
  /** 현지 시각 ISO (오프셋 포함) */
  takenAt: string | null;
  gps: { lat: number; lng: number } | null;
  tags: Record<string, string>;
};

type Stream = {
  index: number;
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  color_transfer?: string;
  side_data_list?: { rotation?: number }[];
  tags?: Record<string, string>;
};

const DECODABLE_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis', 'pcm_s16le', 'pcm_s24le', 'alac', 'ac3', 'eac3', 'flac']);

export async function probeVideo(file: string): Promise<VideoProbe> {
  const out = await run(FFPROBE, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]);
  const j = JSON.parse(out.toString()) as { streams: Stream[]; format: { duration?: string; tags?: Record<string, string> } };
  const v = j.streams.find((s) => s.codec_type === 'video' && s.width);
  if (!v) throw new Error(`영상 스트림이 없다: ${file}`);
  const rotation = Math.abs(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0) % 180;
  const [num, den] = (v.r_frame_rate ?? '30/1').split('/').map(Number);
  const audio = j.streams.find((s) => s.codec_type === 'audio' && DECODABLE_AUDIO.has(s.codec_name ?? ''));
  const tags = j.format.tags ?? {};
  return {
    width: rotation === 90 ? v.height! : v.width!,
    height: rotation === 90 ? v.width! : v.height!,
    duration: Number(j.format.duration ?? 0),
    fps: den ? num / den : 30,
    audioIndex: audio ? audio.index : null,
    hdr: ['arib-std-b67', 'smpte2084'].includes(v.color_transfer ?? ''),
    takenAt: parseQuickTimeDate(tags['com.apple.quicktime.creationdate'] ?? tags.creation_time),
    gps: parseIso6709(tags['com.apple.quicktime.location.ISO6709'] ?? tags.location),
    tags,
  };
}

/** "2026-02-07T09:32:19+0900" → "2026-02-07T09:32:19+09:00" */
function parseQuickTimeDate(s?: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/);
  if (!m) return null;
  const off = m[2] ?? 'Z';
  return m[1] + (off === 'Z' ? 'Z' : off.replace(/^([+-]\d{2}):?(\d{2})$/, '$1:$2'));
}

/** "+34.9680+135.7758+056.891/" */
function parseIso6709(s?: string): { lat: number; lng: number } | null {
  const m = s?.match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

/** 출력 파일에 위치·기기 정보가 남았는지 — 공개 사이트라 반드시 비어 있어야 한다 */
export async function leakedTags(file: string): Promise<string[]> {
  const out = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format_tags:stream_tags', '-of', 'json', file]);
  const text = out.toString();
  return ['location', 'ISO6709', 'com.apple.quicktime.make', 'com.apple.quicktime.model', 'creationdate'].filter((k) =>
    text.includes(k),
  );
}
