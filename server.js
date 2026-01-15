const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- ESTADO DO JOGO (AUTORITATIVO) ---
let gameState = {
    phase: 'LOBBY', // LOBBY, GAME, VOTING, END
    players: {},    // Armazena dados de cada socket.id
    sanityGlobal: 100, // Sanidade coletiva (afeta o mapa)
    ritualActive: false,
    turn: 0,
    votes: {}, // { voterId: targetId }
    hintTimer: null,
    hallucinationTimer: null
};

let socketMap = {}; // Mapeia socket.id -> playerId

// Definição dos Caminhos (Classes)
const PATHWAYS = {
    OBSERVER: { name: 'Caminho do Observador', role: 'Detetive', baseSanity: 8 },
    WHISPERER: { name: 'Caminho do Sussurro', role: 'Ocultista', baseSanity: 6 },
    EXECUTIONER: { name: 'Caminho do Carrasco', role: 'Assassino', baseSanity: 7 }
};

// Definição dos Codinomes
const CODENAMES = {
    GHOST: { id: 'GHOST', name: 'Codinome: Fantasma', desc: 'Mensagem anônima.', image: 'ghost.png' },
    ECLIPSE: { id: 'ECLIPSE', name: 'Codinome: Eclipse', desc: 'Alucinação coletiva (-1 Sanidade).', image: 'eclipse.png' },
    WATCHER: { id: 'WATCHER', name: 'Codinome: Observador', desc: 'Revela o Caminho de um jogador.', image: 'watcher.png' },
    MIMIC: { id: 'MIMIC', name: 'Codinome: Mímico', desc: 'Troca Sanidade com outro.', image: 'mimic.png' }
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

io.on('connection', (socket) => {
    console.log('Nova conexão:', socket.id);

    // Jogador entra no Lobby
    socket.on('joinGame', (playerName) => {
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
            isReady: false,
            sanity: 10,
            isDead: false,
            inventory: [], // Codinomes iriam aqui
            diary: "", // Anotações pessoais
            clues: [] // Pistas recebidas (apenas Detetives)
        };
        
        socketMap[socket.id] = playerId;
        socket.emit('joinSuccess', playerId); // Envia o ID para o cliente salvar

        // Notifica a todos sobre o novo jogador com som e texto
        io.emit('playerJoinedLobby', playerName);
        io.emit('actionResult', { text: `${playerName} entrou no lobby.`, tab: 'system' });
        io.emit('updatePlayerList', Object.values(gameState.players));
    });

    // Reconexão de Jogador
    socket.on('reconnectGame', (playerId) => {
        const player = gameState.players[playerId];
        if (player) {
            // Atualiza o socket do jogador
            player.socketId = socket.id;
            socketMap[socket.id] = playerId;
            
            socket.emit('joinSuccess', playerId);
            
            if (gameState.phase === 'LOBBY') {
                socket.emit('reconnectUI', 'LOBBY');
            } else {
                socket.emit('gameStarted', gameState); // Restaura o estado do jogo
            }
            
            io.emit('updatePlayerList', Object.values(gameState.players));
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
            io.emit('updatePlayerList', Object.values(gameState.players));
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

        io.emit('actionResult', { text: `${player.name} iniciou a sessão. O Véu se ergue...`, tab: 'system' });

        gameState.phase = 'GAME';
        assignRoles();

        // Inicia o sistema de dicas (a cada 30s)
        if (gameState.hintTimer) clearInterval(gameState.hintTimer);
        gameState.hintTimer = setInterval(generateHint, 30000);

        // Inicia o sistema de alucinações (a cada 10s)
        if (gameState.hallucinationTimer) clearInterval(gameState.hallucinationTimer);
        gameState.hallucinationTimer = setInterval(generateHallucinations, 10000);

        io.emit('gameStarted', gameState);
    });

    // Ação de Jogador (Ex: Investigar, Usar Carta)
    socket.on('playerAction', (actionData) => {
        const playerId = socketMap[socket.id];
        const player = gameState.players[playerId];
        if (!player || gameState.phase !== 'GAME') return;
        
        if (player.isDead) return;

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

            // Anuncia a saída no log
            io.emit('actionResult', { text: `${player.name} saiu do jogo.`, tab: 'system' });

            // Dispara o som de saída apenas se estiver no lobby
            if (gameState.phase === 'LOBBY') {
                io.emit('playerLeftLobby', player.name);
            }

            delete gameState.players[playerId];
            delete socketMap[socket.id];
            io.emit('updatePlayerList', Object.values(gameState.players));
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
                const text = contentWithoutCmd.slice(target.name.length).trim();
                if (text) {
                    io.to(target.socketId).emit('chatMessage', { sender: player.name, text, type: 'private' });
                    socket.emit('chatMessage', { sender: `Para ${target.name}`, text, type: 'private' });
                }
            } else {
                socket.emit('actionResult', 'Jogador não encontrado para sussurro.');
            }
        } else {
            // Chat Global
            io.emit('chatMessage', { sender: player.name, text: msg, type: 'global' });
        }
    });

    // --- SISTEMA DE VOTAÇÃO ---
    
    socket.on('startVoting', () => {
        if (gameState.phase !== 'GAME') return;
        
        gameState.phase = 'VOTING';
        gameState.votes = {}; // Limpa votos anteriores
        
        io.emit('votingStarted', Object.values(gameState.players));
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
    const cardKeys = Object.keys(CODENAMES);
    
    // Lógica simplificada de distribuição
    // Num jogo real, haveria balanceamento (1 Assassino, X Ocultistas, Y Detetives)
    playerIds.forEach((id, index) => {
        let assignedPath;
        
        // Apenas para demonstração: distribui ciclicamente
        if (index % 3 === 0) assignedPath = PATHWAYS.OBSERVER;
        else if (index % 3 === 1) assignedPath = PATHWAYS.WHISPERER;
        else assignedPath = PATHWAYS.EXECUTIONER;

        gameState.players[id].pathway = assignedPath.name;
        gameState.players[id].role = assignedPath.role; // Secreto no cliente real
        gameState.players[id].sanity = assignedPath.baseSanity;
        
        // Distribui 1 Codinome Aleatório
        const randomCard = CODENAMES[cardKeys[Math.floor(Math.random() * cardKeys.length)]];
        gameState.players[id].inventory.push(randomCard);
    });

    console.log("Funções distribuídas. O Véu se ergue.");
}

function handleAction(player, action) {
    // Exemplo de mecânica de Sanidade
    if (action.type === 'INVESTIGATE_OCCULT') {
        // Risco de perder sanidade
        const roll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1; // 2d6
        
        let resultMsg = "";
        
        if (roll < 6) {
            player.sanity -= 2;
            gameState.sanityGlobal -= 5; // O fracasso acelera o ritual
            resultMsg = "Você olhou para o abismo. O abismo olhou de volta. (-2 Sanidade)";
            io.to(player.socketId).emit('actionResult', { text: resultMsg, tab: 'combat' });
        } else {
            resultMsg = "Você encontrou uma pista oculta sem enlouquecer.";
            io.to(player.socketId).emit('actionResult', { text: resultMsg, tab: 'system' });
        }

        // Verifica colapso mental
        if (player.sanity <= 4) {
            resultMsg += " [ALUCINAÇÃO] As paredes estão respirando.";
            io.to(player.socketId).emit('sanityEffect', { type: 'HALLUCINATION' });
        }

        checkRitual();

        
        // Atualiza estado global para todos (sem revelar segredos)
        io.emit('stateUpdate', { 
            playerId: player.id, 
            sanity: player.sanity 
        });
    }

    // Mecânica de Codinomes
    if (action.type === 'USE_CODENAME') {
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
        const card = player.inventory.splice(cardIndex, 1)[0];
        let msg = `[CODINOME] ${player.name} ativou o protocolo ${card.name}!`;

        switch (card.id) {
            case 'GHOST':
                io.emit('actionResult', `[FANTASMA] Uma transmissão criptografada ecoa: "A verdade é apenas uma mentira bem contada..."`);
                break;
            case 'ECLIPSE':
                Object.values(gameState.players).forEach(p => {
                    p.sanity = Math.max(0, p.sanity - 1);
                    if (p.sanity <= 4) io.to(p.socketId).emit('sanityEffect', { type: 'HALLUCINATION' });
                });
                gameState.sanityGlobal -= 10;
                checkRitual();
                msg += " A sanidade de todos foi abalada.";
                io.emit('actionResult', { text: msg, tab: 'combat' });
                break;
            case 'WATCHER':
                const target = Object.values(gameState.players).find(p => p.id !== player.id);
                if (target) io.emit('actionResult', { text: `[OBSERVADOR] O arquivo foi descriptografado: ${target.name} segue o ${target.pathway}.`, tab: 'system' });
                break;
            case 'MIMIC':
                const swapTarget = Object.values(gameState.players).find(p => p.id !== player.id);
                if (swapTarget) {
                    [player.sanity, swapTarget.sanity] = [swapTarget.sanity, player.sanity];
                    msg += ` Trocou de sanidade com ${swapTarget.name}.`;
                }
                io.emit('actionResult', { text: msg, tab: 'combat' });
                break;
            default:
                io.emit('actionResult', { text: msg, tab: 'system' });
        }

        io.emit('gameStarted', gameState); // Atualiza UI de todos (Sanidade/Inventário)
    }

    // Habilidade Especial do Carrasco durante o Ritual
    if (action.type === 'RITUAL_EXECUTE') {
        if (!gameState.ritualActive) {
            io.to(player.socketId).emit('actionResult', "O Ritual não está ativo.");
            return;
        }
        if (player.role !== 'Assassino') {
            io.to(player.socketId).emit('actionResult', "Apenas o Carrasco possui este poder.");
            return;
        }

        const target = gameState.players[action.targetId];
        if (target && !target.isDead && target.id !== player.id) {
            target.isDead = true;
            io.emit('actionResult', { text: `[RITUAL] ☠️ O Carrasco executou ${target.name} brutalmente!`, tab: 'combat' });
            io.emit('updatePlayerList', Object.values(gameState.players));

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

        io.emit('actionResult', { text: `[SACRIFÍCIO] ${player.name} entregou sua vida para purificar a mente do grupo.`, tab: 'combat' });
        io.emit('updatePlayerList', Object.values(gameState.players));

        // Verifica condições de vitória/derrota imediatas
        const alive = Object.values(gameState.players).filter(p => !p.isDead);
        const killer = Object.values(gameState.players).find(p => p.role === 'Assassino');

        if (player.role === 'Assassino') {
            gameState.phase = 'END';
            io.emit('gameOver', { winner: 'A Sociedade', reason: 'O Assassino cometeu suicídio.', players: gameState.players });
        } else if (killer && !killer.isDead && alive.length <= 1) {
            gameState.phase = 'END';
            io.emit('gameOver', { winner: 'O Carrasco', reason: 'A resistência da sociedade quebrou.', players: gameState.players });
        }

        io.emit('gameStarted', gameState); // Sincroniza estado (Sanidade atualizada)
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
        io.emit('updatePlayerList', Object.values(gameState.players)); // Atualiza lista para mostrar mortos

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

    const players = Object.values(gameState.players);
    const killer = players.find(p => p.role === 'Assassino');
    if (!killer) return;

    // Envia apenas para Detetives vivos
    const detectives = players.filter(p => p.role === 'Detetive' && !p.isDead);
    if (detectives.length === 0) return;

    const innocents = players.filter(p => p.role !== 'Assassino' && !p.isDead);
    let msg = "";
    const roll = Math.random();

    if (roll < 0.4) {
        msg = `O Olho que Tudo Vê revela: O nome do assassino começa com '${killer.name.charAt(0).toUpperCase()}'.`;
    } else if (roll < 0.7) {
        msg = `Uma premonição indica que o nome do assassino possui ${killer.name.length} letras.`;
    } else if (innocents.length > 0) {
        const innocent = innocents[Math.floor(Math.random() * innocents.length)];
        msg = `Os espíritos inocentam ${innocent.name}. Ele não carrega a lâmina.`;
    }

    if (msg) detectives.forEach(d => {
        d.clues.push(msg); // Salva a pista no inventário do jogador
        io.to(d.socketId).emit('hintMessage', msg);
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
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`The Veiled Crown server running on port ${PORT}`);
});