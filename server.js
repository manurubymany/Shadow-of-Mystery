const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Rota de aviso caso o index.html não esteja na pasta correta
app.get('/', (req, res) => {
    res.send('<h1>Erro: Arquivos não encontrados</h1><p>O servidor está rodando, mas não encontrou o <b>index.html</b>.</p><p>Certifique-se de mover <code>index.html</code>, <code>style.css</code> e <code>client.js</code> para dentro da pasta <b>public</b>.</p>');
});

// --- ESTADO DO JOGO (AUTORITATIVO) ---
let gameState = {
    phase: 'LOBBY', // LOBBY, GAME, VOTING, END
    players: {},    // Armazena dados de cada socket.id
    sanityGlobal: 100, // Sanidade coletiva (afeta o mapa)
    ritualActive: false,
    turn: 0,
    votes: {}, // { voterId: targetId }
    lastCardUsed: null, // Para O Mago
    cluesPaused: false, // Para A Morte
    lockdown: false,    // Para O Mundo
    hintTimer: null,
    hallucinationTimer: null,
    merchant: { active: false, items: [] }, // Estado do Mercador
    merchantTimer: null,
    roomLights: {} // Estado das luzes por sala { 'Salão': true, ... }
};

let socketMap = {}; // Mapeia socket.id -> playerId

// Definição dos Caminhos (Classes)
const PATHWAYS = {
    DEATH: { name: 'Caminho da Morte', role: 'Carrasco', baseSanity: 6 }, // Seq 9: Assassino
    SEER: { name: 'Caminho do Vidente', role: 'Vidente', baseSanity: 8 }, // Seq 9: Vidente
    SPECTATOR: { name: 'Caminho do Observador', role: 'Observador', baseSanity: 7 }, // Seq 9: Espectador
    POET: { name: 'Caminho do Poeta', role: 'Poeta', baseSanity: 9 } // Seq 9: Insones/Poeta
};

const ROOMS = ['Salão', 'Biblioteca', 'Jardim', 'Cozinha', 'Aposentos'];

// Definição dos Codinomes
const CODENAMES = {
    // Carrasco (Morte/Caos)
    DEATH: { id: 'DEATH', name: 'A Morte', desc: 'Impede análise de pistas por 2 rodadas.', image: 'death.png', pathway: 'Carrasco' },
    THE_DEVIL: { id: 'THE_DEVIL', name: 'O Diabo', desc: 'Causa caos e tentação.', image: 'the_devil.png', pathway: 'Carrasco' }, // Placeholder image
    THE_TOWER: { id: 'THE_TOWER', name: 'A Torre', desc: 'Destruição súbita.', image: 'the_tower.png', pathway: 'Carrasco' }, // Placeholder image

    // Vidente (Investigador)
    THE_MAGICIAN: { id: 'THE_MAGICIAN', name: 'O Mago', desc: 'Copia a última carta usada.', image: 'the_magician.png', pathway: 'Vidente' },
    HIGH_PRIESTESS: { id: 'HIGH_PRIESTESS', name: 'A Papisa', desc: 'Revela um item do inventário de alguém.', image: 'high_priestess.png', needsTarget: true, pathway: 'Vidente' },
    JUDGEMENT: { id: 'JUDGEMENT', name: 'O Julgamento', desc: 'Revela a verdade.', image: 'judgement.png', pathway: 'Vidente' }, // Placeholder image

    // Observador (Espião)
    THE_HERMIT: { id: 'THE_HERMIT', name: 'O Eremita', desc: 'Ilumina o oculto.', image: 'the_hermit.png', pathway: 'Observador' }, // Placeholder image
    THE_MOON: { id: 'THE_MOON', name: 'A Lua', desc: 'Causa alucinações e confusão no chat.', image: 'the_moon.png', pathway: 'Observador' },
    THE_STAR: { id: 'THE_STAR', name: 'A Estrela', desc: 'Esperança e clareza.', image: 'the_star.png', pathway: 'Observador' }, // Placeholder image

    // Poeta (Civil)
    THE_SUN: { id: 'THE_SUN', name: 'O Sol', desc: 'Vitalidade e alegria.', image: 'the_sun.png', pathway: 'Poeta' }, // Placeholder image
    THE_EMPRESS: { id: 'THE_EMPRESS', name: 'A Imperatriz', desc: 'Fertilidade e criação.', image: 'the_empress.png', pathway: 'Poeta' }, // Placeholder image
    THE_WORLD: { id: 'THE_WORLD', name: 'O Mundo', desc: 'Sela as Ruínas, impedindo ações.', image: 'the_world.png', pathway: 'Poeta' },

    // Especial / Coringa
    THE_FOOL: { id: 'THE_FOOL', name: 'O Louco', desc: 'Envia uma "Verdade Confirmada" falsa.', image: 'the_fool.png', needsInput: true, pathway: 'Especial' },
    HANGED_MAN: { id: 'HANGED_MAN', name: 'O Pendurado', desc: 'Sacrifica 2 Sanidade para proteger um aliado.', image: 'hanged_man.png', needsTarget: true, pathway: 'Especial' }
};

// Definição de Habilidades por Nível
const ABILITIES = {
    Carrasco: {
        10: { id: 'SECRET_PASSAGE', name: 'Passagem Secreta', cost: 1, desc: 'Move-se entre salas sem ser notado.', targetType: 'room', cooldown: 15 },
        9: { id: 'SILENT_KILL', name: 'Abate Silencioso', cost: 3, desc: 'Tenta eliminar um alvo.', needsTarget: true, cooldown: 45 },
        8: { id: 'SABOTAGE', name: 'Sabotagem', cost: 2, desc: 'Apaga as luzes de uma sala, impedindo ações.', needsTarget: true, targetType: 'room', cooldown: 60 }
    },
    Vidente: {
        9: { id: 'AUSPEX', name: 'Auspício', cost: 2, desc: 'Recebe uma pista enigmática.', needsTarget: false, cooldown: 30 }
    },
    Observador: {
        9: { id: 'DETAIL_VISION', name: 'Visão de Detalhes', cost: 1, desc: 'Encontra itens ocultos.', needsTarget: false, cooldown: 20 }
    },
    Poeta: {
        9: { id: 'SOOTHE', name: 'Acalento', cost: 1, desc: 'Restaura sanidade de um alvo.', needsTarget: true, cooldown: 15 }
    }
};

const INGREDIENTS_LIST = [
    "Raiz de Mandrágora", "Cinzas de Vampiro", "Cristal Espiritual", 
    "Pena de Coruja", "Sangue de Lobo", "Olho de Tritão", "Pó de Estrela"
];

const POTION_FORMULAS = {
    2: ["Raiz de Mandrágora", "Cristal Espiritual", "Pena de Coruja"], // Seq 9 -> 8
    3: ["Cinzas de Vampiro", "Sangue de Lobo", "Olho de Tritão"]      // Seq 8 -> 7
};

const HALLUCINATIONS = [
    "Eles sabem o que você fez.",
    "Não confie neles.",
    "Ele está mentindo.",
    "Corra.",
    "A parede está sangrando.",
    "Você é o próximo.",
    "Shhh...",
    "Eu vejo você.",
    "A culpa é sua.",
    "Acorde."
];

const ROOM_PASSWORD = "1234"; // Defina a senha da sua sala aqui

io.on('connection', (socket) => {
    console.log('Nova conexão:', socket.id);

    // Jogador entra no Lobby (Agora recebe objeto { name, password })
    socket.on('joinGame', (data) => {
        const playerName = data.name;
        const password = data.password;

        if (ROOM_PASSWORD && password !== ROOM_PASSWORD) {
            socket.emit('errorMsg', 'Senha incorreta.');
            return;
        }

        if (gameState.phase !== 'LOBBY') {
            socket.emit('errorMsg', 'O jogo já começou.');
            return;
        }

        // Gera um ID persistente para o jogador
        const playerId = 'player_' + Math.random().toString(36).substr(2, 9);
        
        gameState.players[playerId] = {
            id: playerId,
            socketId: socket.id, // Armazena o socket atual para comunicação
            name: playerName,
            pathway: null,
            room: 'Salão', // Sala inicial
            x: 400, // Posição X na sala
            y: 300, // Posição Y na sala
            spirituality: 10, // Mana para habilidades/visão
            spiritVisionActive: false,
            level: 9, // Começa na Sequência 9
            xp: 0,
            abilityCooldowns: {}, // Armazena timestamp de quando a habilidade estará disponível
            isReady: false,
            sanity: 10,
            isDead: false,
            isInverted: false, // Carta Invertida (Sanidade < 5)
            isMonster: false, // Novo estado: Beyonder Descontrolado
            realName: playerName, // Guarda o nome original
            isProtected: false, // Para O Pendurado
            ingredients: [], // Inventário de ingredientes para poções
            inventory: [], // Codinomes iriam aqui
            diary: "", // Anotações pessoais
            clues: [] // Pistas recebidas (apenas Detetives)
        };
        
        socketMap[socket.id] = playerId;
        socket.join('Salão'); // Entra no canal da sala inicial
        socket.emit('joinSuccess', playerId); // Envia o ID para o cliente salvar

        // Notifica a todos sobre o novo jogador com som e texto
        io.emit('playerJoinedLobby', playerName);
        io.emit('actionResult', { text: `${playerName} entrou no lobby.`, tab: 'system' });
        broadcastUpdatePlayerList();
    });

    // Reconexão de Jogador
    socket.on('reconnectGame', (playerId) => {
        const player = gameState.players[playerId];
        if (player) {
            // Atualiza o socket do jogador
            player.socketId = socket.id;
            socketMap[socket.id] = playerId;
            socket.join(player.room); // Reentra na sala atual
            
            socket.emit('joinSuccess', playerId);
            
            if (gameState.phase === 'LOBBY') {
                socket.emit('reconnectUI', 'LOBBY');
            } else {
                socket.emit('gameStarted', gameState); // Restaura o estado do jogo
            }
            
            broadcastUpdatePlayerList();
        } else {
            socket.emit('forceClearSession'); // ID inválido ou jogo reiniciado
        }
    });

    // Sistema de Prontidão (Ready)
    socket.on('toggleReady', () => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (player && gameState.phase === 'LOBBY') {
            player.isReady = !player.isReady;
            broadcastUpdatePlayerList();
        }
    });

    // Iniciar Partida (Apenas admin ou simplificado para teste)
    socket.on('startGame', () => {
        if (Object.keys(gameState.players).length < 1) return; // Mínimo de jogadores        

        const playerId = socketMap[socket.id];

        const unready = Object.values(gameState.players).filter(p => !p.isReady);
        if (unready.length > 0) {
            socket.emit('actionResult', { text: `Não é possível iniciar. Aguardando: ${unready.map(p => p.name).join(', ')}`, tab: 'system' });
            return;
        }

        const player = gameState.players[playerId];
        if (!player) return; // Impede o início se o solicitante não for um jogador válido

        // Inicia a animação de sorteio no cliente
        io.emit('roleShuffleStart');

        // Aguarda 4 segundos para a animação terminar antes de iniciar a lógica
        setTimeout(() => {
            io.emit('actionResult', { text: `O Banquete das Sombras começou. As identidades foram ocultadas.`, tab: 'system' });

            gameState.phase = 'GAME';
            // Inicializa as luzes das salas
            ROOMS.forEach(r => gameState.roomLights[r] = true);
            
            assignRoles();

            // Inicia o sistema de dicas (a cada 30s)
            if (gameState.hintTimer) clearInterval(gameState.hintTimer);
            gameState.hintTimer = setInterval(generateHint, 30000);

            // Inicia o sistema de alucinações (a cada 10s)
            if (gameState.hallucinationTimer) clearInterval(gameState.hallucinationTimer);
            gameState.hallucinationTimer = setInterval(generateHallucinations, 10000);

            // Inicia o ciclo do Mercador Sombrio (verifica a cada 30s)
            if (gameState.merchantTimer) clearInterval(gameState.merchantTimer);
            gameState.merchantTimer = setInterval(trySpawnMerchant, 30000);

            // Loop de efeitos contínuos (Visão Espiritual)
            if (gameState.effectLoop) clearInterval(gameState.effectLoop);
            gameState.effectLoop = setInterval(processContinuousEffects, 1000);

            io.emit('gameStarted', gameState);
        }, 4000);
    });

    // Sistema de Movimentação entre Salas
    socket.on('moveRoom', (targetRoom) => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (!player || gameState.phase !== 'GAME' || player.isDead) return;

        if (!ROOMS.includes(targetRoom)) return;
        if (player.room === targetRoom) return;

        const oldRoom = player.room;
        socket.leave(oldRoom);
        player.room = targetRoom;
        player.x = 400; // Reseta posição ao entrar
        player.y = 300;
        socket.join(targetRoom);

        socket.emit('actionResult', { text: `Você entrou em: ${targetRoom}`, tab: 'system' });
        
        // Notifica quem está na nova sala
        socket.to(targetRoom).emit('actionResult', { text: `${player.name} entrou na sala.`, tab: 'system' });
        
        // Notifica quem ficou na sala antiga
        socket.to(oldRoom).emit('actionResult', { text: `${player.name} saiu da sala.`, tab: 'system' });

        broadcastUpdatePlayerList();
    });

    // Movimentação (WASD/Joystick)
    socket.on('playerMove', (data) => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (!player || gameState.phase !== 'GAME' || player.isDead) return;

        // Atualiza posição (com limites simples de 0 a 800x600)
        player.x = Math.max(0, Math.min(800, player.x + data.dx));
        player.y = Math.max(0, Math.min(600, player.y + data.dy));
        
        // Emite apenas para quem está na sala (otimização)
        io.to(player.room).emit('updatePositions', { id: playerId, x: player.x, y: player.y });
    });

    // Visão Espiritual
    socket.on('toggleSpiritVision', (active) => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (!player || player.isDead) return;

        player.spiritVisionActive = active;
        broadcastUpdatePlayerList(); // Atualiza para mostrar aura se necessário
    });

    // Ação de Jogador (Ex: Investigar, Usar Carta)
    socket.on('playerAction', (actionData) => {
        if (gameState.lockdown && actionData.type !== 'USE_CODENAME') {
            socket.emit('actionResult', "O Mundo selou as Ruínas. Nenhuma ação é possível.");
            return;
        }

        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (!player || gameState.phase !== 'GAME') return;
        
        if (player.isDead && !player.isMonster) return; // Monstros podem agir (futuramente)

        // Exemplo: Uso de Habilidade baseada no Caminho
        handleAction(player, actionData);
    });

    // Sistema de Diário
    socket.on('updateDiary', (text) => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (player) {
            player.diary = String(text).slice(0, 5000); // Limite de caracteres
        }
    });

    socket.on('disconnect', () => {
        const playerId = socketMap[socket.id];
        if (playerId && gameState.players[playerId]) {
            const player = gameState.players[playerId];
            console.log(`Jogador ${player.name} desconectado.`);
            const displayName = player.realName || player.name;

            // Anuncia a saída no log
            io.emit('actionResult', { text: `${displayName} saiu do jogo.`, tab: 'system' });

            // Dispara o som de saída apenas se estiver no lobby
            if (gameState.phase === 'LOBBY') {
                io.emit('playerLeftLobby', displayName);
            }

            delete gameState.players[playerId];
            delete socketMap[socket.id];
            broadcastUpdatePlayerList();
        }
    });

    // Sistema de Chat
    socket.on('chatMessage', (msg) => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (!player) return;

        msg = String(msg).trim();
        if (!msg) return;

        // Chat dos Ocultistas: /o Mensagem
        if (msg.startsWith('/o ')) {
            if (player.role !== 'Ocultista') {
                socket.emit('actionResult', { text: "Você não compreende a língua das sombras.", tab: 'chat' });
                return;
            }

            const text = msg.slice(3).trim();
            if (!text) return;

            const occultists = Object.values(gameState.players).filter(p => p.role === 'Ocultista');
            occultists.forEach(p => {
                io.to(p.socketId).emit('chatMessage', { sender: player.name, text, type: 'occult' });
            });
            return;
        }

        // Verifica se é sussurro: /w Nome Mensagem
        if (msg.startsWith('/w ')) {
            const contentWithoutCmd = msg.slice(3).trim();
            // Busca gulosa: tenta encontrar um jogador cujo nome coincida com o início do texto
            const target = Object.values(gameState.players).find(p => 
                contentWithoutCmd.startsWith(p.name + ' ') || contentWithoutCmd === p.name
            );

            if (target) {
                if (target.room !== player.room) {
                    socket.emit('actionResult', { text: "Você só pode sussurrar para quem está na mesma sala.", tab: 'chat' });
                    return;
                }

                const text = contentWithoutCmd.slice(target.name.length).trim();
                if (text) {
                    io.to(target.socketId).emit('chatMessage', { sender: player.name, text, type: 'private' });
                    socket.emit('chatMessage', { sender: `Para ${target.name}`, text, type: 'private' });
                }
            } else {
                socket.emit('actionResult', 'Jogador não encontrado para sussurro.');
            }
        } else {
            // Chat Local (Apenas na mesma sala)
            io.to(player.room).emit('chatMessage', { sender: player.name, text: msg, type: 'global' });
        }
    });

    // Sistema de Crafting (Poções)
    socket.on('craftPotion', () => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (!player || gameState.phase !== 'GAME') return;

        const nextLevel = player.level + 1;
        const requiredIngredients = POTION_FORMULAS[nextLevel];

        if (!requiredIngredients) {
            socket.emit('actionResult', { text: "Você já alcançou o ápice do seu Caminho por enquanto.", tab: 'system' });
            return;
        }

        // Verifica ingredientes
        const playerIngredients = [...player.ingredients]; // Cópia para simular consumo
        let hasAll = true;
        
        for (const req of requiredIngredients) {
            const idx = playerIngredients.indexOf(req);
            if (idx === -1) {
                hasAll = false;
                break;
            }
            playerIngredients.splice(idx, 1); // Remove ingrediente encontrado (consome)
        }

        if (hasAll) {
            player.ingredients = playerIngredients; // Aplica o consumo
            
            // Chance de falha de 20% (Pode ajustar conforme a Sequência)
            if (Math.random() < 0.2) {
                player.sanity = Math.max(0, player.sanity - 3);
                io.to(player.socketId).emit('actionResult', { text: `☣️ FALHA NA ALQUIMIA: A poção rejeitou seu corpo e causou danos mentais. (-3 Sanidade)`, tab: 'combat' });

                // Verifica colapso mental (Monstro)
                if (player.sanity <= 0 && !player.isMonster && !player.isDead) {
                    player.isMonster = true;
                    player.role = 'Monstro';
                    io.emit('actionResult', { text: `⚠️ ${player.name} PERDEU O CONTROLE! Tornou-se um Monstro!`, tab: 'combat' });
                }
            } else {
                player.level--; // Evolui descendo a Sequência (9 -> 8 -> ... -> 0)
                io.to(player.socketId).emit('actionResult', { text: `🧪 RITUAL DE ASCENSÃO: Você bebeu a poção e avançou para a Sequência ${player.level}!`, tab: 'system' });
                
                // Vitória na Sequência 0
                if (player.level === 0) {
                    gameState.phase = 'END';
                    io.emit('gameOver', { winner: player.name, reason: 'Um novo Deus ascendeu.', players: gameState.players });
                }
            }

            io.to(player.socketId).emit('updateIngredients', player.ingredients);
            broadcastUpdatePlayerList();
        } else {
            socket.emit('actionResult', { text: `Faltam ingredientes para a Sequência ${nextLevel}.`, tab: 'system' });
        }
    });

    // Sistema de Troca de Ingredientes
    socket.on('tradeIngredient', (data) => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (!player || gameState.phase !== 'GAME') return;
        if (player.isDead) {
             socket.emit('actionResult', { text: "Mortos não podem negociar.", tab: 'system' });
             return;
        }

        const { targetId, ingredientName } = data;
        const target = gameState.players[targetId];

        if (!target) {
            socket.emit('actionResult', { text: "Destinatário não encontrado.", tab: 'system' });
            return;
        }
        
        if (target.isDead) {
            socket.emit('actionResult', { text: "Você não pode entregar itens aos mortos.", tab: 'system' });
            return;
        }

        const ingIndex = player.ingredients.indexOf(ingredientName);
        if (ingIndex === -1) {
            socket.emit('actionResult', { text: "Você não possui este ingrediente.", tab: 'system' });
            return;
        }

        // Transferência
        player.ingredients.splice(ingIndex, 1);
        target.ingredients.push(ingredientName);

        // Atualiza UIs e Notifica
        io.to(player.socketId).emit('updateIngredients', player.ingredients);
        io.to(target.socketId).emit('updateIngredients', target.ingredients);
        io.to(player.socketId).emit('actionResult', { text: `Você enviou ${ingredientName} para ${target.name}.`, tab: 'system' });
        io.to(target.socketId).emit('actionResult', { text: `${player.name} lhe enviou ${ingredientName}.`, tab: 'system' });
    });

    // Sistema de Compra no Mercador
    socket.on('buyItem', (itemId) => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (!player || gameState.phase !== 'GAME') return;
        
        if (!gameState.merchant.active) {
            socket.emit('actionResult', { text: "O Mercador já partiu.", tab: 'system' });
            return;
        }

        const item = gameState.merchant.items.find(i => i.id === itemId);
        if (!item) return;

        if (player.sanity <= item.cost) {
            socket.emit('actionResult', { text: "Sua mente está muito frágil para negociar com as sombras.", tab: 'system' });
            return;
        }

        // Efetua a compra
        player.sanity -= item.cost;
        
        if (item.name === "Elixir da Clareza") {
            const healAmount = 5;
            player.sanity = Math.min(10, player.sanity + healAmount);
            io.to(player.socketId).emit('actionResult', { text: `✨ Você consumiu o Elixir da Clareza. A névoa em sua mente se dissipa. (+${healAmount} Sanidade)`, tab: 'system' });
        } else {
            player.ingredients.push(item.name);
            io.to(player.socketId).emit('actionResult', { text: `Você trocou ${item.cost} de Sanidade por ${item.name}.`, tab: 'system' });
            io.to(player.socketId).emit('updateIngredients', player.ingredients);
        }
        
        broadcastUpdatePlayerList();
    });

    // --- SISTEMA DE VOTAÇÃO ---
    
    socket.on('startVoting', () => {
        if (gameState.phase !== 'GAME') return;
        
        gameState.phase = 'VOTING';
        gameState.votes = {}; // Limpa votos anteriores
        
        // Envia lista sanitizada para votação (embora nomes sejam públicos, garante segurança)
        const safeList = Object.values(gameState.players).map(p => ({ id: p.id, name: p.name, isDead: p.isDead }));
        io.emit('votingStarted', safeList);
        io.emit('actionResult', "O Julgamento começou. Vocês têm 15 segundos.");

        // Temporizador para encerrar a votação
        setTimeout(() => {
            endVoting();
        }, 15000);
    });

    socket.on('castVote', (targetId) => {
        if (gameState.phase !== 'VOTING') return;
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        
        if (player && !player.isDead) {
            gameState.votes[playerId] = targetId;
        }
    });
});

// --- LÓGICA DO SISTEMA ---

function assignRoles() {
    const playerIds = Object.keys(gameState.players);

    // Embaralha os jogadores para garantir distribuição aleatória dos papéis
    for (let i = playerIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
    }

    // Lógica simplificada de distribuição
    // Num jogo real, haveria balanceamento (1 Assassino, X Ocultistas, Y Detetives)
    // Agora distribui: Carrasco, Vidente, Observador, Poeta
    playerIds.forEach((id, index) => {
        let assignedPath;
        
        const roles = [PATHWAYS.DEATH, PATHWAYS.SEER, PATHWAYS.SPECTATOR, PATHWAYS.POET];
        assignedPath = roles[index % roles.length];

        gameState.players[id].pathway = assignedPath.name;
        gameState.players[id].role = assignedPath.role; // Secreto no cliente real
        gameState.players[id].sanity = assignedPath.baseSanity;
        
        // SISTEMA DE IDENTIDADE (TAROT) POR CAMINHO
        // Filtra cartas disponíveis para este caminho
        const availableCards = Object.values(CODENAMES).filter(c => c.pathway === assignedPath.role || c.pathway === 'Especial');
        
        // Seleciona uma carta aleatória do conjunto permitido
        const identityCard = availableCards[Math.floor(Math.random() * availableCards.length)];
        
        // Se a carta já foi usada (colisão simples), tenta pegar outra ou usa fallback
        // Em produção, removeríamos a carta da pool global
        
        gameState.players[id].name = identityCard.name; // O nome visível vira "A Morte", etc.
        gameState.players[id].identityCard = identityCard.id; // Salva qual carta é a identidade
        
        // Distribui 1 Codinome Aleatório (Item) - Pode ser qualquer carta como item
        const allCards = Object.values(CODENAMES);
        const randomItem = allCards[Math.floor(Math.random() * allCards.length)];
        gameState.players[id].inventory.push(randomItem);
    });

    console.log("Funções distribuídas. O Véu se ergue.");
}

// Função para enviar a lista de jogadores com "Véu de Espiritualidade" (Sanitização)
function broadcastUpdatePlayerList() {
    const players = Object.values(gameState.players);
    
    // Itera sobre todos os sockets conectados para enviar dados personalizados
    io.sockets.sockets.forEach((socket) => {
        const playerId = socketMap[socket.id];
        
        const sanitizedList = players.map(p => {
            const isMe = playerId && p.id === playerId;
            // O Véu cai se: for você mesmo, o jogador for um Monstro ou estiver Morto
            const isRevealed = p.isMonster || p.isDead; 
            
            const pSafe = { ...p };
            if (!isMe && !isRevealed) {
                delete pSafe.role;
                delete pSafe.pathway;
                delete pSafe.realName;
                delete pSafe.inventory;
                delete pSafe.clues;
                delete pSafe.diary;
                delete pSafe.ingredients;
                // Mantém 'room' visível para saber onde os outros estão (ou remova se quiser "fog of war" total)
                // Mantém x, y para renderização
                // Mantém spiritVisionActive para efeitos visuais
            }
            return pSafe;
        });
        
        socket.emit('updatePlayerList', sanitizedList);
    });
}

function grantXP(player, amount) {
    if (player.level >= 3) return; // Nível máximo

    player.xp += amount;
    
    // O XP agora serve apenas como pontuação ou requisito secundário, o nível sobe via Poções.
}

function handleAction(player, action) {
    // Exemplo de mecânica de Sanidade
    if (action.type === 'INVESTIGATE_OCCULT') {
        // Risco de perder sanidade
        const roll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1; // 2d6
        
        // Penalidade se estiver Invertido
        if (player.isInverted) {
             // Lógica de penalidade (ex: resultado falso ou mais dano)
        }
        
        let resultMsg = "";
        
        if (roll < 6) {
            player.sanity -= 2;
            gameState.sanityGlobal -= 5; // O fracasso acelera o ritual
            resultMsg = "Você olhou para o abismo. O abismo olhou de volta. (-2 Sanidade)";
            io.to(player.socketId).emit('actionResult', { text: resultMsg, tab: 'combat' });
        } else {
            resultMsg = "Você encontrou uma pista oculta sem enlouquecer.";
            io.to(player.socketId).emit('actionResult', { text: resultMsg, tab: 'system' });
            // Sucesso concede XP
            grantXP(player, 10);
        }

        // Verifica Carta Invertida (Sanidade < 5)
        if (player.sanity < 5 && !player.isInverted) {
            player.isInverted = true;
            io.to(player.socketId).emit('actionResult', { text: "⚠️ SUA CARTA INVERTEU! Sua mente está fragmentada. Alucinações intensificadas.", tab: 'combat' });
        } else if (player.sanity >= 5 && player.isInverted) {
            player.isInverted = false;
            io.to(player.socketId).emit('actionResult', { text: "Sua mente recuperou o equilíbrio. A carta voltou ao normal.", tab: 'system' });
        }

        if (player.sanity <= 4 || player.isInverted) {
            resultMsg += " [ALUCINAÇÃO] As paredes estão respirando.";
            io.to(player.socketId).emit('sanityEffect', { type: 'HALLUCINATION' });
        }

        checkRitual();

        
        // Atualiza estado global para todos (sem revelar segredos)
        io.emit('stateUpdate', { 
            playerId: player.id, 
            sanity: player.sanity,
            level: player.level
        });
    }

    // Mecânica de Codinomes
    if (action.type === 'USE_CODENAME') {
        if (gameState.lockdown && action.type === 'USE_CODENAME') {
             io.to(player.socketId).emit('actionResult', "O poder das Ruínas impede o uso de cartas.");
             return;
        }

        const cardIndex = action.cardIndex ?? 0;

        if (player.inventory.length === 0) {
            io.to(player.socketId).emit('actionResult', "Você não possui codinomes.");
            return;
        }

        if (!player.inventory[cardIndex]) {
            io.to(player.socketId).emit('actionResult', "Carta inválida.");
            return;
        }

        // Usa a carta selecionada
        // Nota: O Mago não gasta a carta se copiar, mas aqui simplificamos gastando a carta "O Mago"
        const card = player.inventory[cardIndex]; 
        
        // Lógica específica para cartas que precisam de alvo/input antes de gastar
        let target = null;
        if (card.needsTarget) {
            if (!action.targetId) return; // Cliente deve enviar
            target = gameState.players[action.targetId];
            if (!target) return;
        }

        // Remove a carta do inventário
        player.inventory.splice(cardIndex, 1);
        
        // Registra última carta usada (exceto O Mago para evitar loop infinito fácil)
        if (card.id !== 'THE_MAGICIAN') {
            gameState.lastCardUsed = card;
        }

        let msg = `[TARÔ] ${player.name} usou a carta ${card.name}!`;
        let effectId = card.id;

        // Lógica do Mago (Copia efeito)
        if (effectId === 'THE_MAGICIAN') {
            if (gameState.lastCardUsed) {
                effectId = gameState.lastCardUsed.id;
                msg += ` (Copiando ${gameState.lastCardUsed.name})`;
            } else {
                io.to(player.socketId).emit('actionResult', "Nenhuma carta foi usada anteriormente para copiar.");
                return;
            }
        }

        switch (effectId) {
            case 'THE_FOOL':
                const fakeMsg = action.message || "O silêncio é a única resposta.";
                io.emit('chatMessage', { sender: 'SISTEMA', text: `VERDADE CONFIRMADA: ${fakeMsg}`, type: 'global' });
                break;
            case 'HIGH_PRIESTESS':
                if (target && target.inventory.length > 0) {
                    const revealedItem = target.inventory[Math.floor(Math.random() * target.inventory.length)];
                    io.to(player.socketId).emit('actionResult', { text: `A Sacerdotisa revela: ${target.name} possui "${revealedItem.name}".`, tab: 'system' });
                } else {
                    io.to(player.socketId).emit('actionResult', { text: `A Sacerdotisa nada vê no inventário de ${target ? target.name : 'ninguém'}.`, tab: 'system' });
                }
                break;
            case 'HANGED_MAN':
                player.sanity = Math.max(0, player.sanity - 2);
                if (target) {
                    target.isProtected = true;
                    io.to(player.room).emit('actionResult', { text: `${player.name} sacrificou sua sanidade para proteger ${target.name}.`, tab: 'combat' });
                    // Remove proteção após um tempo (ex: 30s)
                    setTimeout(() => { target.isProtected = false; }, 30000);
                }
                break;
            case 'DEATH':
                gameState.cluesPaused = true;
                io.emit('actionResult', { text: "A Morte cobriu os rastros. Nenhuma pista será revelada em breve.", tab: 'system' });
                setTimeout(() => { gameState.cluesPaused = false; }, 60000); // 2 rodadas (aprox 60s)
                break;
            case 'THE_MOON':
                Object.values(gameState.players).forEach(p => {
                    io.to(p.socketId).emit('sanityEffect', { type: 'HALLUCINATION' });
                });
                io.emit('actionResult', { text: "A Lua brilha. A confusão reina.", tab: 'system' });
                break;
            case 'THE_WORLD':
                gameState.lockdown = true;
                io.emit('actionResult', { text: "O MUNDO PAROU. As Ruínas estão seladas.", tab: 'combat' });
                setTimeout(() => { gameState.lockdown = false; io.emit('actionResult', "O tempo volta a fluir."); }, 15000);
                break;
        }

        io.emit('gameStarted', gameState); // Atualiza UI de todos (Sanidade/Inventário)
    }

    // Uso de Habilidades de Classe
    if (action.type === 'USE_ABILITY') {
        const abilityId = action.abilityId;
        const roleAbilities = ABILITIES[player.role];
        
        // Encontra a habilidade nos níveis desbloqueados
        let ability = null;
        for (let lvl = 10; lvl >= player.level; lvl--) { // Verifica da Seq 10 (Habilidades Extras) até a atual
            if (roleAbilities[lvl] && roleAbilities[lvl].id === abilityId) {
                ability = roleAbilities[lvl];
                break;
            }
        }

        if (!ability) return;

        // Verifica se há luz na sala (exceto se a habilidade for a própria Sabotagem, que pode ser feita do escuro ou de longe)
        if (gameState.roomLights[player.room] === false && abilityId !== 'SABOTAGE') {
            io.to(player.socketId).emit('actionResult', "Está escuro demais aqui para usar habilidades.");
            return;
        }

        // Verifica Cooldown
        if (player.abilityCooldowns[abilityId] && Date.now() < player.abilityCooldowns[abilityId]) {
            const remaining = Math.ceil((player.abilityCooldowns[abilityId] - Date.now()) / 1000);
            io.to(player.socketId).emit('actionResult', `Habilidade em recarga. Aguarde ${remaining}s.`);
            return;
        }

        if (player.sanity < ability.cost) {
            io.to(player.socketId).emit('actionResult', "Sanidade insuficiente para realizar este feito.");
            return;
        }

        // Aplica Cooldown
        if (ability.cooldown) {
            player.abilityCooldowns[abilityId] = Date.now() + (ability.cooldown * 1000);
        }

        player.sanity -= ability.cost;
        let target = null;
        if (action.targetId) target = gameState.players[action.targetId];

        // O Dilema do Poder: Descrições visuais que podem denunciar o caminho
        let visualEffectMsg = "";
        let targetRoom = null;

        // Efeitos das Habilidades
        switch (abilityId) {
            case 'SILENT_KILL':
                visualEffectMsg = `Uma sombra antinatural se move rapidamente em direção a ${target ? target.name : 'alguém'}...`;
                if (target) {
                    // Chance de matar baseada na sanidade ou isolamento (simulado)
                    if (Math.random() > 0.4) {
                        target.isDead = true;
                        io.emit('actionResult', { text: `[ABATE] ${target.name} foi encontrado morto em circunstâncias misteriosas.`, tab: 'combat' });
                    } else {
                        io.to(player.socketId).emit('actionResult', { text: `Falha ao tentar eliminar ${target.name}. Ele não estava vulnerável.`, tab: 'combat' });
                    }
                }
                break;
            case 'SABOTAGE':
                // O alvo aqui é uma sala (enviado em action.targetId pelo cliente adaptado)
                targetRoom = action.targetId; 
                if (targetRoom && ROOMS.includes(targetRoom)) {
                    gameState.roomLights[targetRoom] = false;
                    io.to(targetRoom).emit('actionResult', { text: "🌑 As luzes se apagaram repentinamente! O caos reina.", tab: 'system' });
                    io.to(targetRoom).emit('lightsOut', true); // Evento para o cliente escurecer a tela
                    
                    // Restaura as luzes após 30 segundos
                    setTimeout(() => {
                        gameState.roomLights[targetRoom] = true;
                        io.to(targetRoom).emit('actionResult', { text: "💡 As luzes voltaram a piscar e se acenderam.", tab: 'system' });
                        io.to(targetRoom).emit('lightsOut', false);
                    }, 30000);
                }
                break;
            case 'SECRET_PASSAGE':
                targetRoom = action.targetId;
                if (targetRoom && ROOMS.includes(targetRoom)) {
                    if (player.room === targetRoom) {
                        io.to(player.socketId).emit('actionResult', "Você já está nesta sala.");
                        return;
                    }
                    const oldRoom = player.room;
                    const socket = io.sockets.sockets.get(player.socketId);
                    if (socket) {
                        socket.leave(oldRoom);
                        player.room = targetRoom;
                        socket.join(targetRoom);
                        io.to(player.socketId).emit('actionResult', { text: `[FURTIVO] Você usou as passagens secretas para chegar em: ${targetRoom}`, tab: 'system' });
                        // Não emite notificações para as salas (movimento invisível)
                    }
                }
                break;
            case 'AUSPEX':
                visualEffectMsg = `${player.name} entra em um transe profundo, seus olhos brilhando com uma luz estelar.`;
                // Gera uma pista imediata
                generateHint(); 
                io.to(player.socketId).emit('actionResult', { text: "As estrelas sussurram um segredo...", tab: 'system' });
                break;
            case 'DETAIL_VISION':
                visualEffectMsg = `${player.name} examina minuciosamente o ambiente, seus olhos varrendo cada detalhe oculto.`;
                // Simula encontrar um item/ingrediente
                const found = INGREDIENTS_LIST[Math.floor(Math.random() * INGREDIENTS_LIST.length)];
                player.ingredients.push(found);
                io.to(player.socketId).emit('actionResult', { text: `[VISÃO] Você encontrou: ${found}. (Item de progressão)`, tab: 'system' });
                io.to(player.socketId).emit('updateIngredients', player.ingredients);
                break;
            case 'SOOTHE':
                visualEffectMsg = `${player.name} recita versos antigos, uma aura dourada e calmante envolve ${target ? target.name : 'o alvo'}.`;
                if (target) {
                    target.sanity = Math.min(10, target.sanity + 3);
                    io.to(target.socketId).emit('actionResult', { text: `${player.name} acalmou sua mente. (+3 Sanidade)`, tab: 'system' });
                    io.to(player.socketId).emit('actionResult', { text: `Você restaurou a sanidade de ${target.name}.`, tab: 'system' });
                }
                break;
        }
        
        // Emite o efeito visual para todos (Dilema do Poder)
        if (visualEffectMsg) {
            // Apenas quem está na sala vê o efeito visual (se houver luz, ou se for algo que brilha no escuro)
            io.to(player.room).emit('actionResult', { text: `[EFEITO VISUAL] ${visualEffectMsg}`, tab: 'combat' });
        }
        
        broadcastUpdatePlayerList();
    }

    // Habilidade Especial do Carrasco durante o Ritual
    if (action.type === 'RITUAL_EXECUTE') {
        if (!gameState.ritualActive) {
            io.to(player.socketId).emit('actionResult', "O Ritual não está ativo.");
            return;
        }
        if (player.role !== 'Carrasco') {
            io.to(player.socketId).emit('actionResult', "Apenas o Carrasco possui este poder.");
            return;
        }

        const target = gameState.players[action.targetId];
        if (target && !target.isDead && target.id !== player.id) {
            target.isDead = true;
            io.to(player.room).emit('actionResult', { text: `[RITUAL] ☠️ O Carrasco executou ${target.name} brutalmente!`, tab: 'combat' });
            broadcastUpdatePlayerList();

            // Verifica Vitória do Assassino (Se sobrar apenas ele ou 1x1 em algumas regras)
            const alivePlayers = Object.values(gameState.players).filter(p => !p.isDead);
            if (alivePlayers.length <= 1) {
                gameState.phase = 'END';
                io.emit('gameOver', { winner: 'O Carrasco', reason: 'Todos os opositores foram eliminados.', players: gameState.players });
            }
        }
    }

    // Mecânica de Sacrifício
    if (action.type === 'SACRIFICE') {
        player.isDead = true;
        
        // Restaura sanidade dos outros jogadores vivos
        Object.values(gameState.players).forEach(p => {
            if (p.id !== player.id && !p.isDead) {
                p.sanity = Math.min(10, p.sanity + 4); // Recupera até 4 pontos
            }
        });

        gameState.sanityGlobal = Math.min(100, gameState.sanityGlobal + 20); // Recupera sanidade global

        io.emit('actionResult', { text: `[SACRIFÍCIO] ${player.name} entregou sua vida para purificar a mente do grupo.`, tab: 'combat' }); // Sacrifício é um evento global
        broadcastUpdatePlayerList();

        // Verifica condições de vitória/derrota imediatas
        const alive = Object.values(gameState.players).filter(p => !p.isDead);
        const killer = Object.values(gameState.players).find(p => p.role === 'Carrasco');

        if (player.role === 'Carrasco') {
            gameState.phase = 'END';
            io.emit('gameOver', { winner: 'A Sociedade', reason: 'O Assassino cometeu suicídio.', players: gameState.players });
        } else if (killer && !killer.isDead && alive.length <= 1) {
            gameState.phase = 'END';
            io.emit('gameOver', { winner: 'O Carrasco', reason: 'A resistência da sociedade quebrou.', players: gameState.players });
        }

        io.emit('gameStarted', gameState); // Sincroniza estado (Sanidade atualizada)
    }

    // VERIFICAÇÃO DE MONSTRO (Sanidade <= 0)
    if (player.sanity <= 0 && !player.isMonster && !player.isDead) {
        player.isMonster = true;
        player.role = 'Monstro'; // Perde o papel original
        player.name = "Monstro (" + player.name + ")"; // Carta Quebrada
        io.to(player.room).emit('actionResult', { text: `⚠️ O VÉU SE RASGA! O usuário da carta [${player.realName || player.name}] era um [${player.pathway}] e sucumbiu ao descontrole!`, tab: 'combat' });
        broadcastUpdatePlayerList();
    }
}

function checkRitual() {
    if (!gameState.ritualActive && gameState.sanityGlobal < 50) {
        gameState.ritualActive = true;
        io.emit('ritualStart');
        io.emit('actionResult', { text: "⚠️ A SANIDADE GLOBAL COLAPSOU! O RITUAL COMEÇOU! ⚠️", tab: 'system' });
    }
}

function endVoting() {
    if (gameState.phase !== 'VOTING') return;

    // Contagem de votos
    const voteCounts = {};
    Object.values(gameState.votes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    let maxVotes = 0;
    let targetToEliminate = null;
    let isTie = false;

    for (const [targetId, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
            maxVotes = count;
            targetToEliminate = targetId;
            isTie = false;
        } else if (count === maxVotes) {
            isTie = true;
        }
    }

    gameState.phase = 'GAME';
    io.emit('votingEnded');

    if (targetToEliminate && !isTie) {
        const victim = gameState.players[targetToEliminate];
        victim.isDead = true;
        io.emit('actionResult', { text: `[VEREDITO] ${victim.name} foi considerado culpado e executado.`, tab: 'combat' });
        broadcastUpdatePlayerList();

        // Verifica Vitória dos Detetives (Se mataram o Assassino)
        if (victim.role === 'Assassino') {
            gameState.phase = 'END';
            io.emit('gameOver', { winner: 'A Sociedade', reason: 'O Assassino foi neutralizado.', players: gameState.players });
        }
    } else {
        io.emit('actionResult', { text: `[VEREDITO] O tribunal não chegou a um consenso. Ninguém morreu.`, tab: 'system' });
    }
}

function generateHint() {
    if (gameState.phase !== 'GAME') return;
    if (gameState.cluesPaused) return; // Efeito da carta A Morte

    const players = Object.values(gameState.players);
    const killer = players.find(p => p.role === 'Carrasco');
    if (!killer) return;

    // Envia apenas para Detetives vivos
    const detectives = players.filter(p => p.role === 'Vidente' && !p.isDead);
    if (detectives.length === 0) return;

    const innocents = players.filter(p => p.role !== 'Carrasco' && !p.isDead);
    let msg = "";
    const roll = Math.random();
    
    // Se o Vidente estiver Invertido, pode receber pista falsa
    // (Lógica simplificada: aqui assumimos que o Vidente é quem chama a função, mas na verdade é um timer global.
    // Para implementar pistas falsas individuais, precisaríamos iterar sobre os detetives e checar o estado de cada um.)
    
    // ...

    if (roll < 0.4) {
        msg = `O Olho que Tudo Vê revela: O nome do assassino começa com '${killer.name.charAt(0).toUpperCase()}'.`;
    } else if (roll < 0.7) {
        msg = `Uma premonição indica que o nome do assassino possui ${killer.name.length} letras.`;
    } else if (innocents.length > 0) {
        const innocent = innocents[Math.floor(Math.random() * innocents.length)];
        msg = `Os espíritos inocentam ${innocent.name}. Ele não carrega a lâmina.`;
    }

    // Envia pista (com chance de ser falsa se Invertido)
    if (msg) detectives.forEach(d => {
        let finalMsg = msg;
        if (d.isInverted && Math.random() < 0.5) {
             finalMsg = "Os sussurros mentem... (Pista Falsa Gerada)"; // Exemplo simples
        }
        
        d.clues.push(finalMsg); 
        io.to(d.socketId).emit('hintMessage', finalMsg);
        io.to(d.socketId).emit('updateClues', d.clues); // Atualiza a lista no cliente
    });
}

function generateHallucinations() {
    if (gameState.phase !== 'GAME') return;

    const players = Object.values(gameState.players);
    
    players.forEach(player => {
        // Sanidade abaixo de 3 gatilha alucinações
        if (player.isDead || player.sanity >= 3) return;

        // 40% de chance por tick
        if (Math.random() > 0.4) return;

        const randomMsg = HALLUCINATIONS[Math.floor(Math.random() * HALLUCINATIONS.length)];
        
        // Tenta simular um jogador real falando para confundir
        const otherPlayers = players.filter(p => p.id !== player.id);
        let senderName = "???";
        
        if (otherPlayers.length > 0) {
            senderName = otherPlayers[Math.floor(Math.random() * otherPlayers.length)].name;
        }

        // Envia apenas para o jogador alucinado (type: 'global' faz parecer real)
        io.to(player.socketId).emit('chatMessage', { sender: senderName, text: randomMsg, type: 'global' });
    });

    // SUSSURROS DO VÉU (Vazamento de Identidade por Sanidade Baixa)
    players.forEach(player => {
        if (!player.isDead && player.sanity < 4 && !player.isMonster) {
            // 30% de chance de vazar informação
            if (Math.random() < 0.3) {
                const otherPlayers = players.filter(p => p.id !== player.id);
                if (otherPlayers.length > 0) {
                    const receiver = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
                    io.to(receiver.socketId).emit('actionResult', { text: `👂 O Véu afina... Você ouve sussurros perturbadores: "${player.name} trilha o ${player.pathway}..."`, tab: 'system' });
                }
            }
        }
    });
}

function trySpawnMerchant() {
    if (gameState.phase !== 'GAME') return;
    if (gameState.merchant.active) return;

    // 30% de chance de aparecer a cada ciclo
    if (Math.random() < 0.3) {
        const items = [];
        // Gera 3 itens aleatórios
        for (let i = 0; i < 3; i++) {
            if (Math.random() < 0.15) { // 15% de chance de aparecer o item raro
                items.push({ id: i, name: "Elixir da Clareza", cost: 2 });
            } else {
                const ing = INGREDIENTS_LIST[Math.floor(Math.random() * INGREDIENTS_LIST.length)];
                items.push({ id: i, name: ing, cost: Math.floor(Math.random() * 2) + 1 }); // Custo 1 ou 2 Sanidade
            }
        }
        
        gameState.merchant = { active: true, items };
        io.emit('merchantUpdate', gameState.merchant);
        io.emit('actionResult', { text: "👻 O Mercador Sombrio emergiu das sombras! (Oferta por tempo limitado)", tab: 'system' });

        // Desaparece após 20 segundos
        setTimeout(() => {
            gameState.merchant = { active: false, items: [] };
            io.emit('merchantUpdate', gameState.merchant);
            io.emit('actionResult', { text: "O Mercador Sombrio desapareceu na névoa.", tab: 'system' });
        }, 20000);
    }
}

function processContinuousEffects() {
    if (gameState.phase !== 'GAME') return;

    Object.values(gameState.players).forEach(p => {
        if (p.spiritVisionActive && !p.isDead) {
            // Drena Espiritualidade e Sanidade
            if (p.spirituality > 0) {
                p.spirituality = Math.max(0, p.spirituality - 1);
            } else {
                // Se acabar a mana, drena sanidade
                p.sanity = Math.max(0, p.sanity - 1);
                if (p.sanity === 0) checkMonsterTransformation(p); // Função auxiliar ou lógica inline
            }
            
            io.to(p.socketId).emit('updateStats', { sanity: p.sanity, spirituality: p.spirituality });
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Shadow Of Mystery server running on port ${PORT}`);
});