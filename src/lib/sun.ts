/**
 * 일출·일몰 시각 (현지 시각, 시간 단위 소수). 하루 시계(day-clock)의 하늘색에 쓴다.
 * 표준 일출 방정식 — 오차 수 분. 네트워크 없이 계산하므로 과거 날짜도 그대로 된다.
 */
const RAD = Math.PI / 180;

export function sunTimes(date: string, lat: number, lng: number, utcOffset = Math.round(lng / 15)): { rise: number; set: number } | null {
  const [y, m, d] = date.split('-').map(Number);
  // J2000(정오) 이후 날짜 수 — 정수여야 그날 정오 기준이 된다
  const n = Math.ceil(Date.UTC(y, m - 1, d) / 86400000 + 2440587.5 - 2451545.0 + 0.0008);
  const jStar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec);
  if (cosH < -1 || cosH > 1) return null; // 백야·극야
  const h = Math.acos(cosH) / RAD / 360;
  const local = (j: number) => {
    const hours = ((j - 2440587.5) * 24 + utcOffset) % 24;
    return hours < 0 ? hours + 24 : hours;
  };
  return { rise: local(transit - h), set: local(transit + h) };
}

/** "HH:MM" 또는 taken "YYYY-MM-DDTHH:MM" → 시간 단위 소수 */
export function hoursOf(t: string): number {
  const hm = t.includes('T') ? t.split('T')[1] : t;
  const [hh, mm] = hm.split(':').map(Number);
  return hh + mm / 60;
}

type Rgb = [number, number, number];
const hex = (c: string): Rgb => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as Rgb;
const mix = (a: Rgb, b: Rgb, t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

const NIGHT: [string, string] = ['#070b1c', '#141a33'];
const DAWN: [string, string] = ['#3d4f87', '#f2a07b'];
const DAY: [string, string] = ['#3f86d0', '#a9d3f2'];
const DUSK: [string, string] = ['#3b3a74', '#f08a5d'];

/** 시각 h 의 하늘 — [위, 아래] 두 색. 일출·일몰 앞뒤로 새벽·노을을 지난다 */
export function skyAt(h: number, sun: { rise: number; set: number } | null): [string, string] {
  const rise = sun?.rise ?? 6;
  const set = sun?.set ?? 18;
  const keys: [number, [string, string]][] = [
    [0, NIGHT],
    [rise - 1, NIGHT],
    [rise, DAWN],
    [rise + 1.5, DAY],
    [set - 1.5, DAY],
    [set, DUSK],
    [set + 1, NIGHT],
    [24, NIGHT],
  ];
  for (let i = 1; i < keys.length; i++) {
    const [h1, c1] = keys[i];
    const [h0, c0] = keys[i - 1];
    if (h <= h1) {
      const t = h1 === h0 ? 1 : Math.min(1, Math.max(0, (h - h0) / (h1 - h0)));
      return [mix(hex(c0[0]), hex(c1[0]), t), mix(hex(c0[1]), hex(c1[1]), t)];
    }
  }
  return NIGHT;
}
