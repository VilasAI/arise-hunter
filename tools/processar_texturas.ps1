# Processa as pranchas do dono (Imagens\Chat) em assets do jogo:
#   - heróis e inimigos -> sheets horizontais nome_acao.png (4 frames, 256px, base a 92%)
#   - armas/armaduras   -> ícones icon_*.png (128px, centrados)
#   - texturas          -> tex_NN.jpg (256px, opacas)
# Fundo: os 2 tons do axadrezado são amostrados por prancha; remove-se por
# flood-fill do perímetro (+ passe por cor apertado para buracos internos).
# Grelha dos sprites: bandas detetadas por projeção da máscara de conteúdo.
param(
  [string]$Origem  = "$env:USERPROFILE\Desktop\Claude.ai\Imagens\Chat",
  [string]$Destino = "$PSScriptRoot\..\assets\2d"
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;

public class Prancha {
  int W, H; int[] px; List<int[]> tons = new List<int[]>();
  bool[] conteudo;   // máscara já erodida (linhas finas de moldura/tracejado fora)

  public Prancha(string caminho) : this(caminho, false) {}
  public Prancha(string caminho, bool fundoInterno){
    using(Bitmap bmp0 = (Bitmap)Image.FromFile(caminho))
    using(Bitmap bmp = new Bitmap(bmp0.Width, bmp0.Height, PixelFormat.Format32bppArgb)){
      using(Graphics g = Graphics.FromImage(bmp)) g.DrawImage(bmp0, 0, 0, bmp0.Width, bmp0.Height);
      W = bmp.Width; H = bmp.Height; px = new int[W*H];
      var d = bmp.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(d.Scan0, px, 0, W*H);
      bmp.UnlockBits(d);
    }
    AmostrarTons();
    if(fundoInterno) TonsDoHistograma();   // células com fundo próprio (batedor)
    ConstruirMascara();
  }

  // o fundo domina a área: os bins de cor mais frequentes também são fundo
  // (apanha fundos internos de células que o perímetro não vê)
  void TonsDoHistograma(){
    var hist = new Dictionary<int,int>();
    for(int i=0;i<px.Length;i+=3){
      int c = px[i];
      int chave = (((c>>16)&255)/8)*10000 + (((c>>8)&255)/8)*100 + ((c&255)/8);
      int v; hist.TryGetValue(chave, out v); hist[chave] = v+1;
    }
    var top = new List<KeyValuePair<int,int>>(hist);
    top.Sort((a,b)=> b.Value.CompareTo(a.Value));
    int minimo = (px.Length/3) * 3/100;          // só bins com >=3% da imagem
    for(int k=0; k<Math.Min(6, top.Count); k++){
      if(top[k].Value < minimo) break;
      int chave = top[k].Key;
      int[] tom = { (chave/10000)*8+4, ((chave/100)%100)*8+4, (chave%100)*8+4 };
      bool novo = true;
      foreach(var t in tons) if(Dist2(t, tom) < 100) { novo = false; break; }
      if(novo) tons.Add(tom);
    }
  }

  // mediana 5x5 em 14 pontos do perímetro -> tons distintos do axadrezado
  void AmostrarTons(){
    var pontos = new List<int[]>();
    int[] xs = { 6, W/4, W/2, 3*W/4, W-7 };
    foreach(int x in xs){ pontos.Add(new []{x, 6}); pontos.Add(new []{x, H-7}); }
    pontos.Add(new []{6, H/2}); pontos.Add(new []{W-7, H/2});
    pontos.Add(new []{6, H/4}); pontos.Add(new []{W-7, 3*H/4});
    foreach(var p in pontos){
      var rs = new List<int>(); var gs = new List<int>(); var bs = new List<int>();
      for(int dy=-2; dy<=2; dy++) for(int dx=-2; dx<=2; dx++){
        int c = px[(p[1]+dy)*W + p[0]+dx];
        rs.Add((c>>16)&255); gs.Add((c>>8)&255); bs.Add(c&255);
      }
      rs.Sort(); gs.Sort(); bs.Sort();
      int[] tom = { rs[12], gs[12], bs[12] };
      bool novo = true;
      foreach(var t in tons) if(Dist2(t, tom) < 100) { novo = false; break; }
      if(novo) tons.Add(tom);
    }
  }
  static int Dist2(int[] a, int[] b){
    int dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2];
    return dr*dr+dg*dg+db*db;
  }
  bool EhFundo(int i, int tol2){
    int c = px[i]; int[] v = { (c>>16)&255, (c>>8)&255, c&255 };
    foreach(var t in tons) if(Dist2(t, v) <= tol2) return true;
    return false;
  }

  void ConstruirMascara(){
    bool[] bruto = new bool[W*H];
    for(int i=0;i<W*H;i++) bruto[i] = !EhFundo(i, 22*22);
    conteudo = new bool[W*H];               // erosão 3x3: mata linhas de 1-2 px
    for(int y=1;y<H-1;y++) for(int x=1;x<W-1;x++){
      int i=y*W+x;
      if(!bruto[i]) continue;
      bool ok = true;
      for(int dy=-1; dy<=1 && ok; dy++) for(int dx=-1; dx<=1; dx++)
        if(!bruto[i+dy*W+dx]){ ok=false; break; }
      conteudo[i] = ok;
    }
  }

  // bandas horizontais de sprites: runs de linhas com conteúdo (x>=xMin), altura>=36
  public int[] Bandas(int xMin, int minAltura){
    var res = new List<int>();
    int y0 = -1;
    for(int y=0;y<H;y++){
      int soma=0;
      for(int x=xMin;x<W;x++) if(conteudo[y*W+x]) soma++;
      bool ativo = soma >= 28;   // ignora molduras/tracejados residuais nos gaps
      if(ativo && y0<0) y0=y;
      if((!ativo || y==H-1) && y0>=0){
        int y1 = ativo ? y : y-1;
        if(y1-y0+1 >= minAltura){ res.Add(y0); res.Add(y1); }
        y0 = -1;
      }
    }
    return res.ToArray();
  }

  // dentro da banda [y0..y1], span de conteúdo e maior gap central -> 2 metades.
  // Algumas pranchas repetem os rótulos (IDLE/ATTACK/…) no início de cada
  // metade: sub-runs estreitos e BAIXOS no arranque da metade são podados.
  public int[] Metades(int y0, int y1, int xMin){
    int[] proj = new int[W];
    int[] topo = new int[W]; int[] fundo = new int[W];
    for(int x=xMin;x<W;x++){
      topo[x]=int.MaxValue; fundo[x]=-1;
      for(int y=y0;y<=y1;y++) if(conteudo[y*W+x]){
        proj[x]++;
        if(y<topo[x])topo[x]=y; if(y>fundo[x])fundo[x]=y;
      }
    }
    int a0=-1, a1=-1;
    for(int x=xMin;x<W;x++) if(proj[x]>0){ if(a0<0)a0=x; a1=x; }
    if(a0<0) return new int[]{0,0,0,0};
    int melhorIni=0, melhorFim=0, gIni=-1;
    for(int x=a0;x<=a1;x++){
      bool vazio = proj[x]==0;
      if(vazio && gIni<0) gIni=x;
      if((!vazio || x==a1) && gIni>=0){
        int gFim = vazio ? x : x-1;
        int centro = (gIni+gFim)/2;
        if(gFim-gIni > melhorFim-melhorIni && centro > W*35/100 && centro < W*65/100){
          melhorIni=gIni; melhorFim=gFim;
        }
        gIni=-1;
      }
    }
    if(melhorFim==0) return new int[]{PodarLabel(a0,a1,proj,topo,fundo), a1, 0, 0};
    int m1 = PodarLabel(a0, melhorIni-1, proj, topo, fundo);
    int m2 = PodarLabel(melhorFim+1, a1, proj, topo, fundo);
    return new int[]{m1, melhorIni-1, m2, a1};
  }
  int PodarLabel(int x0, int x1, int[] proj, int[] topo, int[] fundo){
    while(true){
      int r0=-1, r1=-1;
      for(int x=x0;x<=x1;x++){
        if(proj[x]>0){ if(r0<0)r0=x; r1=x; }
        else if(r0>=0) break;
      }
      if(r0<0) return x0;
      int alto=0;
      for(int x=r0;x<=r1;x++) if(fundo[x]>=0) alto = Math.Max(alto, fundo[x]-topo[x]+1);
      if(r1-r0+1 < 115 && alto < 42){          // é rótulo: salta-o
        int nx = r1+1;
        while(nx<=x1 && proj[nx]==0) nx++;
        if(nx>x1) return x0;
        x0 = nx;
      } else return r0;
    }
  }

  // recorta célula com fundo removido: flood do perímetro (tol larga) + cor global (tol curta)
  public Bitmap Celula(int cx, int cy, int cw, int ch){
    cw = Math.Min(cw, W-cx); ch = Math.Min(ch, H-cy);
    int n = cw*ch; int[] cel = new int[n];
    for(int y=0;y<ch;y++) for(int x=0;x<cw;x++) cel[y*cw+x] = px[(cy+y)*W + cx+x];
    bool[] fundo = new bool[n];
    var fila = new Queue<int>();
    Func<int,bool> ehF = i => {
      int c = cel[i]; int[] v = { (c>>16)&255, (c>>8)&255, c&255 };
      foreach(var t in tons) if(Dist2(t,v) <= 24*24) return true;
      return false;
    };
    Action<int> semear = i => { if(!fundo[i] && ehF(i)){ fundo[i]=true; fila.Enqueue(i); } };
    for(int x=0;x<cw;x++){ semear(x); semear((ch-1)*cw+x); }
    for(int y=0;y<ch;y++){ semear(y*cw); semear(y*cw+cw-1); }
    while(fila.Count>0){
      int i = fila.Dequeue(); int ix=i%cw;
      if(ix>0) semear(i-1); if(ix<cw-1) semear(i+1);
      if(i>=cw) semear(i-cw); if(i<n-cw) semear(i+cw);
    }
    for(int i=0;i<n;i++){                    // buracos internos: só cor quase exata
      if(fundo[i]) cel[i]=0;
      else {
        int c = cel[i]; int[] v = { (c>>16)&255, (c>>8)&255, c&255 };
        foreach(var t in tons) if(Dist2(t,v) <= 12*12){ cel[i]=0; break; }
      }
    }
    Bitmap outb = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
    var d = outb.LockBits(new Rectangle(0,0,cw,ch), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    System.Runtime.InteropServices.Marshal.Copy(cel, 0, d.Scan0, n);
    outb.UnlockBits(d);
    return outb;
  }

  // caixa de conteúdo "sólido" da célula (abertura 2px: riscos/molduras finas não contam)
  public static int[] CaixaSolida(Bitmap bmp){
    int w=bmp.Width, h=bmp.Height, n=w*h;
    int[] p = new int[n];
    var d = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    System.Runtime.InteropServices.Marshal.Copy(d.Scan0, p, 0, n);
    bmp.UnlockBits(d);
    bool[] m = new bool[n];
    for(int i=0;i<n;i++) m[i] = ((p[i]>>24)&255) > 24;
    bool[] er = new bool[n];
    for(int y=2;y<h-2;y++) for(int x=2;x<w-2;x++){
      int i=y*w+x; if(!m[i]) continue;
      bool ok=true;
      for(int dy=-2;dy<=2 && ok;dy++) for(int dx=-2;dx<=2;dx++) if(!m[i+dy*w+dx]){ ok=false; break; }
      er[i]=ok;
    }
    int x0=w, y0=h, x1=-1, y1=-1, cont=0;
    for(int i=0;i<n;i++){
      if(!er[i]) continue;
      cont++;
      int x=i%w, y=i/w;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
    if(x1<0) return new int[]{0,0,0,0,0};
    x0=Math.Max(0,x0-3); y0=Math.Max(0,y0-3); x1=Math.Min(w-1,x1+3); y1=Math.Min(h-1,y1+3);
    return new int[]{x0,y0,x1-x0+1,y1-y0+1,cont};   // [4] = píxeis sólidos
  }

  // baseY>0: alinha pelo posicionamento ORIGINAL na célula (animação estável) —
  // horizontal preserva o offset da célula, vertical preserva o gap até ao chão
  public static Bitmap Sheet(Bitmap[] frames, int[][] caixas, int S, double esc, double baseY){
    Bitmap sh = new Bitmap(S*frames.Length, S, PixelFormat.Format32bppArgb);
    using(Graphics g = Graphics.FromImage(sh)){
      g.InterpolationMode = InterpolationMode.NearestNeighbor;
      g.PixelOffsetMode = PixelOffsetMode.Half;
      for(int f=0; f<frames.Length; f++){
        int[] cx = caixas[f]; if(cx[2]==0) continue;
        int dw = (int)Math.Round(cx[2]*esc), dh = (int)Math.Round(cx[3]*esc);
        int dx, dy;
        if(baseY>0){
          int celW = frames[f].Width, celH = frames[f].Height;
          dx = f*S + (int)Math.Round((S-celW*esc)/2 + cx[0]*esc);
          int gap = celH - cx[1] - cx[3];             // conteúdo -> fundo da célula
          dy = (int)Math.Round(S*baseY - gap*esc) - dh;
        } else {
          dx = f*S + (S-dw)/2;
          dy = (S-dh)/2;
        }
        g.DrawImage(frames[f], new Rectangle(dx,dy,dw,dh),
                    new Rectangle(cx[0],cx[1],cx[2],cx[3]), GraphicsUnit.Pixel);
      }
    }
    return sh;
  }
}
'@

if(-not (Test-Path $Destino)){ New-Item -ItemType Directory -Force $Destino | Out-Null }

$P = @{
  texturas  = 'dfe6ad9a-e833-4d2c-b6f0-085e98b8ae51'
  guerreiro = '76c5a8c9-3713-46c4-9181-0ea96c77d232'
  mago      = '91a16169-776d-4776-9325-c9f13e5e1991'
  batedor   = '5cb5e878-4928-4cce-aacf-3c73cb6122d7'
  assassino = '43a009d2-e4cf-4b49-acb9-d25d1d5ffa20'
  paladino  = '40b8f1be-3378-4690-a57c-a1a34721561a'
  eq_paladino  = '50e6692c-602c-4fea-af99-11a7353d547f'
  eq_mago      = '898b8ef0-49d0-4e16-bc49-649a40ef5648'
  eq_batedor   = '139e6d9f-4b7c-485a-b19e-1ed97c945834'
  eq_assassino = '66f14524-8db1-42c1-9f56-49a695a06898'
  eq_guerreiro = 'e8a5543d-246f-4a42-a5b7-ffea7083750d'
  en_goblin    = 'd9411fe4-cd55-4518-b2f3-80f05f64bf93'
  en_caster    = '9a7144d4-72ff-445b-8f83-8c394f39ed2f'
  en_hunter    = 'd681d62a-17e3-4bda-af62-726820eaffb7'
  en_stalker   = '89b394ee-5f09-499a-bd33-3da8855aaab7'
  en_knight    = 'fcab45ea-29fa-4f58-ac25-cfc3c4f1fd58'
}
$XMIN = 108   # à esquerda disto vivem os rótulos IDLE/WALK/…
# frames de ataque que a heurística de massa não apanha: herdam o anterior à força
$HERDAR = @{ 'en_plague' = @(2,3); 'en_warlock' = @(3) }

# gera os 5 sheets (idle/walk/attack/hurt/death) das 2 skins de uma prancha
# $inset: pranchas com molduras de célula (batedor) recortam o interior
function Processar-Personagem([string]$id, [string[]]$nomes, [int]$inset = 0){
  $pr = New-Object Prancha (Join-Path $Origem "$($P[$id]).png"), ($inset -gt 0)
  $bandas = $pr.Bandas($XMIN, 36)
  $nB = $bandas.Length/2
  if($nB -lt 6){ Write-Warning "${id}: só $nB bandas — a saltar"; return }
  # as 6 últimas bandas são as linhas de sprites (headers ficam acima)
  $ini = ($nB-6)*2
  $acoes = @('idle','walk','attack',$null,'hurt','death')   # linha 3 = special (fora)
  for($lin=0; $lin -lt 6; $lin++){
    if(-not $acoes[$lin]){ continue }
    $y0 = $bandas[$ini + $lin*2]; $y1 = $bandas[$ini + $lin*2 + 1]
    $m = $pr.Metades($y0, $y1, $XMIN)
    if($m[2] -eq 0){ Write-Warning "${id}/$($acoes[$lin]): sem gap central"; continue }
    foreach($skin in 0,1){
      $sx0 = $m[$skin*2]; $sx1 = $m[$skin*2+1]
      $frames = @(); $caixas = @(); $criados = @()
      $lw = ($sx1-$sx0+1)/4.0
      for($f=0; $f -lt 4; $f++){
        $cx = [int]($sx0 + $f*$lw)
        $cel = $pr.Celula($cx+$inset, $y0-4+$inset, [int]$lw-2*$inset, ($y1-$y0+9)-2*$inset)
        $frames += $cel; $criados += $cel; $caixas += ,([Prancha]::CaixaSolida($cel))
      }
      $maxW = ($caixas | ForEach-Object { $_[2] } | Measure-Object -Maximum).Maximum
      $maxH = ($caixas | ForEach-Object { $_[3] } | Measure-Object -Maximum).Maximum
      if($maxW -eq 0){ Write-Warning "$id skin$skin $($acoes[$lin]): vazio"; continue }
      # ataque: um frame só com o projétil (pouca massa) faria o corpo piscar — herda o vizinho
      if($acoes[$lin] -eq 'attack'){
        $maxPx = ($caixas | ForEach-Object { $_[4] } | Measure-Object -Maximum).Maximum
        $fracos = $HERDAR[$nomes[$skin]]                    # overrides manuais
        for($f=1; $f -lt 4; $f++){
          if($caixas[$f][4] -lt $maxPx*0.5 -or ($fracos -contains $f)){ $frames[$f] = $frames[$f-1]; $caixas[$f] = $caixas[$f-1] }
        }
        if($caixas[0][4] -lt $maxPx*0.5){ $frames[0] = $frames[1]; $caixas[0] = $caixas[1] }
      }
      $esc = [Math]::Min((256*0.92)/$maxW, (256*0.92)/$maxH)
      $sheet = [Prancha]::Sheet($frames, $caixas, 256, $esc, 0.92)
      $saida = Join-Path $Destino ("{0}_{1}.png" -f $nomes[$skin], $acoes[$lin])
      $sheet.Save($saida, [System.Drawing.Imaging.ImageFormat]::Png)
      $sheet.Dispose(); $criados | ForEach-Object { $_.Dispose() }
      Write-Output ("sheet  {0}_{1}  y={2}-{3}" -f $nomes[$skin], $acoes[$lin], $y0, $y1)
    }
  }
}

foreach($cl in 'guerreiro','mago','assassino','paladino'){
  Processar-Personagem $cl @("heroi_$cl", ("heroi_{0}2" -f $cl))
}
Processar-Personagem 'batedor' @('heroi_batedor','heroi_batedor2') 9
Processar-Personagem 'en_goblin'  @('en_goblin','en_orcbrute')
Processar-Personagem 'en_caster'  @('en_necro','en_warlock')
Processar-Personagem 'en_hunter'  @('en_bone','en_plague')
Processar-Personagem 'en_stalker' @('en_stalker','en_venom')
Processar-Personagem 'en_knight'  @('en_corrupted','en_templar')
# o ataque do stalker na prancha é só o rasto da garra — usa o walk (o jogo põe o efeito)
Copy-Item (Join-Path $Destino 'en_stalker_walk.png') (Join-Path $Destino 'en_stalker_attack.png') -Force

# ---------- equipamento: 3-4 secções × 3 colunas, interior da moldura ----------
$eqCol = @(@(66,426),@(450,810),@(834,1194))
function Icone([object]$pr, [int]$x0, [int]$y0, [int]$x1, [int]$y1, [string]$saida){
  $cel = $pr.Celula($x0, $y0, ($x1-$x0), ($y1-$y0))
  $cx = [Prancha]::CaixaSolida($cel)
  if($cx[2] -eq 0){ Write-Warning "vazio: $saida"; $cel.Dispose(); return }
  $esc = [Math]::Min((128*0.94)/$cx[2], (128*0.94)/$cx[3])
  $ico = [Prancha]::Sheet(@($cel), @(,$cx), 128, $esc, 0)
  $ico.Save($saida, [System.Drawing.Imaging.ImageFormat]::Png)
  $ico.Dispose(); $cel.Dispose()
  Write-Output ("icone  {0}" -f (Split-Path $saida -Leaf))
}
function Processar-Equipamento([string]$id, [string]$cl, [string[]]$cats){
  $pr = New-Object Prancha (Join-Path $Origem "$($P[$id]).png")
  # secções = bandas largas na coluna central da prancha inteira
  $bandas = $pr.Bandas(20, 120)
  $nB = $bandas.Length/2
  if($nB -lt $cats.Length){ Write-Warning "${id}: $nB bandas para $($cats.Length) secções"; return }
  $ini = ($nB - $cats.Length)*2
  for($s=0; $s -lt $cats.Length; $s++){
    $y0 = $bandas[$ini+$s*2]; $y1 = $bandas[$ini+$s*2+1]
    for($k=0; $k -lt 3; $k++){
      Icone $pr ($eqCol[$k][0]+14) ($y0+12) ($eqCol[$k][1]-14) ($y1-52) (Join-Path $Destino ("icon_{0}_{1}{2}.png" -f $cl, $cats[$s], ($k+1)))
    }
  }
}
Processar-Equipamento 'eq_guerreiro' 'guerreiro' @('espada','machado','escudo','armadura')
Processar-Equipamento 'eq_mago'      'mago'      @('cajado','adaga','armadura')
Processar-Equipamento 'eq_batedor'   'batedor'   @('arco','adaga','armadura')
Processar-Equipamento 'eq_assassino' 'assassino' @('adaga','arco','armadura')
Processar-Equipamento 'eq_paladino'  'paladino'  @('espada','escudo','armadura')

# ---------- texturas: 4×4 opacas -> jpg 256 ----------
$img = [System.Drawing.Bitmap]::FromFile((Join-Path $Origem "$($P.texturas).png"))
$cel = 1254/4
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$jpegParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$jpegParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]86)
for($lin=0; $lin -lt 4; $lin++){
  for($col=0; $col -lt 4; $col++){
    $n = $lin*4 + $col + 1
    $x = [int]($col*$cel)+10; $y = [int]($lin*$cel)+10; $t = [int]$cel-20
    $out = New-Object System.Drawing.Bitmap 256,256
    $g = [System.Drawing.Graphics]::FromImage($out)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0,0,256,256), $x, $y, $t, $t, 'Pixel')
    $g.Dispose()
    $out.Save((Join-Path $Destino ("tex_{0:00}.jpg" -f $n)), $jpegCodec, $jpegParams)
    $out.Dispose()
  }
}
$img.Dispose()
Write-Output 'texturas: 16 tiles'
Write-Output 'FEITO'
