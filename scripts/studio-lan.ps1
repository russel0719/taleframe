# TaleFrame Studio : 폰(같은 와이파이)에서 PC 의 Studio(기본 TCP 8742)에 접속하게 방화벽을 연다.
#
# WSL 에서 `scripts/studio-lan.sh` 를 실행하면 이 스크립트가 관리자 권한으로 뜬다.
# WSL 은 이미 mirrored 네트워킹이어야 한다 (.wslconfig 는 건드리지 않고, WSL 재시작도 하지 않는다).
#
# 이 파일은 반드시 UTF-8 BOM 으로 저장한다 — Windows PowerShell 5.1 은 BOM 이 없으면 한글을 CP949 로 읽는다.

param([int]$Port = 8742)
$ErrorActionPreference = "Stop"
# WSL 터미널로 나가는 출력이 CP949 로 깨지지 않게 (승격 전 첫 안내가 깨져 보였다)
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Admin {
  return ([Security.Principal.WindowsPrincipal] `
      [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
if (-not (Admin)) {
  Write-Host "관리자 권한이 필요합니다. 승격을 요청합니다..." -ForegroundColor Yellow
  Start-Process powershell -Verb RunAs -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"", "-Port", $Port)
  exit
}

Write-Host ""
Write-Host "TaleFrame Studio - 폰에서 접속할 수 있게 방화벽을 엽니다 (TCP $Port)" -ForegroundColor Cyan
Write-Host ""

$wslVm = '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'  # WSL 고정 VMCreatorId
$rule  = "taleframe-studio-$Port"

# (1) Hyper-V 방화벽 - mirrored 모드의 WSL 은 이 뒤에 있다. 없으면 연결이 조용히 거부된다
if (-not (Get-Command New-NetFirewallHyperVRule -ErrorAction SilentlyContinue)) {
  Write-Warning "[1/2] New-NetFirewallHyperVRule 이 없습니다 (Windows 11 22H2+ 필요)."
} elseif (Get-NetFirewallHyperVRule -Name $rule -ErrorAction SilentlyContinue) {
  Write-Host "[1/2] 방화벽(Hyper-V) - 규칙이 이미 있습니다."
} else {
  New-NetFirewallHyperVRule -Name $rule -DisplayName "TaleFrame Studio ($Port)" `
    -Direction Inbound -VMCreatorId $wslVm -Protocol TCP -LocalPorts $Port -Action Allow | Out-Null
  Write-Host "[1/2] 방화벽(Hyper-V) - 인바운드 TCP $Port 를 열었습니다."
}

# (2) 호스트 방화벽 - 개인 네트워크(집 와이파이)에서만. 카페·공항 와이파이에서는 열리지 않는다
if (Get-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue) {
  Write-Host "[2/2] 방화벽(호스트) - 규칙이 이미 있습니다."
} else {
  New-NetFirewallRule -Name $rule -DisplayName "TaleFrame Studio ($Port)" `
    -Direction Inbound -Protocol TCP -LocalPort $Port -Profile Private -Action Allow | Out-Null
  Write-Host "[2/2] 방화벽(호스트) - 개인 네트워크에서만 TCP $Port 를 열었습니다."
}

$profiles = Get-NetConnectionProfile | ForEach-Object { "$($_.Name)=$($_.NetworkCategory)" }
Write-Host ""
Write-Host "현재 네트워크: $($profiles -join ', ')"
Write-Host "집 와이파이가 Public 이면 Windows 설정 > 네트워크 > 속성에서 '개인 네트워크'로 바꿉니다." -ForegroundColor Yellow
Write-Host ""
Write-Host "되돌리려면 (관리자 PowerShell):" -ForegroundColor DarkGray
Write-Host "    Remove-NetFirewallRule -Name '$rule'; Remove-NetFirewallHyperVRule -Name '$rule'" -ForegroundColor DarkGray
Write-Host ""
Read-Host "엔터를 누르면 이 창이 닫힙니다"
