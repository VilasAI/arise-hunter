# Validacao A5 da Arte v2: contrato META, imagens e screenshots headless.
param(
  [string]$Raiz = (Split-Path $PSScriptRoot -Parent),
  [string]$Saida = (Join-Path (Split-Path $PSScriptRoot -Parent) 'tests\screenshots')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
public static class ArteImagem {
  public static void ValidarSheet(string path, int frames, int cellW, int cellH) {
    using (var b = (Bitmap)Image.FromFile(path)) {
      if (b.Width != frames * cellW || b.Height != cellH)
        throw new Exception(String.Format("{0}: {1}x{2}; esperado {3}x{4}", path, b.Width, b.Height, frames*cellW, cellH));
      var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
      int[] px=new int[b.Width*b.Height]; System.Runtime.InteropServices.Marshal.Copy(d.Scan0,px,0,px.Length); b.UnlockBits(d);
      for(int f=0;f<frames;f++){
        int opacos=0;
        for(int y=0;y<cellH;y++)for(int x=0;x<cellW;x++)if(((px[y*b.Width+f*cellW+x]>>24)&255)>24)opacos++;
        if(opacos<10)throw new Exception(String.Format("{0}: frame {1} vazio",path,f));
      }
    }
  }
  public static void ValidarImagem(string path, int w, int h) {
    using(var b=(Bitmap)Image.FromFile(path))if(b.Width!=w||b.Height!=h)
      throw new Exception(String.Format("{0}: {1}x{2}; esperado {3}x{4}",path,b.Width,b.Height,w,h));
  }
}
'@

function Confirmar([bool]$condicao, [string]$mensagem){ if(-not $condicao){ throw $mensagem } }

$assets = Join-Path $Raiz 'assets\2d'
$metaPath = Join-Path $assets 'sprites-meta.json'
Confirmar (Test-Path -LiteralPath $metaPath) "META inexistente: $metaPath"
$meta = Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
$sheets = @($meta.sheets.psobject.Properties)
$icones = @($meta.icons.psobject.Properties)
$texturas = @($meta.textures.psobject.Properties)
Confirmar ($meta.schema -eq 2) "META schema=$($meta.schema); esperado 2"
Confirmar ($sheets.Count -eq 126) "META: $($sheets.Count)/126 sheets"
Confirmar ($icones.Count -eq 48) "META: $($icones.Count)/48 ícones"
Confirmar ($texturas.Count -eq 16) "META: $($texturas.Count)/16 texturas"

foreach($p in $sheets){
  $v=$p.Value; $path=Join-Path $assets $v.file
  Confirmar (Test-Path -LiteralPath $path) "Sheet em falta: $($v.file)"
  [ArteImagem]::ValidarSheet($path,[int]$v.frames,[int]$v.cell.w,[int]$v.cell.h)
}
foreach($p in $icones){
  $v=$p.Value;$path=Join-Path $assets $v.file
  Confirmar (Test-Path -LiteralPath $path) "Ícone em falta: $($v.file)"
  [ArteImagem]::ValidarImagem($path,[int]$v.cell.w,[int]$v.cell.h)
}
foreach($p in $texturas){
  $v=$p.Value;$path=Join-Path $assets $v.file
  Confirmar (Test-Path -LiteralPath $path) "Textura em falta: $($v.file)"
  [ArteImagem]::ValidarImagem($path,[int]$v.size.w,[int]$v.size.h)
}
Write-Host "META OK - 126 sheets, 48 icones, 16 texturas"

$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
Confirmar ([bool]$browser) 'Chrome/Edge não encontrado para A5 headless.'
$node = (Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path $Saida | Out-Null
$saidaAbs = [IO.Path]::GetFullPath($Saida)
$perfil = Join-Path ([IO.Path]::GetTempPath()) ("vigilia-a5-"+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $perfil | Out-Null
$servidor = $null

function Invocar-Pagina([string]$url,[string]$ficheiro,[int]$w,[int]$h,[int]$dpr=1){
  $comuns=@('--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check',
    '--disable-logging','--log-level=3',"--user-data-dir=$perfil","--window-size=$w,$h",
    "--force-device-scale-factor=$dpr",'--virtual-time-budget=18000')
  $eapAnterior=$ErrorActionPreference;$ErrorActionPreference='Continue'
  $dom = & $browser @comuns '--dump-dom' $url 2>$null | Out-String
  $codigoDom=$LASTEXITCODE;$ErrorActionPreference=$eapAnterior
  Confirmar ($codigoDom -eq 0) "Browser falhou: $url"
  $aberturaHtml = [regex]::Match($dom,'(?is)<html\b[^>]*>').Value
  Confirmar ($aberturaHtml -match 'data-a5-status="ready"') "A5 não ficou ready: $url"
  Confirmar ($aberturaHtml -notmatch 'data-a5-status="error"') "A5 reportou erro: $url"
  $path=Join-Path $saidaAbs $ficheiro
  if(Test-Path -LiteralPath $path){ Remove-Item -LiteralPath $path -Force }
  # Chromium antigo perde as aspas de --screenshot quando o destino contém
  # espaços. Escreve primeiro no perfil temporário e só depois move o PNG.
  $shotTemporario=Join-Path $perfil $ficheiro
  if(Test-Path -LiteralPath $shotTemporario){ Remove-Item -LiteralPath $shotTemporario -Force }
  $ErrorActionPreference='Continue'
  & $browser @comuns "--screenshot=$shotTemporario" $url 2>$null | Out-Null
  $codigoShot=$LASTEXITCODE;$ErrorActionPreference=$eapAnterior
  Confirmar ($codigoShot -eq 0 -and (Test-Path -LiteralPath $shotTemporario)) "Screenshot falhou: $ficheiro"
  Move-Item -LiteralPath $shotTemporario -Destination $path -Force
  Write-Host ("screenshot {0,-28} {1}x{2} dpr={3}" -f $ficheiro,$w,$h,$dpr)
  return $path
}

try {
  $scriptServidor = Join-Path $Raiz 'tools\servidor_teste.mjs'
  $argsServidor = '"{0}" --root "{1}" --host 127.0.0.1 --port 4173' -f $scriptServidor,$Raiz
  $servidor = Start-Process -FilePath $node -ArgumentList $argsServidor -WindowStyle Hidden -PassThru
  $pronto=$false
  for($i=0;$i -lt 60;$i++){
    try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4173/tests/sprites.html' -TimeoutSec 1; if($r.StatusCode -eq 200){$pronto=$true;break} } catch {}
    Start-Sleep -Milliseconds 250
  }
  Confirmar $pronto 'Servidor A5 não arrancou em 127.0.0.1:4173.'

  Invocar-Pagina 'http://127.0.0.1:4173/tests/sprites.html' 'contact-sheet.png' 1600 3600 | Out-Null
  for($bioma=0;$bioma -le 5;$bioma++){
    $urlBioma = 'http://127.0.0.1:4173/tests/cenario.html?bioma={0}&seed=123&static=1&loop=1' -f $bioma
    $ficheiroBioma = 'cenario-bioma-{0}.png' -f $bioma
    Invocar-Pagina $urlBioma $ficheiroBioma 1365 768 | Out-Null
  }
  Invocar-Pagina 'http://127.0.0.1:4173/tests/cenario.html?bioma=0&seed=123&static=1&loop=1' 'cenario-mobile-portrait.png' 390 844 | Out-Null
  Invocar-Pagina 'http://127.0.0.1:4173/tests/cenario.html?bioma=5&seed=123&static=1&loop=1&provacao=1' 'cenario-mobile-landscape.png' 844 390 | Out-Null

  $repetida=Invocar-Pagina 'http://127.0.0.1:4173/tests/cenario.html?bioma=0&seed=123&static=1&loop=1' 'cenario-bioma-0-repeat.png' 1365 768
  $original=Join-Path $saidaAbs 'cenario-bioma-0.png'
  Confirmar ((Get-FileHash -Algorithm SHA256 $original).Hash -eq (Get-FileHash -Algorithm SHA256 $repetida).Hash) 'Seed 123 não produziu screenshot determinístico.'
  Remove-Item -LiteralPath $repetida

  $manifesto = Get-ChildItem -LiteralPath $saidaAbs -Filter '*.png' | Sort-Object Name | ForEach-Object {
    [ordered]@{file=$_.Name;sha256=(Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLowerInvariant();bytes=$_.Length}
  }
  $manifesto | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $saidaAbs 'manifest.json') -Encoding UTF8
  Write-Host "A5 OK - $($manifesto.Count) screenshots em $saidaAbs"
}
finally {
  if($servidor -and -not $servidor.HasExited){ Stop-Process -Id $servidor.Id -Force -ErrorAction SilentlyContinue }
  $perfilAbs=[IO.Path]::GetFullPath($perfil);$tmpAbs=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if($perfilAbs.StartsWith($tmpAbs,[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $perfilAbs)){
    Remove-Item -LiteralPath $perfilAbs -Recurse -Force -ErrorAction SilentlyContinue
  }
}
