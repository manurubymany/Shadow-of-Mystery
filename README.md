# SHADOW OF MYSTERY

## 🌑 Visão Geral
**Shadow Of Mystery** é um jogo multiplayer online de dedução social e horror cósmico ambientado em uma mansão vitoriana. Os jogadores assumem papéis secretos e devem descobrir quem é o assassino (Carrasco) antes que a sanidade coletiva colapse e o Ritual consuma a todos.

## 🕹️ Regras e Mecânicas

### Papéis (Caminhos)
Ao iniciar a partida, cada jogador recebe secretamente um Caminho:
1.  **Caminho do Observador (Detetive):** Recebe pistas periódicas (mensagens verdes no log) sobre a identidade do assassino (ex: letra inicial do nome).
2.  **Caminho do Sussurro (Ocultista):** Possui sanidade base diferenciada e joga como inocente.
3.  **Caminho do Carrasco (Assassino):** O antagonista. Seu objetivo é eliminar os outros. Ganha a habilidade de **Executar (☠️)** instantaneamente quando o Ritual está ativo.

### Sanidade e Loucura
*   Cada jogador possui um nível de Sanidade (Máx: 10).
*   Ações como **Investigar Oculto** ou ataques de cartas de Tarô reduzem a sanidade.
*   **Sanidade Baixa (< 4):** O jogador sofre alucinações visuais (tela distorcida).
*   **Loucura (< 3):** O jogador começa a ver mensagens falsas no chat, criadas pelo servidor para confundi-lo.

### Fases do Jogo
*   **Investigação:** Jogadores usam o chat, investigam e usam cartas.
*   **O Ritual:** Se a **Sanidade Global** cair abaixo de 50, o céu se torna vermelho e chove sangue. O Carrasco pode matar sem restrições.
*   **Julgamento:** Qualquer jogador pode convocar uma votação. Se a maioria votar em alguém, essa pessoa é executada.

### Ações Especiais
*   **Cartas de Tarô:** Itens consumíveis com efeitos variados (A Lua drena sanidade, A Justiça revela papéis, etc.).
*   **Sacrifício:** Um jogador pode optar por se matar para restaurar a sanidade dos sobreviventes.
*   **Diário:** Um bloco de notas pessoal que persiste durante a sessão.

---

## 🛠️ Instalação e Execução

### Pré-requisitos
*   [Node.js](https://nodejs.org/) instalado em sua máquina.

### Passo a Passo

1.  **Instale as dependências:**
    Abra o terminal na pasta do projeto e execute:
    ```bash
    npm install
    ```

2.  **Estrutura de Arquivos:**
    Certifique-se de que seus arquivos estejam organizados na pasta `public`:
    ```text
    /Ruins
      ├── server.js
      ├── package.json
      ├── index.html
      ├── style.css
      ├── client.js
      └── assets/
          ├── audio/  (Arquivos .mp3)
          └── cards/  (Arquivos .png)
    ```

3.  **Inicie o Servidor:**
    ```bash
    node server.js
    ```

4.  **Jogue:**
    Abra o navegador e acesse: `http://localhost:3000`
    *Dica: Abra múltiplas abas ou janelas anônimas para testar com vários jogadores.*

### Assets Necessários
Para que o jogo funcione perfeitamente (sem erros 404), adicione os arquivos de mídia nas pastas `assets/audio/` (ex: `wind_howl.mp3`, `bell_toll.mp3`) e `assets/cards/` (ex: `the_fool.png`).

---
*Desenvolvido com Node.js, Socket.io e Horror Cósmico.*