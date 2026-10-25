/**
 * TaleFrame Studio — 폰에서 사진을 올리고, headless Claude 의 질문에 답하고, 미리보기를 확인하고 게시한다.
 * PC(WSL)에서 돈다. 집 와이파이 전용.
 *
 *   npm run studio            이 PC 에서만 (http://127.0.0.1:8742)
 *   npm run studio -- --lan   집 와이파이의 폰에서도 (토큰 필요 — 터미널 QR 이나 PC 의 /connect 화면 QR 로 들어온다)
 *
 * 처음 한 번: scripts/studio-lan.sh 로 Windows 방화벽(개인 네트워크 전용)을 연다.
 */
import { serve } from '@hono/node-server';
import QRCode from 'qrcode';
import { createApp } from './app';
import { PORT, lanAddress, token } from './config';

const LAN = process.argv.includes('--lan');
const TOKEN = token();
const app = createApp({ lan: LAN, token: TOKEN });
const hostname = LAN ? '0.0.0.0' : '127.0.0.1';
const server = serve({ fetch: app.fetch, port: PORT, hostname }, async () => {
  console.log(`TaleFrame Studio — http://127.0.0.1:${PORT}/  (이 PC)`);
  if (LAN) {
    const host = lanAddress();
    if (!host) {
      console.log('· 와이파이 주소를 못 찾았다 — WSL 이 mirrored 네트워킹인지 확인한다');
    } else {
      const url = `http://${host}:${PORT}/?k=${TOKEN}`;
      console.log(`폰: 같은 와이파이에서 아래 QR 을 찍는다 (또는 PC 브라우저로 http://127.0.0.1:${PORT}/connect)`);
      console.log(await QRCode.toString(url, { type: 'terminal', small: true }));
      console.log(`  ${url.replace(TOKEN, '<토큰>')}`);
    }
  }
});

// 이미 다른 Studio(예: 백그라운드로 띄운 것)가 포트를 쓰고 있으면 오류 대신 안내만 한다
server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log(`${PORT} 포트를 이미 쓰고 있다 — Studio 가 벌써 떠 있을 가능성이 크다.`);
  console.log(`  · 떠 있는 것을 그대로 쓰려면: PC 브라우저로 http://127.0.0.1:${PORT}/connect 를 열어 QR 을 찍는다`);
  console.log(`  · 끄고 다시 띄우려면: fuser -k ${PORT}/tcp && npm run studio -- --lan`);
  process.exit(1);
});
