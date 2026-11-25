<# : PredictMaint - configuracao completa do ambiente (arquivo unico: parte .bat + parte PowerShell)
@echo off
title PredictMaint - Configurar ambiente completo
set "PM_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex (${%~f0} | Out-String)"
goto :EOF
#>
# ============================================================
#  PredictMaint - Configuracao completa do ambiente de trabalho
#  Equipe Mantech - padrao do instalador do Leonardo
#  1. Instala o que faltar: Git, Docker Desktop, VS Code, DBeaver e Node.js
#  2. Baixa/atualiza o projeto (branch feat/banco-completo)
#  3. Sobe banco (MySQL 8.4), API e site no Docker Desktop
#  4. Cria atalhos, conexao no DBeaver e abre o VS Code
#  Todas as senhas: senai@123 (banco e logins do site)
#  Pode rodar quantas vezes quiser: pula o que ja esta pronto.
# ============================================================
$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

$SENHA     = 'senai@123'
$REPO      = 'https://github.com/Luiz-sourceDev/PredictMaint-Luiz.git'
$BRANCH    = 'feat/banco-completo'
$BASE      = Join-Path $env:USERPROFILE 'projetos-senai'
$PROJETO   = Join-Path $BASE 'PredictMaint-Luiz'
$NOME_COMPOSE = 'predictmaint-luiz'
$PASTA_BAT = $env:PM_DIR

# Quem assina os commits feitos neste PC (so dentro do projeto)
$GIT_NOME  = 'Luiz-sourceDev'
$GIT_EMAIL = 'luiz.f.reis11@aluno.senai.br'

# Hash bcrypt de "senai@123" (logins do site)
$HASH_SENHA = '$2b$10$RDn46/1JlpY8lPETAIerHObj.G0LQgjBnFe5CrJLWO1welvMfpP6W'

function Passo($m) { Write-Host "`n==> $m" -ForegroundColor Yellow }
function Ok($m)    { Write-Host "    [OK] $m" -ForegroundColor Green }
function Info($m)  { Write-Host "    [..] $m" -ForegroundColor Cyan }
function Aviso($m) { Write-Host "    [!]  $m" -ForegroundColor Magenta }
function Falha($m) {
    Write-Host "`n    [ERRO] $m" -ForegroundColor Red
    Write-Host "    Tire um print desta janela e mande no chat." -ForegroundColor Red
    Read-Host "`n    Pressione Enter para fechar"
    exit 1
}
function PortaAberta($p) {
    $t = New-Object Net.Sockets.TcpClient
    try { $t.Connect('127.0.0.1', $p); $true } catch { $false } finally { $t.Close() }
}
function PortaLivre($inicio) {
    foreach ($p in $inicio..($inicio + 30)) { if (-not (PortaAberta $p)) { return $p } }
    Falha "Nao achei porta livre a partir de $inicio."
}
function RodarDocker([string]$argumentos) {
    $saida = cmd /c "docker $argumentos 2>&1"
    return @{ ok = ($LASTEXITCODE -eq 0); texto = ($saida | Out-String) }
}
function MySqlRoot([string]$sql) {
    $saida = & docker compose exec -T -e "MYSQL_PWD=$SENHA" database mysql -uroot -N -e $sql 2>&1 | Out-String
    return @{ ok = ($LASTEXITCODE -eq 0); texto = $saida }
}
function SitesNoAr($url) {
    try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200 } catch { $false }
}
# Recarrega o PATH depois de instalar programas (sem precisar fechar a janela)
function AtualizarPath {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    foreach ($extra in @((Join-Path $env:ProgramFiles 'Git\cmd'), (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd'),
                         (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'), (Join-Path $env:ProgramFiles 'nodejs'),
                         (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin'))) {
        if ((Test-Path $extra) -and ($env:Path -notlike "*$extra*")) { $env:Path += ";$extra" }
    }
}
$TEM_WINGET = [bool](Get-Command winget -ErrorAction SilentlyContinue)
# Instala com o winget: tenta so para o usuario (sem administrador) e, se nao der, para o computador
function Instalar([string]$id, [string]$nome, [bool]$soMaquina = $false) {
    if (-not $TEM_WINGET) { Aviso "winget nao disponivel: instale o $nome manualmente."; return $false }
    Info "Instalando $nome (pode levar alguns minutos)..."
    $argBase = @('install', '--id', $id, '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
    if (-not $soMaquina) {
        & winget @($argBase + @('--scope', 'user')) | Out-Host
        if ($LASTEXITCODE -eq 0) { AtualizarPath; Ok "$nome instalado"; return $true }
    }
    & winget @argBase | Out-Host
    AtualizarPath
    if ($LASTEXITCODE -eq 0) { Ok "$nome instalado"; return $true }
    Aviso "Nao consegui instalar o $nome automaticamente (o PC pode exigir administrador)."
    return $false
}
function AchaDBeaver {
    @((Join-Path $env:ProgramFiles 'DBeaver\dbeaver.exe'), (Join-Path $env:LOCALAPPDATA 'DBeaver\dbeaver.exe'),
      (Join-Path $env:LOCALAPPDATA 'Programs\DBeaver\dbeaver.exe')) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

Write-Host ''
Write-Host '  =====================================================' -ForegroundColor White
Write-Host '   PredictMaint - configuracao completa do ambiente' -ForegroundColor White
Write-Host '   Equipe Mantech' -ForegroundColor White
Write-Host '  =====================================================' -ForegroundColor White

# ---------------------------------------------------------------
Passo '1/9 Conferindo e instalando os programas'
AtualizarPath
if (-not $TEM_WINGET) { Aviso 'winget (Instalador de Aplicativos) nao encontrado. Vou conferir o que ja existe.' }

if (Get-Command git -ErrorAction SilentlyContinue) { Ok (git --version) }
elseif (-not (Instalar 'Git.Git' 'Git')) { Falha 'Git nao encontrado. Instale em https://git-scm.com e rode de novo.' }

if (Get-Command code -ErrorAction SilentlyContinue) { Ok 'VS Code ja instalado' }
else { Instalar 'Microsoft.VisualStudioCode' 'VS Code' | Out-Null }

if (AchaDBeaver) { Ok 'DBeaver ja instalado' }
else { Instalar 'DBeaver.DBeaver.Community' 'DBeaver' | Out-Null }

if (Get-Command node -ErrorAction SilentlyContinue) { Ok "Node.js $(node --version)" }
else { Instalar 'OpenJS.NodeJS.LTS' 'Node.js LTS' | Out-Null }

$ddExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if ((Get-Command docker -ErrorAction SilentlyContinue) -or (Test-Path $ddExe)) { Ok 'Docker Desktop ja instalado' }
else {
    Aviso 'O Docker Desktop precisa de administrador. Se o Windows pedir permissao, clique em Sim.'
    if (Instalar 'Docker.DockerDesktop' 'Docker Desktop' $true) {
        Write-Host ''
        Write-Host '    O Docker Desktop foi instalado.' -ForegroundColor Green
        Write-Host '    1) REINICIE o computador.' -ForegroundColor Green
        Write-Host '    2) Abra o Docker Desktop, aceite os termos e espere "Engine running".' -ForegroundColor Green
        Write-Host '    3) Rode este instalador de novo (ele continua de onde parou).' -ForegroundColor Green
        Read-Host "`n    Pressione Enter para fechar"
        exit 0
    }
    Falha 'Docker Desktop nao encontrado e nao consegui instalar. Peca ao tecnico do laboratorio ou instale em https://www.docker.com/products/docker-desktop'
}

# ---------------------------------------------------------------
Passo '2/9 Ligando o Docker Desktop'
cmd /c "docker info >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
    if (Test-Path $ddExe) {
        Info 'Abrindo o Docker Desktop (pode levar 1 ou 2 minutos)...'
        Start-Process $ddExe
    } else {
        Aviso 'Abra o Docker Desktop manualmente.'
    }
    $ok = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep 5
        AtualizarPath
        cmd /c "docker info >nul 2>&1"
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    }
    if (-not $ok) { Falha 'O Docker Desktop nao ficou pronto. Abra ele, aceite os termos, espere aparecer "Engine running" e rode este instalador de novo. Se ele pedir WSL, rode no PowerShell: wsl --update' }
}
Ok 'Docker Desktop rodando'
cmd /c "docker compose version >nul 2>&1"
if ($LASTEXITCODE -ne 0) { Falha 'O "docker compose" nao esta disponivel. Atualize o Docker Desktop.' }

# ---------------------------------------------------------------
Passo '3/9 Baixando / atualizando o projeto (versao mais nova do GitHub)'
New-Item -ItemType Directory -Force -Path $BASE | Out-Null
if (Test-Path (Join-Path $PROJETO '.git')) {
    Set-Location $PROJETO
    git fetch origin --prune 2>&1 | Out-Null
    git checkout $BRANCH 2>&1 | Out-Null
    git pull --ff-only origin $BRANCH 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Aviso 'Nao consegui atualizar (tem alteracoes locais?). Vou usar os arquivos que ja estao na pasta.' }
} else {
    git clone $REPO $PROJETO
    if ($LASTEXITCODE -ne 0) { Falha 'Nao consegui baixar o projeto do GitHub. Verifique a internet.' }
    Set-Location $PROJETO
    git checkout $BRANCH 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Aviso "Branch $BRANCH nao existe mais, usando a main." }
}
git config user.name  $GIT_NOME  2>&1 | Out-Null
git config user.email $GIT_EMAIL 2>&1 | Out-Null
Ok "Projeto em $PROJETO ($(git rev-parse --abbrev-ref HEAD), commits como $GIT_NOME)"

# ---------------------------------------------------------------
Passo '4/9 Parando a versao anterior (se existir) e escolhendo portas'
$env:COMPOSE_PROJECT_NAME = $NOME_COMPOSE
RodarDocker 'compose down' | Out-Null

$volumeJaExistia = [bool](cmd /c "docker volume ls -q" | Where-Object { $_ -eq "${NOME_COMPOSE}_mysql-data" })
if ($volumeJaExistia) {
    $r = Read-Host '    O banco ja existe de uma instalacao anterior. Recriar do zero com os dados de exemplo? (S/N) [N]'
    if ($r -match '^[sS]') {
        RodarDocker "volume rm ${NOME_COMPOSE}_mysql-data" | Out-Null
        $volumeJaExistia = $false
        Ok 'Banco antigo apagado. Ele sera criado de novo.'
    } else { Ok 'Mantendo o banco que ja existe.' }
}

$PF = PortaLivre 3000
$PB = PortaLivre 8080
$PD = PortaLivre 3306

function GravarEnv {
    $envTxt = @"
COMPOSE_PROJECT_NAME=$NOME_COMPOSE

FRONTEND_HOST_PORT=$PF
BACKEND_HOST_PORT=$PB
DATABASE_HOST_PORT=$PD

FRONTEND_PORT=3000
BACKEND_PORT=8080

FRONTEND_URL=http://localhost:$PF
NEXT_PUBLIC_API_URL=http://localhost:$PB/api

MYSQL_ROOT_PASSWORD=$SENHA
MYSQL_DATABASE=predictmaint
MYSQL_USER=app_user
MYSQL_PASSWORD=$SENHA

DB_HOST=database
DB_PORT=3306
DB_USER=app_user
DB_PASSWORD=$SENHA
DB_NAME=predictmaint

JWT_SECRET=predictmaint-senai-mantech-2026-segredo-do-token-jwt
TZ=America/Sao_Paulo
"@
    [IO.File]::WriteAllText((Join-Path $PROJETO '.env'), ($envTxt -replace "`r?`n", "`r`n"))
}
GravarEnv
Ok "Portas: site $PF | API $PB | banco $PD"

# ---------------------------------------------------------------
Passo '5/9 Montando e subindo os containers (primeira vez: 5 a 10 minutos)'
$subiu = $false
for ($tentativa = 1; $tentativa -le 3; $tentativa++) {
    $log = Join-Path $env:TEMP 'predictmaint-compose.log'
    cmd /c "docker compose up -d --build 2>&1" | Tee-Object -FilePath $log | Out-Host
    if ($LASTEXITCODE -eq 0) { $subiu = $true; break }
    $texto = Get-Content $log -Raw
    if ($texto -match 'port is already allocated|ports are not available|address already in use|bind:') {
        Aviso 'Uma das portas esta bloqueada no Windows. Tentando outras portas...'
        RodarDocker 'compose down' | Out-Null
        $PF = PortaLivre ($PF + 1); $PB = PortaLivre ($PB + 1); $PD = PortaLivre ($PD + 1)
        GravarEnv
        Ok "Novas portas: site $PF | API $PB | banco $PD"
        continue
    }
    if ($texto -match 'unhealthy|dependency failed') {
        Aviso 'O banco ainda esta sendo criado. Esperando 30 segundos e tentando de novo...'
        Start-Sleep 30
        continue
    }
    break
}
if (-not $subiu) { Falha 'O Docker nao conseguiu subir os containers. Veja as mensagens acima.' }
Ok 'Containers no ar: database, backend, frontend'

# ---------------------------------------------------------------
Passo '6/9 Esperando o banco ficar pronto'
$pronto = $false; $negado = 0
for ($i = 0; $i -lt 72; $i++) {
    $r = MySqlRoot 'SELECT COUNT(*) FROM predictmaint.usuarios'
    if ($r.ok) { $pronto = $true; break }
    if ($r.texto -match 'Access denied') { $negado++ } else { $negado = 0 }
    if ($negado -ge 18) { break }
    Start-Sleep 5
}
if (-not $pronto -and $negado -ge 18) {
    Aviso 'O banco que ja existia usa outra senha.'
    $r = Read-Host '    Recriar o banco do zero com a senha senai@123? (S/N)'
    if ($r -notmatch '^[sS]') { Falha 'Sem recriar o banco nao da para continuar com a senha senai@123.' }
    RodarDocker 'compose down -v' | Out-Null
    cmd /c "docker compose up -d 2>&1" | Out-Host
    for ($i = 0; $i -lt 72; $i++) {
        Start-Sleep 5
        $r = MySqlRoot 'SELECT COUNT(*) FROM predictmaint.usuarios'
        if ($r.ok) { $pronto = $true; break }
    }
}
if (-not $pronto) {
    cmd /c "docker compose logs --tail 25 database 2>&1" | Out-Host
    Falha 'O banco nao ficou pronto. Veja o log acima.'
}
Ok "Banco predictmaint pronto (root / $SENHA e app_user / $SENHA)"

# ---------------------------------------------------------------
Passo '7/9 Deixando os logins do site com a senha senai@123'
$r = MySqlRoot "UPDATE predictmaint.usuarios SET senha_hash = '$HASH_SENHA' WHERE id > 0"
if (-not $r.ok) { Falha "Nao consegui atualizar as senhas: $($r.texto)" }
Ok 'admin@, tecnico@ e funcionario@mantech.com.br com senha senai@123'

# ---------------------------------------------------------------
Passo '8/9 Testando a API e o site'
$api = "http://localhost:$PB/api/health"
$site = "http://localhost:$PF"
$okApi = $false
for ($i = 0; $i -lt 36; $i++) { if (SitesNoAr $api) { $okApi = $true; break }; Start-Sleep 5 }
if ($okApi) { Ok "API respondendo em $api" } else {
    cmd /c "docker compose logs --tail 20 backend 2>&1" | Out-Host
    Aviso 'A API ainda nao respondeu. Veja o log acima.'
}
$okSite = $false
for ($i = 0; $i -lt 36; $i++) { if (SitesNoAr $site) { $okSite = $true; break }; Start-Sleep 5 }
if ($okSite) { Ok "Site respondendo em $site" } else { Aviso 'O site ainda nao respondeu. Espere um pouco e abra no navegador.' }

# ---------------------------------------------------------------
Passo '9/9 Atalhos, DBeaver e VS Code'
$desktop = [Environment]::GetFolderPath('Desktop')
$iniciar = @"
@echo off
title Iniciar PredictMaint
echo Ligando o PredictMaint no Docker...
docker info >nul 2>&1
if errorlevel 1 start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
:espera
docker info >nul 2>&1
if errorlevel 1 (timeout /t 5 >nul & goto espera)
cd /d "$PROJETO"
docker compose up -d
echo Aguardando o site...
timeout /t 15 >nul
start $site
"@
$parar = @"
@echo off
title Parar PredictMaint
cd /d "$PROJETO"
docker compose stop
echo PredictMaint parado. Os dados do banco continuam salvos.
pause
"@
[IO.File]::WriteAllText((Join-Path $desktop 'Iniciar PredictMaint.bat'), ($iniciar -replace "`r?`n", "`r`n"))
[IO.File]::WriteAllText((Join-Path $desktop 'Parar PredictMaint.bat'),   ($parar   -replace "`r?`n", "`r`n"))
$testar = "@echo off`r`ncall `"$PROJETO\testes\Rodar-Testes.bat`"`r`n"
if (Test-Path (Join-Path $PROJETO 'testes\Rodar-Testes.bat')) { [IO.File]::WriteAllText((Join-Path $desktop 'Testar PredictMaint.bat'), $testar) }
Ok "Atalhos 'Iniciar', 'Parar' e 'Testar PredictMaint' na Area de Trabalho"

$sqlTeste = $null
# Consultas de teste: usa a do projeto (sempre a mais nova); se nao tiver, a que veio com o instalador
$origemSql = Join-Path $PROJETO 'database\testes-banco.sql'
if (-not (Test-Path $origemSql) -and $PASTA_BAT) { $origemSql = Join-Path $PASTA_BAT 'testes-banco.sql' }
if (Test-Path $origemSql) {
    $sqlTeste = Join-Path $BASE 'testes-banco.sql'
    Copy-Item $origemSql $sqlTeste -Force
    Ok "Consultas de teste copiadas para $sqlTeste"
} else {
    Aviso 'Nao achei o testes-banco.sql (nem no projeto nem ao lado do instalador).'
}

# Conexao pronta no DBeaver (so cria se ainda nao existir)
$dbeaverExe = @(
    (Join-Path $env:ProgramFiles 'DBeaver\dbeaver.exe'),
    (Join-Path $env:LOCALAPPDATA 'DBeaver\dbeaver.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\DBeaver\dbeaver.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($dbeaverExe) {
    if (Get-Process dbeaver -ErrorAction SilentlyContinue) {
        Aviso 'O DBeaver esta aberto. Feche ele e rode o instalador de novo para criar a conexao automatica.'
    } else {
        try {
            $dsDir  = Join-Path $env:APPDATA 'DBeaverData\workspace6\General\.dbeaver'
            $dsFile = Join-Path $dsDir 'data-sources.json'
            New-Item -ItemType Directory -Force -Path $dsDir | Out-Null
            if (Test-Path $dsFile) { $ds = Get-Content $dsFile -Raw | ConvertFrom-Json } else { $ds = [pscustomobject]@{ folders = [pscustomobject]@{}; connections = [pscustomobject]@{} } }
            if (-not $ds.connections) { $ds | Add-Member -NotePropertyName connections -NotePropertyValue ([pscustomobject]@{}) -Force }
            $conexao = [pscustomobject]@{
                provider = 'mysql'; driver = 'mysql8'; name = 'PredictMaint (Docker)'
                'save-password' = $false
                configuration = [pscustomobject]@{
                    host = '127.0.0.1'; port = "$PD"; database = 'predictmaint'
                    url = "jdbc:mysql://127.0.0.1:$PD/predictmaint"
                    configurationType = 'MANUAL'; type = 'dev'; 'auth-model' = 'native'; user = 'root'
                    properties = [pscustomobject]@{ allowPublicKeyRetrieval = 'true'; useSSL = 'false' }
                }
            }
            $ds.connections | Add-Member -NotePropertyName 'predictmaint-docker' -NotePropertyValue $conexao -Force
            [IO.File]::WriteAllText($dsFile, ($ds | ConvertTo-Json -Depth 10))
            Ok "DBeaver: conexao 'PredictMaint (Docker)' criada (porta $PD, usuario root, senha $SENHA)"
        } catch { Aviso "Nao consegui criar a conexao no DBeaver: $($_.Exception.Message)" }
    }
} else {
    Aviso 'DBeaver nao encontrado. Os dados de conexao estao no resumo abaixo.'
}

$wb = Get-ChildItem (Join-Path $env:ProgramFiles 'MySQL') -Filter 'MySQLWorkbench.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($wb) { Info 'MySQL Workbench tambem encontrado (use Host 127.0.0.1, usuario root, senha senai@123).' }

# Abre o projeto no VS Code para trabalhar
$code = Get-Command code -ErrorAction SilentlyContinue
if ($code) { Start-Process -FilePath $code.Source -ArgumentList "`"$PROJETO`"" -WindowStyle Hidden; Ok 'Projeto aberto no VS Code' }

Start-Process $site

Write-Host ''
Write-Host '  ======================================================' -ForegroundColor Green
Write-Host '   TUDO PRONTO!' -ForegroundColor Green
Write-Host ''
Write-Host "   Site ........ $site"
Write-Host "   API ......... $api"
Write-Host ''
Write-Host "   Logins do site (senha de todos: $SENHA)"
Write-Host '     Gestor ......... admin@mantech.com.br'
Write-Host '     Tecnico ........ tecnico@mantech.com.br'
Write-Host '     Funcionario .... funcionario@mantech.com.br'
Write-Host ''
Write-Host '   DBeaver (conexao "PredictMaint (Docker)") / Workbench'
Write-Host "     Host 127.0.0.1 | Porta $PD | Usuario root | Senha $SENHA"
Write-Host '     Banco: predictmaint'
Write-Host ''
Write-Host "   Projeto ..... $PROJETO"
Write-Host '   Ligar de novo: atalho "Iniciar PredictMaint" na Area de Trabalho'
Write-Host '   Desligar:      atalho "Parar PredictMaint"'
Write-Host '  ======================================================' -ForegroundColor Green
Read-Host "`n  Pressione Enter para fechar"
