# VIGÍLIA — Crónicas dos Portais

RPG de ação mobile com lógica de mundo "caçadores e portais": há doze anos abriu-se a
**Fenda**, e desde então surgem portais para masmorras. Tu és um **Vigia** da Ordem,
com um dom raro — comandar as sombras dos inimigos derrotados.

Feito em HTML5/Canvas puro, sem dependências. Funciona como **PWA**: instala-se no
ecrã inicial do telemóvel e joga offline. Estética rústica/medieval (pedra, madeira,
tochas, pergaminho).

## Como jogar (testar já)

1. Na pasta do jogo: `python -m http.server 8080` (ou `npx serve`; abrir `index.html`
   diretamente também funciona, exceto o modo offline).
2. No telemóvel, abre o IP do PC na mesma rede e usa **"Adicionar ao ecrã inicial"**.
3. Para testar o equilíbrio: abre `tests/sim.html`.

## Controlos (combate)

| Controlo | Ação |
|---|---|
| **Joystick flutuante** (metade esquerda) | Movimento livre analógico — a velocidade segue a inclinação |
| **Botão grande** (espada) | Ataque básico com auto-mira ao alcance — nunca arrasta o personagem |
| **Botão de esquiva** (ou deslizar à direita) | Dash com i-frames, cooldown visível e rasto fantasma |
| **Botões de poder** (toque) | Poder instantâneo / no alvo mais próximo |
| **Botões de poder** (segurar + arrastar) | Mira direcional (Lâmina, Investida, Corrente) — largar dispara |
| Botão **A** | Auto-combate |
| Na vila | Toca/arrasta para andar; perto de um local aparece o botão de interação |

Vertical e horizontal; a interface adapta-se sozinha.

## Sistemas

- **Vila navegável**: Ferreiro (forja, encantamentos, runas, fusão), Mercador (stock
  diário), Círculo de Portais (ranks E–S + diária), Quadro de Missões (+ ranking),
  a tua Base (melhorias, Altar das Sombras, save) e o NPC Mestre Aldric (missões/tutoriais).
- **Atributos**: básicos (Força/Vitalidade/Agilidade, 1 ponto = +1) e avançados
  (Crítico, Dano Crítico, Sorte, Roubo de Vida, Penetração, Vel. de Cooldown —
  **2 pontos = 1 unidade**, meio ponto guardado, caps com "Máx.").
- **11 poderes** com 5 tiers (100→270% de efeito, cooldowns a encolher) e talentos
  à escolha a partir do tier 3. Tiers 4–5 exigem **Despertar**.
- **Despertar**: aos níveis 15 e 30, supera a Provação para desbloquear tiers
  superiores e os portais rank A/S.
- **Runas** na arma (queimadura, gelo, roubo, relâmpago em cadeia, fortuna) — caem
  de bosses rank C+.
- **Stamina**: cada portal custa 3 (diária grátis); regenera 1 a cada 6 min.
- **Sombras**: extraem-se dos bosses; o Altar da base e o poder Exército de Sombras
  tornam-nas mais fortes.

## Balanceamento

**Tudo** o que afeta números vive em [js/balance.js](js/balance.js), comentado linha
a linha — valores base, fórmulas de dano, curva de inimigos por rank, tiers de poderes,
custos, stamina, runas. Afinar o jogo = editar esse ficheiro.

## Save / Cloud

Guarda automático em `localStorage` + código de exportação/importação (na Base).
A interface `Cloud` em `js/game.js` está pronta a ligar a um backend (ex.: Firebase)
para sincronização real entre dispositivos.

## Empacotar para Android/iOS

```bash
npm init -y
npm i @capacitor/core @capacitor/cli
npx cap init "Vigilia" "com.exemplo.vigilia" --web-dir .
npx cap add android   # e/ou ios
npx cap open android  # gerar APK/AAB no Android Studio
```
