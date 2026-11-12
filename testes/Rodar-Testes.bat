<# : PredictMaint - rodar os testes automatizados (arquivo unico: parte .bat + parte PowerShell)
@echo off
title PredictMaint - Testes automatizados
set "PM_TESTES=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex (${%~f0} | Out-String)"
goto :EOF
#>
# ============================================================
#  PredictMaint - Testes automatizados
#  1. Testes da API: cada funcao e cada permissao (gestor, tecnico, funcionario)
#  2. Testes de tela: um navegador robo usa o sistema como uma pessoa
#  Roda contra o sistema ligado no Docker deste PC.
# ============================================================
$ErrorActionPreference = 'Continue'
$SENHA   = 'senai@123'
$TESTES  = $env:PM_TESTES.TrimEnd('\')
$PROJETO = Split-Path $TESTES -Parent

function Passo($m) { Write-Host "`n==> $m" -ForegroundColor Yellow }
function Ok($m)    { Write-Host "    [OK] $m" -ForegroundColor Green }
function Info($m)  { Write-Host "    [..] $m" -ForegroundColor Cyan }
function Aviso($m) { Write-Host "    [!]  $m" -ForegroundColor Magenta }
function Falha($m) {
    Write-Host "`n    [ERRO] $m" -ForegroundColor Red
    Read-Host "`n    Pressione Enter para fechar"
    exit 1
}
# Confere se o endereco responde 200. Usa o curl.exe do Windows (aceita certificado proprio, TLS 1.2+);
# se nao houver curl, usa o PowerShell com TLS 1.2 e aceitando o certificado.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function NoAr($url) {
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        $codigo = & $curl.Source -k -s -o NUL -w '%{http_code}' --max-time 8 $url 2>$null
        return ($codigo -eq '200')
    }
    try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 8).StatusCode -eq 200 } catch { $false }
}

Write-Host ''
Write-Host '  =============================================' -ForegroundColor White
Write-Host '   PredictMaint - testes automatizados' -ForegroundColor White
Write-Host '  =============================================' -ForegroundColor White

# ---------------------------------------------------------------
Passo '1/5 Conferindo o Node.js e o sistema no ar'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Falha 'Node.js nao encontrado. Rode o Configurar-Ambiente-PredictMaint.bat ou instale em https://nodejs.org' }
Ok "Node.js $(node --version)"

# Usa as portas que o instalador gravou no .env do projeto
$PF = 3000; $PB = 8080
$envArq = Join-Path $PROJETO '.env'
if (Test-Path $envArq) {
    foreach ($l in Get-Content $envArq) {
        if ($l -match '^FRONTEND_HOST_PORT=(\d+)') { $PF = [int]$Matches[1] }
        if ($l -match '^BACKEND_HOST_PORT=(\d+)')  { $PB = [int]$Matches[1] }
    }
}
if (-not $env:API_URL)  { $env:API_URL  = "http://localhost:$PB/api" }
if (-not $env:SITE_URL) { $env:SITE_URL = "http://localhost:$PF" }
# Servidor com certificado proprio ("Nao seguro"): os testes aceitam mesmo assim
if ($env:API_URL -like 'https:*') { $env:NODE_TLS_REJECT_UNAUTHORIZED = '0'; $env:NODE_NO_WARNINGS = '1' }

$remoto = $env:API_URL -notmatch 'localhost|127\.0\.0\.1'
if ($remoto) { [Net.ServicePointManager]::ServerCertificateValidationCallback = { $true } }
if (-not $remoto -and -not (NoAr "$($env:API_URL)/health")) {
    Info 'O sistema esta desligado. Ligando no Docker...'
    Set-Location $PROJETO
    cmd /c "docker compose up -d 2>&1" | Out-Host
    for ($i = 0; $i -lt 36; $i++) { if (NoAr "$($env:API_URL)/health") { break }; Start-Sleep 5 }
}
# Servidor que so responde em http (ou so em https): troca sozinho
if ($remoto -and -not (NoAr "$($env:API_URL)/health")) {
    if ($env:API_URL -like 'https:*') { $alt = 'http:' + $env:API_URL.Substring(6) } else { $alt = 'https:' + $env:API_URL.Substring(5) }
    if (NoAr "$alt/health") {
        Aviso "O servidor respondeu em $alt (troquei http/https sozinho)."
        $env:API_URL = $alt
        if ($env:SITE_URL -like 'https:*') { $env:SITE_URL = 'http:' + $env:SITE_URL.Substring(6) } else { $env:SITE_URL = 'https:' + $env:SITE_URL.Substring(5) }
    }
}
if (-not (NoAr "$($env:API_URL)/health")) { if ($remoto) { Falha "O servidor nao respondeu em $($env:API_URL)/health. Abra esse endereco no navegador: se abrir la, mande um print desta janela." } else { Falha "A API nao respondeu em $($env:API_URL). Ligue o sistema (atalho Iniciar PredictMaint) e rode de novo." } }
Ok "API em $($env:API_URL) | site em $($env:SITE_URL)"

# ---------------------------------------------------------------
Passo '2/5 Banco de dados'
if ($remoto) { $r = 'N'; Info 'Testando o servidor: o banco de la nao e recriado.' }
else { $r = Read-Host '    Recriar o banco com os dados de exemplo antes de testar? Apaga o que foi cadastrado a mao. (S/N) [N]' }
if ($r -match '^[sS]') {
    Set-Location $PROJETO
    foreach ($arq in @('01-schema.sql', '02-seed.sql')) {
        cmd /c "docker compose exec -T -e MYSQL_PWD=$SENHA database mysql -uroot --default-character-set=utf8mb4 < `"database\init\$arq`" 2>&1" | Out-Host
        if ($LASTEXITCODE -ne 0) { Falha "Nao consegui rodar $arq no banco." }
    }
    $hash = '$2b$10$RDn46/1JlpY8lPETAIerHObj.G0LQgjBnFe5CrJLWO1welvMfpP6W'
    cmd /c "docker compose exec -T -e MYSQL_PWD=$SENHA database mysql -uroot -e `"UPDATE predictmaint.usuarios SET senha_hash='$hash' WHERE id > 0`" 2>&1" | Out-Null
    Ok 'Banco recriado com os dados de exemplo (senhas senai@123)'
} else { Ok 'Mantendo os dados atuais (os testes criam registros marcados como TST/Teste e nao apagam nada seu)' }

# ---------------------------------------------------------------
Passo '3/5 Preparando os testes (primeira vez: 1 a 2 minutos)'
Set-Location $TESTES
if (-not (Test-Path (Join-Path $TESTES 'node_modules\@playwright\test'))) {
    cmd /c "npm install --no-audit --no-fund 2>&1" | Out-Host
    if ($LASTEXITCODE -ne 0) { Falha 'Nao consegui instalar as ferramentas de teste (npm install).' }
}
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $env:PW_CHANNEL -and -not $edge) {
    Info 'Microsoft Edge nao encontrado. Baixando o navegador de testes...'
    cmd /c "npx playwright install chromium 2>&1" | Out-Host
    $env:PW_CHANNEL = 'chromium'
}
Ok 'Ferramentas prontas'

# ---------------------------------------------------------------
Passo '4/5 Testes da API (permissoes, cadastros, medicoes, OS, chamados, orcamento, usuarios, avisos)'
cmd /c "npm run api 2>&1" | Out-Host
$apiOk = ($LASTEXITCODE -eq 0)

# ---------------------------------------------------------------
Passo '5/5 Testes de tela (navegador robo no computador e no celular)'
cmd /c "npx playwright test 2>&1" | Out-Host
$telasOk = ($LASTEXITCODE -eq 0)

$relatorio = Join-Path $TESTES 'relatorio-telas\index.html'
if (Test-Path $relatorio) { Start-Process $relatorio }

Write-Host ''
if ($apiOk -and $telasOk) {
    Write-Host '  ======================================================' -ForegroundColor Green
    Write-Host '   TODOS OS TESTES PASSARAM' -ForegroundColor Green
    Write-Host '  ======================================================' -ForegroundColor Green
} else {
    Write-Host '  ======================================================' -ForegroundColor Red
    if (-not $apiOk)   { Write-Host '   Testes da API: FALHARAM (veja as linhas com X acima)' -ForegroundColor Red }
    else               { Write-Host '   Testes da API: ok' -ForegroundColor Green }
    if (-not $telasOk) { Write-Host '   Testes de tela: FALHARAM (o relatorio abriu no navegador, com print de cada falha)' -ForegroundColor Red }
    else               { Write-Host '   Testes de tela: ok' -ForegroundColor Green }
    Write-Host '  ======================================================' -ForegroundColor Red
}
Read-Host "`n  Pressione Enter para fechar"
