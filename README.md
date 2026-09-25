# No Signal — Projeto FETEC

> Jogo Sci-Fi Pixel Art Retro ambientado em solo marciano.

## 🚀 Sobre o Projeto
**No Signal** é um jogo de exploração e combate sci-fi com estética **pixel art retro**, ambientado em **Duna** no ano de 2167. A Terra (Kerbin) está exaurida e envia a missão **ARES-1** com três astronautas em busca de um novo lar. Depois da queda no planeta e da perda de contato, restam você, um aliado… e um invasor — e oxigênio para apenas **5 dias**.

Você controla um astronauta em missão de reconhecimento com recursos limitados de **oxigênio**, **combustível** e **moedas**. Explora a superfície marciana, desce ao Núcleo e às Catacumbas, enfrenta esqueletos e um chefe — e sobrevive aos ataques das golems a cada duas noites. Com moedas, compra itens na loja; com as peças espalhadas pelo mapa, conserta a nave ARES-1 para voltar.

Três personagens jogáveis com armas diferentes (**Astronauta**, **Lagarto Espacial** e **Ocstronauta**) também definem o papel dos outros dois tripulantes: um vira aliado e o outro, inimigo. O dia e a noite passam em tempo real, e cada escolha leva a um dos **quatro finais** possíveis (veja o guia no final deste arquivo).

## 🛠️ Tecnologias Utilizadas
- **Frontend:** HTML5, CSS3 Vanilla, JavaScript Moderno (ES Modules), Canvas 2D API
- **Backend:** PHP (PDO, Prepared Statements)
- **Banco de Dados:** MySQL (`nosignal_db`)
- **Design & Assets:** Pixel art sci-fi retro com paleta temática de Marte

## 📂 Estrutura do Repositório
```
Projeto-FETEC-NoSignal/
├── nosignal/
│   ├── backend/
│   │   ├── database/     # Scripts SQL de schema
│   │   └── public/       # Endpoints da API PHP
│   └── frontend/
│       ├── index.html    # Entrada principal
│       └── src/
│           ├── assets/   # Sprites, áudio e referências
│           ├── content/  # Inimigos, eventos, itens e rotas
│           ├── engine/   # Game Engine, Renderers, Câmera
│           ├── entities/ # Classes de entidades (Player, etc.)
│           ├── state/    # Gerenciamento de estado do jogo
│           ├── styles/   # Estilos CSS
│           ├── systems/  # Sistemas de combate, combustível, eventos
│           └── ui/       # Telas, HUD e menus
└── README.md
```

## 🎮 Como Executar Localmente
1. Clone o repositório dentro do diretório `htdocs` do seu servidor XAMPP:
   ```bash
   git clone https://github.com/luiiwwq/Projeto-FETECC-NoSignal.git
   ```
2. Inicie o **Apache** e o **MySQL** pelo XAMPP Control Panel.
3. Importe o banco de dados em `nosignal/backend/database/schema.sql` via phpMyAdmin ou CLI MySQL.
4. Acesse o jogo no seu navegador:
   ```
   http://localhost/Projeto-Feira-NOSIGNAL/nosignal/frontend/index.html
   ```

## 🏆 Ranking (Supabase)

Execute `nosignal/backend/database/supabase_ranking.sql` no **SQL Editor** do projeto Supabase configurado em `nosignal/frontend/src/services/ranking.js`. O script cria o ranking, o histórico de finais concluídos e as funções para registrar/consultar a contagem (reexecute-o para atualizar instalações existentes). Se usar outro projeto, atualize a URL e a chave **publishable** nesse arquivo (nunca use uma chave `service_role` no frontend).

Quando um final começa, a partida é registrada **uma única vez** no Supabase (um UUID de partida evita duplicação ao repetir a cutscene). Ao voltar ao menu depois da cutscene, o ranking recebe nome, personagem escolhido, tempo de jogo, mortes, total de moedas ganhas durante a partida (sem incluir as 50 iniciais e sem descontar compras) e o ID do final.

O menu **Ranking** mostra o pódio (os **3 melhores** em destaque) e os demais colocados na tabela, com os filtros **GLOBAL** e **FINAL 01–04** para ver o ranking de um final específico. A ordem é sempre: **menor tempo, menos mortes e mais moedas**.

O ranking mantém apenas o resultado mais recente de cada nome, sem diferenciar maiúsculas e minúsculas. Nomes iguais não comprovam que é a mesma pessoa: qualquer visitante que usar esse nome poderá substituir a entrada, pois não há contas de usuário no jogo. A contagem geral por final pode ser consultada no SQL Editor com `select * from public.contagem_finais();`.

## 🎬 Guia: como conseguir os 4 finais

A missão principal é consertar a nave **ARES-1** para escapar de Duna: colete as **três peças** (motor, meio e ponta) no mapa e use `[E]` perto da nave para consertá-la. Seu oxigênio dura **5 dias**: se a nave não estiver consertada na virada para o **5º dia**, o Final 1 acontece de qualquer forma. O que você decide — e se derrota ou poupa o astronauta invasor — define qual final você vê.

| Final | Como conseguir |
| --- | --- |
| **Final 1 — Sem fuga** | Deixe a nave **sem conserto**: ao virar o **5º dia** (ou se o oxigênio acabar antes), a terraformação começa sem você. Acontece sozinho, mesmo longe da nave ou dentro das cavernas. |
| **Final 2 — Abandono da missão** | Sem as peças, ainda **antes do 5º dia**, fique perto da ARES-1 e aperte `[E]` em **CONCLUIR MISSÃO?** (o botão só libera após ~2 minutos de jogo). Confirmar encerra a missão e a terraformação acontece sem você. |
| **Final 3 — Fuga com vingança** | Conserte a nave com as 3 peças, **derrote o astronauta invasor** na superfície e aperte `[E]` em **INTERAJA COM A NAVE** para partir. |
| **Final 4 — Fuga em paz** | Conserte a nave com as 3 peças, **poupe o astronauta invasor** (não o derrote) e aperte `[E]` para partir da ARES-1. |

Resumo rápido: **F1** = deixar o tempo acabar · **F2** = desistir cedo na nave sem peças · **F3** = consertar a nave, matar o invasor e partir · **F4** = consertar a nave, poupar o invasor e partir.

Para ver os **Finais 3 e 4** é preciso jogar duas partidas (a decisão de derrotar ou poupar o invasor é tomada só na hora de partir), e lembre-se: o invasor derrotado **não reaparece** ao voltar à superfície. Os rankings **FINAL 01–04** do menu mostram os melhores tempos de cada um desses caminhos.
