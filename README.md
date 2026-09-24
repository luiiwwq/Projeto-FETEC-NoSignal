# No Signal — Projeto FETEC

> Jogo Sci-Fi Pixel Art Retro ambientado em solo marciano.

## 🚀 Sobre o Projeto
**No Signal** é um jogo de exploração e combate sci-fi desenvolvido com estética pixel art, com tema espacial/marciano. O jogador assume o controle de um astronauta em missão de reconhecimento com recursos limitados de combustível, sistema de combate e eventos planetários.

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
   git clone https://github.com/luiiwwq/Projeto-FETEC-NoSignal.git
   ```
2. Inicie o **Apache** e o **MySQL** pelo XAMPP Control Panel.
3. Importe o banco de dados em `nosignal/backend/database/schema.sql` via phpMyAdmin ou CLI MySQL.
4. Acesse o jogo no seu navegador:
   ```
   http://localhost/Projeto-Feira-NOSIGNAL/nosignal/frontend/index.html
   ```

## 🏆 Ranking global (Supabase)

Execute `nosignal/backend/database/supabase_ranking.sql` no **SQL Editor** do projeto Supabase configurado em `nosignal/frontend/src/services/ranking.js`. O script cria o ranking, o histórico de finais concluídos e as funções para registrar/consultar a contagem. Reexecute-o para atualizar instalações existentes. Se usar outro projeto, atualize a URL e a chave **publishable** nesse arquivo (nunca use uma chave `service_role` no frontend).

Quando um final começa, a partida é contada uma única vez no Supabase (com identificador de partida para evitar duplicação). Ao voltar ao menu depois da cutscene, o ranking recebe nome, personagem escolhido, tempo de jogo, mortes, total de moedas ganhas durante a partida (sem incluir as 50 iniciais e sem descontar compras) e ID do final. O menu **Ranking** mostra a quantidade de cada final, os três primeiros colocados e os demais na tabela; a ordem é menor tempo, menos mortes e mais moedas.

Finais: antes do quinto dia, sem as três peças, `[E] CONCLUIR MISSÃO` perto da ARES-1 inicia a terraformação sem fuga (Final 2). No início do quinto dia a missão passa a ser **VOLTE À NAVE**; se ainda faltam peças, o mesmo botão aciona o Final 1. Se o oxigênio acabar antes de voltar, o Final 1 acontece automaticamente. Com as três peças ainda é possível consertar a nave antes que o tempo acabe; depois, derrotar o NPC inimigo leva ao Final 3 e poupá-lo leva ao Final 4. A contagem (a partir da instalação do script) pode ser consultada no SQL Editor com `select * from public.contagem_finais();`.

O ranking mantém apenas o resultado mais recente de cada nome, sem diferenciar maiúsculas e minúsculas. Nomes iguais não comprovam que é a mesma pessoa: qualquer visitante que usar esse nome poderá substituir a entrada, pois não há contas de usuário no jogo.
