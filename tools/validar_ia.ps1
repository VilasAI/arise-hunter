# Validacao do Bloco 3 (IA): corre tests/ia.html headless e exige PASS deterministico.
param(
  [string]$Raiz = (Split-Path $PSScriptRoot -Parent),
  [int]$Porta = 4174,
  [int]$Seed = 123
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Confirmar([bool]$condicao, [string]$mensagem){ if(-not $condicao){ throw $mensagem } }

$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
Confirmar ([bool]$browser) 'Chrome/Edge não encontrado para o teste headless.'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$perfil = Join-Path ([IO.Path]::GetTempPath()) ("vigilia-ia-"+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $perfil | Out-Null
$servidor = $null

function Obter-Dom([string]$url){
  $comuns=@('--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',
    '--no-first-run','--no-default-browser-check','--disable-logging','--log-level=3',
    "--user-data-dir=$perfil",'--window-size=1365,768','--virtual-time-budget=18000')
  $eap=$ErrorActionPreference;$ErrorActionPreference='Continue'
  $dom = & $browser @comuns '--dump-dom' $url 2>$null | Out-String
  $codigo=$LASTEXITCODE;$ErrorActionPreference=$eap
  Confirmar ($codigo -eq 0) "Browser falhou: $url"
  return $dom
}

function Extrair-Resultado([string]$dom){
  return [regex]::Match($dom,'(?is)<pre id="resultado">(.*?)</pre>').Groups[1].Value.Trim()
}

try {
  $scriptServidor = Join-Path $Raiz 'tools\servidor_teste.mjs'
  $argsServidor = '"{0}" --root "{1}" --host 127.0.0.1 --port {2}' -f $scriptServidor,$Raiz,$Porta
  $servidor = Start-Process -FilePath $node -ArgumentList $argsServidor -WindowStyle Hidden -PassThru
  $pronto=$false
  for($i=0;$i -lt 60;$i++){
    try { $r=Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:{0}/tests/ia.html" -f $Porta) -TimeoutSec 1; if($r.StatusCode -eq 200){$pronto=$true;break} } catch {}
    Start-Sleep -Milliseconds 250
  }
  Confirmar $pronto "Servidor não arrancou em 127.0.0.1:$Porta."

  $url = 'http://127.0.0.1:{0}/tests/ia.html?seed={1}' -f $Porta,$Seed
  $dom1 = Obter-Dom $url
  $resultado = Extrair-Resultado $dom1
  Write-Host $resultado
  $abertura = [regex]::Match($dom1,'(?is)<html\b[^>]*>').Value
  Confirmar ($abertura -match 'data-ia-status="pass"') 'O teste de IA não ficou em PASS.'

  $resultado2 = Extrair-Resultado (Obter-Dom $url)
  Confirmar ($resultado -eq $resultado2) "Seed $Seed não foi determinística: duas corridas deram resultados diferentes."
  Write-Host "IA OK - PASS deterministico (seed $Seed)"
}
finally {
  if($servidor -and -not $servidor.HasExited){ Stop-Process -Id $servidor.Id -Force -ErrorAction SilentlyContinue }
  $perfilAbs=[IO.Path]::GetFullPath($perfil);$tmpAbs=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if($perfilAbs.StartsWith($tmpAbs,[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $perfilAbs)){
    Remove-Item -LiteralPath $perfilAbs -Recurse -Force -ErrorAction SilentlyContinue
  }
}
