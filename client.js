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

const sfxVote = new Audio('assets/audio/bell_toll.mp3'); // Sino do Julgamento
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

// --- LOGS TEMÁTICOS (ESTILO BLASPHEMOUS) ---
function addLog(text, color = null, tab = 'system') {
    const targetBox = document.getElementById(`log-box-${tab}`);
    if (!targetBox) return;

    const p = document.createElement('p');
    p.innerHTML = `<span style="color: var(--gold-dim)">[†]</span> ${text}`;
    
    // Cores baseadas na paleta do CSS
    if (color) p.style.color = color;
    else if (tab === 'combat') p.style.color = 'var(--blood-bright)';
    else if (tab === 'system') p.style.color = 'var(--gold)';

    targetBox.appendChild(p);
    targetBox.scrollTop = targetBox.scrollHeight;
}

// --- SINCRONIZAÇÃO COM FIREBASE ---
db.ref('players').on('value', (snapshot) => {
    const val = snapshot.val();
    currentPlayers = val ? Object.values(val) : [];
    
    // Lógica de Host
    if (currentPlayers.length > 0) {
        const sorted = currentPlayers.sort((a, b) => a.id.localeCompare(b.id));
        if (sorted[0].id === myId && !isHost) {
            isHost = true;
            addLog("Você assumiu a custódia desta sessão.", "var(--gold)");
        }
    }

    renderPlayerList();
    
    const me = currentPlayers.find(p => p.id === myId);
    if (me) {
        if (me.isDead && !isDead) triggerDeath();
        
        // Atualiza Barras Visuais (As novas barras do CSS)
        const sanityBar = document.getElementById('sanity-bar');
        if (sanityBar) sanityBar.style.width = (me.sanity * 10) + "%";
        
        const sanityBarMini = document.getElementById('sanity-bar-mini');
        if (sanityBarMini) sanityBarMini.style.width = (me.sanity * 10) + "%";
        
        document.getElementById('my-level').innerText = me.level || 1;
        document.getElementById('my-role').innerText = "Caminho: " + me.pathway;
    }
});

// --- SISTEMA DE MORTE (EXCOMUNGADO) ---
function triggerDeath() {
    isDead = true;
    document.body.classList.add('dead-mode');
    const deathOverlay = document.getElementById('death-overlay');
    deathOverlay.style.display = 'flex';
    
    // Altera o título para o estilo Blasphemous
    deathOverlay.innerHTML = `<h1 class="death-title">EXCOMUNGADO</h1><p>Sua penitência acabou.</p>`;
    
    sfxDeath.play().catch(() => {});
    bgmAmbient.volume = 0.1;
    addLog("Sua alma foi separada do corpo. Você agora é apenas um eco.", "var(--blood)", 'combat');
}

// --- RITUAL E EFEITOS ---
db.ref('gameState').on('value', (snapshot) => {
    const state = snapshot.val();
    if (!state) return;
    gameState = state;

    if (state.ritualActive && !isRitualActive) {
        isRitualActive = true;
        document.body.classList.add('ritual-mode');
        sfxRitual.play().catch(() => {});
        startBloodRain(); // Função que você já tem para criar as gotas
        addLog("O MILAGRE DOLOROSO SE MANIFESTA: O RITUAL COMEÇOU!", "var(--blood-bright)", 'system');
    }
});

// --- INTERFACE DE VOTAÇÃO (TRIBUNAL) ---
window.startVoting = () => {
    if (isDead) return;
    db.ref('gameState').update({ phase: 'VOTING', votes: {} });
    sfxVote.play().catch(() => {});
};

// Funções de Diário e Pistas (Mantendo sua lógica original)
window.openDiary = () => { document.getElementById('diary-overlay').style.display = 'flex'; };
window.closeDiary = () => { 
    document.getElementById('diary-overlay').style.display = 'none'; 
    db.ref('players/' + myId).update({ diary: document.getElementById('diary-text').value });
};

// Iniciar áudio de menu ao primeiro clique
document.addEventListener('click', () => {
    if (!myId) bgmMenu.play().catch(() => {});
}, { once: true });
