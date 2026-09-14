---
name: pixel-map-art
description: Criar, reconstruir e corrigir mapas pixel art jogáveis usando máscaras de terreno, tilemaps, microtiles, camadas de renderização, colisões e validação por screenshot. Use ao criar ou alterar qualquer mapa, dungeon, caverna, superfície, arena ou região do No Signal.
license: MIT
metadata:
  project: No Signal
  focus: reusable-map-workflow
---

# Skill: Pixel Map Art

Use esta skill para criar ou corrigir qualquer mapa visual e jogável do projeto **No Signal**. Ela serve para superfícies, cavernas, catacumbas, arenas, castelos, salas, regiões externas e mapas futuros. O objetivo é produzir uma composição pixel art integrada, legível e navegável, não um retângulo com textura repetida e sprites soltos.

## Regra principal

Antes de adicionar props, resolva a composição do terreno. Se a screenshot ainda parece “textura de chão + objetos espalhados”, a tarefa não está concluída. Não tente resolver falhas estruturais adicionando mais itens em `decorations`.

O mapa precisa ser planejado como uma composição de tiles: piso, bordas, paredes, transições, obstáculos, decoração, caminhos, áreas de interesse e camadas devem trabalhar juntos.

## Primeiro: descobrir o mapa-alvo

Antes de editar, identifique:

- qual mapa está sendo criado ou alterado;
- seu ID, dimensões, `tileSize`, spawn, saídas e áreas de gameplay;
- o tipo visual: superfície, caverna, dungeon, arena, sala ou região externa;
- a referência visual, se existir;
- o tileset e os assets corretos para esse mapa;
- o renderer e a câmera usados;
- o sistema de colisões, interação, combate e transição envolvidos.

Leia os arquivos realmente relacionados ao mapa. No No Signal, normalmente isso inclui `content/maps.js`, `content/tilemap.js`, `engine/MapRenderer.js`, `engine/tileAtlas.js`, `engine/Camera.js`, `systems/collisionSystem.js`, `systems/explorationSystem.js`, `GameEngine.js` e os assets do mapa.

Não copie regras específicas de outro mapa sem verificar se o estilo, a escala, o tipo de terreno e a gameplay são compatíveis.

## Brief obrigatório antes de implementar

Defina antes de editar:

| Campo | Decisão necessária |
|---|---|
| Função | exploração, combate, transição, hub, puzzle ou narrativa |
| Proporção | relação width:height derivada da referência e da câmera |
| Escala | tamanho lógico da célula e tamanho real dos tiles |
| Percurso | entrada, caminho principal, áreas secundárias e saída |
| Foco | arena, portal, estrutura, item, boss, vista ou marco |
| Densidade | regiões densas, abertas e de transição |
| Paleta | cores e contraste do tileset correto |
| Colisão | o que é sólido, caminhável, interativo ou apenas decorativo |
| Validação | screenshots e rotas que precisam ser testadas |

Quando a referência ou o usuário definirem proporção, layout ou composição, trate isso como requisito. Não substitua uma referência específica por uma dungeon genérica.

## Escolher a representação correta

Use uma fonte única de verdade para visual e gameplay sempre que possível:

- máscara de walkability quando o mapa é uma massa de chão e rocha;
- tilemap quando a composição exige tiles, bordas, cantos e transições precisas;
- dados de regiões quando o mapa tem salas conectadas, corredores e áreas de interesse;
- objetos separados para props decorativos e elementos interativos;
- AABBs ou polígonos derivados da estrutura do mapa para colisões.

Não use apenas `CanvasPattern` repetido como solução visual principal para mapas que exigem composição. Um padrão pode existir como fallback durante o carregamento, mas não deve dominar a imagem final.

Não desenhe o terreno final com `fillRect` liso, blocos geométricos genéricos, CSS, gradientes modernos ou formas que não pertençam ao estilo do jogo.

## Microtiles e transições

Quando os assets forem tiles de 16×16 e a lógica usar células maiores, componha as células maiores com microtiles reais. Uma célula lógica de 64×64 normalmente pode conter 4×4 tiles de 16×16.

Determine as bordas pela vizinhança, não por posição aleatória:

- piso cercado por piso;
- borda superior, inferior, esquerda e direita;
- cantos internos e externos;
- rocha isolada;
- ponta de parede;
- recuo e saliência;
- transição entre materiais;
- detalhe de chão e sombra de contato.

Use variação determinística por coordenada. Não altere o tile a cada frame. Mantenha coordenadas inteiras, pixels nítidos e ausência de blur.

A arte deve esconder a geometria das colisões. AABBs retangulares podem continuar existindo internamente, mas não devem aparecer como linhas artificiais na imagem.

## Planejamento espacial

Desenhe mentalmente ou documente a planta antes de posicionar objetos. Todo mapa deve possuir:

1. entrada ou ponto de spawn claro;
2. percurso principal continuamente navegável;
3. áreas abertas suficientes para a função do mapa;
4. gargalos apenas quando forem intencionais;
5. pontos de interesse visualmente reconhecíveis;
6. bordas e limites com composição, sem vazios acidentais;
7. saída ou transição coerente com a arte.

Não faça uma arena retangular colada no piso. Forme áreas abertas com recuos, saliências, entradas e saídas. Não crie corredores perfeitamente uniformes quando a referência pede uma massa orgânica.

Para mapas de dungeon, use massas de parede e grupos de decoração nas bordas, mantendo o caminho legível. Para mapas externos, use variação de terreno e marcos que organizem a exploração. Para arenas, priorize espaço de combate e silhueta clara. Para salas, priorize foco, circulação e composição em camadas.

## Camadas de renderização

Separe explicitamente:

1. base de piso;
2. variações, rachaduras e detalhes de piso;
3. bordas, paredes e transições;
4. objetos de fundo;
5. objetos de primeiro plano;
6. jogador, inimigos e entidades;
7. efeitos, marcadores, água e elementos interativos.

Não desenhe todos os sprites em uma camada geral. A falta de camadas faz os objetos parecerem colados sobre a textura e prejudica profundidade, legibilidade e integração.

Se o renderer não suportar ordenação vertical, implemente ao menos a separação de fundo, parede, props e entidades sem quebrar os mapas existentes.

## Decoração e densidade

Distribua decoração por grupos intencionais, não por espaçamento uniforme:

- agrupe rochas em curvas, limites e gargalos;
- use árvores, ruínas e raízes para formar silhuetas;
- use ossos, túmulos e pequenos detalhes em faixas ou bolsões coerentes;
- reserve cristais, luzes e objetos raros para pontos de contraste;
- mantenha objetos grandes fora do caminho principal, salvo quando forem obstáculos intencionais;
- preserve áreas abertas necessárias para navegação e combate;
- evite preencher cada célula com um objeto diferente.

A densidade pode variar por região. Bordas e áreas narrativas podem ser densas; caminhos e arenas precisam de leitura; vazios só devem existir quando tiverem função visual ou de gameplay.

## Colisões e gameplay

Separe sempre arte de colisão:

- decoração pequena normalmente não bloqueia;
- paredes e grandes rochas podem bloquear;
- árvores, portas e estruturas bloqueiam somente quando a arte e a gameplay exigirem;
- props interativos devem ter área própria e acessível;
- spawn, entradas, saídas, arenas e objetivos não podem ficar presos.

Após editar, teste a rota completa. Verifique o caminho de ida e volta, áreas de combate, transições e interações. Não considere o mapa concluído apenas porque o código compila.

## Referência visual e screenshots

Abra a referência e compare diretamente:

- proporção do mapa;
- distribuição das massas;
- densidade por região;
- escala relativa dos tiles e props;
- paleta e contraste;
- forma das paredes e transições;
- pontos focais;
- quantidade de espaço aberto;
- leitura do caminho.

Gere screenshots reais do mapa em visão ampla e em áreas críticas. Para mapas grandes, capture pelo menos a entrada, o centro e o destino final. Se a screenshot mostrar blocos grandes, bordas retas, repetição óbvia ou sprites colados, corrija primeiro terreno, máscara, transições e camadas. Não declare sucesso sem uma validação visual.

## Processo de implementação

1. Audite o mapa e os assets atuais.
2. Faça o brief e registre dimensões, proporção, regiões e caminho.
3. Escolha ou crie a fonte de verdade do terreno.
4. Construa primeiro piso, máscara, bordas e transições.
5. Derive ou ajuste colisões.
6. Adicione decoração por grupos e camadas.
7. Conecte saídas, interações e gameplay existente.
8. Execute o projeto e percorra a rota completa.
9. Faça screenshots e compare com a referência.
10. Corrija primeiro falhas estruturais e visuais grandes; depois detalhes menores.
11. Confira console, assets ausentes, proporção, escala e responsividade.

## Critérios de aprovação

A implementação só está aprovada quando:

- a proporção e o enquadramento atendem à referência ou ao brief;
- o mapa tem uma silhueta e uma composição reconhecíveis;
- o piso não mostra repetição óbvia de uma única célula;
- paredes e transições são integradas ao terreno;
- o caminho e as áreas de gameplay são legíveis;
- a decoração não parece aleatória nem colada por cima;
- as camadas dão profundidade suficiente;
- as colisões correspondem à arte;
- spawn, saída, objetivos e áreas de combate funcionam;
- não há erros de carregamento no console;
- screenshots reais foram produzidas e analisadas.

Ao finalizar, informe o mapa-alvo, arquivos alterados, dimensões, estratégia de terreno, regra de colisão, assets reutilizados, testes executados e caminhos das screenshots.

## Restrições

Não reescreva o projeto inteiro. Não altere mapas não relacionados. Não substitua um mapa jogável por uma imagem estática. Não invente assets se os existentes forem suficientes. Não use estética moderna, blur ou 3D para mascarar falhas de composição. Não declare sucesso sem executar e visualizar o resultado.
