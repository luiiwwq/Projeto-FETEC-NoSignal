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
