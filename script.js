const firebaseConfig = {
  apiKey: "AIzaSyAGnl9EmIf_Xm6XTu7_Ls-bgVOXD9ZIEsg",
  authDomain: "socia-9ace8.firebaseapp.com",
  databaseURL: "https://socia-9ace8-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "socia-9ace8",
  storageBucket: "socia-9ace8.firebasestorage.app",
  messagingSenderId: "90559520701",
  appId: "1:90559520701:web:fefa9b6e03041bdc007cd4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentRoom = "";
let myPlayerKey = "";
let myPlayerName = "";
let mySlot = null;
let roleModalShown = false;
let selectedTargetKey = null;

const ROLE_CATEGORIES = {
  townsfolk: [
    { name: "Analityk Logów", team: "blue", desc: "Zaczynasz grę, wiedząc, że 1 z 2 wskazanych graczy ma określoną rolę dobrego pracownika." },
    { name: "Monitoring Awaryjny", team: "blue", desc: "Jeśli giniesz w nocy, budzisz się, wybierasz gracza i poznajesz jego dokładną rolę." },
    { name: "Digital Forensics", team: "blue", desc: "Każdą nocy dowiadujesz się, jaką rolę miał gracz, który został wczoraj przegłosowany za dnia." },
    { name: "Audytor Podatności", team: "blue", desc: "Zaczynasz grę, wiedząc, ile par złych graczy siedzi obok siebie." },
    { name: "Skaner Sieciowy", team: "blue", desc: "Co noc wybierasz 2 graczy (uwaga na false positive)." },
    { name: "Firewall", team: "blue", desc: "Co noc wybierasz gracza (nie siebie): chronisz go przed Hackerem." },
    { name: "Pentester", team: "blue", desc: "Raz na grę za dnia możesz publicznie wskazać gracza: jeśli to Hacker, natychmiast ginie." },
    { name: "SOC Analityk", team: "blue", desc: "Co noc dowiadujesz się, ilu złych graczy siedzi po Twoich bezpośrednich żyjących sąsiadach." },
    { name: "SysAdmin", team: "blue", desc: "Zaczynasz grę, wiedząc, że 1 z 2 graczy to określony Pomocnik/Trojan." },
    { name: "CEO", team: "blue", desc: "Jeśli zostało 3 graczy i nikt nie zginie za dnia, wygrywasz. VIP chroni przed nocnym paraliżem." },
    { name: "Mainframe", team: "blue", desc: "Jesteś stale odporny na atak Hackera." }
  ],
  outsiders: [
    { name: "Podwykonawca", team: "yellow", desc: "Co noc wybierasz „pana” – głosujesz za dnia tylko wtedy, gdy on też odda głos." },
    { name: "Izolowana sieć", team: "yellow", desc: "Jeśli zginiesz w wyniku głosowania (skazania), Twoja drużyna natychmiast przegrywa." },
    { name: "UBO", team: "yellow", desc: "Jeśli zginiesz w wyniku głosowania (skazania), Twoja drużyna natychmiast przegrywa." },
    { name: "Błąd konfiguracji", team: "yellow", desc: "Myślisz, że masz normalną rolę, ale Twoja zdolność daje zmyślone lub niedziałające wyniki." }
  ],
  minions: [
    { name: "Socjotechnik", team: "red", desc: "Co noc wybierasz gracza: jego zdolność tej nocy i następnego dnia nie działa." },
    { name: "Serwer Zapasowy", team: "red", desc: "Jeśli w grze jest min. 5 osób, a Hacker zginie, natychmiast przejmujesz jego rolę." },
    { name: "Trojan", team: "red", desc: "Myślisz, że jesteś dobrym Mieszczaninem, ale grasz dla APT Team. Hacker wie, kim jesteś." },
    { name: "Botnet", team: "red", desc: "Obecność Botneta dodaje do puli gry dodatkowych Outsiders (+2)." }
  ],
  demons: [
    { name: "Hacker", team: "red", desc: "Co noc wybierasz gracza do zaszyfrowania. Jeśli zginiesz, Pomocnik przejmuje rolę." }
  ]
};

function getRoleProportions(count) {
  const baseTable = {
    5:  { townsfolk: 3, outsiders: 0, minions: 1, demons: 1 },
    6:  { townsfolk: 3, outsiders: 1, minions: 1, demons: 1 },
    7:  { townsfolk: 5, outsiders: 0, minions: 1, demons: 1 },
    8:  { townsfolk: 5, outsiders: 1, minions: 1, demons: 1 },
    9:  { townsfolk: 5, outsiders: 2, minions: 1, demons: 1 },
    10: { townsfolk: 7, outsiders: 0, minions: 2, demons: 1 },
    11: { townsfolk: 7, outsiders: 1, minions: 2, demons: 1 },
    12: { townsfolk: 7, outsiders: 2, minions: 2, demons: 1 },
    13: { townsfolk: 9, outsiders: 0, minions: 3, demons: 1 },
    14: { townsfolk: 9, outsiders: 1, minions: 3, demons: 1 },
    15: { townsfolk: 9, outsiders: 2, minions: 3, demons: 1 }
  };

  if (baseTable[count]) return baseTable[count];

  const demons = 1;
  const minions = Math.floor((count - 1) / 3) - 1; 
  const remainder = (count - 1) % 3;
  const outsiders = remainder;
  const townsfolk = count - demons - minions - outsiders;

  return { townsfolk, outsiders, minions, demons };
}

function showScreen(id) {
  document.querySelectorAll('.card > div').forEach(div => div.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function switchTab(tabName, btnElement) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  if (tabName === 'table') {
    document.getElementById('tab-table').classList.remove('hidden');
  } else if (tabName === 'roles') {
    document.getElementById('tab-roles').classList.remove('hidden');
    renderRolesBook();
  } else if (tabName === 'first-night') {
    document.getElementById('tab-first-night').classList.remove('hidden');
  } else if (tabName === 'next-nights') {
    document.getElementById('tab-next-nights').classList.remove('hidden');
  }

  btnElement.classList.add('active');
}

function renderRolesBook() {
  const container = document.getElementById('roles-book-container');
  if (container.innerHTML.trim() !== "") return;

  let html = `<div class="role-category-title" style="color: var(--blue);">💙 Blue Team (Townsfolk)</div>`;
  ROLE_CATEGORIES.townsfolk.forEach(r => {
    html += `<div class="role-item"><div class="role-item-name">${r.name}</div><div class="role-item-desc">${r.desc}</div></div>`;
  });

  html += `<div class="role-category-title" style="color: var(--yellow);">💛 Yellow Team (Outsiders)</div>`;
  ROLE_CATEGORIES.outsiders.forEach(r => {
    html += `<div class="role-item"><div class="role-item-name">${r.name}</div><div class="role-item-desc">${r.desc}</div></div>`;
  });

  html += `<div class="role-category-title" style="color: var(--red);">❤️ APT Team (Minions)</div>`;
  ROLE_CATEGORIES.minions.forEach(r => {
    html += `<div class="role-item"><div class="role-item-name">${r.name}</div><div class="role-item-desc">${r.desc}</div></div>`;
  });

  html += `<div class="role-category-title" style="color: var(--red);">🦹 Hacker (Demon)</div>`;
  ROLE_CATEGORIES.demons.forEach(r => {
    html += `<div class="role-item"><div class="role-item-name">${r.name}</div><div class="role-item-desc">${r.desc}</div></div>`;
  });

  container.innerHTML = html;
}

function getPerimeterPosition(index, total) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const rx = 41;
  const ry = 39;
  const left = 50 + rx * Math.cos(angle);
  const top = 50 + ry * Math.sin(angle);
  return { left: `${left}%`, top: `${top}%` };
}

function getCircleSizeConfig(total) {
  if (total > 22) return { size: 36, fontSize: '0.38em' };
  if (total > 16) return { size: 44, fontSize: '0.45em' };
  if (total > 12) return { size: 50, fontSize: '0.52em' };
  if (total > 8) return { size: 60, fontSize: '0.6em' };
  return { size: 70, fontSize: '0.68em' };
}

function getSuspicions() {
  const key = `socia_suspects_${currentRoom}_${myPlayerKey}`;
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch(e) {
    return {};
  }
}

function saveSuspicions(suspects) {
  const key = `socia_suspects_${currentRoom}_${myPlayerKey}`;
  localStorage.setItem(key, JSON.stringify(suspects));
}

function saveSession(isHost = false) {
  sessionStorage.setItem('socia_session', JSON.stringify({
    room: currentRoom,
    playerKey: myPlayerKey,
    playerName: myPlayerName,
    isHost: isHost
  }));
}

function clearSession() {
  sessionStorage.removeItem('socia_session');
}

function restoreSession() {
  const sessionData = sessionStorage.getItem('socia_session');
  if (!sessionData) return;

  try {
    const session = JSON.parse(sessionData);
    if (!session || !session.room) return;

    db.ref('rooms/' + session.room).once('value').then(snapshot => {
      if (!snapshot.exists()) {
        clearSession();
        return;
      }

      currentRoom = session.room;

      if (session.isHost) {
        document.getElementById('host-room-code').innerText = currentRoom;
        document.getElementById('max-player-count').innerText = snapshot.val().maxPlayers || 6;
        showScreen('screen-host');

        document.getElementById("qrcode").innerHTML = "";
        new QRCode(document.getElementById("qrcode"), {
          text: window.location.href.split('?')[0] + "?room=" + currentRoom,
          width: 140, height: 140
        });

        listenHostRoom();
      } else if (session.playerKey) {
        const players = snapshot.val().players || {};
        if (!players[session.playerKey]) {
          clearSession();
          return;
        }

        myPlayerKey = session.playerKey;
        myPlayerName = session.playerName || players[myPlayerKey].name;
        mySlot = players[myPlayerKey].slot;

        document.getElementById('display-player-name').innerText = myPlayerName;
        document.getElementById('display-player-slot').innerText = mySlot;

        populateSuspectSelect();
        showScreen('screen-player');
        listenPlayerRoom();
      }
    });
  } catch (e) {
    console.error("Błąd przywracania sesji:", e);
    clearSession();
  }
}

function getRandomSample(categoryList, count) {
  let result = [];
  let shuffled = [...categoryList].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}

// === HOST LOGIKA ===
function createRoom() {
  let maxPlayersInput = parseInt(document.getElementById('host-max-players').value);
  if (isNaN(maxPlayersInput) || maxPlayersInput < 5) maxPlayersInput = 5;
  if (maxPlayersInput > 31) maxPlayersInput = 31;

  currentRoom = Math.random().toString(36).substring(2, 6).toUpperCase();
  db.ref('rooms/' + currentRoom).set({
    state: 'lobby',
    maxPlayers: maxPlayersInput,
    createdAt: Date.now()
  });

  document.getElementById('host-room-code').innerText = currentRoom;
  document.getElementById('max-player-count').innerText = maxPlayersInput;
  showScreen('screen-host');

  // Generowanie kodu QR dla Netlify (używa oficjalnego adresu hostingu)
  const qrContainer = document.getElementById("qrcode");
  qrContainer.innerHTML = "";

  // Pobiera aktualny adres strony (np. https://socia-game.netlify.app) + kod pokoju
  const currentDomain = window.location.origin + window.location.pathname;
  const qrData = `${currentDomain}?room=${currentRoom}`;

  try {
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, {
        text: qrData,
        width: 140,
        height: 140,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      qrContainer.innerHTML = `<p style="color:var(--red); font-size:0.8em;">Błąd: Brak biblioteki QR. Kod pokoju to: <b>${currentRoom}</b></p>`;
    }
  } catch (err) {
    console.error("Błąd generowania QR:", err);
    qrContainer.innerHTML = `<p style="color:var(--red); font-size:0.8em;">Kod pokoju: <b>${currentRoom}</b></p>`;
  }

  saveSession(true);
  listenHostRoom();
}

function listenHostRoom() {
  db.ref(`rooms/${currentRoom}`).on('value', snapshot => {
    const roomData = snapshot.val();
    if (!roomData) return;

    const players = roomData.players || {};
    const max = roomData.maxPlayers || 6;
    const playerKeys = Object.keys(players);
    const config = getCircleSizeConfig(max);

    document.getElementById('player-count').innerText = playerKeys.length;
    const containerDiv = document.getElementById('host-player-circles');
    containerDiv.innerHTML = "";

    const assignListDiv = document.getElementById('host-role-assign-list');
    assignListDiv.innerHTML = "";

    const allRoles = [
      ...ROLE_CATEGORIES.townsfolk,
      ...ROLE_CATEGORIES.outsiders,
      ...ROLE_CATEGORIES.minions,
      ...ROLE_CATEGORIES.demons
    ];

    for (let i = 1; i <= max; i++) {
      const pos = getPerimeterPosition(i - 1, max);
      const playerKey = playerKeys.find(k => players[k].slot === i);
      
      if (playerKey) {
        const p = players[playerKey];
        let statusClass = "joined";
        if (roomData.state === 'ingame') {
          statusClass += p.alive ? " alive" : " dead";
          if (p.role) statusClass += ` team-${p.role.team}`;
        }
        
        let roleBadgeStyle = "";
        if (p.role) {
          if (p.role.team === 'red') roleBadgeStyle = "color: var(--red); font-weight:bold;";
          else if (p.role.team === 'blue') roleBadgeStyle = "color: var(--blue); font-weight:bold;";
          else if (p.role.team === 'yellow') roleBadgeStyle = "color: var(--yellow); font-weight:bold;";
        }

        containerDiv.innerHTML += `
          <div class="player-circle ${statusClass}" 
               style="left: ${pos.left}; top: ${pos.top}; width: ${config.size}px; height: ${config.size}px; font-size: ${config.fontSize}; cursor: pointer;" 
               title="Kliknij, aby zmienić stan" 
               onclick="toggleKill('${playerKey}', ${p.alive})">
            <span class="player-name">#${i} ${p.name}</span>
            ${p.role ? `<span class="player-role" style="${roleBadgeStyle}">${p.role.name}</span>` : `<span class="player-role">Gotowy</span>`}
          </div>
        `;

        // Generowanie pola wyboru roli dla h osta
        let optionsHtml = `<option value="">-- Losowo z tabeli --</option>`;
        allRoles.forEach(r => {
          let selected = (p.manualRole && p.manualRole === r.name) ? "selected" : "";
          optionsHtml += `<option value="${r.name}" ${selected}>${r.name} (${r.team.toUpperCase()})</option>`;
        });

        assignListDiv.innerHTML += `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 0.85em;">
            <span style="font-weight: bold; width: 110px; overflow: hidden; text-overflow: ellipsis;">#${i} ${p.name}:</span>
            <select onchange="setManualRole('${playerKey}', this.value)" style="flex: 1; padding: 5px; background: #161b22; border: 1px solid var(--border); color: white; border-radius: 4px;">
              ${optionsHtml}
            </select>
          </div>
        `;

      } else {
        containerDiv.innerHTML += `
          <div class="player-circle" style="left: ${pos.left}; top: ${pos.top}; width: ${config.size}px; height: ${config.size}px; font-size: ${config.fontSize};">
            <span class="empty-slot">#${i}</span>
          </div>
        `;
      }
    }
  });
}

function setManualRole(playerKey, roleName) {
  db.ref(`rooms/${currentRoom}/players/${playerKey}`).update({
    manualRole: roleName || null
  });
}

function startGame() {
  db.ref(`rooms/${currentRoom}/players`).once('value', snapshot => {
    const players = snapshot.val();
    if (!players) return alert("Brak graczy w pokoju!");
    const keys = Object.keys(players);
    const playerCount = keys.length;

    if (playerCount < 5) {
      return alert("❌ Minimalna liczba graczy w pokoju do rozpoczęcia gry to 5!");
    }

    const proportions = getRoleProportions(playerCount);

    // Przygotowanie puli ról losowych dla graczy, którzy nie mają przypisanej roli ręcznie
    let poolTowns = [...ROLE_CATEGORIES.townsfolk];
    let poolOuts = [...ROLE_CATEGORIES.outsiders];
    let poolMin = [...ROLE_CATEGORIES.minions];
    let poolDem = [...ROLE_CATEGORIES.demons];

    let assignedRolesMap = {};
    let unassignedKeys = [];

    // Najpierw sprawdzamy, kto ma przypisaną rolę ręcznie przez hosta
    keys.forEach(key => {
      let p = players[key];
      if (p.manualRole) {
        let foundRole = [...poolTowns, ...poolOuts, ...poolMin, ...poolDem].find(r => r.name === p.manualRole);
        if (foundRole) {
          assignedRolesMap[key] = foundRole;
          // Usuwamy z puli losowania, żeby nie zdublować (opcjonalnie)
        } else {
          unassignedKeys.push(key);
        }
      } else {
        unassignedKeys.push(key);
      }
    });

    // Dla pozostałych losujemy według proporcji
    let autoRoles = [];
    autoRoles.push(...getRandomSample(ROLE_CATEGORIES.townsfolk, proportions.townsfolk));
    autoRoles.push(...getRandomSample(ROLE_CATEGORIES.outsiders, proportions.outsiders));
    autoRoles.push(...getRandomSample(ROLE_CATEGORIES.minions, proportions.minions));
    autoRoles.push(...getRandomSample(ROLE_CATEGORIES.demons, proportions.demons));
    autoRoles.sort(() => Math.random() - 0.5);

    let updates = {};
    let autoIndex = 0;

    keys.forEach(key => {
      if (assignedRolesMap[key]) {
        updates[`${key}/role`] = assignedRolesMap[key];
      } else {
        updates[`${key}/role`] = autoRoles[autoIndex % autoRoles.length];
        autoIndex++;
      }
      updates[`${key}/alive`] = true;
    });

    db.ref(`rooms/${currentRoom}/players`).update(updates);
    db.ref(`rooms/${currentRoom}`).update({ state: 'ingame' });
  });
}

function toggleKill(playerKey, currentStatus) {
  db.ref(`rooms/${currentRoom}/players/${playerKey}`).update({
    alive: !currentStatus
  });
}

function checkRoomAndShowSlots() {
  const code = document.getElementById('join-code').value.toUpperCase();
  const name = document.getElementById('player-name').value.trim();
  if (!code || !name) return alert("Wpisz kod i imię!");

  myPlayerName = name;

  db.ref('rooms/' + code).once('value').then(snapshot => {
    if (!snapshot.exists()) {
      alert("❌ Pokój o takim kodzie nie istnieje!");
      return;
    }

    const roomData = snapshot.val();
    if (roomData.state && roomData.state !== 'lobby') {
      alert("⚠️ Gra w tym pokoju już się rozpoczęła.");
      return;
    }

    currentRoom = code;
    document.getElementById('select-slot-room-code').innerText = code;
    showScreen('screen-select-slot');

    db.ref(`rooms/${currentRoom}`).on('value', snap => {
      const data = snap.val();
      if (!data) return;

      const players = data.players || {};
      const max = data.maxPlayers || 6;
      const config = getCircleSizeConfig(max);
      const containerDiv = document.getElementById('slots-grid');
      containerDiv.innerHTML = "";

      for (let i = 1; i <= max; i++) {
        const pos = getPerimeterPosition(i - 1, max);
        const takenPlayerKey = Object.keys(players).find(k => players[k].slot === i);

        if (takenPlayerKey) {
          containerDiv.innerHTML += `
            <div class="player-circle taken" style="left: ${pos.left}; top: ${pos.top}; width: ${config.size}px; height: ${config.size}px; font-size: ${config.fontSize};">
              <span class="player-name">#${i} Zajęte</span>
            </div>
          `;
        } else {
          containerDiv.innerHTML += `
            <div class="player-circle selectable" style="left: ${pos.left}; top: ${pos.top}; width: ${config.size}px; height: ${config.size}px; font-size: ${config.fontSize};" onclick="claimSlot(${i})">
              <span class="player-name">#${i} Wolne</span>
            </div>
          `;
        }
      }
    });
  }).catch(error => {
    console.error("Błąd połączenia:", error);
    alert("Wystąpił błąd podczas dołączania do pokoju.");
  });
}

function claimSlot(slotNumber) {
  mySlot = slotNumber;
  document.getElementById('display-player-name').innerText = myPlayerName;
  document.getElementById('display-player-slot').innerText = slotNumber;

  const newPlayerRef = db.ref(`rooms/${currentRoom}/players`).push();
  myPlayerKey = newPlayerRef.key;

  newPlayerRef.set({
    name: myPlayerName,
    slot: slotNumber,
    alive: true
  });

  saveSession(false);
  populateSuspectSelect();
  showScreen('screen-player');
  listenPlayerRoom();
}

function listenPlayerRoom() {
  db.ref(`rooms/${currentRoom}`).on('value', snapshot => {
    const roomData = snapshot.val();
    if (!roomData) return;

    const players = roomData.players || {};
    const max = roomData.maxPlayers || 6;
    const playerKeys = Object.keys(players);
    const config = getCircleSizeConfig(max);

    const containerDiv = document.getElementById('player-table-circles');
    containerDiv.innerHTML = "";

    const me = players[myPlayerKey];
    if (me && me.role && !roleModalShown) {
      showRoleModal(me.role);
      roleModalShown = true;
    }

    const suspicions = getSuspicions();

    for (let i = 1; i <= max; i++) {
      const pos = getPerimeterPosition(i - 1, max);
      const playerKey = playerKeys.find(k => players[k].slot === i);
      
      if (playerKey) {
        const p = players[playerKey];
        const isMe = (playerKey === myPlayerKey);
        let statusClass = isMe ? "joined is-me" : "joined";

        if (roomData.state === 'ingame') {
          statusClass += p.alive ? " alive" : " dead";
          if (isMe && p.role) {
            statusClass += ` team-${p.role.team}`;
          }
        }

        let clickAttr = "";
        let suspectText = "";
        if (!isMe && roomData.state === 'ingame') {
          statusClass += " interactive-target";
          clickAttr = `onclick="openSuspectModal('${playerKey}', '${p.name}')"`;
          if (suspicions[playerKey]) {
            suspectText = `<span class="player-role" style="color:var(--yellow);" title="Podejrzenie">❓ ${suspicions[playerKey]}</span>`;
          }
        }

        let innerContent = "";
        if (isMe && p.role) {
          innerContent = `<span class="player-role" style="font-weight:bold;">${p.role.name}</span>`;
        } else if (suspectText) {
          innerContent = suspectText;
        } else {
          innerContent = `<span class="player-role">${p.alive ? '🟢' : '🔴'}</span>`;
        }

        containerDiv.innerHTML += `
          <div class="player-circle ${statusClass}" style="left: ${pos.left}; top: ${pos.top}; width: ${config.size}px; height: ${config.size}px; font-size: ${config.fontSize};" ${clickAttr}>
            <span class="player-name">#${i} ${p.name}</span>
            ${innerContent}
          </div>
        `;
      } else {
        containerDiv.innerHTML += `
          <div class="player-circle" style="left: ${pos.left}; top: ${pos.top}; width: ${config.size}px; height: ${config.size}px; font-size: ${config.fontSize};">
            <span class="empty-slot">#${i}</span>
          </div>
        `;
      }
    }

    const statusBox = document.getElementById('player-status-box');
    if (me && me.alive === false) {
      statusBox.innerHTML = `<h3 style="color:var(--red); margin:0;">⚠️ ZOSTALEŚ ZASZYFROWANY!</h3>`;
    } else if (me && me.alive === true && me.role) {
      statusBox.innerHTML = `<h3 style="color:var(--green); margin:0;">SYSTEM DZIAŁA STABILNIE</h3>`;
    }
  });
}

function populateSuspectSelect() {
  const select = document.getElementById('suspect-role-select');
  select.innerHTML = '<option value="">-- Brak / Wyczyść --</option>';
  const allRoles = [...ROLE_CATEGORIES.townsfolk, ...ROLE_CATEGORIES.outsiders, ...ROLE_CATEGORIES.minions, ...ROLE_CATEGORIES.demons];
  allRoles.forEach(r => {
    select.innerHTML += `<option value="${r.name}">${r.name} (${r.team.toUpperCase()})</option>`;
  });
}

function openSuspectModal(targetKey, targetName) {
  selectedTargetKey = targetKey;
  document.getElementById('suspect-player-title').innerText = `Gracz: ${targetName}`;
  
  const suspicions = getSuspicions();
  document.getElementById('suspect-role-select').value = suspicions[targetKey] || "";
  
  document.getElementById('suspect-modal').classList.remove('hidden');
}

function closeSuspectModal() {
  document.getElementById('suspect-modal').classList.add('hidden');
  selectedTargetKey = null;
}

function saveSuspectRole() {
  if (!selectedTargetKey) return;
  const roleVal = document.getElementById('suspect-role-select').value;
  
  let suspicions = getSuspicions();
  if (roleVal) {
    suspicions[selectedTargetKey] = roleVal;
  } else {
    delete suspicions[selectedTargetKey];
  }
  
  saveSuspicions(suspicions);
  closeSuspectModal();
}

function showRoleModal(role) {
  const modalInfo = document.getElementById('modal-role-info');
  modalInfo.innerHTML = `
    <h1 style="color: var(--blue); margin: 10px 0;">${role.name}</h1>
    <span class="badge badge-${role.team}">${role.team.toUpperCase()} TEAM</span>
    <p style="font-size:1.1em; line-height: 1.4; margin-top:15px; color: #c9d1d9;">${role.desc}</p>
  `;
  document.getElementById('role-modal').classList.remove('hidden');
}

function closeRoleModal() {
  document.getElementById('role-modal').classList.add('hidden');
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('room')) {
  document.getElementById('join-code').value = urlParams.get('room');
}

window.addEventListener('load', restoreSession);