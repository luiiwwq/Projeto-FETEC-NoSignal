# Prompt completo para o Antigravity — No Signal

Você está trabalhando no desenvolvimento de um jogo de navegador chamado **No Signal**.

O projeto já possui um protótipo funcional completo, com sistemas de jogo e botões já implementados. Nesta etapa, sua tarefa é melhorar a tela inicial visualmente, aproximando-a da imagem de referência, sem destruir ou reescrever a lógica existente.

A tela inicial deve ficar visualmente refinada, com aparência de jogo sci-fi em pixel art, mas os botões precisam continuar sendo elementos HTML reais e interativos.

---

## 1. Objetivo desta etapa

Implemente somente a apresentação visual da tela inicial do jogo.

Não implemente novos sistemas completos de gameplay nesta etapa. Não crie combate, exploração, eventos, inventário, progressão, salvamento ou backend novo.

O objetivo é:

- usar a scene espacial limpa como cenário;
- integrar a logo separada;
- manter os botões já existentes no protótipo;
- melhorar a composição visual com HTML, CSS e JavaScript;
- preparar a tela para desktop e mobile;
- preservar toda a lógica já existente;
- deixar a interface organizada para receber outras telas futuramente.

A imagem antiga que continha logo, menu, botões e textos juntos foi descartada intencionalmente. Não procure essa imagem antiga, não tente restaurá-la e não reconstrua a tela usando uma imagem única com a interface gravada dentro dela.

---

## 2. Imagem de referência e assets atuais

A referência original da composição pode ser consultada no arquivo:

```text
frontend/src/assets/references/no-signal-title-screen.png
```

Porém, essa imagem deve ser usada apenas como referência visual, caso ainda exista. A implementação atual deve utilizar os novos assets separados.

A pasta `frontend/src/assets/references/` deverá conter os seguintes arquivos ou equivalentes com nomes semelhantes:

```text
frontend/src/assets/references/
├── no-signal-scene.png
├── no-signal-scene@2x.png
├── no-signal-scene-mobile.png
├── no-signal-logo.png
└── no-signal-logo@2x.png
```

Os nomes esperados significam:

| Arquivo | Função |
|---|---|
| `no-signal-scene.png` | Scene limpa em resolução padrão, sem logo, menu ou botões |
| `no-signal-scene@2x.png` | A mesma scene limpa em resolução 2x |
| `no-signal-scene-mobile.png` | Variante vertical/mobile da scene, sem logo, menu ou botões |
| `no-signal-logo.png` | Logo separada em resolução padrão, com transparência quando possível |
| `no-signal-logo@2x.png` | Logo separada em resolução 2x |

Se os arquivos tiverem nomes ligeiramente diferentes, leia a pasta e identifique os arquivos pela função e pelas dimensões. Não renomeie, mova ou sobrescreva os assets sem necessidade.

A imagem composta antiga com logo e menu não deve ser recriada. O cenário, a logo e os controles precisam continuar separados.

---

## 3. Leitura obrigatória do projeto antes de editar

Antes de alterar qualquer arquivo:

1. leia a estrutura completa do projeto;
2. leia o `frontend/index.html`;
3. leia o `frontend/src/app.js`;
4. leia o `frontend/src/ui/titleScreen.js`, se existir;
5. leia o `frontend/src/ui/screens.js`;
6. leia os arquivos de estilo em `frontend/src/styles/`;
7. localize os handlers atuais de `New Game`, `Load Game`, `Options` e `Credits`;
8. leia os arquivos de estado que forem usados pela tela inicial;
9. verifique os assets disponíveis em `frontend/src/assets/`;
10. verifique a pasta `scripts/`, mas não execute scripts Python sem necessidade.

Não recrie o projeto do zero.

Não substitua arquivos inteiros sem necessidade.

Não apague sistemas existentes.

Não altere o backend para realizar uma tarefa exclusivamente visual.

Antes de implementar, apresente um plano curto dizendo:

- quais arquivos serão alterados;
- quais arquivos serão preservados;
- como a scene padrão será usada;
- como a scene mobile será selecionada;
- como a logo será posicionada;
- como os botões existentes serão preservados.

---

## 4. Estrutura atual e responsabilidades

O projeto possui uma separação entre backend e frontend. Para esta tarefa, trabalhe principalmente dentro de:

```text
frontend/
└── src/
    ├── app.js
    ├── assets/
    ├── styles/
    └── ui/
```

A separação de responsabilidades deve permanecer semelhante a esta:

```text
app.js          = inicialização e coordenação da aplicação
titleScreen.js  = tela de título, logo e menu inicial
screens.js      = outras telas do jogo
state/          = estado da partida
systems/        = regras do jogo
content/        = dados narrativos e definições do jogo
styles/         = aparência e responsividade
```

Se `titleScreen.js` já existe, use-o para a tela inicial. Não mova essa responsabilidade para `screens.js` sem uma justificativa clara.

Os botões já implementados devem continuar conectados aos handlers atuais. Se a aparência antiga estiver misturada com os eventos, refatore somente o necessário para separar o visual da lógica.

---

## 5. Direção visual da referência

A tela deve preservar a identidade visual da referência:

- pixel art sci-fi;
- espaço profundo quase preto e azul-marinho;
- Marte enorme ocupando principalmente o lado direito;
- Terra menor entre o espaço e Marte;
- estrelas discretas e pixeladas;
- logo No Signal no lado esquerdo;
- menu vertical no lado esquerdo;
- painéis em laranja queimado e marrom-avermelhado;
- bordas duras e aparência levemente desgastada;
- tipografia pixelada;
- atmosfera de isolamento espacial;
- composição assimétrica, não centralizada.

A referência visual não deve ser transformada em um layout moderno de dashboard.

Não use como solução principal:

- cards arredondados;
- glassmorphism;
- gradientes roxos;
- neon azul ou rosa;
- fonte Inter, Arial, Roboto ou outra fonte genérica nos elementos principais;
- sombras suaves de interface moderna;
- ícones genéricos que não aparecem na referência;
- planetas criados com formas CSS simples;
- a imagem inteira como um único elemento que contém os botões;
- elementos visuais inventados que não sejam necessários para a composição.

Uma paleta inicial aproximada pode ser:

```css
--space-black: #090913;
--space-blue: #101020;
--mars-dark: #71301f;
--mars-red: #a94322;
--mars-orange: #d85a22;
--mars-light: #ed8733;
--logo-gold: #e39a3e;
--panel-brown: #71301f;
--panel-orange: #b95129;
--text-cream: #f3c17d;
--pixel-shadow: #35151a;
```

Ajuste as cores comparando diretamente com os assets e com a referência. Não trate essa paleta como valor absoluto se ela divergir visualmente da imagem.

---

## 6. Uso da scene padrão e da scene 2x

A scene padrão deve ser usada em telas normais. A scene 2x deve ser usada em telas de alta densidade ou quando o navegador permitir escolher automaticamente o asset de maior resolução.

Não faça upscale repetido no navegador.

Não aplique filtros de blur.

Não deforme a scene alterando largura e altura de forma independente.

Preserve a proporção original e use `object-fit`, `background-size` ou `image-set` corretamente.

Quando fizer sentido, use `image-set` para permitir que o navegador selecione a resolução adequada:

```css
.title-screen__scene {
  background-image: image-set(
    url('../assets/references/no-signal-scene.png') 1x,
    url('../assets/references/no-signal-scene@2x.png') 2x
  );
}
```

Se o bundler ou a estrutura atual não aceitar `image-set` dessa maneira, use uma alternativa compatível com o projeto. Não invente caminhos que não existem.

A scene deve ocupar o fundo da tela sem conter logo, menu, botões, mensagens ou textos gravados dentro dela.

A scene deve manter:

- Marte no lado direito;
- Terra na região intermediária esquerda;
- espaço vazio suficiente no lado esquerdo para a interface;
- estrelas distribuídas de forma semelhante à referência;
- textura pixel art sem borrado excessivo.

---

## 7. Uso da scene mobile

Não crie versões separadas para desktop, ultrawide ou tablet nesta etapa.

Apenas a scene padrão e a scene mobile devem ser utilizadas:

```text
no-signal-scene.png
no-signal-scene@2x.png
no-signal-scene-mobile.png
```

A scene mobile possui um enquadramento vertical próprio e deve ser selecionada somente em telas estreitas.

Use uma media query apropriada, por exemplo:

```css
.title-screen__scene {
  background-image: image-set(
    url('../assets/references/no-signal-scene.png') 1x,
    url('../assets/references/no-signal-scene@2x.png') 2x
  );
}

@media (max-aspect-ratio: 4/5) {
  .title-screen__scene {
    background-image: url('../assets/references/no-signal-scene-mobile.png');
    background-position: center center;
  }
}
```

Ajuste os caminhos de acordo com a estrutura real do projeto.

Não use a scene desktop simplesmente esticada para preencher o celular se a variante mobile existir.

Não crie uma variante mobile da logo se `no-signal-logo.png` e `no-signal-logo@2x.png` já puderem ser redimensionadas corretamente. A logo deve continuar separada e pode ser reposicionada ou reduzida por CSS.

No celular, reorganize a interface com cuidado:

- logo em posição legível;
- menu em coluna;
- botões acessíveis por toque;
- Marte e Terra enquadrados conforme a scene mobile;
- nenhum overflow horizontal;
- nenhuma deformação da logo.

---

## 8. Uso da logo padrão e 2x

A logo deve ser um elemento separado da scene.

Use:

```text
no-signal-logo.png
no-signal-logo@2x.png
```

A logo não deve ser redesenhada com uma fonte genérica se os assets já estiverem disponíveis.

Não use a logo incorporada na imagem antiga, pois essa imagem foi descartada.

Se possível, renderize a logo com uma fonte ou imagem que preserve transparência e pixels definidos.

Para a logo pixelada, não aplique blur ou suavização excessiva.

Uma implementação possível é:

```css
.title-screen__logo {
  width: clamp(180px, 22vw, 340px);
  height: auto;
  image-rendering: pixelated;
}
```

Ajuste o tamanho com base na referência e teste em desktop e mobile.

Se o asset 2x estiver disponível, o navegador pode escolhê-lo automaticamente por `image-set` ou pelo mecanismo de resolução compatível com a arquitetura do projeto.

---

## 9. Menu e botões existentes

Os botões já foram implementados no protótipo e não devem ser apagados ou recriados de maneira paralela.

Mantenha os handlers e comportamentos já existentes para:

```text
New Game
Load Game
Options
Credits
```

O trabalho desta etapa é principalmente visual: posicionar, estilizar e integrar os botões existentes sobre a scene limpa.

Os botões devem:

- continuar sendo elementos HTML reais;
- manter seus eventos atuais;
- funcionar com mouse;
- funcionar com teclado;
- possuir foco visível;
- responder a hover e active;
- preservar a aparência de placas pixeladas;
- manter o texto legível;
- não depender de texto gravado em uma imagem;
- não iniciar novos sistemas que não existiam antes.

Não substitua os botões por uma imagem.

Não remova handlers apenas porque a interface foi redesenhada.

Não implemente novamente a lógica de New Game, Load Game, Options ou Credits se ela já existir.

Se uma ação ainda não estiver implementada, preserve o comportamento atual do protótipo e apenas mostre um feedback adequado, sem criar gameplay novo.

---

## 10. HTML e CSS recomendados

A interface deve separar scene, logo, menu e elementos auxiliares:

```html
<div class="title-screen">
  <div class="title-screen__scene" aria-hidden="true"></div>

  <main class="title-screen__content">
    <header class="title-screen__brand">
      <img
        class="title-screen__logo"
        src="..."
        alt="No Signal"
      />
    </header>

    <nav class="title-screen__menu" aria-label="Menu principal">
      <!-- Reutilize os botões e handlers existentes -->
    </nav>

    <!-- Mensagens ou versão somente se já existirem no protótipo -->
  </main>
</div>
```

Use a organização já existente no projeto. O exemplo não exige que os nomes sejam copiados literalmente.

A scene deve ficar em uma camada visual, enquanto logo e menu permanecem em camadas superiores:

```css
.title-screen {
  position: relative;
  width: 100vw;
  height: 100vh;
  min-height: 480px;
  overflow: hidden;
  background: var(--space-black);
}

.title-screen__scene {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
}

.title-screen__content {
  position: relative;
  z-index: 1;
  min-height: 100%;
}
```

Não copie cegamente esse CSS. Ajuste a implementação à arquitetura e aos estilos existentes.

---

## 11. Responsividade

Nesta etapa, implemente somente estes dois contextos principais:

### Desktop e telas horizontais

Use:

```text
no-signal-scene.png
no-signal-scene@2x.png
```

Preserve a composição horizontal:

- logo no lado esquerdo;
- menu abaixo da logo;
- Terra entre o menu e Marte;
- Marte dominando o lado direito;
- espaço vazio no lado esquerdo.

### Mobile e telas estreitas

Use:

```text
no-signal-scene-mobile.png
```

Adapte a posição da logo e dos botões para uma composição vertical legível.

Não é necessário criar nesta etapa:

- `scene-desktop.png` separado;
- `scene-ultrawide.png`;
- `scene-tablet.png`;
- variantes extras para cada resolução exata.

Apenas teste a scene padrão em mais de uma resolução horizontal para garantir que ela não fique deformada.

Teste pelo menos:

- desktop 1445 × 720;
- desktop 1920 × 1080;
- celular 390 × 844.

---

## 12. Python e scripts auxiliares

A pasta `scripts/` contém ferramentas Python que podem ter sido criadas para preparar imagens ou assets.

Não apague os scripts existentes.

Não execute scripts Python sem antes verificar o que eles fazem.

Para esta etapa, priorize HTML, CSS e JavaScript no frontend.

Python pode ser usado somente como ferramenta auxiliar para:

- verificar dimensões;
- converter JPG para PNG;
- preparar uma versão 2x;
- recortar ou organizar assets;
- validar arquivos gerados.

Python não deve ser executado pelo navegador, importado para o frontend ou transformado em dependência de runtime.

Se usar algum script, informe:

- qual script foi usado;
- qual foi o objetivo;
- quais arquivos foram gerados;
- quais arquivos foram modificados;
- como repetir o processamento.

Se não for necessário usar Python, mantenha a pasta `scripts/` intacta.

---

## 13. Animações e efeitos

Use efeitos discretos e compatíveis com a referência:

- destaque suave no botão selecionado;
- pequenas variações nas estrelas, se já existirem;
- leve pulsação atmosférica em Marte, se combinar com a arte;
- transição curta ao entrar na tela;
- efeito de ruído muito controlado, somente se já fizer parte da estética.

Não use:

- partículas 3D;
- efeitos neon exagerados;
- animações que deformem a scene;
- zoom contínuo em Marte;
- movimentos que dificultem a leitura do menu;
- transições longas ou modernas demais.

Respeite `prefers-reduced-motion`.

---

## 14. Processo obrigatório

Execute as etapas nesta ordem.

### Etapa A — Inspeção

Leia o projeto, os assets, a tela inicial e os handlers atuais. Confirme que a imagem composta antiga não está mais presente e que os novos assets estão disponíveis.

### Etapa B — Análise visual

Abra a referência e as imagens da scene limpa. Identifique:

- proporções;
- posição de Marte;
- posição da Terra;
- espaço reservado para logo e menu;
- diferenças entre scene padrão e mobile;
- dimensões padrão e 2x;
- transparência da logo;
- possíveis problemas de nitidez.

### Etapa C — Plano

Apresente um plano curto com os arquivos que serão alterados e explique como os assets serão usados.

### Etapa D — Implementação

Integre scene, logo e botões sem apagar a lógica existente.

### Etapa E — Validação técnica

Execute o projeto localmente. Verifique:

- console sem erros;
- caminhos de imagens funcionando;
- logo carregando;
- scene padrão carregando;
- scene 2x sendo usada quando apropriado;
- scene mobile sendo usada em tela estreita;
- botões ainda respondendo;
- ausência de overflow horizontal.

### Etapa F — Validação visual

Capture ou renderize a tela em:

```text
1445 × 720
1920 × 1080
390 × 844
```

Compare com a referência e corrija:

- escala da logo;
- posição do menu;
- tamanho dos botões;
- enquadramento de Marte;
- posição da Terra;
- contraste;
- nitidez;
- proporção da scene;
- espaço entre os elementos;
- comportamento mobile.

Não declare a tarefa concluída apenas porque o código compila.

---

## 15. Critérios de aceitação

A tarefa só estará concluída quando:

- a scene limpa estiver sendo usada como cenário;
- a imagem antiga com logo e menu não for necessária;
- a logo estiver separada e funcionando como asset independente;
- a scene padrão funcionar em telas horizontais;
- a scene 2x estiver disponível ou integrada corretamente;
- a scene mobile for usada em telas estreitas;
- não forem criadas variantes desktop, ultrawide ou tablet desnecessárias;
- os botões existentes continuarem funcionando;
- os handlers existentes forem preservados;
- o menu não estiver gravado dentro de uma imagem;
- não houver imagem deformada;
- não houver blur excessivo;
- não houver erro no console;
- não houver caminhos quebrados;
- não houver overflow horizontal;
- a tela tiver aparência coerente com a referência pixel art;
- a logo estiver nítida;
- Marte e Terra estiverem bem enquadrados;
- a interface funcionar com mouse, teclado e toque;
- a imagem original ou assets de referência não forem sobrescritos;
- os arquivos de backend, state, systems e content não forem alterados sem necessidade;
- a tela tiver sido testada em desktop e mobile.

---

## 16. Resposta final obrigatória

Ao terminar, informe:

1. quais arquivos foram lidos;
2. quais arquivos foram criados ou alterados;
3. quais assets foram encontrados;
4. quais nomes e caminhos reais dos assets foram usados;
5. como a scene padrão foi integrada;
6. como a scene 2x foi integrada;
7. como a scene mobile foi selecionada;
8. como a logo foi integrada;
9. quais handlers dos botões foram preservados;
10. se algum script Python foi usado;
11. quais testes foram executados;
12. quais resoluções foram verificadas;
13. quais limitações ainda existem;
14. quais sistemas continuam deliberadamente para etapas futuras;
15. como executar o projeto localmente.

Não diga apenas que a tarefa foi concluída. Relate objetivamente o que foi alterado e o que ainda precisa ser feito.
