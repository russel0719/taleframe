#!/usr/bin/env bash
# Windows 바탕 화면의 "TaleFrame Studio.cmd" 가 부른다 (scripts/studio-desktop.sh 가 만든 것).
# 로그인 셸(bash -l)로 불려야 ~/.local/bin 의 claude 가 PATH 에 들어온다.
set -euo pipefail
cd "$(dirname "$0")/.."
exec npm run -s studio -- --lan --open
