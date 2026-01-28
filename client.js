// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    databaseURL: "https://shadow-of-mystery-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
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

document.getElementById('btn-join').onclick = () => {
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

function joinGameFirebase(name) {
    const playerId = 'player_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const playerData = {
        id: playerId, name: name, room: 'Salão',
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

// --- SINCRONIZAÇÃO E LÓGICA DE VITÓRIA ---
db.ref('players').on('value', (snapshot) => {
    const val = snapshot.val();
    currentPlayers = val ? Object.values(val) : [];
    
    if (currentPlayers.length > 0) {
        const sorted = currentPlayers.sort((a, b) => a.id.localeCompare(b.id));
        if (sorted[0].id === myId && !isHost) {
            isHost = true;
            addLog("Você assumiu a custódia desta sessão.", "var(--gold)");
        }
    }

    // VERIFICAÇÃO DE VITÓRIA (Se o Assassino/Carrasco morreu)
    const assassin = currentPlayers.find(p => p.role === 'Carrasco' || p.pathway === 'Caminho da Morte');
    if (assassin && assassin.isDead && gameState?.phase === 'GAME') {
        db.ref('gameState').update({ phase: 'GAME_OVER', winner: 'INNOCENTS' });
    }
    
// Dentro do db.ref('players').on('value'...)
const me = currentPlayers.find(p => p.id === myId);
if (me) {
    const sBar = document.getElementById('sanity-bar');
    const sBarMini = document.getElementById('sanity-bar-mini');
    
    // Só atualiza se o elemento realmente existir na tela atual
    if (sBar) sBar.style.width = (me.sanity * 10) + "%";
    if (sBarMini) sBarMini.style.width = (me.sanity * 10) + "%";
}
});

// --- REINICIAR O JOGO ---
window.resetGame = () => {
    if (!isHost) {
        alert("Apenas o Custódio (Host) pode reiniciar a penitência.");
        return;
    }

    const updates = {};
    updates['gameState/phase'] = 'GAME'; // Ou 'LOBBY' se preferir voltar ao início
    updates['gameState/ritualActive'] = false;
    updates['gameState/winner'] = null;
    
    currentPlayers.forEach(p => {
        updates[`players/${p.id}/isDead`] = false;
        updates[`players/${p.id}/sanity`] = 10;
        updates[`players/${p.id}/isReady`] = false;
    });

    db.ref().update(updates).then(() => {
        addLog("O Milagre redefinindo o tempo... A penitência recomeça.", "var(--gold)");
        document.getElementById('game-over-screen').style.display = 'none';
        if (isDead) {
            isDead = false;
            document.body.classList.remove('dead-mode');
            document.getElementById('death-overlay').style.display = 'none';
        }
    });
};

// --- GAME OVER SCREEN ---
db.ref('gameState').on('value', (snapshot) => {
    const state = snapshot.val();
    if (!state) return;
    gameState = state;

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

window.startVoting = () => {
    if (isDead) return;
    db.ref('gameState').update({ phase: 'VOTING' });
    sfxVote.play().catch(() => {});
};

document.addEventListener('click', () => {
    if (!myId) bgmMenu.play().catch(() => {});
}, { once: true });

