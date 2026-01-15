// CORE ENGINE - Ruins of Destiny
// ===============================

const bgm = document.getElementById("bgm");
const sfx = document.getElementById("sfx");
const textBox = document.getElementById("text");
const speakerBox = document.getElementById("speaker");
const charImg = document.getElementById("charImg");
const bgImg = document.getElementById("bg"); 
const choicesBox = document.getElementById("choices");
const routeDisplay = document.getElementById("route");

let state = "menu";
let currentRoute = "";
let isTyping = false;
let playerName = ""; // Variável para armazenar o nome do jogador

let affection = {
    lucien: 0,
    eryon: 0,
    kaiden: 0,
    aelion: 0
};

function typeText(element, text) {
    element.innerText = "";
    isTyping = true;
    let i = 0;
    const speed = 30;

    function type() {
        if (i < text.length) {
            element.innerText += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else {
            isTyping = false;
        }
    }
    type();
}

function playMusic(file) {
    if (!file) return;
    const newSrc = "assets/audio/" + file;
    if (bgm.getAttribute("src") === newSrc) return;
    bgm.src = newSrc;
    bgm.play().catch(e => console.log("Áudio aguardando interação."));
}

function loadScene(key) {
    const scene = scenes[key];
    if (!scene) {
        console.error("Cena não encontrada:", key);
        return;
    }

    state = key;

    if (scene.route) {
        currentRoute = scene.route;
        routeDisplay.innerText = "Rota: " + currentRoute;
    }

    if (scene.text) {
        typeText(textBox, scene.text);
    } else {
        textBox.innerText = "";
    }

    // Substitui "Eu" pelo nome do jogador
    let speakerName = scene.speaker || "";
    if (speakerName === "Eu" && playerName) {
        speakerName = playerName;
    }
    speakerBox.innerText = speakerName;
    speakerBox.style.display = scene.speaker ? "block" : "none";

    // CORREÇÃO PARA IMAGENS COM ESPAÇO:
    if (scene.char) {
        charImg.src = encodeURI("assets/chars/" + scene.char);
        charImg.style.opacity = "1";
        charImg.style.display = "block";
    } else {
        charImg.style.opacity = "0";
    }

    if (scene.bg) {
        bgImg.src = encodeURI("assets/bg/" + scene.bg);
    }

    if (scene.music) playMusic(scene.music);

    choicesBox.innerHTML = "";

    if (scene.choices) {
        scene.choices.forEach(c => {
            const btn = document.createElement("button");
            btn.className = "choice";
            btn.innerText = c.text;
            btn.onclick = (e) => {
                e.stopPropagation();
                if (c.affect) affection[c.affect] += c.value || 0;
                loadScene(c.next);
            };
            choicesBox.appendChild(btn);
        });
        document.onclick = null;
    } else if (scene.next) {
        document.onclick = () => {
            if (isTyping) return;
            document.onclick = null;
            loadScene(scene.next);
        };
    }
}

// Botão de Iniciar
document.getElementById("startBtn").onclick = () => {
    // Captura o nome do jogador
    playerName = document.getElementById("playerName").value || "Jogador";
    document.getElementById("menu").style.display = "none";
    loadScene("cena1_1");
};

// OBJETO DE CENAS
const scenes = {

// OBJETO DE CENAS - INÍCIO

// ---------- MENU ----------
menu: {
    text: "Fragmento da Origem",
    char: "login.png", 
    music: "menu.mp3",
    choices: [
        { text: "Iniciar", next: "nome" }
    ]
},

// ---------- CAPTURA DE NOME ----------
nome: {
    speaker: "Sistema",
    text: "Como você se chama?",
    char: "login.png",
    // Esta cena aguarda o clique no botão de Iniciar do HTML
    // No seu JS, podemos fazer o seguinte:
    next: "cena1_1" 
},

// ... continuação do objeto scenes

// ---------- CENA 1 – ESCRITÓRIO ----------
cena1_1: {
    speaker: "Eu",
    text: "Hoje foi uma sexta-feira complicada. Muita demanda para entregar aquele projeto de sistema.",
    char: "escritorio_1.png", // Sugestão: evite 'ó' e espaços em nomes de arquivo
    music: "escritorio.mp3",
    next: "cena1_2"
},

cena1_2: {
    speaker: "Eu",
    text: "Olho o relógio. Nossa, já são 18h00. Finalmente a hora de voltar para casa.",
    char: "escritorio_2.png",
    next: "cena1_3"
},

cena1_3: {
    speaker: "", // Narração (caixa de nome ficará vazia ou oculta)
    text: "Pego minha bolsa e desligo o computador.",
    char: "escritorio_3.png",
    next: "cena2_1" 
},
// ---------- CENA 2 – RUA ----------
cena2_1:{
    speaker:"Eu",
    text:"Nossa, que gelo que está hoje. Que dor de cabeça… foi muito cansativo.\nParece que minha cabeça vai explodir.\nVou passar na farmácia do outro lado da avenida pegar um remédio.",
    char:"rua 1.png",
    music:"chuva.mp3",
    next:"cena2_2"
},

cena2_2:{
    speaker:"",
    text:"Cai um pingo de água no meu olho.",
    char:"rua 2.png",
    next:"cena2_3"
},

cena2_3:{
    speaker:"Eu",
    text:"Aii, que merda… começou a chover.\nVou correr logo para a farmácia.",
    next:"cena3_1"
},

// ---------- CENA 3 – O ACIDENTE ----------
cena3_1:{
    speaker:"Eu",
    text:"Vou aproveitar e correr antes que o sinal feche.\nA chuva já engrossou, estou encharcado.",
    char:"acidente 1.png",
    next:"cena3_2"
},

cena3_2:{
    speaker:"",
    text:"Atravessando a avenida.\n\nBAAAANG.",
    music:"o acidente.mp3",
    char:"acidente 2.png",
    next:"cena3_3"
},

cena3_3:{
    speaker:"",
    text:"Barulho de batida e chuva.",
    char:"acidente 3.png",
    next:"cena3_4"
},

cena3_4:{
    speaker:"",
    text:"Tudo fica escuro.",
    char:"acidente 4.png",
    next:"cena4_1"
},

// ---------- CENA 4 – O VAZIO ----------
cena4_1:{
    speaker:"Eu",
    text:"Huum… o que está acontecendo?\nNão estou enxergando.\nEstá tudo escuro.\nAlguém consegue me ouvir?",
    char:"vazio 1.png",
    next:"cena4_2"
},

cena4_2:{
    speaker:"",
    text:"Uma luz surge ao longe, crescendo gradualmente.",
    char:"vazio_2.png",
    next:"cena4_3"
},

cena4_3:{
    speaker:"",
    text:"Ela toma a forma de uma mulher.",
    char:"vazio_3.png",
    next:"cena4_4"
},

cena4_4:{
    speaker:"Aleia",
    text:"Eu sou Aleia, responsável por cuidar das reencarnações de quem não conseguiu cumprir seu propósito.",
    next:"cena4_5"
},

cena4_5:{
    speaker:"Eu",
    text:"Eu morri…?",
    next:"cena4_6"
},

cena4_6:{
    speaker:"Aleia",
    text:"Sim. Um motorista perdeu o controle na chuva.",
    next:"cena4_7"
},

cena4_7:{
    speaker:"Eu",
    text:"E meus gatos…?",
    next:"cena4_8"
},

cena4_8:{
    speaker:"Aleia",
    text:"Estão bem. Tudo foi resolvido.",
    next:"cena4_9"
},

cena4_9:{
    speaker:"Aleia",
    text:"Do outro lado do portão está sua próxima reencarnação.\nLá você terá a chance de cumprir sua missão.",
    next:"cena4_10"
},

cena4_10:{
    speaker:"Eu",
    text:"O quê?! Espera, eu nem entendi ainda!",
    char:"vazio_4.png",
    next:"cena5_1"
},

// ---------- CENA 5 – RUÍNAS ----------
cena5_1:{
    speaker:"Eu",
    text:"Ah… que claro… está tudo embaçado.",
    char:"ruínas_1.png",
    music:"mystical japanese.mp3",
    next:"cena5_2"
},

cena5_2:{
    speaker:"",
    text:"Começo a enxergar ao redor.",
    char:"ruínas_2.png",
    next:"cena5_3"
},

cena5_3:{
    speaker:"Eu",
    text:"Que mulher estranha… não explicou nada.\nSerá que tem reclamação aqui no céu? Rs.",
    char:"ruínas_3.png",
    next:"cena5_4"
},

cena5_4:{
    speaker:"",
    text:"Acordei em meio a uma floresta.\nUm antigo palácio em ruínas, estátuas de deuses destruídas.",
    char:"ruínas_4.png",
    next:"cena5_5"
},

cena5_5:{
    speaker:"",
    text:"Passo por um portão quebrado.",
    char:"ruínas_5.png",
    next:"cena6_1"
},

// ---------- CENA 6 – O CAMINHO ----------
cena6_1:{
    speaker:"",
    text:"Começo a andar em meio às árvores.\nMeus pés doem.\nApós horas, escuto o som de um rio.",
    char:"caminho_1.png",
    music:"passos na floresta.mp3",
    next:"cena6_2"
},

cena6_2:{
    speaker:"",
    text:"Chego até um rio.",
    char:"caminho_2.png",
    next:"cena6_3"
},

cena6_3:{
    speaker:"Eu",
    text:"Bom… sempre dizem que onde tem água deve ter vida.\nQual caminho devo seguir?",
    choices:[
        { text:"Seguir o rio até a cidade (Lucien)", next:"lucien_1", affect:"lucien", value:1 },
        { text:"Descansar na árvore (Eryon)", next:"eryon_1", affect:"eryon", value:1 },
        { text:"Entrar na floresta (Kaiden)", next:"kaiden_1", affect:"kaiden", value:1 },
        { text:"Voltar às ruínas (Aelion)", next:"aelion_1", affect:"aelion", value:1 }
    ]
},

// A partir daqui você cola TODAS as cenas de cada rota
// exatamente no mesmo formato, mantendo texto, falas e imagens.
// Exemplo inicial de Lucien:

// ===============================
// ROTA DO LUCIEN – BLOCO 2.1
// ===============================

lucien_1:{
  route:"Lucien",
  speaker:"",
  text:"Caminho lentamente pela margem do rio.\nA água reflete a luz fraca da lua, ondulando como prata líquida.\nMeus pés doem, minhas roupas ainda estão úmidas da chuva.",
  char:"lucien 1.png",
  music:"gotica do lucien.mp3",
  next:"lucien_2"
},

lucien_2:{
  speaker:"",
  text:"O som da correnteza me acompanha por um tempo até que, entre as árvores, percebo algo diferente.\n\nPedras alinhadas.\n\nUm caminho antigo, parcialmente tomado pelo musgo.",
  char:"lucien 2.png",
  next:"lucien_3"
},

lucien_3:{
  speaker:"",
  text:"Sigo por ele com cautela.\n\nApós alguns minutos, as árvores se abrem.\n\nDiante de mim, surge um castelo enorme, envolto por névoa e silêncio.",
  char:"lucien 3.png",
  next:"lucien_4"
},

lucien_4:{
  speaker:"Eu",
  text:"Um castelo?!\nÓtimo… considerando meu histórico recente, provavelmente vou acabar queimada numa fogueira.\n\nO portão principal está entreaberto.",
  char:"lucien 4.png",
  choices:[
    { text:"Não tenho opção, preciso de abrigo.", next:"lucien_5", affect:"lucien", value:1 },
    { text:"Isso é claramente uma péssima ideia… mas vou entrar.", next:"lucien_5" },
    { text:"Se eu morrer de novo, vou reclamar com Aleia.", next:"lucien_5" }
  ]
},

lucien_5:{
  speaker:"",
  text:"O interior é escuro, mas não abandonado.\nHá móveis cobertos por poeira, tapeçarias antigas rasgadas pelo tempo.",
  char:"lucien 5.png",
  next:"lucien_6"
},

lucien_6:{
  speaker:"Eu",
  text:"…Tem alguém aqui?",
  char:"lucien 6.png",
  next:"lucien_7"
},

lucien_7:{
  speaker:"",
  text:"Nenhuma resposta.\n\nExausta, encontro um sofá antigo perto de uma lareira apagada.\nMe deito, o corpo pesado demais para continuar alerta.\n\nMeus olhos se fecham.",
  char:"presença 1.png",
  next:"lucien_8"
},

lucien_8:{
  speaker:"",
  text:"Sinto.\n\nAntes mesmo de ouvir.\n\nUma presença pesada, dominante.",
  char:"presença 2.png",
  next:"lucien_9"
},

lucien_9:{
  speaker:"",
  text:"Abro os olhos lentamente.\n\nUma sombra está no canto do salão.",
  char:"presença 3.png",
  next:"lucien_10"
},

lucien_10:{
  speaker:"Estranho",
  text:"Quem é você…\n\ne o que faz em minha casa?",
  char:"lucien 7.png",
  next:"lucien_11"
},
lucien_11:{
  speaker:"",
  text:"Ele se aproxima.\n\nQuando a luz o alcança, vejo olhos vermelhos, cabelo escuro, pele pálida.\nO ar ao redor dele carrega um cheiro suave de rosas vermelhas.",
  char:"lucien 8.png",
  next:"lucien_12"
},

lucien_12:{
  speaker:"Eu",
  text:"M-me desculpe…\nEu não quis invadir, achei que estivesse abandonado.",
  char:"presença 4.png",
  next:"lucien_13"
},

lucien_13:{
  speaker:"Estranho",
  text:"Ele me observa como um predador analisa a presa.\n\nQue azar o seu.\n\nVai morrer esta noite.",
  char:"lucien 9.png",
  choices:[
    { text:"Espere! Eu posso ir embora agora!", next:"lucien_14" },
    { text:"Se vai me matar, ao menos diga seu nome.", next:"lucien_14", affect:"lucien", value:1 },
    { text:"Você não parece tão assustador assim.", next:"lucien_14" }
  ]
},

lucien_14:{
  speaker:"",
  text:"Ele se move rápido demais.\n\nSinto mãos frias segurando meus braços.\n\nAntes que eu possa gritar, uma dor aguda explode em meu pescoço.",
  char:"presença 5.png",
  next:"lucien_15"
},

lucien_15:{
  speaker:"Eu",
  text:"A-ah…!",
  char:"presença 6.png",
  next:"lucien_16"
},

lucien_16:{
  speaker:"",
  text:"O mundo gira.\n\nO sangue.\n\nA dor.",
  char:"presença 7.png",
  next:"lucien_17"
},

lucien_17:{
  speaker:"",
  text:"E então—\n\nUma luz branca irrompe de mim.\n\nO salão se ilumina violentamente.",
  char:"presença 8.png",
  next:"lucien_18"
},

lucien_18:{
  speaker:"",
  text:"O estranho é arremessado contra uma coluna de pedra.\n\nSilêncio absoluto.",
  char:"lucien 10.png",
  next:"lucien_19"
},

lucien_19:{
  speaker:"",
  text:"Respiro com dificuldade.\n\nMinhas mãos ainda brilham fracamente.",
  char:"presença 9.png",
  next:"lucien_20"
},

lucien_20:{
  speaker:"",
  text:"Ele se levanta lentamente.",
  char:"presença 10.png",
  next:"lucien_21"
},

lucien_21:{
  speaker:"Estranho",
  text:"Você… não é humana.",
  next:"lucien_22"
},

lucien_22:{
  speaker:"Eu",
  text:"O quê?!",
  next:"lucien_23"
},

lucien_23:{
  speaker:"Lucien",
  text:"Meu nome é Lucien.\n\nAquela luz…\n\né Origem.",
  char:"presença 11.png",
  next:"lucien_24"
},

lucien_24:{
  speaker:"Eu",
  text:"Aleia…",
  next:"lucien_25"
},

lucien_25:{
  speaker:"",
  text:"Ao ouvir o nome, Lucien endurece.",
  char:"lucien 11.png",
  next:"lucien_26"
},

lucien_26:{
  speaker:"Lucien",
  text:"Então foi ela que te enviou.",
  choices:[
    { text:"Você conhece Aleia?", next:"lucien_27" },
    { text:"Ela não me explicou nada!", next:"lucien_27" },
    { text:"Se isso é culpa dela, eu também quero respostas.", next:"lucien_27" }
  ]
},
lucien_27:{
  speaker:"Lucien",
  text:"Você não deveria estar aqui.\n\nMas agora que está… não posso te deixar na floresta.\n\nFique.\nAo menos esta noite.",
  char:"presença 12.png",
  next:"lucien_28"
},

lucien_28:{
  speaker:"",
  text:"O cansaço me vence.\n\nA escuridão me engole.",
  char:"sonho 1.png",
  next:"lucien_29"
},

lucien_29:{
  speaker:"",
  text:"No vazio branco do sonho, uma figura surge.\n\nAleia.",
  char:"sonho 2.png",
  next:"lucien_30"
},

lucien_30:{
  speaker:"Aleia",
  text:"O Ciclo das Reencarnações foi quebrado.\n\nVocê é o Fragmento da Origem.\n\nSua missão não é viver.\n\nÉ decidir quem merece continuar existindo.",
  char:"sonho 3.png",
  choices:[
    { text:"Eu não pedi por isso.", next:"lucien_31" },
    { text:"E se eu me recusar?", next:"lucien_31" },
    { text:"E Lucien… faz parte disso?", next:"lucien_31", affect:"lucien", value:1 }
  ]
},

lucien_31:{
  speaker:"",
  text:"A luz do sonho se desfaz.\n\nAcordo sobressaltada.",
  char:"lucien 20.png",
  next:"lucien_32"
},

lucien_32:{
  speaker:"",
  text:"Lucien está ao lado da cama.",
  char:"lucien 21.png",
  next:"lucien_33"
},

lucien_33:{
  speaker:"Lucien",
  text:"Você sabia.\n\nReencarnadas despertam monstros.\n\nPosso?",
  char:"lucien 22.png",
  choices:[
    { text:"Sim.", next:"lucien_34", affect:"lucien", value:1 },
    { text:"Só se prometer não me machucar.", next:"lucien_34", affect:"lucien", value:1 },
    { text:"Não… ainda não.", next:"lucien_34" }
  ]
},

lucien_34:{
  speaker:"",
  text:"Quando ele toca minha mão, uma marca antiga surge entre nós.\n\nO castelo inteiro estremece.\n\nSombras se movem nas paredes.",
  char:"lucien 23.png",
  next:"lucien_35"
},

lucien_35:{
  speaker:"Lucien",
  text:"Se fizer isso…\n\nnão há volta.",
  choices:[
    { text:"Beijá-lo", next:"lucien_final", affect:"lucien", value:2 },
    { text:"Fugir", next:"menu" },
    { text:"Recuar", next:"menu" }
  ]
},

lucien_final:{
  speaker:"Lucien",
  text:"Minha eternidade… agora tem um começo.\n\nO sol nasce sobre o castelo.\n\nFim da rota do Lucien.",
  char:"lucien final 4.png",
  music:"gótica do lucien.mp3",
  next:"menu"
},

// ===============================
// ROTA DO ERYON – BLOCO 3.1
// ===============================

eryon_1:{
  route:"Eryon",
  speaker:"",
  text:"O ar da floresta é quente e pesado.\n\nCinzas caem lentamente do céu como neve escura.\nO cheiro de fumaça impregna tudo.",
  char:"eryon 1.png",
  next:"eryon_2"
},

eryon_2:{
  speaker:"",
  text:"Entre árvores queimadas, vejo chamas dançando ao longe.\n\nAlgo — ou alguém — está ali.",
  char:"eryon 2.png",
  next:"eryon_3"
},

eryon_3:{
  speaker:"",
  text:"Um homem de cabelos vermelhos observa o fogo como se ele fosse parte de seu próprio corpo.",
  char:"eryon 3.png",
  next:"eryon_4"
},

eryon_4:{
  speaker:"Eryon",
  text:"Você…\n\nNão deveria estar aqui.",
  char:"eryon 4.png",
  next:"eryon_5"
},

eryon_5:{
  speaker:"Eu",
  text:"Desculpe, eu… estou perdida.",
  char:"eryon 5.png",
  choices:[
    { text:"Pedir ajuda.", next:"eryon_6", affect:"eryon", value:1 },
    { text:"Ficar em silêncio.", next:"eryon_6" },
    { text:"Perguntar quem ele é.", next:"eryon_6" }
  ]
},

eryon_6:{
  speaker:"",
  text:"As chamas ao redor dele diminuem levemente.",
  char:"eryon 6.png",
  next:"eryon_7"
},
eryon_7:{
  speaker:"Eryon",
  text:"Não é comum ver alguém caminhar sozinha por estas terras queimadas.\n\nQuem é você?",
  char:"eryon 7.png",
  next:"eryon_8"
},

eryon_8:{
  speaker:"Eu",
  text:"Eu… não sei ao certo.\n\nSó acordei aqui depois de um acidente.",
  char:"eryon 8.png",
  next:"eryon_9"
},

eryon_9:{
  speaker:"",
  text:"Ao ouvir isso, o olhar de Eryon suaviza.\n\nAs chamas ao redor dele diminuem ainda mais.",
  char:"eryon 9.png",
  next:"eryon_10"
},

eryon_10:{
  speaker:"Eryon",
  text:"Então você também carrega marcas do passado.\n\nEste mundo é cruel com os que sobrevivem.",
  char:"eryon 10.png",
  choices:[
    { text:"Perguntar sobre ele.", next:"eryon_11", affect:"eryon", value:1 },
    { text:"Permanecer em silêncio.", next:"eryon_11" },
    { text:"Dizer que quer ir embora.", next:"eryon_11" }
  ]
},

eryon_11:{
  speaker:"",
  text:"O vento sopra cinzas entre nós.\n\nO calor das chamas se mistura com uma estranha sensação de segurança.",
  char:"eryon 11.png",
  next:"eryon_12"
},
eryon_12:{
  speaker:"Eryon",
  text:"O fogo não é apenas destruição.\n\nEle também purifica.\n\nVocê sente isso, não sente?",
  char:"eryon 12.png",
  next:"eryon_13"
},

eryon_13:{
  speaker:"Eu",
  text:"Sinto…\n\nAlgo dentro de mim reage quando chego perto de você.",
  char:"eryon 13.png",
  next:"eryon_14"
},

eryon_14:{
  speaker:"",
  text:"Uma faísca salta entre nossas mãos quando quase nos tocamos.",
  char:"eryon 14.png",
  next:"eryon_15"
},

eryon_15:{
  speaker:"Eryon",
  text:"Origem.\n\nVocê também carrega esse poder.\n\nAleia escolheu você.",
  char:"eryon 15.png",
  choices:[
    { text:"Perguntar sobre Aleia.", next:"eryon_16" },
    { text:"Recuar assustada.", next:"eryon_16" },
    { text:"Aceitar o que está acontecendo.", next:"eryon_16", affect:"eryon", value:1 }
  ]
},

eryon_16:{
  speaker:"",
  text:"O fogo ao redor de Eryon dança de forma diferente.\n\nNão ameaça.\n\nProtege.",
  char:"eryon 16.png",
  next:"eryon_17"
},
eryon_17:{
  speaker:"Eryon",
  text:"Este mundo está à beira do colapso.\n\nA Origem decide quem permanece.\n\nE você… é a chave.",
  char:"eryon 17.png",
  next:"eryon_18"
},

eryon_18:{
  speaker:"Eu",
  text:"Então tudo isso… não foi um acaso?",
  char:"eryon 18.png",
  next:"eryon_19"
},

eryon_19:{
  speaker:"Eryon",
  text:"Nada do que envolve Aleia é um acaso.",
  char:"eryon 19.png",
  next:"eryon_20"
},

eryon_20:{
  speaker:"",
  text:"Ele estende a mão para mim.\n\nO calor não queima.\n\nConforta.",
  char:"eryon 20.png",
  next:"eryon_21"
},

eryon_21:{
  speaker:"Eryon",
  text:"Se escolher ficar ao meu lado…\n\nO fogo vai proteger você.\n\nMas o mundo mudará.",
  choices:[
    { text:"Aceitar a mão de Eryon.", next:"eryon_final", affect:"eryon", value:2 },
    { text:"Recuar.", next:"menu" },
    { text:"Fugir.", next:"menu" }
  ]
},

eryon_final:{
  speaker:"Eryon",
  text:"O fogo se ergue ao nosso redor.\n\nNão destrói.\n\nCria.\n\nFim da rota do Eryon.",
  char:"eryon final.png",
  next:"menu"
},

// ===============================
// ROTA DO KAIDEN – BLOCO 4.1
// ===============================

kaiden_1:{
  route:"Kaiden",
  speaker:"",
  text:"O som de passos ecoa pelo corredor de pedra.\n\nA luz de tochas revela paredes antigas cobertas por símbolos.",
  char:"kaiden 1.png",
  music:"mystical japanese",
  next:"kaiden_2"
},

kaiden_2:{
  speaker:"",
  text:"Uma figura de armadura negra surge diante de mim.\n\nEle segura uma espada manchada de sangue seco.",
  char:"kaiden 2.png",
  next:"kaiden_3"
},

kaiden_3:{
  speaker:"Kaiden",
  text:"Você não deveria estar aqui.\n\nEstas ruínas não são seguras.",
  char:"kaiden 3.png",
  next:"kaiden_4"
},

kaiden_4:{
  speaker:"Eu",
  text:"Eu não tive escolha.\n\nAcordei neste lugar.",
  char:"kaiden 4.png",
  choices:[
    { text:"Pedir ajuda.", next:"kaiden_5", affect:"kaiden", value:1 },
    { text:"Desconfiar dele.", next:"kaiden_5" },
    { text:"Perguntar quem ele é.", next:"kaiden_5" }
  ]
},

kaiden_5:{
  speaker:"",
  text:"O olhar de Kaiden suaviza por um instante.\n\nMas ele mantém a mão próxima da espada.",
  char:"kaiden 5.png",
  next:"kaiden_6"
},
kaiden_6:{
  speaker:"Kaiden",
  text:"Este lugar é amaldiçoado.\n\nCriaturas da Origem vagam por aqui.\n\nVocê não sobreviveria sozinha.",
  char:"kaiden 6.png",
  next:"kaiden_7"
},

kaiden_7:{
  speaker:"Eu",
  text:"Origem…\n\nTodo mundo fala disso.\n\nO que é exatamente?",
  char:"kaiden 7.png",
  next:"kaiden_8"
},

kaiden_8:{
  speaker:"Kaiden",
  text:"Uma força antiga.\n\nCapaz de criar e destruir mundos.\n\nAleia a controla.",
  char:"kaiden 8.png",
  next:"kaiden_9"
},

kaiden_9:{
  speaker:"",
  text:"Um rugido ecoa ao longe.\n\nKaiden se coloca à minha frente.",
  char:"kaiden 9.png",
  next:"kaiden_10"
},

kaiden_10:{
  speaker:"Kaiden",
  text:"Fique atrás de mim.",
  char:"kaiden 10.png",
  choices:[
    { text:"Confiar nele.", next:"kaiden_11", affect:"kaiden", value:1 },
    { text:"Tentar fugir.", next:"kaiden_11" },
    { text:"Perguntar o que é aquilo.", next:"kaiden_11" }
  ]
},

kaiden_11:{
  speaker:"",
  text:"Sombras se movem entre as colunas quebradas.",
  char:"kaiden 11.png",
  next:"kaiden_12"
},
kaiden_12:{
  speaker:"Kaiden",
  text:"Essas criaturas são atraídas pela Origem.\n\nE você… brilha para elas.",
  char:"kaiden 12.png",
  next:"kaiden_13"
},

kaiden_13:{
  speaker:"Eu",
  text:"Então eu sou um alvo agora?",
  char:"kaiden 13.png",
  next:"kaiden_14"
},

kaiden_14:{
  speaker:"Kaiden",
  text:"Sim.\n\nMas enquanto eu estiver aqui, nada vai tocar você.",
  char:"kaiden 14.png",
  next:"kaiden_15"
},

kaiden_15:{
  speaker:"",
  text:"Ele segura minha mão.\n\nUma energia antiga pulsa entre nós.",
  char:"kaiden 15.png",
  next:"kaiden_16"
},

kaiden_16:{
  speaker:"Kaiden",
  text:"Se decidir lutar ao meu lado…\n\nNão haverá volta.",
  choices:[
    { text:"Aceitar.", next:"kaiden_final", affect:"kaiden", value:2 },
    { text:"Recusar.", next:"menu" },
    { text:"Fugir.", next:"menu" }
  ]
},

kaiden_final:{
  speaker:"Kaiden",
  text:"Juntos, enfrentaremos a Origem.\n\nFim da rota do Kaiden.",
  char:"kaiden final.png",
  next:"menu"
},
// ===============================
// ROTA DO AELION – BLOCO 5.1
// ===============================
aelion_1:{
  route:"Aelion",
  speaker:"",
  text:"O céu noturno está coberto por estrelas.\n\nUm vento frio sopra sobre o campo aberto.",
  char:"aelion 1.png",
  music:"trilha do aelion",
  next:"aelion_2"
},

aelion_2:{
  speaker:"",
  text:"Uma figura de cabelos prateados observa o horizonte.\n\nHá algo melancólico em sua postura.",
  char:"aelion 2.png",
  next:"aelion_3"
},

aelion_3:{
  speaker:"Aelion",
  text:"Você chegou.\n\nEu estava esperando.",
  char:"aelion 3.png",
  next:"aelion_4"
},

aelion_4:{
  speaker:"Eu",
  text:"Você me conhece?",
  char:"aelion 4.png",
  choices:[
    { text:"Perguntar quem ele é.", next:"aelion_5", affect:"aelion", value:1 },
    { text:"Ficar em silêncio.", next:"aelion_5" },
    { text:"Dizer que quer ir embora.", next:"aelion_5" }
  ]
},

aelion_5:{
  speaker:"",
  text:"Aelion se aproxima lentamente.\n\nSeus olhos refletem as estrelas.",
  char:"aelion 5.png",
  next:"aelion_6"
},
aelion_6:{
  speaker:"Aelion",
  text:"Este mundo existe entre sonhos e realidade.\n\nVocê não deveria estar aqui… mas está.",
  char:"aelion 6.png",
  next:"aelion_7"
},

aelion_7:{
  speaker:"Eu",
  text:"Todo mundo diz isso.\n\nMas ninguém explica por quê.",
  char:"aelion 7.png",
  next:"aelion_8"
},

aelion_8:{
  speaker:"Aelion",
  text:"Porque você carrega a Origem.\n\nAleia a confiou a você.",
  char:"aelion 8.png",
  next:"aelion_9"
},

aelion_9:{
  speaker:"",
  text:"Uma brisa envolve nós dois.\n\nO mundo parece desacelerar.",
  char:"aelion 9.png",
  next:"aelion_10"
},

aelion_10:{
  speaker:"Aelion",
  text:"O destino deste mundo depende de você.",
  char:"aelion 10.png",
  choices:[
    { text:"Perguntar sobre Aleia.", next:"aelion_11" },
    { text:"Afastar-se.", next:"aelion_11" },
    { text:"Ouvir em silêncio.", next:"aelion_11", affect:"aelion", value:1 }
  ]
},

aelion_11:{
  speaker:"",
  text:"Aelion segura minha mão com cuidado.",
  char:"aelion 11.png",
  next:"aelion_12"
},
aelion_12:{
  speaker:"Aelion",
  text:"Se escolher ficar comigo…\n\nEu posso proteger você do peso da Origem.",
  char:"aelion 12.png",
  next:"aelion_13"
},

aelion_13:{
  speaker:"Eu",
  text:"E o que acontece com o mundo?",
  char:"aelion 13.png",
  next:"aelion_14"
},

aelion_14:{
  speaker:"Aelion",
  text:"Ele continuará.\n\nMas mudará para sempre.",
  char:"aelion 14.png",
  next:"aelion_15"
},

aelion_15:{
  speaker:"Aelion",
  text:"Faça sua escolha.",
  choices:[
    { text:"Ficar com Aelion.", next:"aelion_final", affect:"aelion", value:2 },
    { text:"Recuar.", next:"menu" },
    { text:"Partir.", next:"menu" }
  ]
},

aelion_final:{
  speaker:"Aelion",
  text:"Sob as estrelas, escolhemos um ao outro.\n\nFim da rota do Aelion.",
  char:"aelion final.png",
  music:"trilha do aelion",
  next:"menu"
},
// Continue colando o roteiro inteiro aqui...

};

// ===============================
const startBtn = document.getElementById("startBtn");
const playerNameInput = document.getElementById("playerName");
const menu = document.getElementById("menu");

startBtn.onclick = ()=>{
    menu.style.display = "none";
    loadScene("menu");
};

