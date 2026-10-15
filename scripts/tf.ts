/**
 * TaleFrame CLI — 기계적인 일(스캔·변환·검증·업로드)은 전부 여기서 한다.
 * 판단(컷 선택·순서·자막·템플릿)은 travel-story 스킬이 한다.
 *
 *   npm run tf -- status <slug>               어느 단계까지 했는지 (이어서 할 때 가장 먼저)
 *   npm run tf -- scan <폴더> --slug <slug>   원본 폴더 → work/<slug>/inventory.json + 썸네일 + 밀착 인화지
 *   npm run tf -- places <slug>               GPS 묶음 + 장소명 후보 (Nominatim)
 *   npm run tf -- catalog                     템플릿 카탈로그 (필드 포함)
 *   npm run tf -- media <slug>                story.json 이 쓰는 미디어만 웹용으로 변환 → media.json
 *   npm run tf -- weather <slug>              weather-card 의 실측 날씨 → weather.json
 *   npm run tf -- routes <slug> [--force]     map-journey 구간별 실제 길 경로 (OSRM) → routes.json
 *   npm run tf -- validate [slug] [--remote]  스키마 + 참조 + 규칙 검사
 *   npm run tf -- upload <slug> [--prune]     파생 파일 → Supabase Storage
 *   npm run tf -- schema                      content/story.schema.json 갱신
 */
import { fail } from './lib/common';
import { printCatalog, validate, writeSchema } from './lib/check';
import { deriveMedia } from './lib/derive';
import { places } from './lib/places';
import { routes } from './lib/routes';
import { scan } from './lib/scan';
import { status } from './lib/status';
import { upload } from './lib/upload';
import { weather } from './lib/weather';

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--') && !a.includes('=')));
const opt = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--slug');
const need = (v: string | undefined, what: string) => v ?? fail(`${what} 가 필요하다 — scripts/tf.ts 상단 사용법 참고`);

switch (cmd) {
  case 'status':
    status(need(positional[0], 'slug'));
    break;
  case 'scan':
    await scan(need(positional[0], '폴더'), need(opt('--slug'), '--slug'));
    break;
  case 'places':
    await places(need(positional[0], 'slug'));
    break;
  case 'catalog':
    printCatalog();
    break;
  case 'media':
    await deriveMedia(need(positional[0], 'slug'));
    break;
  case 'weather':
    await weather(need(positional[0], 'slug'));
    break;
  case 'routes':
    await routes(need(positional[0], 'slug'), { force: flags.has('--force') });
    break;
  case 'validate':
    await validate(positional, { remote: flags.has('--remote') });
    break;
  case 'upload':
    await upload(need(positional[0], 'slug'), { prune: flags.has('--prune') });
    break;
  case 'schema':
    writeSchema();
    break;
  default:
    fail(`알 수 없는 명령: ${cmd ?? '(없음)'} — scripts/tf.ts 상단 사용법 참고`);
}
