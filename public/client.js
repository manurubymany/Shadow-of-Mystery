// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    databaseURL: "https://shadow-of-mystery-default-rtdb.firebaseio.com/"
    // Adicione apiKey se necessário, mas para RTDB aberto, a URL basta.
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref();

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const playerList = document.getElementById('player-list');
const chatInput = document.getElementById('chat-input');
const btnSendChat = document.getElementById('btn-send-chat');
const votingOverlay = document.getElementById('voting-overlay');
const votingCandidates = document.getElementById('voting-candidates');
const gameOverScreen = document.getElementById('game-over-screen');
const winnerDisplay = document.getElementById('winner-display');
const abilityContainer = document.getElementById('ability-container');
const revealList = document.getElementById('reveal-list');
const diaryOverlay = document.getElementById('diary-overlay');
const diaryText = document.getElementById('diary-text');
const cluesOverlay = document.getElementById('clues-overlay');
const cluesList = document.getElementById('clues-list');
const tutorialOverlay = document.getElementById('tutorial-overlay');
const creditsOverlay = document.getElementById('credits-overlay');
const lobbyChatInput = document.getElementById('lobby-chat-input');
const btnLobbyChat = document.getElementById('btn-lobby-chat');
const lobbyChatLog = document.getElementById('lobby-chat-log');

// --- SISTEMA DE ÁUDIO ---
const bgmAmbient = new Audio('assets/audio/ambient_loop.mp3');
bgmAmbient.loop = true;
bgmAmbient.volume = 0.3;

const sfxVote = new Audio('assets/audio/bell_toll.mp3');
const sfxDeath = new Audio('assets/audio/death_impact.mp3');
const sfxRitual = new Audio('assets/audio/ritual_alarm.mp3');
const sfxWhisper = new Audio('assets/audio/whisper.mp3');
const sfxJoin = new Audio('assets/audio/door_open.mp3');
sfxJoin.volume = 0.5;
const sfxLeave = new Audio('assets/audio/door_close.mp3');
sfxLeave.volume = 0.5;

// Sons de Passos
const sfxStepWood = new Audio('assets/audio/step_wood.mp3');
const sfxStepStone = new Audio('assets/audio/step_stone.mp3');
const sfxStepGrass = new Audio('assets/audio/step_grass.mp3');
const sfxStepCarpet = new Audio('assets/audio/step_carpet.mp3');

// Mapeamento de Materiais por Sala
const ROOM_MATERIALS = {
    'Salão': sfxStepWood,
    'Biblioteca': sfxStepWood,
    'Jardim': sfxStepGrass,
    'Cozinha': sfxStepStone,
    'Aposentos': sfxStepCarpet
};

// Som de ambiente para a tela de login
const sfxWind = new Audio('assets/audio/wind_howl.mp3');
sfxWind.loop = true;
sfxWind.volume = 0.15;

// Música de Fundo do Menu
const bgmMenu = new Audio('assets/audio/menu_theme.mp3');
bgmMenu.loop = true;
bgmMenu.volume = 0.3; // Ajuste o volume aqui (0.0 a 1.0)

function playMenuAudio() {
    sfxWind.play().catch(() => {});
    bgmMenu.play().catch(() => {});
}

playMenuAudio();
document.addEventListener('click', playMenuAudio, { once: true });

// Estado Local
let myId = null;
let isDead = false;
let myRole = null;
let isRitualActive = false;
let currentPlayers = [];
let previousInventorySize = 0;

// --- EVENTOS DE UI ---

document.getElementById('btn-join').onclick = () => {
    const name = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if (name) {
        socket.emit('joinGame', { name, password });
    }
};

document.getElementById('btn-ready').onclick = () => {
    socket.emit('toggleReady');
};

document.getElementById('btn-add-bot').onclick = () => {
    socket.emit('addBot');
};

document.getElementById('btn-leave').onclick = () => {
    if (confirm("Deseja sair do lobby e voltar ao início?")) {
        localStorage.removeItem('vc_playerId');
        location.reload();
    }
};

document.getElementById('btn-start').onclick = () => {
    startGameLogic();
};

document.getElementById('btn-close-tutorial').onclick = () => {
    tutorialOverlay.style.display = 'none';
};

document.getElementById('btn-help').onclick = () => {
    tutorialOverlay.style.display = 'flex';
};

document.getElementById('btn-credits').onclick = () => {
    creditsOverlay.style.display = 'flex';
};

document.getElementById('btn-close-credits').onclick = () => {
    creditsOverlay.style.display = 'none';
};

btnLobbyChat.onclick = sendLobbyChat;
lobbyChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendLobbyChat();
});

btnSendChat.onclick = sendChat;

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});

function sendChat() {
    const text = chatInput.value.trim();
    if (text) {
        sendChatMessage(text);
        chatInput.value = '';
    }
}

function sendLobbyChat() {
    const text = lobbyChatInput.value.trim();
    if (text) {
        sendChatMessage(text);
        lobbyChatInput.value = '';
    }
}

window.sendAction = (type) => {
    if (isDead) return;
    socket.emit('playerAction', { type: type });
};

window.startVoting = () => {
    if (isDead) return;
    socket.emit('startVoting');
};

window.confirmSacrifice = () => {
    if (isDead) return;
    if (confirm("VOCÊ ESTÁ PRESTES A SE SACRIFICAR.\n\nIsso causará sua morte permanente, mas restaurará a sanidade dos seus aliados.\n\nDeseja realmente fazer isso?")) {
        socket.emit('playerAction', { type: 'SACRIFICE' });
    }
};

window.openDiary = () => {
    diaryOverlay.style.display = 'flex';
};

window.closeDiary = () => {
    diaryOverlay.style.display = 'none';
    db.ref('players/' + myId).update({ diary: diaryText.value });
};

window.openClues = () => {
    cluesOverlay.style.display = 'flex';
};

window.closeClues = () => {
    cluesOverlay.style.display = 'none';
};

// Salvamento automático do diário (debounce)
let diaryTimeout;
diaryText.addEventListener('input', () => {
    clearTimeout(diaryTimeout);
    diaryTimeout = setTimeout(() => {
        if (myId) db.ref('players/' + myId).update({ diary: diaryText.value });
    }, 1000);
});

window.switchTab = (tabName) => {
    // Remove classe active de todos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.log-box').forEach(box => box.classList.remove('active'));
    document.querySelectorAll('.log-box').forEach(box => box.style.display = 'none');

    // Ativa o selecionado
    event.target.classList.add('active');
    const activeBox = document.getElementById(`log-box-${tabName}`);
    activeBox.classList.add('active');
    activeBox.style.display = 'block';
};

// --- EVENTOS DO SOCKET ---

socket.on('connect', () => {
    document.getElementById('status-display').innerText = "Conectado ao Servidor";
    
    // Tenta reconectar se houver sessão salva
    const storedId = localStorage.getItem('vc_playerId');
    if (storedId) {
        socket.emit('reconnectGame', storedId);
    }
});

socket.on('joinSuccess', (playerId) => {
    sfxWind.pause(); // Para o som do vento ao entrar
    bgmMenu.pause(); // Para a música do menu
    myId = playerId;
    localStorage.setItem('vc_playerId', playerId);
    
    // Se for um novo login (não reconexão automática que já trata UI), mostra o lobby
    if (loginScreen.style.display !== 'none' && gameScreen.style.display === 'none') {
        loginScreen.style.display = 'none';
        lobbyScreen.style.display = 'block';
        tutorialOverlay.style.display = 'flex'; // Abre o tutorial ao entrar
    }
});

socket.on('errorMsg', (msg) => {
    alert(msg);
});

socket.on('forceClearSession', () => {
    localStorage.removeItem('vc_playerId');
    // Opcional: alert("Sessão expirada.");
    location.reload();
});

socket.on('updatePlayerList', (players) => {
    currentPlayers = players;
    renderPlayerList();
    renderAbilities(); // Atualiza habilidades se o nível mudou
});

socket.on('reconnectUI', (phase) => {
    if (phase === 'LOBBY') {
        loginScreen.style.display = 'none';
        lobbyScreen.style.display = 'block';
        // Opcional: tutorialOverlay.style.display = 'flex'; // Se quiser mostrar na reconexão também
    }
});

socket.on('gameStarted', (gameState) => {
    if (lobbyChatLog) lobbyChatLog.innerHTML = '';
    if (lobbyChatInput) lobbyChatInput.value = '';
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    
    // Identificar meu personagem
    const me = gameState.players[myId];
    if (me) {
        myRole = me.role;
        document.getElementById('my-role').innerText = "Caminho: " + me.pathway;
        document.getElementById('my-sanity').innerText = me.sanity;
        document.getElementById('my-level').innerText = me.level || 1;
        renderInventory(me.inventory);
        renderAbilities();
        diaryText.value = me.diary || ""; // Carrega o diário salvo
        renderClues(me.clues || []); // Carrega pistas salvas
        addLog(`O jogo começou. Você trilha o ${me.pathway}.`);
        
        // Resetar estado de morte ao iniciar novo jogo
        resetDeathState();
        
        // Iniciar música ambiente (pode exigir interação do usuário dependendo do navegador)
        bgmAmbient.play().catch(e => console.log("Áudio bloqueado pelo navegador. Interaja com a página."));

        if (gameState.ritualActive) {
            document.body.classList.add('ritual-mode');
            isRitualActive = true;
            startBloodRain();
            renderPlayerList();
        }
    }
});

socket.on('playerJoinedLobby', () => {
    // O servidor já envia uma mensagem de log via 'actionResult'.
    // Apenas tocamos o som para evitar duplicidade de mensagens.
    sfxJoin.play().catch(() => {});
});

socket.on('playerLeftLobby', () => {
    sfxLeave.play().catch(() => {});
});

socket.on('actionResult', (data) => {
    // Suporta tanto string antiga quanto objeto novo { text, tab }
    if (typeof data === 'string') {
        addLog(data, null, 'system');
    } else {
        addLog(data.text, null, data.tab || 'system');
    }
});

socket.on('sanityEffect', (effect) => {
    if (effect.type === 'HALLUCINATION') {
        document.body.style.filter = "sepia(100%) hue-rotate(90deg) blur(1px)";
        setTimeout(() => {
            document.body.style.filter = "none";
        }, 3000);
        addLog("Sua mente vacila...", '#ff6b6b', 'combat');
    }
});

socket.on('chatMessage', (data) => {
    // data = { sender: 'Nome', text: 'msg', type: 'global'|'private'|'occult' }
    let color = '#d4c5a8';
    let prefix = '[Global]';

    if (data.type === 'private') {
        color = '#ff6b6b';
        prefix = '[Sussurro]';
        sfxWhisper.play().catch(() => {});
    } else if (data.type === 'occult') {
        color = '#b388eb'; // Roxo místico
        prefix = '[Sombra]';
        sfxWhisper.play().catch(() => {});
    }

    addLog(`${prefix} ${data.sender}: ${data.text}`, color, 'chat');

    // Adiciona ao chat do Lobby se estiver visível
    if (lobbyScreen.style.display !== 'none' && lobbyChatLog) {
        const p = document.createElement('p');
        p.innerText = `${data.sender}: ${data.text}`;
        p.style.color = color;
        lobbyChatLog.appendChild(p);
        lobbyChatLog.scrollTop = lobbyChatLog.scrollHeight;
    }
});

socket.on('hintMessage', (msg) => {
    addLog(`[PISTA] ${msg}`, '#00ff00', 'system'); // Verde brilhante para pistas
});

socket.on('updateClues', (clues) => {
    renderClues(clues);
});

socket.on('votingStarted', (players) => {
    votingOverlay.style.display = 'flex';
    votingCandidates.innerHTML = '';

    players.forEach(p => {
        if (!p.isDead) {
            const btn = document.createElement('button');
            btn.className = 'vote-btn';
            btn.innerText = `Condenar ${p.name}`;
            btn.onclick = () => {
                socket.emit('castVote', p.id);
                votingCandidates.innerHTML = '<p>Voto registrado. Aguardando veredito...</p>';
            };
            votingCandidates.appendChild(btn);
        }
    });

    addLog("--- O JULGAMENTO COMEÇOU ---", "#a63737", 'system');
    sfxVote.play().catch(() => {});
});

socket.on('votingEnded', () => {
    votingOverlay.style.display = 'none';
});

socket.on('ritualStart', () => {
    document.body.classList.add('ritual-mode');
    isRitualActive = true;
    sfxRitual.play().catch(() => {});
    addLog("O CÉU SE TORNA SANGUE. O RITUAL ESTÁ ENTRE NÓS.", "#ff0000", 'system');
    startBloodRain();
    renderPlayerList();
});

socket.on('gameOver', (data) => {
    // data = { winner: string, reason: string, players: object }
    document.body.classList.remove('dead-mode'); // Remove filtro cinza se estiver morto
    document.body.classList.remove('ritual-mode');
    
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    votingOverlay.style.display = 'none';
    document.getElementById('death-overlay').style.display = 'none';
    document.getElementById('blood-rain-container').style.display = 'none';
    gameOverScreen.style.display = 'flex';

    winnerDisplay.innerText = `VENCEDOR: ${data.winner.toUpperCase()}`;
    document.getElementById('win-reason').innerText = data.reason;

    revealList.innerHTML = '';
    Object.values(data.players).forEach(p => {
        const li = document.createElement('li');
        const status = p.isDead ? " (MORTO)" : " (VIVO)";
        li.innerText = `${p.name} - ${p.role} [${p.pathway}]${status}`;
        if (p.role === 'Assassino') li.style.color = '#ff4444';
        revealList.appendChild(li);
    });
});

function addLog(text, color = null, tab = 'system') {
    const targetBox = document.getElementById(`log-box-${tab}`) || document.getElementById('log-box-system');
    const p = document.createElement('p');
    p.innerText = `> ${text}`;
    if (color) p.style.color = color;
    targetBox.appendChild(p);
    targetBox.scrollTop = targetBox.scrollHeight;
}

function triggerDeath() {
    isDead = true;
    document.body.classList.add('dead-mode');
    document.getElementById('death-overlay').style.display = 'flex';
    sfxDeath.play().catch(() => {});
    addLog("A escuridão te consumiu. Você não pode mais interagir com o mundo físico.", "#ff0000", 'combat');
}

function resetDeathState() {
    isDead = false;
    document.body.classList.remove('dead-mode');
    document.getElementById('death-overlay').style.display = 'none';
}

function renderInventory(inventory) {
    const list = document.getElementById('card-list');
    list.innerHTML = '';
    list.classList.add('inventory-grid'); // Adiciona classe para layout grid
    
    if (!inventory || inventory.length === 0) {
        const li = document.createElement('li');
        li.innerText = "(Vazio)";
        li.style.color = "#777";
        li.style.fontStyle = "italic";
        list.appendChild(li);
        previousInventorySize = 0;
        return;
    }

    inventory.forEach((card, index) => {
        const li = document.createElement('li');
        
        const img = document.createElement('img');
        // Assume que as imagens estão em assets/cards/
        img.src = `assets/cards/${card.image}`;
        img.className = 'codename-card';
        img.alt = card.name;
        img.title = `${card.name}\n${card.desc}`; // Tooltip nativo

        // Anima apenas se for o carregamento inicial ou se for uma carta nova (índice maior que o anterior)
        if (previousInventorySize === 0 || index >= previousInventorySize) {
            img.classList.add('flip-in');
            img.style.animationDelay = `${(index - previousInventorySize) * 0.15}s`; // Efeito cascata
        } else {
            img.style.opacity = "1"; // Cartas antigas aparecem instantaneamente
        }
        
        img.onclick = () => {
            if (confirm(`Deseja ativar o "${card.name}"?`)) {
                socket.emit('playerAction', { type: 'USE_CODENAME', cardIndex: index });
            }
        };
        
        li.appendChild(img);
        list.appendChild(li);
    });

    previousInventorySize = inventory.length;
}

function renderPlayerList() {
    playerList.innerHTML = '';
    
    // Verifica se eu morri
    const me = currentPlayers.find(p => p.id === myId);
    if (me && me.isDead && !isDead) {
        triggerDeath();
    }

    currentPlayers.forEach(p => {
        const li = document.createElement('li');
        const readyStatus = p.isReady ? " [PRONTO]" : "";
        li.innerText = `${p.name} (Lvl ${p.level || 1})${p.id === myId ? " (Você)" : ""}${readyStatus}`;
        
        if (p.isReady) {
            li.style.color = "#4caf50"; // Verde para indicar pronto
        }
        
        if (p.isDead) {
            li.style.textDecoration = "line-through";
            li.style.color = "#888";
        } else if (isRitualActive && myRole === 'Assassino' && p.id !== myId && !isDead) {
            // Botão de Execução do Assassino
            const btnKill = document.createElement('button');
            btnKill.innerText = "☠️";
            btnKill.className = "kill-btn";
            btnKill.title = "Executar Jogador";
            btnKill.style.marginLeft = "10px";
            btnKill.onclick = () => {
                if (confirm(`Deseja executar ${p.name}? Esta ação é irreversível.`)) {
                    socket.emit('playerAction', { type: 'RITUAL_EXECUTE', targetId: p.id });
                }
            };
            li.appendChild(btnKill);
        }

        playerList.appendChild(li);
    });

    // Atualiza o texto do meu botão
    const btnReady = document.getElementById('btn-ready');
    if (me && btnReady) {
        btnReady.innerText = me.isReady ? "Cancelar" : "Estou Pronto";
        btnReady.style.borderColor = me.isReady ? "#4caf50" : "#5c4b36";
    }
}

function renderAbilities() {
    abilityContainer.innerHTML = '';
    const me = currentPlayers.find(p => p.id === myId);
    if (!me || !me.role) return;

    // Definição local para renderização (deve bater com o servidor)
    const ABILITIES_UI = {
        Detetive: {
            2: { id: 'ANALYZE', name: 'Analisar Aura', cost: 2, target: true },
            3: { id: 'TRUTH', name: 'Visão da Verdade', cost: 5, target: true }
        },
        Ocultista: {
            2: { id: 'HEAL', name: 'Restaurar Mente', cost: 1, target: true },
            3: { id: 'BLAST', name: 'Sussurro do Caos', cost: 3, target: true }
        },
        Assassino: {
            2: { id: 'TERROR', name: 'Semear Terror', cost: 0, target: true },
            3: { id: 'SABOTAGE', name: 'Sabotagem', cost: 0, target: false }
        }
    };

    const myAbilities = ABILITIES_UI[me.role];
    if (!myAbilities) return;

    for (let lvl = 2; lvl <= (me.level || 1); lvl++) {
        if (myAbilities[lvl]) {
            const ab = myAbilities[lvl];
            const btn = document.createElement('button');
            btn.style.marginTop = "5px";
            
            // Verifica Cooldown
            const cooldownEnd = me.abilityCooldowns && me.abilityCooldowns[ab.id] ? me.abilityCooldowns[ab.id] : 0;
            const now = Date.now();
            
            if (cooldownEnd > now) {
                const remaining = Math.ceil((cooldownEnd - now) / 1000);
                btn.innerText = `${ab.name} (${remaining}s)`;
                btn.disabled = true;
                btn.style.borderColor = "#555";
                btn.style.color = "#777";
                btn.style.cursor = "not-allowed";
            } else {
                btn.innerText = `${ab.name} (Custo: ${ab.cost})`;
                btn.style.borderColor = "#b388eb"; // Cor mística
                btn.style.color = "#e0d0f5";
                btn.onclick = () => useAbility(ab.id, ab.target, ab.name);
            }
            
            abilityContainer.appendChild(btn);
        }
    }
}

// Atualiza a UI das habilidades a cada segundo para mostrar a contagem regressiva
setInterval(() => {
    if (document.getElementById('game-screen').style.display === 'block') {
        renderAbilities();
    }
}, 1000);

function startBloodRain() {
    const container = document.getElementById('blood-rain-container');
    container.style.display = 'block';
    container.innerHTML = ''; // Limpa gotas anteriores

    for (let i = 0; i < 100; i++) {
        const drop = document.createElement('div');
        drop.className = 'blood-drop';
        drop.style.left = Math.random() * 100 + 'vw';
        drop.style.animationDuration = (Math.random() * 1 + 0.5) + 's'; // Entre 0.5s e 1.5s
        drop.style.animationDelay = (Math.random() * 2) + 's';
        drop.style.opacity = Math.random() * 0.5 + 0.2;
        container.appendChild(drop);
    }
}

function renderClues(clues) {
    cluesList.innerHTML = '';
    if (!clues || clues.length === 0) {
        const li = document.createElement('li');
        li.innerText = "Nenhuma pista encontrada ainda.";
        li.style.fontStyle = "italic";
        li.style.color = "#555";
        cluesList.appendChild(li);
        return;
    }
    clues.forEach(clue => {
        const li = document.createElement('li');
        li.innerText = clue;
        cluesList.appendChild(li);
    });
}