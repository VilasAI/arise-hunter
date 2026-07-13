# Processa as pranchas do dono (Imagens\Chat) em assets do jogo:
#   - heróis e inimigos -> sheets horizontais nome_acao.png (frames reais, células 256px)
#   - armas/armaduras   -> ícones icon_*.png (128px, centrados)
#   - texturas          -> tex_NN.jpg (256px, opacas)
# Fundo: os tons do axadrezado são amostrados por prancha e só se remove o
# componente ligado às margens de cada célula. Píxeis interiores nunca são
# apagados por semelhança de cor.
# Grelha dos sprites: tools/mapa_animacoes.json é a fonte única de verdade.
param(
  [string]$Origem  = "$env:USERPROFILE\Desktop\Claude.ai\Imagens\Chat",
  [string]$Destino = "$PSScriptRoot\..\assets\2d",
  [string]$Mapa    = "$PSScriptRoot\mapa_animacoes.json"
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

  // Recorta uma célula e remove exclusivamente o fundo ligado ao perímetro.
  // Regiões interiores parecidas com o fundo ficam fechadas/opalinas: nunca se
  // apagam detalhes de armadura, sombras ou contornos por uma passagem global.
  public Bitmap Celula(int cx, int cy, int cw, int ch){
    cw = Math.Min(cw, W-cx); ch = Math.Min(ch, H-cy);
    int n = cw*ch; int[] cel = new int[n];
    for(int y=0;y<ch;y++) for(int x=0;x<cw;x++) cel[y*cw+x] = px[(cy+y)*W + cx+x];
    bool[] candidato = new bool[n];
    Func<int,bool> ehF = i => {
      int c = cel[i]; int[] v = { (c>>16)&255, (c>>8)&255, c&255 };
      // Tolerância curta: o checker é quase exato e uma tolerância larga cria
      // caminhos através de sombras/contornos escuros do próprio sprite.
      foreach(var t in tons) if(Dist2(t,v) <= 12*12) return true;
      return false;
    };
    for(int i=0;i<n;i++) candidato[i]=ehF(i);
    // Erosão do candidato: o checker forma áreas sólidas; os píxeis escuros
    // isolados dentro da arte deixam de constituir corredores para o flood.
    bool[] nucleo = new bool[n];
    for(int y=1;y<ch-1;y++) for(int x=1;x<cw-1;x++){
      int i=y*cw+x; if(!candidato[i]) continue; bool ok=true;
      for(int dy=-1;dy<=1&&ok;dy++) for(int dx=-1;dx<=1;dx++)
        if(!candidato[i+dy*cw+dx]){ok=false;break;}
      nucleo[i]=ok;
    }
    bool[] fundo = new bool[n]; var fila = new Queue<int>();
    Action<int> semear = i => { if(!fundo[i] && nucleo[i]){ fundo[i]=true; fila.Enqueue(i); } };
    for(int x=1;x<cw-1;x++){ semear(cw+x); semear((ch-2)*cw+x); }
    for(int y=1;y<ch-1;y++){ semear(y*cw+1); semear(y*cw+cw-2); }
    while(fila.Count>0){
      int i = fila.Dequeue(); int ix=i%cw;
      if(ix>0) semear(i-1); if(ix<cw-1) semear(i+1);
      if(i>=cw) semear(i-cw); if(i<n-cw) semear(i+cw);
    }
    // Repõe dois píxeis do contorno que a erosão retirou, mas sem voltar a
    // abrir caminhos arbitrariamente longos pelo interior do sprite.
    for(int passe=0;passe<2;passe++){
      bool[] add=new bool[n];
      for(int y=0;y<ch;y++) for(int x=0;x<cw;x++){
        int i=y*cw+x;if(fundo[i]||!candidato[i])continue;
        if((x>0&&fundo[i-1])||(x<cw-1&&fundo[i+1])||(y>0&&fundo[i-cw])||(y<ch-1&&fundo[i+cw]))add[i]=true;
      }
      for(int i=0;i<n;i++)if(add[i])fundo[i]=true;
    }
    for(int i=0;i<n;i++) if(fundo[i]) cel[i]=0;
    Bitmap outb = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
    var d = outb.LockBits(new Rectangle(0,0,cw,ch), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    System.Runtime.InteropServices.Marshal.Copy(cel, 0, d.Scan0, n);
    outb.UnlockBits(d);
    return outb;
  }

  // Os ícones têm molduras que isolam ilhas do checker. Depois do flood de
  // margem, limpa apenas nesses recortes os tons exatos que ficaram fechados.
  public Bitmap CelulaIcone(int cx,int cy,int cw,int ch){
    Bitmap b=Celula(cx,cy,cw,ch); int n=b.Width*b.Height; int[] p=new int[n];
    var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadWrite,PixelFormat.Format32bppArgb);
    System.Runtime.InteropServices.Marshal.Copy(d.Scan0,p,0,n);
    for(int i=0;i<n;i++){
      if(((p[i]>>24)&255)==0)continue;
      int c=p[i];int[]v={(c>>16)&255,(c>>8)&255,c&255};
      foreach(var t in tons)if(Dist2(t,v)<=24*24){p[i]=0;break;}
    }
    // As molduras douradas podem ficar isoladas do perímetro pelo próprio
    // item. Remove componentes horizontais longos e finos; esta regra não
    // toca lâminas diagonais nem o corpo compacto das armaduras.
    bool[] visto=new bool[n]; int[] fila=new int[n]; var comp=new List<int>();
    for(int ini=0;ini<n;ini++){
      if(visto[ini]||((p[ini]>>24)&255)<=24)continue;
      int qi=0,qf=0;fila[qf++]=ini;visto[ini]=true;comp.Clear();
      int x0=b.Width,y0=b.Height,x1=-1,y1=-1;
      while(qi<qf){
        int i=fila[qi++],x=i%b.Width,y=i/b.Width;comp.Add(i);
        if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
        int j;
        if(x>0){j=i-1;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
        if(x<b.Width-1){j=i+1;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
        if(y>0){j=i-b.Width;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
        if(y<b.Height-1){j=i+b.Width;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
      }
      if((y1-y0+1)<=8 && (x1-x0+1)>b.Width*25/100)
        foreach(int i in comp)p[i]=0;
    }
    System.Runtime.InteropServices.Marshal.Copy(p,0,d.Scan0,n);b.UnlockBits(d);return b;
  }

  // Nas armaduras, o friso superior da carta pode ficar desligado do corpo.
  // Remove apenas componentes confinados ao topo que chegam às margens ou
  // são largos; capacetes/plumas centrais continuam ligados ao corpo útil.
  public void LimparMolduraTopo(Bitmap b){
    int w=b.Width,h=b.Height,n=w*h;int[]p=new int[n];
    var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadWrite,PixelFormat.Format32bppArgb);
    System.Runtime.InteropServices.Marshal.Copy(d.Scan0,p,0,n);
    bool[]visto=new bool[n];int[]fila=new int[n];var comp=new List<int>();
    for(int ini=0;ini<n;ini++){
      if(visto[ini]||((p[ini]>>24)&255)<=24)continue;
      int qi=0,qf=0,x0=w,y0=h,x1=-1,y1=-1;fila[qf++]=ini;visto[ini]=true;comp.Clear();
      while(qi<qf){
        int i=fila[qi++],x=i%w,y=i/w,j;comp.Add(i);
        if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
        if(x>0){j=i-1;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
        if(x<w-1){j=i+1;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
        if(y>0){j=i-w;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
        if(y<h-1){j=i+w;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
      }
      int bw=x1-x0+1;
      if(y1<h*22/100 && (x0<w*18/100 || x1>w*82/100 || bw>w*20/100))
        foreach(int i in comp)p[i]=0;
    }
    System.Runtime.InteropServices.Marshal.Copy(p,0,d.Scan0,n);b.UnlockBits(d);
  }

  // Há pranchas em que o corpo fecha por completo pequenas ilhas do checker.
  // Limpa o checker escuro fechado pelo corpo. Píxeis de arte (cor, luz e
  // contorno) criam uma zona protegida de cinco píxeis; só os neutros escuros
  // fora dessa vizinhança são apagados. A regra é usada apenas no Guerreiro.
  public void LimparIlhasFundo(Bitmap b,int minPixels){
    int w=b.Width,h=b.Height,n=w*h;int[]p=new int[n];
    var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadWrite,PixelFormat.Format32bppArgb);
    System.Runtime.InteropServices.Marshal.Copy(d.Scan0,p,0,n);
    bool[] candidato=new bool[n],protegido=new bool[n];
    for(int i=0;i<n;i++){
      if(((p[i]>>24)&255)<=24)continue;
      int c=p[i],r=(c>>16)&255,g=(c>>8)&255,bl=c&255;
      int hi=Math.Max(r,Math.Max(g,bl)),lo=Math.Min(r,Math.Min(g,bl));
      candidato[i]=hi<=52 && hi-lo<=16;
      protegido[i]=!candidato[i];
    }
    for(int passe=0;passe<5;passe++){
      bool[] add=new bool[n];
      for(int i=0;i<n;i++){
        if(!candidato[i]||protegido[i])continue;int x=i%w;
        if((x>0&&protegido[i-1])||(x<w-1&&protegido[i+1])||
           (i>=w&&protegido[i-w])||(i<n-w&&protegido[i+w]))add[i]=true;
      }
      for(int i=0;i<n;i++)if(add[i])protegido[i]=true;
    }
    for(int i=0;i<n;i++)if(candidato[i]&&!protegido[i])p[i]=0;
    System.Runtime.InteropServices.Marshal.Copy(p,0,d.Scan0,n);b.UnlockBits(d);
  }

  // Segmenta uma linha inteira numa grelha física de quatro colunas. Os
  // componentes opacos são atribuídos ao centro de frame mais próximo antes
  // de serem copiados para células iguais; assim VFX largos não são cortados
  // e fragmentos do frame vizinho nunca entram por uma fronteira arbitrária.
  public Bitmap[] CelulasLinha(int cx, int cy, int cw, int ch, int frames, int outW, double limiarDivisao){
    using(Bitmap linha = Celula(cx,cy,cw,ch)){
      int n=cw*ch; int[] p=new int[n];
      var d=linha.LockBits(new Rectangle(0,0,cw,ch), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      System.Runtime.InteropServices.Marshal.Copy(d.Scan0,p,0,n); linha.UnlockBits(d);
      bool[] visto=new bool[n]; int workW=outW*2; int[][] saida=new int[frames][];
      for(int f=0;f<frames;f++) saida[f]=new int[workW*ch];
      int[] q=new int[n]; var comp=new List<int>();
      for(int ini=0;ini<n;ini++){
        if(visto[ini] || ((p[ini]>>24)&255)<=24) continue;
        int qi=0,qf=0; q[qf++]=ini; visto[ini]=true; comp.Clear();
        int x0=cw,y0=ch,x1=-1,y1=-1;
        while(qi<qf){
          int i=q[qi++], x=i%cw, y=i/cw; comp.Add(i);
          if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
          int j;
          if(x>0){j=i-1;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;q[qf++]=j;}}
          if(x<cw-1){j=i+1;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;q[qf++]=j;}}
          if(y>0){j=i-cw;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;q[qf++]=j;}}
          if(y<ch-1){j=i+cw;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;q[qf++]=j;}}
        }
        int bw=x1-x0+1,bh=y1-y0+1;
        // Resíduos de uma linha adjacente aparecem como componentes pequenos
        // colados ao topo/fundo do recorte; não os transfere para o frame.
        if((y0<=1 || y1>=ch-2) && (bh<=20 || comp.Count<40)) continue;
        int[] histX=new int[cw]; foreach(int i in comp) histX[i%cw]++;
        int metade=(comp.Count+1)/2, acum=0, medianaX=x0;
        for(int x=x0;x<=x1;x++){acum+=histX[x];if(acum>=metade){medianaX=x;break;}}
        double centro=medianaX;
        // Se duas poses da prancha se tocam através de um VFX muito largo,
        // divide esse único componente pela coluna lógica. Componentes normais
        // (incluindo um sprite largo) continuam inteiros.
        bool atravessaColunas = bw > (cw/4.0)*limiarDivisao;
        foreach(int i in comp){
          int x=i%cw,y=i/cw,alvo=0; double melhor=Double.MaxValue;
          double refX = atravessaColunas ? x : centro;
          for(int f=0;f<frames;f++){
            double cf=(f+0.5)*cw/4.0, dist=Math.Abs(refX-cf);
            if(dist<melhor){melhor=dist;alvo=f;}
          }
          double centroAlvo=(alvo+0.5)*cw/4.0;
          // Evita o arredondamento bancário de .5, que colapsaria pares de
          // colunas em centros de célula fracionários.
          int dx=(int)Math.Floor(x-centroAlvo+workW/2.0+0.5);
          if(dx>=0 && dx<workW) saida[alvo][y*workW+dx]=p[i];
        }
      }
      Bitmap[] res=new Bitmap[frames];
      for(int f=0;f<frames;f++){
        int minX=workW,maxX=-1;
        for(int y=0;y<ch;y++)for(int x=0;x<workW;x++)if(((saida[f][y*workW+x]>>24)&255)>24){if(x<minX)minX=x;if(x>maxX)maxX=x;}
        int centroConteudo=maxX>=minX?(minX+maxX)/2:workW/2;
        int desloca=outW/2-centroConteudo; int[] final=new int[outW*ch];
        for(int y=0;y<ch;y++)for(int x=0;x<workW;x++){
          int dx=x+desloca;if(dx>=0&&dx<outW)final[y*outW+dx]=saida[f][y*workW+x];
        }
        res[f]=new Bitmap(outW,ch,PixelFormat.Format32bppArgb);
        var od=res[f].LockBits(new Rectangle(0,0,outW,ch),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
        System.Runtime.InteropServices.Marshal.Copy(final,0,od.Scan0,final.Length);res[f].UnlockBits(od);
      }
      return res;
    }
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
    if(x1<0){
      // VFX/projectéis muito finos podem não sobreviver à abertura 5x5; para
      // validação/baseline usa-se então a caixa alpha sem alterar o recorte.
      x0=w; y0=h; x1=-1; y1=-1; cont=0;
      for(int i=0;i<n;i++){
        if(!m[i]) continue; cont++; int x=i%w,y=i/w;
        if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      }
      if(x1<0) return new int[]{0,0,0,0,0};
      return new int[]{x0,y0,x1-x0+1,y1-y0+1,cont};
    }
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

  // Caixa do maior componente ligado (alpha>24). Num frame só-projétil pode
  // sobrar um fragmento da mão/arma do lançador; o projétil é o componente
  // dominante e o recorte por esta caixa deixa o resto de fora.
  public static int[] MaiorComponenteCaixa(Bitmap bmp){
    int w=bmp.Width, h=bmp.Height, n=w*h; int[] p=new int[n];
    var d=bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    System.Runtime.InteropServices.Marshal.Copy(d.Scan0,p,0,n); bmp.UnlockBits(d);
    bool[] visto=new bool[n]; int[] fila=new int[n];
    int bx0=0,by0=0,bx1=-1,by1=-1,melhor=0;
    for(int ini=0;ini<n;ini++){
      if(visto[ini] || ((p[ini]>>24)&255)<=24) continue;
      int qi=0,qf=0,x0=w,y0=h,x1=-1,y1=-1,cont=0;
      fila[qf++]=ini; visto[ini]=true;
      while(qi<qf){
        int i=fila[qi++], x=i%w, y=i/w; cont++;
        if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
        int j;
        if(x>0){j=i-1;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
        if(x<w-1){j=i+1;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
        if(y>0){j=i-w;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
        if(y<h-1){j=i+w;if(!visto[j]&&((p[j]>>24)&255)>24){visto[j]=true;fila[qf++]=j;}}
      }
      if(cont>melhor){ melhor=cont; bx0=x0; by0=y0; bx1=x1; by1=y1; }
    }
    if(bx1<0) return new int[]{0,0,0,0,0};
    bx0=Math.Max(0,bx0-2); by0=Math.Max(0,by0-2); bx1=Math.Min(w-1,bx1+2); by1=Math.Min(h-1,by1+2);
    return new int[]{bx0,by0,bx1-bx0+1,by1-by0+1,melhor};
  }

  // Sheet de recortes justos (projéteis): cada blob é copiado pela sua caixa
  // sólida e centrado numa célula comum; a âncora passa a ser o centro.
  public static Bitmap SheetRecortes(Bitmap[] frames, int[][] caixas, int cellW, int cellH, double esc){
    Bitmap sh = new Bitmap(cellW*frames.Length, cellH, PixelFormat.Format32bppArgb);
    using(Graphics g = Graphics.FromImage(sh)){
      g.InterpolationMode = InterpolationMode.NearestNeighbor;
      g.PixelOffsetMode = PixelOffsetMode.Half;
      for(int f=0; f<frames.Length; f++){
        int[] cx = caixas[f]; if(cx[2]==0) continue;
        int dw = (int)Math.Round(cx[2]*esc), dh = (int)Math.Round(cx[3]*esc);
        g.DrawImage(frames[f], new Rectangle(f*cellW+(cellW-dw)/2, (cellH-dh)/2, dw, dh),
                    new Rectangle(cx[0],cx[1],cx[2],cx[3]), GraphicsUnit.Pixel);
      }
    }
    return sh;
  }

  // Células de origem completas, uma escala comum e padding transparente.
  // O baseline é calculado por ação fora daqui; nunca há trim nem zoom por frame.
  public static Bitmap SheetFixa(Bitmap[] frames, int S, double esc, double[] basesFonte, double ancoraY){
    Bitmap sh = new Bitmap(S*frames.Length, S, PixelFormat.Format32bppArgb);
    using(Graphics g = Graphics.FromImage(sh)){
      g.InterpolationMode = InterpolationMode.NearestNeighbor;
      g.PixelOffsetMode = PixelOffsetMode.Half;
      for(int f=0; f<frames.Length; f++){
        Bitmap fr = frames[f];
        int dw = (int)Math.Round(fr.Width*esc), dh = (int)Math.Round(fr.Height*esc);
        int dx = f*S + (S-dw)/2;
        double baseFonte = basesFonte[Math.Min(f,basesFonte.Length-1)];
        int dy = (int)Math.Round(S*ancoraY - baseFonte*esc);
        g.DrawImage(fr, new Rectangle(dx,dy,dw,dh),
                    new Rectangle(0,0,fr.Width,fr.Height), GraphicsUnit.Pixel);
      }
    }
    return sh;
  }
}
'@

if(-not (Test-Path $Destino)){ New-Item -ItemType Directory -Force $Destino | Out-Null }

$P = @{
  texturas  = 'dfe6ad9a-e833-4d2c-b6f0-085e98b8ae51'
  eq_paladino  = '50e6692c-602c-4fea-af99-11a7353d547f'
  eq_mago      = '898b8ef0-49d0-4e16-bc49-649a40ef5648'
  eq_batedor   = '139e6d9f-4b7c-485a-b19e-1ed97c945834'
  eq_assassino = '66f14524-8db1-42c1-9f56-49a695a06898'
  eq_guerreiro = 'e8a5543d-246f-4a42-a5b7-ffea7083750d'
}

if(-not (Test-Path -LiteralPath $Mapa)){ throw "Mapa de animações inexistente: $Mapa" }
$mapaAnim = Get-Content -Raw -LiteralPath $Mapa | ConvertFrom-Json
if($mapaAnim.schema -ne 2){ throw "Schema de mapa não suportado: $($mapaAnim.schema)" }
$acoesEsperadas = @('idle','walk','attack','skill','hurt','death')
if((@($mapaAnim.actions) -join ',') -ne ($acoesEsperadas -join ',')){
  throw 'O mapa de animações não contém as seis ações canónicas na ordem esperada.'
}

$metaSheets = [ordered]@{}
$metaIcons = [ordered]@{}
$metaTextures = [ordered]@{}
$manifest = [ordered]@{
  schema = 2
  defaults = [ordered]@{
    cell = [ordered]@{ w=[int]$mapaAnim.cellSize; h=[int]$mapaAnim.cellSize }
    anchor = [ordered]@{ x=[double]$mapaAnim.anchor.x; y=[double]$mapaAnim.anchor.y }
  }
  actions = $acoesEsperadas
  sheets = $metaSheets
  icons = $metaIcons
  textures = $metaTextures
}

function Obter-Baselines([object[]]$caixas){
  $validas = @($caixas | Where-Object { $_[2] -gt 0 })
  if(-not $validas.Count){ throw 'A ação não contém nenhum frame opaco.' }
  $maxH = ($validas | ForEach-Object { $_[3] } | Measure-Object -Maximum).Maximum
  $maxPx = ($validas | ForEach-Object { $_[4] } | Measure-Object -Maximum).Maximum
  $corpo = @($validas | Where-Object { $_[3] -ge $maxH*0.45 -and $_[4] -ge $maxPx*0.18 })
  $bases = @($corpo |
    ForEach-Object { $_[1] + $_[3] })
  if(-not $bases.Count){ $bases = @($validas | ForEach-Object { $_[1] + $_[3] }) }
  $bases = @($bases | Sort-Object)
  $m = [int][Math]::Floor($bases.Count/2)
  $fallback = if($bases.Count % 2){ [double]$bases[$m] } else { ([double]$bases[$m-1]+[double]$bases[$m])/2.0 }
  $res = @()
  foreach($cx in $caixas){
    $ehCorpo = $cx[2] -gt 0 -and $cx[3] -ge $maxH*0.45 -and $cx[4] -ge $maxPx*0.18
    if($ehCorpo){ $res += [double]($cx[1]+$cx[3]) } else { $res += $fallback }
  }
  return $res
}

# As dez pranchas animadas usam descritores fixos por UUID. A geometria não
# depende de texto, massa, VFX ou projéteis presentes em cada linha.
function Processar-Personagem([object]$board){
  $g = $board.grid
  $inset = if($null -ne $g.inset){ [int]$g.inset } else { 0 }
  $sourceCellWidth = if($null -ne $board.sourceCellWidth){ [int]$board.sourceCellWidth } else { [int]$mapaAnim.sourceCellWidth }
  $sourceScale = if($null -ne $board.sourceScale){ [double]$board.sourceScale } else { [double]$mapaAnim.sourceScale }
  $limiarDivisao = if($null -ne $g.splitThreshold){ [double]$g.splitThreshold }
    elseif($null -ne $g.splitWide -and -not [bool]$g.splitWide){ 999.0 } else { 1.90 }
  $caminho = Join-Path $Origem ("{0}.png" -f $board.source)
  if(-not (Test-Path -LiteralPath $caminho)){ throw "Prancha inexistente: $caminho" }
  $pr = New-Object Prancha $caminho, ($inset -gt 0)

  for($skin=0; $skin -lt 2; $skin++){
    $base = [string]$board.skins[$skin]
    $projFrames = @(); $projCaixas = @()
    for($lin=0; $lin -lt $acoesEsperadas.Count; $lin++){
      $acao = $acoesEsperadas[$lin]
      $n = [int]$board.frames.$acao
      if($n -lt 1){ throw "$($board.key)/${acao}: contagem de frames inválida" }
      $sxBase = [double]$g.skinX[$skin]
      $larguraBase = [double]$g.skinWidth[$skin]
      $sx = [int]$sxBase + $inset
      $largura = [int]$larguraBase - 2*$inset
      $cy = [int]$g.rowBounds[$lin] + $inset
      $ch = [int]$g.rowBounds[$lin+1] - [int]$g.rowBounds[$lin] - 2*$inset
      if($g.mode -eq 'cells'){
        $frames = @(); $passo = $larguraBase/4.0
        for($f=0; $f -lt $n; $f++){
          $cx = [int][Math]::Round($sxBase+$f*$passo)+$inset
          $frames += $pr.Celula($cx,$cy,[int][Math]::Floor($passo)-2*$inset,$ch)
        }
      } else {
        $frames = @($pr.CelulasLinha($sx, $cy, $largura, $ch, $n,
          $sourceCellWidth, $limiarDivisao))
      }
      # Nesta prancha concreta, três poses fecham ilhas do checker. A limpeza
      # é deliberadamente local: todas as restantes continuam só com flood
      # a partir das margens.
      if($board.key -eq 'guerreiro' -and $acao -in @('skill','hurt','death')){
        $frames | ForEach-Object { $pr.LimparIlhasFundo($_, 1) }
      }
      $caixas = @()
      for($f=0; $f -lt $frames.Count; $f++){
        $box = [Prancha]::CaixaSolida($frames[$f])
        if($box[2] -eq 0){ $frames | ForEach-Object { $_.Dispose() }; throw "$base/$acao frame $f ficou vazio" }
        $caixas += ,$box
      }

      # D028: nas pranchas de atirador, a cauda de attack/skill mostra apenas o
      # projétil em voo (sem corpo). Esses frames saem da ação — o corpo deixa
      # de "piscar" — e alimentam o sheet <skin>_proj (o attack tem prioridade,
      # por ser a primeira das duas ações na ordem canónica).
      if($acao -in @('attack','skill') -and $frames.Count -gt 1){
        $maxH  = ($caixas | ForEach-Object { $_[3] } | Measure-Object -Maximum).Maximum
        $maxPx = ($caixas | ForEach-Object { $_[4] } | Measure-Object -Maximum).Maximum
        $corte = $frames.Count
        while($corte -gt 1){
          # Projétil em voo: blob horizontal (w>=1.18h), mais baixo e mais leve
          # do que o corpo da ação. Medido nas 10 pranchas: projéteis reais têm
          # rácio >=1.24 / altura <=71% / píxeis <=47%; o corpo mais parecido
          # (en_venom curvado) fica a 1.14 / 78% / 65%.
          $cx = $caixas[$corte-1]
          $ehProjetil = ($cx[2] -ge $cx[3]*1.18) -and ($cx[3] -lt $maxH*0.80) -and ($cx[4] -lt $maxPx*0.55)
          if(-not $ehProjetil){ break }
          $corte--
        }
        if($corte -lt $frames.Count){
          $cauda   = @($frames[$corte..($frames.Count-1)])
          $caudaCx = @($cauda | ForEach-Object { ,[Prancha]::MaiorComponenteCaixa($_) })
          if(-not $projFrames.Count){ $projFrames = $cauda; $projCaixas = $caudaCx }
          else { $cauda | ForEach-Object { $_.Dispose() } }
          $frames = @($frames[0..($corte-1)])
          $caixas = @($caixas[0..($corte-1)])
          $n = $frames.Count
          Write-Output ("       {0,-28} {1}: {2} frame(s) de projétil separados" -f "$base","$acao",$cauda.Count)
        }
      }

      [double[]]$baselines = @(Obter-Baselines $caixas)
      $sheet = [Prancha]::SheetFixa($frames, [int]$mapaAnim.cellSize,
        $sourceScale, $baselines, [double]$mapaAnim.anchor.y)
      $nome = "${base}_${acao}"
      $ficheiro = "${nome}.png"
      $saida = Join-Path $Destino $ficheiro
      $sheet.Save($saida, [System.Drawing.Imaging.ImageFormat]::Png)
      $sheet.Dispose(); $frames | ForEach-Object { $_.Dispose() }

      $metaSheets[$nome] = [ordered]@{
        file = $ficheiro
        action = $acao
        frames = $n
        loop = ($acao -in @('idle','walk'))
        cell = [ordered]@{ w=[int]$mapaAnim.cellSize; h=[int]$mapaAnim.cellSize }
        anchor = [ordered]@{ x=[double]$mapaAnim.anchor.x; y=[double]$mapaAnim.anchor.y }
        source = [string]$board.source
      }
      Write-Output ("sheet  {0,-28} frames={1} row={2} baselines={3}" -f $nome,$n,$lin,($baselines -join ','))
    }

    if($projFrames.Count){
      $nProj = $projFrames.Count
      $cw = [int][Math]::Ceiling((($projCaixas | ForEach-Object { $_[2] } | Measure-Object -Maximum).Maximum) * $sourceScale) + 4
      $chP = [int][Math]::Ceiling((($projCaixas | ForEach-Object { $_[3] } | Measure-Object -Maximum).Maximum) * $sourceScale) + 4
      $sheet = [Prancha]::SheetRecortes($projFrames, $projCaixas, $cw, $chP, $sourceScale)
      $nome = "${base}_proj"
      $ficheiro = "${nome}.png"
      $sheet.Save((Join-Path $Destino $ficheiro), [System.Drawing.Imaging.ImageFormat]::Png)
      $sheet.Dispose(); $projFrames | ForEach-Object { $_.Dispose() }
      $metaSheets[$nome] = [ordered]@{
        file = $ficheiro
        action = 'proj'
        frames = $nProj
        loop = $true
        cell = [ordered]@{ w=$cw; h=$chP }
        anchor = [ordered]@{ x=0.5; y=0.5 }
        source = [string]$board.source
      }
      Write-Output ("sheet  {0,-28} frames={1} (projétil, célula {2}x{3})" -f $nome,$nProj,$cw,$chP)
      $projFrames = @(); $projCaixas = @()
    }
  }
}

foreach($board in $mapaAnim.boards){ Processar-Personagem $board }

# ---------- equipamento: 3-4 secções × 3 colunas, interior da moldura ----------
$eqCol = @(@(66,426),@(450,810),@(834,1194))
function Icone([object]$pr, [int]$x0, [int]$y0, [int]$x1, [int]$y1, [string]$saida,
  [bool]$armadura=$false, [bool]$frisoTopoCurto=$false){
  $cel = $pr.CelulaIcone($x0, $y0, ($x1-$x0), ($y1-$y0))
  if($armadura){ $pr.LimparMolduraTopo($cel) }
  $cx = [Prancha]::CaixaSolida($cel)
  if($cx[2] -eq 0){ Write-Warning "vazio: $saida"; $cel.Dispose(); return }
  $esc = [Math]::Min((128*0.94)/$cx[2], (128*0.94)/$cx[3])
  $ico = [Prancha]::Sheet(@($cel), @(,$cx), 128, $esc, 0)
  if($frisoTopoCurto){
    # Nas variantes centrais, o friso isolado ocupa y=4..6; o capacete começa
    # em y=7. A faixa medida é removida sem atingir o corpo.
    $graf = [System.Drawing.Graphics]::FromImage($ico)
    $graf.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $pincel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Transparent)
    $graf.FillRectangle($pincel, 0, 0, 128, 7)
    $pincel.Dispose(); $graf.Dispose()
  }
  $ico.Save($saida, [System.Drawing.Imaging.ImageFormat]::Png)
  $ico.Dispose(); $cel.Dispose()
  $chave = [System.IO.Path]::GetFileNameWithoutExtension($saida)
  $metaIcons[$chave] = [ordered]@{
    file = [System.IO.Path]::GetFileName($saida)
    cell = [ordered]@{ w=128; h=128 }
    anchor = [ordered]@{ x=0.5; y=0.5 }
  }
  Write-Output ("icone  {0}" -f (Split-Path $saida -Leaf))
}
function Processar-Equipamento([string]$id, [string]$cl, [string[]]$cats){
  $pr = New-Object Prancha (Join-Path $Origem "$($P[$id]).png"), $true
  # secções = bandas largas na coluna central da prancha inteira
  $bandas = $pr.Bandas(20, 120)
  $nB = $bandas.Length/2
  if($nB -lt $cats.Length){ Write-Warning "${id}: $nB bandas para $($cats.Length) secções"; return }
  $ini = ($nB - $cats.Length)*2
  for($s=0; $s -lt $cats.Length; $s++){
    $y0 = $bandas[$ini+$s*2]; $y1 = $bandas[$ini+$s*2+1]
    for($k=0; $k -lt 3; $k++){
      $ehArmadura = $cats[$s] -eq 'armadura'
      Icone $pr ($eqCol[$k][0]+24) ($y0+20) ($eqCol[$k][1]-24) ($y1-58) (Join-Path $Destino ("icon_{0}_{1}{2}.png" -f $cl, $cats[$s], ($k+1))) $ehArmadura ($ehArmadura -and $k -eq 1)
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
    $nomeTex = "tex_{0:00}" -f $n
    $papel = switch($n){
      7 {'grelha'}
      8 {'poca_venenosa'}
      9 {'portal_provacao'}
      12 {'variante_parede'}
      14 {'variante_chao'}
      default {'base'}
    }
    $metaTextures[$nomeTex] = [ordered]@{
      file = "${nomeTex}.jpg"
      size = [ordered]@{ w=256; h=256 }
      variants = [ordered]@{ rows=3; cols=3 }
      role = $papel
    }
  }
}
$img.Dispose()
Write-Output 'texturas: 16 tiles'

# 120 sheets de ação + 6 de projétil (heroi_mago ×2 skins, en_necro, en_warlock, en_bone, en_plague)
if($metaSheets.Count -ne 126){ throw "META incompleto: $($metaSheets.Count)/126 sheets" }
if($metaIcons.Count -ne 48){ throw "META incompleto: $($metaIcons.Count)/48 ícones" }
if($metaTextures.Count -ne 16){ throw "META incompleto: $($metaTextures.Count)/16 texturas" }
$json = $manifest | ConvertTo-Json -Depth 10
$metaPath = Join-Path $Destino 'sprites-meta.json'
[System.IO.File]::WriteAllText($metaPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("META   {0} ({1} sheets, {2} ícones, {3} texturas)" -f $metaPath,$metaSheets.Count,$metaIcons.Count,$metaTextures.Count)
Write-Output 'FEITO — recorte v2'
