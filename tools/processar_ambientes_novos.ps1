param(
  [string]$Origem = "$env:USERPROFILE\Desktop\Claude.ai\Claude Cowork\Texturas\IMAGENS CRIADAS",
  [string]$Destino = "$PSScriptRoot\ambientes-gerados"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not ('AtlasAmbiente' -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class AtlasAmbiente {
  static Bitmap Recortar(Bitmap src, Rectangle r) {
    Rectangle lim = Rectangle.Intersect(new Rectangle(0, 0, src.Width, src.Height), r);
    Bitmap dst = new Bitmap(lim.Width, lim.Height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(dst)) {
      g.CompositingMode = CompositingMode.SourceCopy;
      g.DrawImage(src, new Rectangle(0, 0, lim.Width, lim.Height), lim, GraphicsUnit.Pixel);
    }
    return dst;
  }

  static int[] Pixels(Bitmap b) {
    Rectangle r = new Rectangle(0, 0, b.Width, b.Height);
    BitmapData d = b.LockBits(r, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int[] p = new int[b.Width * b.Height];
    Marshal.Copy(d.Scan0, p, 0, p.Length);
    b.UnlockBits(d);
    return p;
  }

  static void Escrever(Bitmap b, int[] p) {
    Rectangle r = new Rectangle(0, 0, b.Width, b.Height);
    BitmapData d = b.LockBits(r, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    Marshal.Copy(p, 0, d.Scan0, p.Length);
    b.UnlockBits(d);
  }

  static bool FundoClaro(int c) {
    int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    int max = Math.Max(r, Math.Max(g, b)), min = Math.Min(r, Math.Min(g, b));
    return (max - min) <= 22 && (r + g + b) / 3 >= 175;
  }

  static Rectangle BlocoTextura(Bitmap b) {
    int w = b.Width, h = b.Height;
    int[] p = Pixels(b);
    int x0 = 0, x1 = w - 1, y0 = 0, y1 = h - 1;
    int limLinha = Math.Max(8, (int)(w * 0.55));
    int limColuna = Math.Max(8, (int)(h * 0.55));
    bool achou = false;
    for (int y = 0; y < h; y++) {
      int n = 0;
      for (int x = 0; x < w; x++) if (!FundoClaro(p[y * w + x])) n++;
      if (n >= limLinha) { y0 = y; achou = true; break; }
    }
    if (!achou) return new Rectangle(0, 0, w, h);
    for (int y = h - 1; y >= y0; y--) {
      int n = 0;
      for (int x = 0; x < w; x++) if (!FundoClaro(p[y * w + x])) n++;
      if (n >= limLinha) { y1 = y; break; }
    }
    for (int x = 0; x < w; x++) {
      int n = 0;
      for (int y = y0; y <= y1; y++) if (!FundoClaro(p[y * w + x])) n++;
      if (n >= limColuna) { x0 = x; break; }
    }
    for (int x = w - 1; x >= x0; x--) {
      int n = 0;
      for (int y = y0; y <= y1; y++) if (!FundoClaro(p[y * w + x])) n++;
      if (n >= limColuna) { x1 = x; break; }
    }
    int bw = Math.Max(1, x1 - x0 + 1), bh = Math.Max(1, y1 - y0 + 1);
    int lado = Math.Min(bw, bh);
    int cx = x0 + bw / 2, cy = y0 + bh / 2;
    return Rectangle.Intersect(new Rectangle(0, 0, w, h), new Rectangle(cx - lado / 2, cy - lado / 2, lado, lado));
  }

  static void TirarFundoClaro(Bitmap b) {
    int w = b.Width, h = b.Height, n = w * h;
    int[] p = Pixels(b);
    bool[] visto = new bool[n];
    int[] fila = new int[n];
    int ini = 0, fim = 0;
    Action<int> por = delegate(int i) {
      if (i >= 0 && i < n && !visto[i] && FundoClaro(p[i])) {
        visto[i] = true; fila[fim++] = i;
      }
    };
    for (int x = 0; x < w; x++) { por(x); por((h - 1) * w + x); }
    for (int y = 0; y < h; y++) { por(y * w); por(y * w + w - 1); }
    while (ini < fim) {
      int i = fila[ini++], x = i % w, y = i / w;
      if (x > 0) por(i - 1);
      if (x + 1 < w) por(i + 1);
      if (y > 0) por(i - w);
      if (y + 1 < h) por(i + w);
    }
    for (int i = 0; i < n; i++) if (visto[i]) p[i] = 0;
    Escrever(b, p);
  }

  static void TirarClarosInteriores(Bitmap b) {
    int[] p = Pixels(b);
    for (int i = 0; i < p.Length; i++) if (FundoClaro(p[i])) p[i] = 0;
    Escrever(b, p);
  }

  static void TirarHaloClaro(Bitmap b) {
    int w = b.Width, h = b.Height;
    int[] p = Pixels(b), src = (int[])p.Clone();
    for (int y = 1; y < h - 1; y++) for (int x = 1; x < w - 1; x++) {
      int i = y * w + x, c = src[i];
      if (((c >> 24) & 255) < 8) continue;
      int r = (c >> 16) & 255, g = (c >> 8) & 255, bl = c & 255;
      int max = Math.Max(r, Math.Max(g, bl)), min = Math.Min(r, Math.Min(g, bl));
      if ((max - min) > 60 || (r + g + bl) / 3 < 145) continue;
      bool tocaTransparencia = false;
      for (int dy = -1; dy <= 1 && !tocaTransparencia; dy++)
        for (int dx = -1; dx <= 1; dx++)
          if (((src[(y + dy) * w + x + dx] >> 24) & 255) < 8) { tocaTransparencia = true; break; }
      if (tocaTransparencia) p[i] = 0;
    }
    Escrever(b, p);
  }

  static bool Claro(int c, int brilhoMinimo, int deltaMaximo) {
    if (((c >> 24) & 255) < 8) return false;
    int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    int max = Math.Max(r, Math.Max(g, b)), min = Math.Min(r, Math.Min(g, b));
    return (max - min) <= deltaMaximo && (r + g + b) / 3 >= brilhoMinimo;
  }

  static bool EmRegiao(int x, int y, Rectangle[] regioes) {
    foreach (Rectangle r in regioes) if (r.Contains(x, y)) return true;
    return false;
  }

  static void TirarComponentesClaras(Bitmap b, Rectangle[] regioes, int minimoPixels, int brilhoMinimo, int deltaMaximo) {
    int w = b.Width, h = b.Height, n = w * h;
    int[] p = Pixels(b);
    bool[] visto = new bool[n];
    int[] fila = new int[n];
    for (int raiz = 0; raiz < n; raiz++) {
      if (visto[raiz] || !Claro(p[raiz], brilhoMinimo, deltaMaximo)) continue;
      List<int> comp = new List<int>();
      int ini = 0, fim = 0; fila[fim++] = raiz; visto[raiz] = true;
      bool escolhida = false;
      while (ini < fim) {
        int i = fila[ini++], x = i % w, y = i / w; comp.Add(i);
        if (EmRegiao(x, y, regioes)) escolhida = true;
        for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          int xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          int j = yy * w + xx;
          if (!visto[j] && Claro(p[j], brilhoMinimo, deltaMaximo)) {
            visto[j] = true; fila[fim++] = j;
          }
        }
      }
      if (escolhida && comp.Count >= minimoPixels) foreach (int i in comp) p[i] = 0;
    }
    Escrever(b, p);
  }

  static void TirarPixelsClaros(Bitmap b, Rectangle[] regioes, int brilhoMinimo, int deltaMaximo) {
    int w = b.Width, h = b.Height;
    int[] p = Pixels(b);
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      int i = y * w + x;
      if (EmRegiao(x, y, regioes) && Claro(p[i], brilhoMinimo, deltaMaximo)) p[i] = 0;
    }
    Escrever(b, p);
  }

  static void TirarHaloClaroEmRegioes(Bitmap b, Rectangle[] regioes) {
    int w = b.Width, h = b.Height;
    int[] p = Pixels(b), src = (int[])p.Clone();
    for (int y = 1; y < h - 1; y++) for (int x = 1; x < w - 1; x++) {
      int i = y * w + x;
      if (!EmRegiao(x, y, regioes) || !Claro(src[i], 125, 75)) continue;
      bool tocaTransparencia = false;
      for (int dy = -1; dy <= 1 && !tocaTransparencia; dy++)
        for (int dx = -1; dx <= 1; dx++)
          if (((src[(y + dy) * w + x + dx] >> 24) & 255) < 8) { tocaTransparencia = true; break; }
      if (tocaTransparencia) p[i] = 0;
    }
    Escrever(b, p);
  }

  static Rectangle CaixaAlpha(Bitmap b) {
    int w = b.Width, h = b.Height;
    int[] p = Pixels(b);
    int x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      if (((p[y * w + x] >> 24) & 255) < 8) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < x0 ? Rectangle.Empty : Rectangle.FromLTRB(x0, y0, x1 + 1, y1 + 1);
  }

  static void ManterMaiorComponente(Bitmap b) {
    int w = b.Width, h = b.Height, n = w * h;
    int[] p = Pixels(b);
    bool[] visto = new bool[n];
    int[] fila = new int[n];
    List<int> maior = new List<int>();
    for (int raiz = 0; raiz < n; raiz++) {
      if (visto[raiz] || ((p[raiz] >> 24) & 255) < 8) continue;
      List<int> comp = new List<int>();
      int ini = 0, fim = 0; fila[fim++] = raiz; visto[raiz] = true;
      while (ini < fim) {
        int i = fila[ini++], x = i % w, y = i / w; comp.Add(i);
        for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          int xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          int j = yy * w + xx;
          if (!visto[j] && ((p[j] >> 24) & 255) >= 8) { visto[j] = true; fila[fim++] = j; }
        }
      }
      if (comp.Count > maior.Count) maior = comp;
    }
    bool[] fica = new bool[n]; foreach (int i in maior) fica[i] = true;
    for (int i = 0; i < n; i++) if (!fica[i]) p[i] = 0;
    Escrever(b, p);
  }

  static Bitmap Escalar(Bitmap src, int w, int h) {
    Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(dst)) {
      g.CompositingMode = CompositingMode.SourceCopy;
      g.InterpolationMode = InterpolationMode.NearestNeighbor;
      g.PixelOffsetMode = PixelOffsetMode.Half;
      g.DrawImage(src, new Rectangle(0, 0, w, h), new Rectangle(0, 0, src.Width, src.Height), GraphicsUnit.Pixel);
    }
    return dst;
  }

  public static void GuardarTextura(string fonte, Rectangle area, string saida, int tamanho) {
    using (Bitmap src = new Bitmap(fonte))
    using (Bitmap q = Recortar(src, area)) {
      Rectangle bloco = BlocoTextura(q);
      using (Bitmap corte = Recortar(q, bloco))
      using (Bitmap fim = Escalar(corte, tamanho, tamanho)) fim.Save(saida, ImageFormat.Png);
    }
  }

  public static void GuardarSprite(string fonte, Rectangle area, string saida, int maximo, int margem) {
    GuardarSpriteInterno(fonte, area, saida, maximo, margem, false, false);
  }

  public static void GuardarSpritePrincipal(string fonte, Rectangle area, string saida, int maximo, int margem) {
    GuardarSpriteInterno(fonte, area, saida, maximo, margem, true, false);
  }

  public static void GuardarSpritePrincipalSemClaros(string fonte, Rectangle area, string saida, int maximo, int margem) {
    GuardarSpriteInterno(fonte, area, saida, maximo, margem, true, true);
  }

  public static void LimparArtefactosVila(string ficheiro, string nome) {
    Rectangle[] regioes;
    bool porComponentes = true;
    int minimoPixels = 2, brilhoMinimo = 175, deltaMaximo = 22;
    switch (nome) {
      case "hub_ferreiro":
        regioes = new Rectangle[] { new Rectangle(244,194,10,53), new Rectangle(254,194,21,18) };
        break;
      case "hub_mercador":
        regioes = new Rectangle[] { new Rectangle(8,150,26,51) };
        porComponentes = false; brilhoMinimo = 145; deltaMaximo = 70;
        break;
      case "hub_base":
        regioes = new Rectangle[] {
          new Rectangle(0,188,41,85), new Rectangle(378,188,43,49), new Rectangle(378,270,43,46)
        };
        break;
      case "hub_portal":
        regioes = new Rectangle[] { new Rectangle(30,112,67,105), new Rectangle(308,112,69,105) };
        minimoPixels = 8;
        break;
      case "hub_quadro":
        regioes = new Rectangle[] { new Rectangle(55,48,166,35), new Rectangle(55,148,166,36) };
        minimoPixels = 10;
        break;
      case "hub_aldrico":
        regioes = new Rectangle[] { new Rectangle(0,155,115,40) };
        porComponentes = false; brilhoMinimo = 125; deltaMaximo = 75;
        break;
      default:
        return;
    }

    Bitmap b;
    using (Bitmap src = new Bitmap(ficheiro)) {
      b = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
      using (Graphics g = Graphics.FromImage(b)) {
        g.CompositingMode = CompositingMode.SourceCopy;
        g.DrawImageUnscaled(src, 0, 0);
      }
    }
    using (b) {
      if (porComponentes) TirarComponentesClaras(b, regioes, minimoPixels, brilhoMinimo, deltaMaximo);
      else TirarPixelsClaros(b, regioes, brilhoMinimo, deltaMaximo);
      TirarHaloClaroEmRegioes(b, regioes);
      b.Save(ficheiro, ImageFormat.Png);
    }
  }

  static void GuardarSpriteInterno(string fonte, Rectangle area, string saida, int maximo, int margem, bool soMaior, bool limparClarosInteriores) {
    using (Bitmap src = new Bitmap(fonte))
    using (Bitmap q = Recortar(src, area)) {
      TirarFundoClaro(q);
      if (limparClarosInteriores) { TirarClarosInteriores(q); TirarHaloClaro(q); }
      if (soMaior) ManterMaiorComponente(q);
      Rectangle box = CaixaAlpha(q);
      if (box.IsEmpty) throw new InvalidOperationException("Recorte ficou vazio: " + saida);
      using (Bitmap corte = Recortar(q, box)) {
        double esc = Math.Min(1.0, (double)(maximo - margem * 2) / Math.Max(corte.Width, corte.Height));
        int dw = Math.Max(1, (int)Math.Round(corte.Width * esc));
        int dh = Math.Max(1, (int)Math.Round(corte.Height * esc));
        using (Bitmap miolo = Escalar(corte, dw, dh)) {
          Bitmap fim = new Bitmap(dw + margem * 2, dh + margem * 2, PixelFormat.Format32bppArgb);
          using (Graphics g = Graphics.FromImage(fim)) {
            g.CompositingMode = CompositingMode.SourceCopy;
            g.Clear(Color.Transparent);
            g.DrawImageUnscaled(miolo, margem, margem);
          }
          fim.Save(saida, ImageFormat.Png);
          fim.Dispose();
        }
      }
    }
  }
}
'@
}

New-Item -ItemType Directory -Force -Path $Destino | Out-Null

$atlas = [ordered]@{
  s = 'ChatGPT Image 14_07_2026, 20_58_44.png'
  a = 'ChatGPT Image 14_07_2026, 20_58_47.png'
  b = 'ChatGPT Image 14_07_2026, 20_58_51.png'
  c = 'ChatGPT Image 14_07_2026, 20_58_55.png'
  d = 'ChatGPT Image 14_07_2026, 20_58_59.png'
  e = 'ChatGPT Image 14_07_2026, 20_59_03.png'
}

$q = 627
foreach ($rank in $atlas.Keys) {
  $fonte = Join-Path $Origem $atlas[$rank]
  [AtlasAmbiente]::GuardarTextura($fonte, (New-Object Drawing.Rectangle 0,0,$q,$q), (Join-Path $Destino "bio_${rank}_parede.png"), 512)
  [AtlasAmbiente]::GuardarTextura($fonte, (New-Object Drawing.Rectangle $q,0,$q,$q), (Join-Path $Destino "bio_${rank}_chao.png"), 512)
  [AtlasAmbiente]::GuardarSpritePrincipal($fonte, (New-Object Drawing.Rectangle 0,$q,$q,$q), (Join-Path $Destino "bio_${rank}_transicao.png"), 768, 4)

  # O atlas do Bosque veio com fundo escuro nos acentos, não transparente.
  # Parede, chão e transição entram já; esses quatro motivos ficam de fora para
  # evitar retângulos visíveis no cenário.
  if ($rank -ne 'e') {
    $meio = 313
    $areas = @(
      (New-Object Drawing.Rectangle $q,$q,$meio,$meio),
      (New-Object Drawing.Rectangle ($q+$meio),$q,($q-$meio),$meio),
      (New-Object Drawing.Rectangle $q,($q+$meio),$meio,($q-$meio)),
      (New-Object Drawing.Rectangle ($q+$meio),($q+$meio),($q-$meio),($q-$meio))
    )
    for ($i=0; $i -lt 4; $i++) {
      [AtlasAmbiente]::GuardarSprite($fonte, $areas[$i], (Join-Path $Destino "bio_${rank}_acento_$($i+1).png"), 256, 4)
    }
  }
}

$vila = Join-Path $Origem 'ChatGPT Image 14_07_2026, 20_58_36.png'
$spritesVila = [ordered]@{
  hub_portal       = @{ r = @(0,0,430,410);      max = 512 }
  hub_ferreiro     = @{ r = @(405,0,315,410);    max = 420 }
  hub_mercador     = @{ r = @(685,0,370,410);    max = 420 }
  hub_base         = @{ r = @(1015,0,433,410);   max = 512 }
  hub_quadro       = @{ r = @(15,395,310,220);   max = 320 }
  hub_aldrico      = @{ r = @(295,395,160,220);  max = 280 }
  hub_ponte        = @{ r = @(1180,585,268,185); max = 320 }
  hub_arvore_1     = @{ r = @(5,700,335,325);    max = 380 }
  hub_arvore_2     = @{ r = @(270,690,250,330);  max = 360 }
  hub_arvore_morta = @{ r = @(435,690,215,300);  max = 340 }
}
foreach ($nome in $spritesVila.Keys) {
  $v = $spritesVila[$nome]; $r = $v.r
  $area = New-Object Drawing.Rectangle $r[0],$r[1],$r[2],$r[3]
  $saida = Join-Path $Destino "$nome.png"
  if ($nome -like 'hub_arvore*') {
    [AtlasAmbiente]::GuardarSpritePrincipalSemClaros($vila, $area, $saida, $v.max, 4)
  } else {
    [AtlasAmbiente]::GuardarSpritePrincipal($vila, $area, $saida, $v.max, 4)
    [AtlasAmbiente]::LimparArtefactosVila($saida, $nome)
  }
}

$tilesVila = [ordered]@{
  hub_relva   = @(450,415,240,195)
  hub_caminho = @(685,415,235,195)
  hub_praca   = @(915,415,230,195)
  hub_agua    = @(1140,415,245,195)
}
foreach ($nome in $tilesVila.Keys) {
  $r = $tilesVila[$nome]
  [AtlasAmbiente]::GuardarTextura($vila, (New-Object Drawing.Rectangle $r[0],$r[1],$r[2],$r[3]), (Join-Path $Destino "$nome.png"), 256)
}

Get-ChildItem -LiteralPath $Destino -File | Sort-Object Name | Select-Object Name,Length
