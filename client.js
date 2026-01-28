// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    databaseURL: "https://shadow-of-mystery-default-rtdb.firebaseio.com/"
};

// Verifica se o Firebase já foi iniciado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// --- SISTEMA DE ÁUDIO ---
const bgmAmbient = new Audio('assets/audio/ambient_loop.mp3');
bgmAmbient.loop = true;
bgmAmbient.volume = 0.3;

const sfxVote = new Audio('assets/audio/bell_toll.mp3'); 
const sfxDeath = new Audio('assets/audio/death_impact.mp3');
const sfxRitual = new Audio('assets/audio/ritual_alarm.mp3');
const sfxJoin = new Audio('assets/audio/door_open.mp3');
const bgmMenu = new Audio('assets/audio/menu_theme.mp3');
bgmMenu.loop = true;

// Estado Local
let myId = null;
let isDead = false;
let myRole = null;
let isRitualActive = false;
let currentPlayers = [];
let gameState = null;
let isHost = false;

// --- INICIALIZAÇÃO E UI ---

const btnJoin = document.getElementById('btn-join');
if(btnJoin) {
    btnJoin.onclick = () => {
        const name = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (password !== "12345") {
            addLog("A chave da sala é inválida. O Véu permanece fechado.", "#ff0000");
            return;
        }

        if (name) {
            joinGameFirebase(name);
        } else {
            alert("Escolha seu Arquétipo antes de iniciar a penitência.");
        }
    };
}

function joinGameFirebase(name) {
    const playerId = 'player_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const playerData = {
        id: playerId, 
        name: name,
        room: 'Salão',
        sanity: 10, isReady: false, isDead: false,
        role: 'Desconhecido', pathway: '???', inventory: [], clues: [], diary: "", level: 1
    };
    
    db.ref('players/' + playerId).set(playerData).then(() => {
        myId = playerId;
        localStorage.setItem('vc_playerId', playerId);
        onJoinSuccess();
    });
}

function onJoinSuccess() {
    bgmMenu.pause();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'flex';
    sfxJoin.play().catch(() => {});
}

// --- LOGS TEMÁTICOS ---
function addLog(text, color = null, tab = 'system') {
    const targetBox = document.getElementById(`log-box-${tab}`);
    if (!targetBox) return;

    const p = document.createElement('p');
    p.innerHTML = `<span style="color: var(--gold-dim)">[†]</span> ${text}`;
    
    if (color) p.style.color = color;
    else if (tab === 'combat') p.style.color = 'var(--blood-bright)';
    else if (tab === 'system') p.style.color = 'var(--gold)';

    targetBox.appendChild(p);
    targetBox.scrollTop = targetBox.scrollHeight;
}

// --- SINCRONIZAÇÃO E LÓGICA DE JOGADORES ---
db.ref('players').on('value', (snapshot) => {
    const val = snapshot.val();
    // 1. Converte objeto em lista
    currentPlayers = val ? Object.values(val) : [];
    
    // --- SEGURANÇA: DETECTA SE A SALA FOI DESTRUÍDA ---
    // Se eu tenho ID (já loguei), mas não estou na lista que veio do banco...
    if (myId && !currentPlayers.find(p => p.id === myId)) {
        alert("A sala foi dissolvida pelo Custódio.");
        localStorage.removeItem('vc_playerId');
        location.reload(); // Chuta o jogador de volta pro login
        return;
    }
    // ---------------------------------------------------

    // 2. Atualiza Lista Visual no Lobby
    const lobbyList = document.getElementById('player-list');
    const lobbyCount = document.getElementById('player-count');

    if (lobbyList && lobbyCount) {
        lobbyList.innerHTML = '';
        lobbyCount.innerText = currentPlayers.length;

        currentPlayers.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<span style="color: ${p.isDead ? 'red' : 'var(--gold)'}">${p.name}</span>`;
            lobbyList.appendChild(li);
        });
    }

    // 3. Lógica de Host (Quem manda na sala)
    if (currentPlayers.length > 0) {
        const sorted = currentPlayers.sort((a, b) => a.id.localeCompare(b.id));
        
        // O jogador mais antigo vira o Host
        if (sorted[0].id === myId) {
            if (!isHost) addLog("Você assumiu a custódia desta sessão.", "var(--gold)");
            isHost = true;

            // Mostra botões de Host
            const btnStart = document.getElementById('btn-start');
            const hostControls = document.getElementById('host-controls');
            if(btnStart) btnStart.style.display = 'inline-block';
            if(hostControls) hostControls.style.display = 'block';
        } else {
            isHost = false;
            // Esconde botões se não for Host
            const btnStart = document.getElementById('btn-start');
            const hostControls = document.getElementById('host-controls');
            if(btnStart) btnStart.style.display = 'none';
            if(hostControls) hostControls.style.display = 'none';
        }
    }

    // 4. Verificação de Vitória
    const assassin = currentPlayers.find(p => p.role === 'Carrasco' || p.pathway === 'Caminho da Morte');
    if (assassin && assassin.isDead && gameState?.phase === 'GAME') {
        db.ref('gameState').update({ phase: 'GAME_OVER', winner: 'INNOCENTS' });
    }
    
    // 5. Atualiza barra de sanidade do próprio jogador
    const me = currentPlayers.find(p => p.id === myId);
    if (me) {
        const sBar = document.getElementById('sanity-bar');
        const sBarMini = document.getElementById('sanity-bar-mini');
        
        if (sBar) sBar.style.width = (me.sanity * 10) + "%";
        if (sBarMini) sBarMini.style.width = (me.sanity * 10) + "%";
        
        if (me.isDead && !isDead) {
            triggerDeath();
        }
    }
});

// --- REINICIAR O JOGO (SOFT RESET) ---
window.resetGame = () => {
    if (!isHost) {
        alert("Apenas o Custódio pode reiniciar.");
        return;
    }
    
    if (!confirm("Tem certeza? Isso vai zerar inventários e papéis de todos.")) return;

    const updates = {};
    updates['gameState'] = {
        phase: 'LOBBY', 
        ritualActive: false, 
        winner: null
    };
    
    // Reseta status de todos os jogadores
    currentPlayers.forEach(p => {
        updates[`players/${p.id}/isDead`] = false;
        updates[`players/${p.id}/sanity`] = 10;
        updates[`players/${p.id}/isReady`] = false;
        updates[`players/${p.id}/role`] = 'Desconhecido';
        updates[`players/${p.id}/pathway`] = '???';
        updates[`players/${p.id}/inventory`] = [];
        updates[`players/${p.id}/clues`] = [];
        updates[`players/${p.id}/diary`] = "";
    });

    db.ref().update(updates).then(() => {
        addLog("O tempo foi redefinido pelo Custódio.", "var(--gold)");
    });
};

// --- DERRUBAR A SALA (HARD RESET) ---
window.destroyRoom = () => {
    if (!isHost) return;
    
    const code = prompt("Para destruir a sala e expulsar todos, digite: FIM");
    
    if (code === "FIM" || code === "fim") {
        // Remove todos os jogadores do banco
        db.ref('players').remove();
        
        // Reseta o estado
        db.ref('gameState').set({ phase: 'LOBBY' });
        
        // O próprio host recarrega a página
        location.reload();
    }
};

// --- GERENCIAMENTO DE ESTADO DO JOGO ---
db.ref('gameState').on('value', (snapshot) => {
    const state = snapshot.val();
    if (!state) return;
    gameState = state;

    // Se o jogo começou, muda a tela do Lobby para o Jogo
    if (state.phase === 'GAME') {
        document.getElementById('lobby-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'flex';
    }
    
    // Se voltou para o Lobby (Reinício)
    if (state.phase === 'LOBBY') {
        document.getElementById('game-screen').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('lobby-screen').style.display = 'flex';
        
        // Reset local visual
        isDead = false;
        document.body.classList.remove('dead-mode');
        document.getElementById('death-overlay').style.display = 'none';
    }

if (state.phase === 'GAME_OVER') {
        const screen = document.getElementById('game-over-screen');
        const display = document.getElementById('winner-display');
        if (screen) screen.style.display = 'flex'; // Garante centralização
        
        if (state.winner === 'INNOCENTS') {
            display.innerText = "VOCÊS VENCERAM AS TREVAS";
            display.className = "gold-text-giant";
        } else {
            display.innerText = "AS TREVAS CONSUMIRAM TUDO";
            display.style.color = "var(--blood)";
        }
    }

    if (state.ritualActive && !isRitualActive) {
        isRitualActive = true;
        document.body.classList.add('ritual-mode');
        sfxRitual.play().catch(() => {});
        addLog("O RITUAL COMEÇOU!", "var(--blood-bright)", 'system');
    }
});

function triggerDeath() {
    isDead = true;
    document.body.classList.add('dead-mode');
    const deathOverlay = document.getElementById('death-overlay');
    if (deathOverlay) {
        deathOverlay.style.display = 'flex'; // 'flex' ativa a centralização do nosso CSS
    }
    sfxDeath.play().catch(() => {});
}

// Botão de Iniciar Jogo (Para o Host)
const btnStart = document.getElementById('btn-start');
if(btnStart) {
    btnStart.onclick = () => {
        if(!isHost) return;
        if (state.phase === 'GAME') {
    document.getElementById('lobby-screen').style.display = 'none';
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen) gameScreen.style.display = 'flex'; // Isso corrige o layout no PC
}

window.startVoting = () => {
    if (isDead) return;
    db.ref('gameState').update({ phase: 'VOTING' });
    sfxVote.play().catch(() => {});
};

document.addEventListener('click', () => {
    if (!myId) bgmMenu.play().catch(() => {});

}, { once: true });
