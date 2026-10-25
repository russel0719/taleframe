#!/usr/bin/env bash
# 폰(집 와이파이)에서 TaleFrame Studio 에 접속할 수 있게 Windows 방화벽을 연다. WSL 안에서 한 번 실행한다.
#
#   scripts/studio-lan.sh          기본 포트 8742
#   scripts/studio-lan.sh 9000     포트 지정 (TALEFRAME_STUDIO_PORT 와 맞춘다)
#
# 방화벽은 Windows 쪽 일이라 관리자 PowerShell 이 필요하다. .ps1 을 Windows 임시폴더로 복사해 띄우고,
# 승격(UAC)은 .ps1 이 스스로 요청한다 (WSL 경로는 Windows 에서 UNC 라 실행 정책에 걸릴 수 있다).
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-${TALEFRAME_STUDIO_PORT:-8742}}"
PS="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
[ -x "$PS" ] || { echo "powershell.exe 를 찾을 수 없다. WSL 이 맞나?"; exit 1; }

case "$(ip route get 1.1.1.1 2>/dev/null | grep -o 'src [0-9.]*' | cut -d' ' -f2)" in
  172.*) echo "⚠ WSL 이 NAT 모드(172.x)다 — 폰에서 닿지 않는다. .wslconfig 에 networkingMode=mirrored 가 먼저 필요하다."; exit 1 ;;
esac

WIN_TEMP="$("$PS" -NoProfile -Command '$env:TEMP' 2>/dev/null </dev/null | tr -d '\r')"
[ -n "$WIN_TEMP" ] || { echo "Windows TEMP 를 알아내지 못했다."; exit 1; }
cp "$DIR/scripts/studio-lan.ps1" "$(wslpath -u "$WIN_TEMP")/taleframe-studio-lan.ps1"

cat <<MSG

Windows 방화벽에 TCP $PORT 인바운드 규칙 2개를 만든다 (Hyper-V + 개인 네트워크 전용).
곧 관리자 권한 요청(UAC) 창이 뜬다. WSL 재시작은 하지 않는다.

MSG
ans=""
if [ -t 0 ]; then read -r -p "계속할까? (y/N) " ans || true
elif { : < /dev/tty; } 2>/dev/null; then read -r -p "계속할까? (y/N) " ans < /dev/tty || true
else echo "터미널이 없어 확인을 받을 수 없다. WSL 터미널에서 직접 실행한다."; exit 1; fi
case "$ans" in y|Y) ;; *) echo "취소했다."; exit 0 ;; esac

cd /mnt/c
"$PS" -NoProfile -ExecutionPolicy Bypass -File "$WIN_TEMP\\taleframe-studio-lan.ps1" -Port "$PORT" </dev/null || true
echo
echo "다음: cd ~/workspace/taleframe && npm run studio -- --lan  → 터미널의 QR 을 폰으로 찍는다"
