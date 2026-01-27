const socket = io();

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
const ingredientsList = document.getElementById('ingredients-list');
const tutorialOverlay = document.getElementById('tutorial-overlay');
const creditsOverlay = document.getElementById('credits-overlay');
const merchantContainer = document.getElementById('merchant-container');
const merchantList = document.getElementById('merchant-list');
const shuffleOverlay = document.getElementById('shuffle-overlay');
const roomButtonsContainer = document.getElementById('room-buttons');
const explorationView = document.getElementById('exploration-view');
const tableView = document.getElementById('table-view');
const gameWorld = document.getElementById('game-world');
const spiritVisionOverlay = document.getElementById('spirit-vision-overlay');
const btnSpiritVision = document.getElementById('btn-spirit-vision');

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

// Som de ambiente para a tela de login
const sfxWind = new Audio('assets/audio/wind_howl.mp3');
sfxWind.loop = true;
sfxWind.volume = 0.15;
sfxWind.play().catch(() => {
    document.addEventListener('click', () => {
        sfxWind.play().catch(() => {});
    }, { once: true });
});

// Estado Local
let myId = null;
let isDead = false;
let myRole = null;
let isRitualActive = false;
let currentPlayers = [];
let previousInventorySize = 0;
let spiritVisionActive = false;
let movementInterval = null;
let moveVector = { x: 0, y: 0 };

// --- EVENTOS DE UI ---

// 1. Botão de Entrar (Integrado ao Firebase)
document.getElementById('btn-join').onclick = () => {
    const name = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // O Firebase exige um formato de e-mail, então adaptamos seu nome de usuário
    const email = name.toLowerCase().replace(/\s/g, '') + "@mansao.com";

    if (name && password) {
        document.getElementById('status-display').innerText = "Validando no cofre...";

        // Chama a autenticação do Firebase configurada no index.html
        window.fbMethods.signInWithEmailAndPassword(window.fbAuth, email, password)
            .then((userCredential) => {
                console.log("Acesso concedido:", userCredential.user.uid);
                
                // Após o Firebase validar, emitimos para o seu servidor Socket.io
                socket.emit('joinGame', { name, password });
            })
            .catch((error) => {
                console.error("Erro Firebase:", error.code);
                alert("O Véu rejeitou seu acesso. Verifique seu nome e senha ou crie sua conta no console.");
                document.getElementById('status-display').innerText = "Acesso Negado.";
            });
    } else {
        alert("Por favor, preencha seu nome e a senha secreta.");
    }
};

// 2. Botões do Lobby
document.getElementById('btn-ready').onclick = () => {
    socket.emit('toggleReady');
};

document.getElementById('btn-start').onclick = () => {
    socket.emit('startGame');
};

// 3. Sistema de Tutorial (Guia de Sobrevivência)
document.getElementById('btn-help').onclick = () => {
    document.getElementById('tutorial-overlay').style.display = 'flex';
};

document.getElementById('btn-close-tutorial').onclick = () => {
    document.getElementById('tutorial-overlay').style.display = 'none';
};

// 4. Diário e Pistas (Elementos de Mistério)
window.openDiary = () => {
    document.getElementById('diary-overlay').style.display = 'flex';
};

window.closeDiary = () => {
    const text = document.getElementById('diary-text').value;
    // DICA: Você pode usar fbMethods.set(fbMethods.ref(fbDb, 'diarios/' + auth.uid), text) para salvar no Firebase!
    document.getElementById('diary-overlay').style.display = 'none';
};

window.openClues = () => {
    document.getElementById('clues-overlay').style.display = 'flex';
};

window.closeClues = () => {
    document.getElementById('clues-overlay').style.display = 'none';
};

// 5. Sistema de Chat
const btnSendChat = document.getElementById('btn-send-chat');
const chatInput = document.getElementById('chat-input');

btnSendChat.onclick = sendChat;

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});

function sendChat() {
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('chatMessage', text);
        chatInput.value = '';
    }
}

// 6. Abas do Log (Sistema, Chat, Combate)
window.switchTab = (tab) => {
    document.querySelectorAll('.log-box').forEach(box => box.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById('log-box-' + tab).style.display = 'block';
    event.currentTarget.classList.add('active');
};
// Botão de Visão Espiritual
btnSpiritVision.onmousedown = () => toggleSpiritVision(true);
btnSpiritVision.onmouseup = () => toggleSpiritVision(false);
btnSpiritVision.ontouchstart = (e) => { e.preventDefault(); toggleSpiritVision(true); };
btnSpiritVision.ontouchend = (e) => { e.preventDefault(); toggleSpiritVision(false); };

window.sendAction = (type) => {
    if (isDead) return;
    socket.emit('playerAction', { type: type });
};

window.startVoting = () => {
    if (isDead) return;
    socket.emit('startVoting');
};

window.craftPotion = () => {
    if (isDead) return;
    socket.emit('craftPotion');
};

window.buyItem = (itemId) => {
    if (isDead) return;
    socket.emit('buyItem', itemId);
};

window.moveRoom = (roomName) => {
    if (isDead) return;
    socket.emit('moveRoom', roomName);
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
    socket.emit('updateDiary', diaryText.value);
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
        socket.emit('updateDiary', diaryText.value);
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
    shuffleOverlay.style.display = 'none'; // Esconde a animação
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    
    // Identificar meu personagem
    const me = gameState.players[myId];
    if (me) {
        myRole = me.role;
        document.getElementById('my-role').innerText = "Caminho: " + me.pathway;
        updateStatsUI(me.sanity, me.spirituality);
        document.getElementById('my-level').innerText = "Seq " + (me.level !== undefined ? me.level : 9);
        updateRoomUI(me.room);
        renderInventory(me.inventory);
        renderIngredients(me.ingredients || []);
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

        // Inicia loop de movimento
        startMovementLoop();
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
});

socket.on('hintMessage', (msg) => {
    addLog(`[PISTA] ${msg}`, '#00ff00', 'system'); // Verde brilhante para pistas
});

socket.on('updateClues', (clues) => {
    renderClues(clues);
});

socket.on('updateIngredients', (ingredients) => {
    renderIngredients(ingredients);
});

socket.on('merchantUpdate', (merchant) => {
    if (merchant.active) {
        merchantContainer.style.display = 'block';
        merchantList.innerHTML = '';
        merchant.items.forEach(item => {
            const li = document.createElement('li');
            li.style.marginBottom = '5px';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            
            li.innerHTML = `
                <span style="color: #d4c5a8;">${item.name}</span>
                <button onclick="buyItem(${item.id})" style="font-size: 0.7em; padding: 2px 5px; border-color: #b388eb; color: #e0d0f5;">
                    -${item.cost} San
                </button>
            `;
            merchantList.appendChild(li);
        });
    } else {
        merchantContainer.style.display = 'none';
    }
});

socket.on('lightsOut', (isDark) => {
    if (isDark) {
        document.body.style.filter = "brightness(0.2) contrast(1.2)";
    } else {
        document.body.style.filter = "none";
    }
});

socket.on('roleShuffleStart', () => {
    shuffleOverlay.style.display = 'flex';
    // Opcional: tocar um som de cartas embaralhando aqui se tiver
});

socket.on('votingStarted', (players) => {
    votingOverlay.style.display = 'flex';
    // Muda para layout de Mesa
    explorationView.style.display = 'none';
    tableView.style.display = 'flex';
    
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
    // Volta para Exploração
    explorationView.style.display = 'block';
    tableView.style.display = 'none';
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

    stopMovementLoop();

    winnerDisplay.innerText = `VENCEDOR: ${data.winner.toUpperCase()}`;
    document.getElementById('win-reason').innerText = data.reason;

    revealList.innerHTML = '';
    Object.values(data.players).forEach(p => {
        const li = document.createElement('li');
        const status = p.isDead ? " (MORTO)" : " (VIVO)";
        li.innerText = `${p.name} - ${p.role} [${p.pathway}]${status}`;
        if (p.role === 'Carrasco') li.style.color = '#ff4444';
        revealList.appendChild(li);
    });
});

socket.on('updatePositions', (data) => {
    // data = { id, x, y }
    const avatar = document.getElementById(`avatar-${data.id}`);
    if (avatar) {
        avatar.style.left = data.x + 'px';
        avatar.style.top = data.y + 'px';
    }
});

socket.on('updateStats', (stats) => {
    updateStatsUI(stats.sanity, stats.spirituality);
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
        img.className = 'codename-card';
        img.alt = card.name;
        img.title = `${card.name}\n${card.desc}`; // Tooltip nativo

        // Fallback: Se a imagem não existir, cria um cartão de texto
        img.onerror = () => {
            img.remove(); // Remove o ícone de imagem quebrada
            const div = document.createElement('div');
            div.className = 'codename-card'; // Mantém o estilo visual
            div.innerText = card.name;
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.fontSize = '0.7em';
            div.style.textAlign = 'center';
            div.style.padding = '5px';
            div.style.color = '#d4c5a8';
            
            // Reatribui o clique para funcionar igual à imagem
            div.onclick = () => {
                useCard(card, index);
            };
            li.appendChild(div);
        };

        img.src = `assets/cards/${card.image}`;

        // Anima apenas se for o carregamento inicial ou se for uma carta nova (índice maior que o anterior)
        if (previousInventorySize === 0 || index >= previousInventorySize) {
            img.classList.add('flip-in');
            img.style.animationDelay = `${(index - previousInventorySize) * 0.15}s`; // Efeito cascata
        } else {
            img.style.opacity = "1"; // Cartas antigas aparecem instantaneamente
        }
        
        img.onclick = () => {
            useCard(card, index);
        };
        
        li.appendChild(img);
        list.appendChild(li);
    });

    previousInventorySize = inventory.length;
}

function renderIngredients(ingredients) {
    ingredientsList.innerHTML = '';
    if (!ingredients || ingredients.length === 0) {
        ingredientsList.innerHTML = '<li>(Vazio)</li>';
        return;
    }
    
    ingredients.forEach(ing => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.marginBottom = '5px';

        const span = document.createElement('span');
        span.innerText = `- ${ing}`;
        
        const btnTrade = document.createElement('button');
        btnTrade.innerText = 'Trocar';
        btnTrade.style.fontSize = '0.7em';
        btnTrade.style.padding = '2px 6px';
        btnTrade.style.marginLeft = '10px';
        btnTrade.style.background = '#2c3e50';
        btnTrade.style.border = '1px solid #5c4b36';
        btnTrade.style.color = '#d4c5a8';
        btnTrade.style.cursor = 'pointer';

        btnTrade.onclick = () => tradeIngredient(ing);
        
        li.appendChild(span);
        li.appendChild(btnTrade);
        ingredientsList.appendChild(li);
    });
}

function tradeIngredient(ingredientName) {
    if (isDead) return;
    const name = prompt(`Para quem você deseja enviar ${ingredientName}?`);
    if (!name) return;
    
    const target = currentPlayers.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (target) {
        if (target.id === myId) return alert("Você não pode trocar consigo mesmo.");
        socket.emit('tradeIngredient', { targetId: target.id, ingredientName });
    } else {
        alert("Jogador não encontrado.");
    }
}

function useCard(card, index) {
    let payload = { type: 'USE_CODENAME', cardIndex: index };

    if (card.needsInput) {
        const msg = prompt(`[${card.name}] Digite a mensagem para enviar:`);
        if (!msg) return;
        payload.message = msg;    
    } else if (card.targetType === 'room') {
        const roomName = prompt(`[${card.name}] Digite a sala alvo (Salão, Biblioteca, Jardim, Cozinha, Aposentos):`);
        if (!roomName) return;
        // Validação simples
        const validRooms = ['Salão', 'Biblioteca', 'Jardim', 'Cozinha', 'Aposentos'];
        const formattedRoom = validRooms.find(r => r.toLowerCase() === roomName.toLowerCase());
        if (formattedRoom) payload.targetId = formattedRoom;
        else { alert("Sala inválida."); return; }
    } else if (card.needsTarget) {
        const name = prompt(`[${card.name}] Digite o nome do alvo:`);
        if (!name) return;
        const target = currentPlayers.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (target) payload.targetId = target.id;
        else { alert("Jogador não encontrado."); return; }
    } else if (!confirm(`Deseja ativar o "${card.name}"?`)) {
        return;
    }

    socket.emit('playerAction', payload);
}

function updateRoomUI(currentRoom) {
    document.getElementById('current-room').innerText = currentRoom || 'Desconhecido';
    
    // Lista de salas disponíveis (deve bater com o servidor)
    const rooms = ['Salão', 'Biblioteca', 'Jardim', 'Cozinha', 'Aposentos'];
    
    roomButtonsContainer.innerHTML = '';
    rooms.forEach(room => {
        const btn = document.createElement('button');
        btn.innerText = room;
        btn.style.fontSize = '0.8em';
        btn.style.padding = '5px';
        btn.style.flex = '1 0 40%'; // Botões ocupam espaço
        
        if (room === currentRoom) {
            btn.disabled = true;
            btn.style.borderColor = '#a63737';
            btn.style.color = '#a63737';
        } else {
            btn.onclick = () => moveRoom(room);
        }
        roomButtonsContainer.appendChild(btn);
    });
}

function updateStatsUI(sanity, spirituality) {
    document.getElementById('my-sanity-text').innerText = sanity;
    document.getElementById('my-spirit-text').innerText = spirituality;
    
    // Atualiza barras visuais
    document.getElementById('sanity-bar').style.width = (sanity * 10) + '%';
    document.getElementById('spirit-bar').style.width = (spirituality * 10) + '%';
}

function renderPlayerList() {
    playerList.innerHTML = '';
    
    // Verifica se eu morri
    const me = currentPlayers.find(p => p.id === myId);
    if (me && me.isDead && !isDead) {
        triggerDeath();
    }
    
    if (me) updateRoomUI(me.room);

    renderGameWorldAvatars(); // Atualiza avatares visuais

    currentPlayers.forEach(p => {
        const li = document.createElement('li');
        const readyStatus = p.isReady ? " [PRONTO]" : "";
        let displayName = p.name;
        
        if (p.isInverted) {
            displayName += " (Invertido)";
            li.style.transform = "rotate(180deg)"; // Efeito visual divertido ou apenas texto
            li.style.color = "#ffaa00";
        }
        
        // Mostra a sala onde o jogador está
        li.innerText = `${displayName} [${p.room || '?'}]${p.id === myId ? " (Você)" : ""}${readyStatus}`;
        
        // Clique para Sussurrar
        if (p.id !== myId) {
            li.style.cursor = "pointer";
            li.title = "Clique para sussurrar";
            li.onclick = () => {
                chatInput.value = `/w ${p.name} `;
                chatInput.focus();
            };
        }

        if (p.isReady) {
            li.style.color = "#4caf50"; // Verde para indicar pronto
        }
        
        if (p.isDead) {
            li.style.textDecoration = "line-through";
            li.style.color = "#888";
        } else if (p.isMonster) {
            li.style.color = "#ff00ff"; // Cor para Monstro
            li.innerText += " [MONSTRO]";
        } else if (isRitualActive && myRole === 'Carrasco' && p.id !== myId && !isDead) {
            // Botão de Execução do Assassino
            const btnKill = document.createElement('button');
            btnKill.innerText = "☠️";
            btnKill.className = "kill-btn";
            btnKill.title = "Executar Jogador";
            btnKill.style.marginLeft = "10px";
            btnKill.onclick = (e) => {
                e.stopPropagation(); // Impede que o clique no botão ative o sussurro
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
        btnReady.style.borderColor = me.isReady ? "#ff4444" : "#4caf50";
        btnReady.style.color = me.isReady ? "#ff4444" : "#d4c5a8";
    }
}

function renderGameWorldAvatars() {
    // Limpa avatares antigos que não estão mais na lista ou mudaram de sala
    // (Simplificação: recria todos. Em produção, faríamos diff)
    gameWorld.innerHTML = '';
    
    const me = currentPlayers.find(p => p.id === myId);
    if (!me) return;

    currentPlayers.forEach(p => {
        if (p.room === me.room && !p.isDead) {
            const div = document.createElement('div');
            div.id = `avatar-${p.id}`;
            div.className = 'player-avatar';
            div.style.left = (p.x || 400) + 'px';
            div.style.top = (p.y || 300) + 'px';
            if (p.id === myId) div.style.border = '2px solid #4caf50';
            gameWorld.appendChild(div);
        }
    });
}

function renderAbilities() {
    abilityContainer.innerHTML = '';
    const me = currentPlayers.find(p => p.id === myId);
    if (!me || !me.role) return;

    // Definição local para renderização (deve bater com o servidor)
    const ABILITIES_UI = {
        Carrasco: {
            10: { id: 'SECRET_PASSAGE', name: 'Passagem Secreta', cost: 1, targetType: 'room' },
            9: { id: 'SILENT_KILL', name: 'Abate Silencioso', cost: 3, target: true },
            8: { id: 'SABOTAGE', name: 'Sabotagem', cost: 2, targetType: 'room' }
        },
        Vidente: {
            9: { id: 'AUSPEX', name: 'Auspício', cost: 2, target: false }
        },
        Observador: {
            9: { id: 'DETAIL_VISION', name: 'Visão de Detalhes', cost: 1, target: false }
        },
        Poeta: {
            9: { id: 'SOOTHE', name: 'Acalento', cost: 1, target: true }
        }
    };

    const myAbilities = ABILITIES_UI[me.role];
    if (!myAbilities) return;

    for (let lvl = 10; lvl >= (me.level !== undefined ? me.level : 9); lvl--) {
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
                btn.onclick = () => useAbility({ ...ab, needsTarget: ab.target || ab.targetType }, 0); // Adaptando para usar a mesma função de cartas ou criar nova
            }
            
            abilityContainer.appendChild(btn);
        }
    }
}

// Função auxiliar para usar habilidades (adaptada de useCard ou nova)
function useAbility(ability, index) {
    let payload = { type: 'USE_ABILITY', abilityId: ability.id };

    if (ability.targetType === 'room') {
        const roomName = prompt(`[${ability.name}] Digite a sala alvo (Salão, Biblioteca, Jardim, Cozinha, Aposentos):`);
        if (!roomName) return;
        const validRooms = ['Salão', 'Biblioteca', 'Jardim', 'Cozinha', 'Aposentos'];
        const formattedRoom = validRooms.find(r => r.toLowerCase() === roomName.toLowerCase());
        if (formattedRoom) payload.targetId = formattedRoom;
        else { alert("Sala inválida."); return; }
    } else if (ability.needsTarget) {
        const name = prompt(`[${ability.name}] Digite o nome do alvo:`);
        if (!name) return;
        const target = currentPlayers.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (target) payload.targetId = target.id;
        else { alert("Jogador não encontrado."); return; }
    }

    socket.emit('playerAction', payload);
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

// --- LÓGICA DE MOVIMENTO E VISÃO ---

function toggleSpiritVision(active) {
    spiritVisionActive = active;
    if (active) {
        spiritVisionOverlay.style.display = 'block';
        btnSpiritVision.classList.add('active');
    } else {
        spiritVisionOverlay.style.display = 'none';
        btnSpiritVision.classList.remove('active');
    }
    socket.emit('toggleSpiritVision', active);
}

// Input de Teclado (WASD)
const keys = {};
document.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function startMovementLoop() {
    if (movementInterval) clearInterval(movementInterval);
    movementInterval = setInterval(() => {
        let dx = 0;
        let dy = 0;
        const speed = 5;

        if (keys['w'] || keys['arrowup']) dy -= speed;
        if (keys['s'] || keys['arrowdown']) dy += speed;
        if (keys['a'] || keys['arrowleft']) dx -= speed;
        if (keys['d'] || keys['arrowright']) dx += speed;

        // Joystick Virtual
        if (moveVector.x !== 0 || moveVector.y !== 0) {
            dx += moveVector.x * speed;
            dy += moveVector.y * speed;
        }

        if (dx !== 0 || dy !== 0) {
            socket.emit('playerMove', { dx, dy });
        }
    }, 50); // 20 FPS
}

function stopMovementLoop() {
    if (movementInterval) clearInterval(movementInterval);
}

// Lógica do Joystick Mobile
const joystickArea = document.getElementById('joystick-area');
const joystickKnob = document.getElementById('joystick-knob');

joystickArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.targetTouches[0];
    const rect = joystickArea.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = touch.clientX - rect.left - centerX;
    const y = touch.clientY - rect.top - centerY;
    
    // Normaliza vetor (-1 a 1)
    moveVector.x = Math.max(-1, Math.min(1, x / 40));
    moveVector.y = Math.max(-1, Math.min(1, y / 40));
    
    // Move visualmente o knob
    joystickKnob.style.transform = `translate(${moveVector.x * 20}px, ${moveVector.y * 20}px)`;
});

joystickArea.addEventListener('touchend', () => {
    moveVector = { x: 0, y: 0 };
    joystickKnob.style.transform = `translate(0px, 0px)`;

});
