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
let gameState = null;
let isHost = false; // Determina se este cliente processa as regras do jogo

// --- CONSTANTES DO JOGO (Lógica Local) ---
const PATHWAYS = {
    DEATH: { name: 'Caminho da Morte', role: 'Carrasco', baseSanity: 6 },
    SEER: { name: 'Caminho do Vidente', role: 'Vidente', baseSanity: 8 },
    SPECTATOR: { name: 'Caminho do Observador', role: 'Observador', baseSanity: 7 },
    POET: { name: 'Caminho do Poeta', role: 'Poeta', baseSanity: 9 }
};
const CODENAMES = {
    DEATH: { id: 'DEATH', name: 'A Morte', desc: 'Impede análise de pistas.', image: 'death.png', pathway: 'Carrasco' },
    THE_DEVIL: { id: 'THE_DEVIL', name: 'O Diabo', desc: 'Causa caos.', image: 'the_devil.png', pathway: 'Carrasco' },
    THE_TOWER: { id: 'THE_TOWER', name: 'A Torre', desc: 'Destruição.', image: 'the_tower.png', pathway: 'Carrasco' },
    THE_MAGICIAN: { id: 'THE_MAGICIAN', name: 'O Mago', desc: 'Copia carta.', image: 'the_magician.png', pathway: 'Vidente' },
    HIGH_PRIESTESS: { id: 'HIGH_PRIESTESS', name: 'A Papisa', desc: 'Revela item.', image: 'high_priestess.png', needsTarget: true, pathway: 'Vidente' },
    JUDGEMENT: { id: 'JUDGEMENT', name: 'O Julgamento', desc: 'Revela verdade.', image: 'judgement.png', pathway: 'Vidente' },
    THE_HERMIT: { id: 'THE_HERMIT', name: 'O Eremita', desc: 'Ilumina.', image: 'the_hermit.png', pathway: 'Observador' },
    THE_MOON: { id: 'THE_MOON', name: 'A Lua', desc: 'Alucinação.', image: 'the_moon.png', pathway: 'Observador' },
    THE_STAR: { id: 'THE_STAR', name: 'A Estrela', desc: 'Esperança.', image: 'the_star.png', pathway: 'Observador' },
    THE_SUN: { id: 'THE_SUN', name: 'O Sol', desc: 'Vitalidade.', image: 'the_sun.png', pathway: 'Poeta' },
    THE_EMPRESS: { id: 'THE_EMPRESS', name: 'A Imperatriz', desc: 'Criação.', image: 'the_empress.png', pathway: 'Poeta' },
    THE_WORLD: { id: 'THE_WORLD', name: 'O Mundo', desc: 'Sela Ruínas.', image: 'the_world.png', pathway: 'Poeta' },
    THE_FOOL: { id: 'THE_FOOL', name: 'O Louco', desc: 'Enganação.', image: 'the_fool.png', needsInput: true, pathway: 'Especial' },
    HANGED_MAN: { id: 'HANGED_MAN', name: 'O Pendurado', desc: 'Proteção.', image: 'hanged_man.png', needsTarget: true, pathway: 'Especial' }
};

// --- EVENTOS DE UI ---

document.getElementById('btn-join').onclick = () => {
    const name = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (password !== "12345") {
        alert("Senha incorreta.");
        return;
    }

    if (name) {
        joinGameFirebase(name);
    }
};

document.getElementById('btn-ready').onclick = () => {
    if (!myId) return;
    db.ref('players/' + myId + '/isReady').transaction(val => !val);
};

document.getElementById('btn-add-bot').onclick = () => {
    const botId = 'bot_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const botName = `Sombra ${Math.floor(Math.random() * 100)}`;
    const botData = createPlayerObject(botId, botName);
    botData.isBot = true;
    botData.isReady = true;
    db.ref('players/' + botId).set(botData);
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
    // Ações genéricas (ex: Investigar)
    if (type === 'INVESTIGATE_OCCULT') handleInvestigate();
};

window.startVoting = () => {
    if (isDead) return;
    db.ref('gameState').update({ phase: 'VOTING', votes: {} });
    addLog("O Julgamento começou.", "#a63737", 'system');
};

window.confirmSacrifice = () => {
    if (isDead) return;
    if (confirm("VOCÊ ESTÁ PRESTES A SE SACRIFICAR.\n\nIsso causará sua morte permanente, mas restaurará a sanidade dos seus aliados.\n\nDeseja realmente fazer isso?")) {
        db.ref('players/' + myId).update({ isDead: true });
        addLog("Você se sacrificou pelo grupo.", "#ff0000", 'combat');
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

// --- LÓGICA FIREBASE ---

function initFirebaseListeners() {
    document.getElementById('status-display').innerText = "Conectado ao Véu (Firebase)";

    // Tenta reconectar se houver sessão salva
    const storedId = localStorage.getItem('vc_playerId');
    if (storedId) {
        db.ref('players/' + storedId).once('value').then(snap => {
            if (snap.exists()) {
                myId = storedId;
                onJoinSuccess();
            } else {
                localStorage.removeItem('vc_playerId');
            }
        });
    }

    // Listener de Jogadores
    db.ref('players').on('value', (snapshot) => {
        const val = snapshot.val();
        currentPlayers = val ? Object.values(val) : [];
        
        // Verifica Host (o jogador mais antigo/primeiro da lista assume a lógica)
        if (currentPlayers.length > 0) {
            const sorted = currentPlayers.sort((a, b) => a.id.localeCompare(b.id));
            if (sorted[0].id === myId && !isHost) {
                isHost = true;
                console.log("Você é o Host da sessão.");
                startHostLoops();
            }
        }

        renderPlayerList();
        renderAbilities();
        
        const me = currentPlayers.find(p => p.id === myId);
        if (me) {
            if (me.isDead && !isDead) triggerDeath();
            document.getElementById('my-sanity').innerText = me.sanity;
            document.getElementById('my-level').innerText = me.level || 1;
            renderInventory(me.inventory);
            renderClues(me.clues || []);
            if (me.diary && diaryText.value === "") diaryText.value = me.diary;
        }
    });

    // Listener de Estado do Jogo
    db.ref('gameState').on('value', (snapshot) => {
        const state = snapshot.val();
        if (!state) return;
        gameState = state;

        if (state.phase === 'GAME' && lobbyScreen.style.display !== 'none') {
            onGameStarted();
        }
        
        if (state.phase === 'VOTING' && votingOverlay.style.display === 'none') {
            startVotingUI();
        } else if (state.phase !== 'VOTING') {
            votingOverlay.style.display = 'none';
        }

        if (state.ritualActive && !isRitualActive) {
            document.body.classList.add('ritual-mode');
            isRitualActive = true;
            startBloodRain();
            addLog("O RITUAL COMEÇOU!", "#ff0000", 'system');
        }
    });

    // Listener de Chat
    db.ref('messages').limitToLast(10).on('child_added', (snapshot) => {
        const msg = snapshot.val();
        addLog(`${msg.sender}: ${msg.text}`, null, 'chat');
        if (lobbyScreen.style.display !== 'none' && lobbyChatLog) {
            const p = document.createElement('p');
            p.innerText = `${msg.sender}: ${msg.text}`;
            lobbyChatLog.appendChild(p);
            lobbyChatLog.scrollTop = lobbyChatLog.scrollHeight;
        }
    });
}

initFirebaseListeners();

function joinGameFirebase(name) {
    const playerId = 'player_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const playerData = createPlayerObject(playerId, name);
    
    db.ref('players/' + playerId).set(playerData).then(() => {
        myId = playerId;
        localStorage.setItem('vc_playerId', playerId);
        onJoinSuccess();
    });
}

function createPlayerObject(id, name) {
    return {
        id: id, name: name, room: 'Salão', x: 400, y: 300,
        sanity: 10, isReady: false, isDead: false,
        role: 'Desconhecido', pathway: '???', inventory: [], clues: [], diary: ""
    };
}

function onJoinSuccess() {
    sfxWind.pause(); // Para o som do vento ao entrar
    bgmMenu.pause(); // Para a música do menu
    
    // Se for um novo login (não reconexão automática que já trata UI), mostra o lobby
    if (loginScreen.style.display !== 'none' && gameScreen.style.display === 'none') {
        loginScreen.style.display = 'none';
        lobbyScreen.style.display = 'block';
        tutorialOverlay.style.display = 'flex'; // Abre o tutorial ao entrar
    }
}

function onGameStarted() {
    if (lobbyChatLog) lobbyChatLog.innerHTML = '';
    if (lobbyChatInput) lobbyChatInput.value = '';
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    
    // Identificar meu personagem
    const me = currentPlayers.find(p => p.id === myId);
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

        if (gameState && gameState.ritualActive) {
            document.body.classList.add('ritual-mode');
            isRitualActive = true;
            startBloodRain();
            renderPlayerList();
        }
    }
}

function sendChatMessage(text) {
    const me = currentPlayers.find(p => p.id === myId);
    const name = me ? me.name : "Desconhecido";
    db.ref('messages').push({ sender: name, text: text, timestamp: Date.now() });
}

function startVotingUI() {
    votingOverlay.style.display = 'flex';
    votingCandidates.innerHTML = '';

    currentPlayers.forEach(p => {
        if (!p.isDead) {
            const btn = document.createElement('button');
            btn.className = 'vote-btn';
            btn.innerText = `Condenar ${p.name}`;
            btn.onclick = () => {
                db.ref('gameState/votes/' + myId).set(p.id);
                votingCandidates.innerHTML = '<p>Voto registrado. Aguardando veredito...</p>';
            };
            votingCandidates.appendChild(btn);
        }
    });

    addLog("--- O JULGAMENTO COMEÇOU ---", "#a63737", 'system');
    sfxVote.play().catch(() => {});
}

// --- LÓGICA DO HOST (SERVERLESS) ---

function startGameLogic() {
    if (currentPlayers.length < 1) {
        alert("Precisa de pelo menos 1 jogador.");
        return;
    }

    const playerIds = currentPlayers.map(p => p.id);
    // Embaralha
    for (let i = playerIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
    }

    const updates = {};
    playerIds.forEach((id, index) => {
        const roles = [PATHWAYS.DEATH, PATHWAYS.SEER, PATHWAYS.SPECTATOR, PATHWAYS.POET];
        const assigned = roles[index % roles.length];
        
        const availableCards = Object.values(CODENAMES).filter(c => c.pathway === assigned.role || c.pathway === 'Especial');
        const card = availableCards[Math.floor(Math.random() * availableCards.length)];

        updates[`players/${id}/role`] = assigned.role;
        updates[`players/${id}/pathway`] = assigned.name;
        updates[`players/${id}/sanity`] = assigned.baseSanity;
        updates[`players/${id}/name`] = card.name;
        updates[`players/${id}/inventory`] = [CODENAMES.THE_FOOL];
    });

    updates['gameState/phase'] = 'GAME';
    updates['gameState/ritualActive'] = false;
    db.ref().update(updates);
}

function startHostLoops() {
    setInterval(() => {
        if (!gameState || gameState.phase !== 'GAME') return;
        // Lógica periódica do host (ex: drenar sanidade)
    }, 2000);
}

function handleInvestigate() {
    const roll = Math.random();
    if (roll < 0.5) {
        addLog("Você encontrou uma pista oculta.", "#00ff00", 'system');
    } else {
        addLog("Sua mente vacila ao olhar o abismo. (-1 Sanidade)", "#ff0000", 'combat');
        db.ref(`players/${myId}/sanity`).transaction(s => (s || 10) - 1);
    }
}

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
                addLog(`Você usou ${card.name}.`, "#b388eb", 'system');
                // Remover do inventário no DB
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
                    db.ref(`players/${p.id}/isDead`).set(true);
                    addLog(`Você executou ${p.name}.`, "#ff0000", 'combat');
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
                btn.onclick = () => addLog(`Habilidade ${ab.name} usada.`, "#b388eb", 'combat');
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