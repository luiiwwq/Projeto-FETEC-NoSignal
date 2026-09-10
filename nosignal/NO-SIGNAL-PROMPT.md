# Prompt completo para o OpenCode — No Signal

Você está trabalhando no desenvolvimento de um jogo de navegador chamado **“No Signal”**.

O projeto já possui um protótipo funcional completo. Nesta etapa, sua responsabilidade é melhorar e reconstruir visualmente **apenas a tela inicial**, aproximando-a o máximo possível da imagem de referência anexada ao projeto, sem quebrar a lógica existente do jogo.

---

## Objetivo principal

Criar uma tela inicial visualmente refinada, com aparência de jogo pixel art sci-fi, baseada diretamente na imagem de referência.

A imagem de referência deve ser tratada como a **principal fonte de verdade visual**. Não crie uma tela genérica de ficção científica, não use um layout moderno de dashboard e não substitua a composição por cards, gradientes ou componentes convencionais.

A primeira etapa é visual e de integração da tela inicial. **Não reescreva os sistemas completos de gameplay.**

A imagem de referência está disponível dentro do projeto neste caminho exato:

```text
assets/reference/no-signal-title-screen.png
```

O arquivo está na raiz do projeto, dentro da pasta `assets/reference/`. O caminho deve ser tratado como case-sensitive. Não altere o nome do arquivo, não mova a imagem e não sobrescreva a referência original.

---

## Referência visual obrigatória

Antes de implementar qualquer alteração visual, abra e analise o arquivo:

```text
assets/reference/no-signal-title-screen.png
```

Não use apenas a descrição textual deste prompt. A imagem deve ser analisada diretamente antes da implementação.

A imagem possui aproximadamente **1445 × 720 pixels**, com proporção panorâmica próxima de 2:1.

A referência visual representa o resultado desejado. A implementação deve tentar reproduzir a composição com alta fidelidade, respeitando principalmente:

- composição geral;
- proporção e enquadramento;
- posição do logotipo;
- posição, tamanho e corte de Marte;
- posição e tamanho da Terra;
- distribuição das estrelas;
- posição e espaçamento do menu;
- largura e altura dos botões;
- cores;
- textura pixel art;
- tipografia ou aparência pixelada dos textos;
- bordas, marcas, sombras e irregularidades dos painéis;
- hierarquia visual;
- áreas vazias e equilíbrio entre os elementos.

A composição da referência contém os seguintes elementos principais:

1. Um fundo de espaço profundo, quase preto, com tonalidade azul-marinho muito escura.

2. Pequenas estrelas e pontos luminosos distribuídos de forma discreta pelo fundo. As estrelas devem preservar a aparência pixelada e não parecer partículas 3D ou efeitos modernos.

3. Marte ocupa grande parte do lado direito da tela. O planeta é enorme e está parcialmente cortado pelas bordas superior, direita e inferior. Ele possui tons de laranja, vermelho queimado e marrom escuro, além de crateras e texturas irregulares em pixel art.

4. A Terra aparece em tamanho menor na região central-esquerda, entre o menu e Marte. Ela possui tons azulados, brancos e cinza, também com aparência pixelada.

5. O logotipo “NO SIGNAL” aparece no canto superior esquerdo. “NO” está em tamanho maior na parte superior e “SIGNAL” aparece abaixo, em tamanho menor. O logotipo possui aparência de tipografia pixelada e tons dourados, alaranjados e marrons.

6. O menu aparece no lado esquerdo, abaixo do logotipo, em uma coluna vertical com quatro itens:

```text
NEW GAME
LOAD GAME
OPTIONS
CREDITS
```

7. Os botões possuem aparência de placas ou painéis pixelados em laranja queimado e marrom-avermelhado. Eles têm bordas duras, marcas, falhas, irregularidades e aparência levemente desgastada. Não use cantos arredondados modernos.

8. Os textos dos botões são claros e possuem aparência de fonte pixelada, com alto contraste em relação aos painéis.

9. O item selecionado deve possuir um destaque visual compatível com a referência, como brilho discreto, diferença de cor, contorno ou mudança de iluminação. Não use neon exagerado.

10. A composição possui uma grande área escura no lado esquerdo e uma grande massa visual de Marte no lado direito. Não centralize todos os elementos.

Preserve a assimetria original: interface no lado esquerdo, Marte dominando o lado direito e Terra funcionando como ponto de equilíbrio visual entre os dois.

Se a imagem não puder ser aberta, pare antes de implementar e informe claramente o problema. Não invente uma nova composição, não crie uma tela genérica de ficção científica e não substitua a referência por gradientes, cards ou imagens aleatórias.

---

## Direção de arte

A direção de arte deve seguir estas regras:

- pixel art sci-fi;
- baixa resolução aparente;
- bordas e detalhes com aparência de pixels;
- paleta escura com laranjas queimados;
- atmosfera de isolamento espacial;
- sensação de tecnologia antiga, nave danificada ou equipamento desgastado;
- contraste entre o vazio azul-marinho do espaço e o volume quente de Marte;
- interface com personalidade de jogo, não de site institucional.

Use esta paleta como ponto de partida e ajuste-a depois da comparação com a imagem:

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

Não utilize como solução principal:

- gradientes roxos;
- neon azul ou rosa;
- glassmorphism;
- cards arredondados;
- sombras suaves de interface moderna;
- fonte Arial, Inter, Roboto ou outra fonte genérica nos elementos principais;
- ícones genéricos que não aparecem na referência;
- layout centralizado;
- animações chamativas que descaracterizem o pixel art;
- planetas em CSS ou imagens aleatórias quando a referência ou os assets existentes já puderem ser utilizados.

---

## Preservação do protótipo existente

Antes de modificar qualquer código:

1. Leia a estrutura atual do projeto.
2. Identifique o ponto de entrada da aplicação.
3. Encontre o componente, classe ou arquivo responsável pela tela inicial.
4. Identifique os eventos já associados a `New Game`, `Load Game`, `Options` e `Credits`.
5. Entenda como o protótipo mantém estado, navegação e telas.
6. Identifique os assets disponíveis.
7. Preserve a lógica existente.
8. Não apague sistemas de gameplay já implementados.
9. Não reescreva o projeto do zero.
10. Não substitua arquivos inteiros sem necessidade.
11. Não remova funções existentes apenas para simplificar a interface.
12. Não crie uma segunda lógica paralela para os botões.

Se a lógica atual estiver acoplada à aparência antiga, refatore somente o necessário para separar visual e comportamento. Os eventos e funções públicas existentes devem continuar funcionando.

A prioridade é:

1. preservar a funcionalidade do protótipo;
2. reconstruir visualmente a tela inicial;
3. melhorar a organização da camada de UI;
4. preparar a interface para futuras telas.

---

## Tecnologias e restrições

Use somente:

- HTML5;
- CSS3;
- JavaScript moderno;
- módulos ES com `type="module"` quando fizer sentido;
- os recursos e dependências que já existem no projeto.

Não adicione frameworks de frontend nesta etapa.

Não adicione React, Vue, Angular, Svelte, Bootstrap ou bibliotecas de UI sem autorização explícita.

Não adicione backend, banco de dados ou novas APIs de servidor.

Não altere a lógica de combate, exploração, eventos, inventário, progressão ou salvamento, exceto quando for absolutamente necessário para manter a tela inicial integrada.

---

## Contexto futuro do jogo

“No Signal” será um jogo de navegador com:

- exploração por rotas ramificadas;
- escolhas narrativas;
- combustível;
- integridade da nave;
- oxigênio;
- suprimentos;
- eventos aleatórios contextuais;
- inventário;
- progressão;
- combate por turnos;
- consequências e finais diferentes.

Esses sistemas são apenas contexto arquitetural. Eles não devem ser implementados, reescritos ou expandidos nesta etapa visual, exceto se já existirem no protótipo e precisarem ser preservados.

---

## Estratégia de assets

Primeiro verifique se o projeto já possui imagens, fontes, ícones, sprites ou texturas que possam ser reutilizados.

Se houver assets separados compatíveis, utilize-os para montar uma interface composta por camadas reais.

A imagem original da referência está em:

```text
assets/reference/no-signal-title-screen.png
```

Preserve esse arquivo original. Não edite, sobrescreva, mova ou renomeie a imagem de referência.

Se a imagem de referência for o único asset visual disponível, ela pode ser utilizada como camada de cenário. Porém, os controles do menu devem continuar sendo elementos HTML reais e interativos.

Não deixe os textos `NEW GAME`, `LOAD GAME`, `OPTIONS` e `CREDITS` existirem apenas como pixels gravados na imagem. Sempre que possível:

1. utilize a arte de espaço, Marte e Terra como camada visual de cenário;
2. mantenha o menu como elementos HTML reais;
3. mantenha os textos dos botões como texto acessível;
4. mantenha o logotipo como asset separado ou elemento visual separado quando possível;
5. evite que o texto do menu fique somente dentro de uma imagem;
6. se a referência contiver o menu incorporado e não houver assets separados, cubra ou substitua cuidadosamente a área do menu por uma camada visual compatível;
7. sobreponha botões HTML reais alinhados exatamente à composição da referência;
8. conecte os botões aos handlers existentes do protótipo.

Se for necessário criar derivados da imagem de referência, organize-os sem destruir o original. Exemplos de arquivos possíveis:

```text
assets/reference/no-signal-title-screen.png
assets/images/no-signal-scene.png
assets/images/no-signal-logo.png
assets/images/mars-background.png
assets/images/earth.png
```

Não use placeholders genéricos azuis, planetas em CSS ou imagens aleatórias de bancos de imagem quando isso reduzir a semelhança com a referência.

Se algum asset separado estiver ausente, mantenha a proporção e a posição esperadas, use um placeholder discreto somente quando necessário e registre o arquivo ausente na resposta final.

---

## Estrutura de UI recomendada

Adapte esta estrutura à arquitetura existente do projeto. Não recrie pastas se elas já estiverem organizadas de outra forma.

```html
<div class="title-screen">
  <div class="space-scene" aria-hidden="true">
    <div class="starfield"></div>
    <div class="mars-layer"></div>
    <div class="earth-layer"></div>
  </div>

  <main class="title-screen__content">
    <header class="title-screen__brand">
      <img class="title-screen__logo" src="..." alt="No Signal" />
    </header>

    <nav class="title-screen__menu" aria-label="Main menu">
      <button type="button">New Game</button>
      <button type="button">Load Game</button>
      <button type="button">Options</button>
      <button type="button">Credits</button>
    </nav>
  </main>
</div>
```

Use os nomes de classes e a organização que já existirem no projeto quando forem adequados. A estrutura acima é uma referência de separação entre cenário, marca e controles; não é obrigatório copiar os nomes literalmente.

---

## Comportamento dos botões

Não remova o comportamento já existente dos botões.

Se o protótipo já possuir as ações, conecte o novo visual aos mesmos handlers existentes.

Se alguma ação ainda não existir, o botão deve:

- ser um elemento HTML real;
- funcionar com mouse;
- funcionar com teclado;
- possuir foco visível;
- responder a `hover` e `active`;
- exibir um feedback temporário ou abrir a tela placeholder correspondente;
- não iniciar sistemas que ainda não foram solicitados nesta etapa.

Os botões não devem ficar apenas decorativos ou sem evento.

A navegação por teclado deve funcionar com `Tab` e `Enter`. O foco visual deve combinar com a estética pixel art.

Os botões não devem:

- iniciar uma partida real se isso ainda não existir no protótipo;
- executar combate;
- alterar combustível ou integridade;
- gerar eventos;
- controlar inventário;
- salvar progresso novo;
- chamar backend novo;
- usar banco de dados.

Se uma dessas funções já existir no protótipo, preserve-a e apenas conecte o novo visual ao fluxo existente.

---

## Responsividade

A composição principal deve ser desenvolvida primeiro para a proporção da imagem de referência, aproximadamente 1445 × 720.

Depois, adapte a interface para:

- desktop em 1445 × 720;
- desktop em 1280 × 720;
- notebook em 1024 × 768;
- celular em 390 × 844.

No desktop, preserve a composição horizontal:

- menu à esquerda;
- Marte à direita;
- Terra na região intermediária;
- logotipo acima do menu.

No celular, não apenas reduza todos os elementos proporcionalmente. Reorganize com cuidado para preservar a hierarquia visual e manter os botões legíveis e utilizáveis.

Evite overflow horizontal.

Os botões devem possuir área de toque adequada, mas sem perder o estilo visual da referência.

Não altere a composição desktop para uma estrutura genérica centralizada apenas para facilitar a implementação.

---

## Animação e efeitos

Use animações discretas e compatíveis com pixel art, como:

- brilho muito sutil no destaque do botão selecionado;
- pequena variação de intensidade nas estrelas;
- leve pulsação atmosférica em Marte;
- transição curta ao entrar na tela inicial;
- efeito de ruído ou flicker muito controlado, somente se combinar com a referência.

Não anime excessivamente o planeta, não use partículas 3D e não aplique efeitos modernos que reduzam a aparência pixelada.

Respeite `prefers-reduced-motion` e reduza ou desative animações quando o usuário solicitar menos movimento.

As animações de interface devem ser curtas, discretas e não podem alterar o layout de forma inesperada.

---

## Qualidade do código

- Não coloque todo o CSS dentro de `index.html`.
- Não coloque toda a lógica em um único arquivo se houver componentes independentes.
- Use nomes de classes claros.
- Prefira classes semânticas e consistentes.
- Mantenha separadas estrutura, estilo e comportamento.
- Use HTML semântico.
- Inclua estados de foco visíveis.
- Use variáveis CSS para cores, espaçamentos, camadas e dimensões recorrentes.
- Evite valores repetidos sem necessidade.
- Evite `!important` salvo quando for realmente indispensável.
- Mantenha a estrutura preparada para receber futuras telas do jogo.
- Não adicione dependências sem necessidade.
- Não crie código de backend ou banco de dados.
- Não altere a lógica do protótipo sem justificar.

---

## Processo obrigatório de implementação

Execute as etapas nesta ordem.

### Etapa 1 — Inspeção do projeto

Leia a estrutura atual do projeto e identifique:

- o ponto de entrada;
- o arquivo ou componente da tela inicial;
- os arquivos de estilo existentes;
- os handlers dos botões;
- os assets já disponíveis;
- o modo de execução local;
- as dependências existentes;
- os sistemas do protótipo que não podem ser quebrados.

Não implemente antes de entender como o projeto está organizado.

### Etapa 2 — Análise da referência

Abra e analise:

```text
assets/reference/no-signal-title-screen.png
```

Faça uma análise curta contendo:

- proporção da referência;
- posição aproximada dos elementos;
- paleta;
- hierarquia visual;
- tipografia;
- escala e corte de Marte;
- posição da Terra;
- estrutura do menu;
- assets disponíveis e ausentes;
- estratégia para manter os controles interativos.

Não invente elementos que não estejam na imagem.

### Etapa 3 — Planejamento visual

Antes de escrever o código final, defina como a tela será composta:

- quais elementos serão imagens;
- quais elementos serão HTML;
- quais elementos serão CSS;
- quais elementos serão reutilizados do protótipo;
- como o menu será alinhado à referência;
- como a imagem será adaptada sem destruir a interatividade.

Se houver mais de uma estratégia possível, escolha a que melhor preserve a fidelidade visual e a funcionalidade existente.

### Etapa 4 — Implementação visual

Reestruture somente a interface inicial necessária.

Preserve a lógica existente e use CSS modularizado.

Não substitua a tela por um screenshot estático.

### Etapa 5 — Integração

Conecte os botões visuais aos handlers existentes.

Não crie uma segunda lógica paralela para o protótipo.

Verifique se os fluxos existentes de `New Game`, `Load Game`, `Options` e `Credits` continuam funcionando ou continuam apresentando seus placeholders corretamente.

### Etapa 6 — Execução

Execute o projeto localmente e verifique se a página abre sem erros.

Verifique o console do navegador e corrija erros de JavaScript, caminhos quebrados, fontes não carregadas e imagens ausentes.

### Etapa 7 — Comparação visual

Renderize ou capture a tela inicial em aproximadamente 1445 × 720 e compare com a referência original:

```text
assets/reference/no-signal-title-screen.png
```

Verifique especialmente:

- posição e tamanho do logotipo;
- posição e tamanho do menu;
- largura e altura dos botões;
- espaçamento vertical dos itens;
- tamanho e corte de Marte;
- posição e tamanho da Terra;
- quantidade e distribuição das estrelas;
- paleta de cores;
- intensidade das sombras;
- textura pixel art;
- alinhamento dos textos;
- contraste;
- ausência de elementos inventados;
- ausência de overflow;
- preservação da composição assimétrica.

Faça ajustes até que a tela renderizada fique visualmente próxima da referência. Não declare a tarefa concluída apenas porque o código compila.

### Etapa 8 — Verificação responsiva

Teste a tela em desktop e celular.

Confirme que:

- nenhum texto fica cortado;
- nenhum botão sai da tela;
- não há rolagem horizontal indesejada;
- os botões continuam acessíveis por toque;
- a composição continua reconhecível;
- o foco de teclado permanece visível;
- as imagens não ficam distorcidas de forma excessiva.

---

## Critérios de aceitação

A tarefa só está concluída quando:

- a tela inicial se aproxima visualmente da imagem de referência;
- o fundo possui estética pixel art espacial;
- Marte domina o lado direito como na referência;
- a Terra aparece na região correta;
- o logotipo e o menu ocupam a região esquerda;
- os quatro botões possuem aparência coerente com a imagem;
- os botões são elementos HTML reais;
- os eventos existentes continuam funcionando;
- não há erros no console;
- não há caminhos quebrados para assets;
- não há overflow horizontal em desktop ou celular;
- a interface funciona com teclado;
- o foco de teclado é visível;
- não foram adicionados sistemas de gameplay novos nesta etapa;
- os assets ausentes estão documentados;
- a imagem original em `assets/reference/no-signal-title-screen.png` foi preservada;
- os arquivos existentes não foram destruídos ou substituídos sem necessidade;
- a tela foi efetivamente renderizada e comparada com a referência.

---

## Resposta final obrigatória

Ao finalizar, informe:

1. quais arquivos foram lidos;
2. quais arquivos foram criados ou alterados;
3. quais componentes visuais foram implementados;
4. quais handlers existentes foram preservados ou conectados;
5. quais assets foram reutilizados;
6. quais assets ainda estão ausentes;
7. quais decisões foram tomadas para aproximar a interface da referência;
8. quais ajustes responsivos foram feitos;
9. como executar o projeto localmente;
10. quais limitações ainda existem em relação à imagem de referência;
11. quais sistemas foram deliberadamente deixados para uma etapa posterior;
12. se a tela foi testada em aproximadamente 1445 × 720 e em celular.

Não diga apenas que a tarefa foi concluída. Descreva objetivamente o que foi alterado e o que ainda falta.
