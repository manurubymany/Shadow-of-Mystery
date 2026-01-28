// --- CONFIGURAÇÃO FIREBASE ---
// Certifique-se de que o firebaseConfig está correto com suas chaves se precisar
const firebaseConfig = {
    databaseURL: "https://shadow-of-mystery-default-rtdb.firebaseio.com/"
};

// Verifica se o Firebase já foi iniciado para evitar erro de duplicidade
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
        name: name, // Aqui você salva como 'name'
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

// --- SINCRONIZAÇÃO E LÓGICA DE JOGADORES (AQUI ESTAVA O ERRO) ---
db.ref('players').on('value', (snapshot) => {
    const val = snapshot.val();
    
    // 1. Converte o Objeto do Firebase em Array
    currentPlayers = val ? Object.values(val) : [];
    
    // ========================================================
    // CORREÇÃO: ATUALIZA A TELA DO LOBBY
    // ========================================================
    const lobbyList = document.getElementById('player-list');
    const lobbyCount = document.getElementById('player-count');

    if (lobbyList && lobbyCount) {
        lobbyList.innerHTML = ''; // Limpa a lista antiga
        lobbyCount.innerText = currentPlayers.length; // Atualiza o número

        currentPlayers.forEach(p => {
            const li = document.createElement('li');
            // Exibe o nome e se está morto ou vivo
            li.innerHTML = `
                <span style="color: ${p.isDead ? 'red' : 'var(--gold)'}">
                    ${p.name}
                </span>
            `;
            lobbyList.appendChild(li);
        });
    }
    // ========================================================

    // Lógica de Host
    if (currentPlayers.length > 0) {
        const sorted = currentPlayers.sort((a, b) => a.id.localeCompare(b.id));
        if (sorted[0].id === myId && !isHost) {
            isHost = true;
            addLog("Você assumiu a custódia desta sessão.", "var(--gold)");
            
            // Mostra o botão de iniciar apenas para o Host
            const btnStart = document.getElementById('btn-start');
            if(btnStart) btnStart.style.display = 'inline-block';
        }
    }

    // VERIFICAÇÃO DE VITÓRIA
    const assassin = currentPlayers.find(p => p.role === 'Carrasco' || p.pathway === 'Caminho da Morte');
    if (assassin && assassin.isDead && gameState?.phase === 'GAME') {
        db.ref('gameState').update({ phase: 'GAME_OVER', winner: 'INNOCENTS' });
    }
    
    // Atualiza barra de sanidade do próprio jogador
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

// --- REINICIAR O JOGO ---
window.resetGame = () => {
    if (!isHost) {
        alert("Apenas o Custódio (Host) pode reiniciar a penitência.");
        return;
    }

    const updates = {};
    updates['gameState/phase'] = 'LOBBY'; 
    updates['gameState/ritualActive'] = false;
    updates['gameState/winner'] = null;
    
    currentPlayers.forEach(p => {
        updates[`players/${p.id}/isDead`] = false;
        updates[`players/${p.id}/sanity`] = 10;
        updates[`players/${p.id}/isReady`] = false;
    });

    db.ref().update(updates).then(() => {
        addLog("O tempo foi redefinido.", "var(--gold)");
    });
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
    
    // Se voltou para o Lobby
    if (state.phase === 'LOBBY') {
        document.getElementById('game-screen').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('lobby-screen').style.display = 'flex';
        // Reset local
        isDead = false;
        document.body.classList.remove('dead-mode');
        document.getElementById('death-overlay').style.display = 'none';
    }

    if (state.phase === 'GAME_OVER') {
        const screen = document.getElementById('game-over-screen');
        const display = document.getElementById('winner-display');
        screen.style.display = 'flex';
        
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
    deathOverlay.style.display = 'flex';
    sfxDeath.play().catch(() => {});
}

// Botão de Iniciar Jogo (Para o Host)
const btnStart = document.getElementById('btn-start');
if(btnStart) {
    btnStart.onclick = () => {
        if(!isHost) return;
        db.ref('gameState').update({ phase: 'GAME' });
    };
}

window.startVoting = () => {
    if (isDead) return;
    db.ref('gameState').update({ phase: 'VOTING' });
    sfxVote.play().catch(() => {});
};

document.addEventListener('click', () => {
    if (!myId) bgmMenu.play().catch(() => {});
}, { once: true });