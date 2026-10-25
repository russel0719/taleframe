#!/usr/bin/env bash
# Windows 바탕 화면에 "TaleFrame Studio.cmd" 를 만든다 — 더블클릭하면 창이 열리고 Studio 가 떠서 QR 이 나온다.
# 창을 닫으면 Studio 도 꺼진다. 이미 떠 있으면 브라우저로 연결 화면(QR)을 연다. WSL 안에서 한 번 실행한다.
#
# (.ps1 은 더블클릭하면 실행되지 않고 메모장으로 열리는 게 Windows 기본값이라 .cmd 로 만든다)
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PS="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
[ -x "$PS" ] && [ -n "${WSL_DISTRO_NAME:-}" ] || { echo "WSL 안에서 실행한다."; exit 1; }

# 바탕 화면은 OneDrive 아래일 수도, 한글 이름일 수도 있다 — Windows 에 직접 묻는다 (UTF-8 로)
DESKTOP="$("$PS" -NoProfile -Command '[Console]::OutputEncoding=[Text.Encoding]::UTF8; [Environment]::GetFolderPath("Desktop")' </dev/null | tr -d '\r')"
[ -n "$DESKTOP" ] || { echo "바탕 화면 위치를 알아내지 못했다."; exit 1; }
OUT="$(wslpath -u "$DESKTOP")/TaleFrame Studio.cmd"

# cmd 파일 안에는 한글을 넣지 않는다 (코드 페이지에 따라 깨진다). 안내 문구는 Studio 가 출력한다
printf '%s\r\n' \
  '@echo off' \
  'chcp 65001 >nul' \
  'title TaleFrame Studio' \
  "wsl.exe -d $WSL_DISTRO_NAME -- bash -lc \"'$DIR/scripts/studio-start.sh'\"" \
  'echo.' \
  'pause' > "$OUT"

echo "✓ 만들었다: $DESKTOP\\TaleFrame Studio.cmd"
echo "  더블클릭 → 창에 QR. 끄려면 창을 닫는다."
