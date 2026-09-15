# Relatório de análise — UndeadMars

A análise foi realizada sobre `nosignal/frontend/src/assets/sprites/UndeadMars/undead-tileset-mars-palette/undead_tileset_mars` na commit `b5a0682`.

## Inventário

Foram encontrados **262 PNGs**, sendo **240 objetos separados** em `PNG/Objects_separately`. A distribuição por tamanho inclui 15 imagens de `16×16`, 103 de `32×32`, 89 de `64×64`, 30 de `128×128` e 3 de `256×256`. O conjunto contém 261 imagens com alpha binário e uma imagem com alpha parcial.

Os principais atlas são `PNG/Ground_rocks.png` (`496×592`) e `PNG/Objects.png` (`768×704`). Também foram considerados os arquivos da pasta `Tiled_files`, incluindo `Undead_land.tmx`, `Ground_rocks.png`, `details.png` e os tilesets relacionados à água.

## Famílias semânticas

| Família | Quantidade aproximada | Uso recomendado |
|---|---:|---|
| Bones e skulls | 60 | Grupos junto às paredes, curvas e salão final |
| Lichs | 3 | Elementos de destaque, sprites `256×256` |
| Plants e thorn plants | 33 | Vegetação irregular nas bordas das paredes |
| Trees e dead/broken trees | 39 | Silhuetas grandes em massas de rocha, fora do caminho |
| Rocks, ruins, graves, crystals e estruturas | 95 | Detalhes de parede e pontos de interesse |
| Terreno e água | 6 | Terreno via atlas; água proibida nas Catacumbas |

## Observações técnicas

Os sprites de objetos são imagens transparentes com tamanhos variados. Eles não podem ser usados como preenchimento de células. Devem ser desenhados sobre uma base de terreno já opaca, respeitando seu bounding box alpha e sua escala natural.

`Ground_rocks.png` contém famílias diferentes de piso, massa de rocha, faces, cantos, sombras e detalhes. Esses recortes não são intercambiáveis. A seleção precisa ser feita por função semântica e por máscara de vizinhança, e não por sorteio independente de microtiles.

Os três Lichs são `Lich_shadow1.png`, `Lich_shadow2.png` e `Lich_shadow3.png`, todos com `256×256`. As famílias de decoração incluem bones, skull piles, plants, thorn plants, trees, dead trees, broken trees, rocks, ruins, graves e crystals. Há nomes reais com grafia irregular, como `Thorn_palnt_*` e `Broken_ tree_*`, que devem ser usados exatamente como estão no diretório.

## Recomendação de implementação

A composição correta é um autotiler determinístico baseado na máscara atual de `44×22` células de `64×64`. Cada célula deve receber uma base opaca de chão ou rocha. As faces, cantos e detalhes devem ser selecionados pela relação com as células vizinhas. O alpha dos objetos deve funcionar como overlay, nunca como preenchimento. A decoração deve ser colocada somente após o terreno e as colisões estarem validados.
