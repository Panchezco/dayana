const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const CANASTA_H = 20;
const CANASTA_W = 60;
const VIDAS_MAX = 5;
const PUNTOS_POR_NIVEL = 150;

const POWERUPS = {
  lento: { emoji: '⏳', texto: 'Cámara lenta', duracion: 5 },
  grande: { emoji: '🧲', texto: 'Canasta grande', duracion: 7 },
  vida: { emoji: '🐾', texto: '+1 vida', duracion: 0 },
};

let puntos = 0;
let vidas = 3;
let nivel = 1;
let combo = 0;
let mejorCombo = 0;
let objetos = [];
let avisos = [];
let particulas = [];
let textos = [];
let efectos = { lento: 0, grande: 0 };
let animId = null;
let jugando = false;
let pausado = false;
let canastaX = 200;
let objetivoX = 200;
let teclas = {};
let ultimoTiempo = 0;
let proximoSpawn = 0;
let sacudida = 0;
let record = leerRecord();

mostrarRecordInicio();

canvas.addEventListener('mousemove', moverMouse);
canvas.addEventListener('touchstart', moverTouch, { passive: false });
canvas.addEventListener('touchmove', moverTouch, { passive: false });
window.addEventListener('keydown', teclaAbajo);
window.addEventListener('keyup', (e) => { teclas[e.key] = false; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && jugando && !pausado) alternarPausa();
});

function iniciar() {
  document.getElementById('inicio').style.display = 'none';
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('overlay').style.display = 'none';
  canvas.style.display = 'block';

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  puntos = 0;
  vidas = 3;
  nivel = 1;
  combo = 0;
  mejorCombo = 0;
  objetos = [];
  avisos = [];
  particulas = [];
  textos = [];
  efectos = { lento: 0, grande: 0 };
  canastaX = objetivoX = canvas.width / 2;
  proximoSpawn = 0.6;
  sacudida = 0;
  jugando = true;
  pausado = false;

  actualizarHud();
  cancelAnimationFrame(animId);
  ultimoTiempo = performance.now();
  animId = requestAnimationFrame(gameLoop);
}

function reiniciar() {
  iniciar();
}

// --- Controles ---

function posicionCanvas(clientX) {
  const rect = canvas.getBoundingClientRect();
  return (clientX - rect.left) * (canvas.width / rect.width);
}

function moverMouse(e) {
  objetivoX = posicionCanvas(e.clientX);
}

function moverTouch(e) {
  e.preventDefault();
  objetivoX = posicionCanvas(e.touches[0].clientX);
}

function teclaAbajo(e) {
  teclas[e.key] = true;
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && jugando) {
    alternarPausa();
  }
}

function alternarPausa() {
  pausado = !pausado;
  if (pausado) {
    cancelAnimationFrame(animId);
    dibujar();
    dibujarPausa();
  } else {
    ultimoTiempo = performance.now();
    animId = requestAnimationFrame(gameLoop);
  }
}

// --- Bucle principal ---

function gameLoop(t) {
  if (!jugando || pausado) return;
  const dt = Math.min((t - ultimoTiempo) / 1000, 0.05);
  ultimoTiempo = t;

  actualizar(dt);
  if (!jugando) return;
  dibujar();

  animId = requestAnimationFrame(gameLoop);
}

function anchoCanasta() {
  return efectos.grande > 0 ? CANASTA_W * 1.8 : CANASTA_W;
}

function actualizar(dt) {
  // Movimiento de la canasta: teclado o ratón, suavizado
  const velTeclado = 480;
  if (teclas.ArrowLeft || teclas.a || teclas.A) objetivoX -= velTeclado * dt;
  if (teclas.ArrowRight || teclas.d || teclas.D) objetivoX += velTeclado * dt;
  const mitad = anchoCanasta() / 2;
  objetivoX = Math.max(mitad, Math.min(canvas.width - mitad, objetivoX));
  canastaX += (objetivoX - canastaX) * Math.min(1, dt * 18);

  efectos.lento = Math.max(0, efectos.lento - dt);
  efectos.grande = Math.max(0, efectos.grande - dt);
  sacudida = Math.max(0, sacudida - dt);
  const factor = efectos.lento > 0 ? 0.45 : 1;

  proximoSpawn -= dt * factor;
  if (proximoSpawn <= 0) {
    spawnObjeto();
    proximoSpawn = Math.max(0.35, 1.0 - (nivel - 1) * 0.07) + Math.random() * 0.4;
  }

  // Avisos de chocolates rapidísimos
  for (let i = avisos.length - 1; i >= 0; i--) {
    const a = avisos[i];
    a.t -= dt * factor;
    if (a.t <= 0) {
      avisos.splice(i, 1);
      objetos.push({ x: a.x, y: -20, emoji: '🍫', tipo: 'malo', speed: 1500, size: 32, rot: 0, giro: 0 });
    }
  }

  const canastaY = canvas.height - CANASTA_H - 10;
  const ancho = anchoCanasta();

  for (let i = objetos.length - 1; i >= 0; i--) {
    const o = objetos[i];
    o.y += o.speed * factor * dt;
    o.rot += o.giro * dt;

    const golpea =
      o.y + o.size / 2 >= canastaY &&
      o.y - o.size / 2 <= canastaY + CANASTA_H &&
      o.x >= canastaX - ancho / 2 - o.size / 3 &&
      o.x <= canastaX + ancho / 2 + o.size / 3;

    if (golpea) {
      objetos.splice(i, 1);
      atrapar(o);
      if (!jugando) return;
      continue;
    }

    if (o.y > canvas.height + 30) {
      objetos.splice(i, 1);
      if (o.tipo === 'mango') {
        combo = 0;
        agregarTexto(o.x, canvas.height - 40, '¡Se cayó!', '#999');
        perderVida();
        if (!jugando) return;
      }
    }
  }

  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.vy += 600 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vida -= dt;
    if (p.vida <= 0) particulas.splice(i, 1);
  }

  for (let i = textos.length - 1; i >= 0; i--) {
    const tx = textos[i];
    tx.y -= 40 * dt;
    tx.vida -= dt;
    if (tx.vida <= 0) textos.splice(i, 1);
  }

  const nuevoNivel = 1 + Math.floor(puntos / PUNTOS_POR_NIVEL);
  if (nuevoNivel > nivel) {
    nivel = nuevoNivel;
    agregarTexto(canvas.width / 2, canvas.height / 2, `¡Nivel ${nivel}!`, '#c0396e', 26, 1.5);
    actualizarHud();
  }
}

function spawnObjeto() {
  const x = 30 + Math.random() * (canvas.width - 60);
  const m = 1 + (nivel - 1) * 0.12;
  const r = Math.random();

  if (r < 0.06) {
    const tipos = Object.keys(POWERUPS).filter((k) => k !== 'vida' || vidas < VIDAS_MAX);
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    objetos.push({ x, y: -20, emoji: POWERUPS[tipo].emoji, tipo: 'power', power: tipo, speed: 160 * m, size: 28, rot: 0, giro: 0 });
    return;
  }

  const probMalo = Math.min(0.25 + nivel * 0.02, 0.45);
  if (r < 0.06 + probMalo) {
    if (Math.random() < 0.12) {
      avisos.push({ x, t: 0.7 });
      return;
    }
    objetos.push({ x, y: -20, emoji: '🍫', tipo: 'malo', speed: (300 + Math.random() * 240) * m, size: 28, rot: 0, giro: 0 });
    return;
  }

  objetos.push({
    x, y: -20, emoji: '🥭', tipo: 'mango',
    speed: (120 + Math.random() * 90) * m,
    size: 26,
    rot: Math.random() * Math.PI,
    giro: (Math.random() - 0.5) * 4,
  });
}

function atrapar(o) {
  if (o.tipo === 'power') {
    const p = POWERUPS[o.power];
    if (o.power === 'vida') {
      vidas = Math.min(VIDAS_MAX, vidas + 1);
    } else {
      efectos[o.power] = p.duracion;
    }
    agregarTexto(o.x, o.y - 10, p.texto, '#3a7bd5', 16);
    explotar(o.x, o.y, '#7fb3ff', 14);
    actualizarHud();
    return;
  }

  if (o.tipo === 'malo') {
    combo = 0;
    sacudida = 0.3;
    explotar(o.x, o.y, '#6b3e26', 12);
    agregarTexto(o.x, o.y - 10, '¡Puaj!', '#6b3e26');
    perderVida();
    return;
  }

  combo++;
  mejorCombo = Math.max(mejorCombo, combo);
  const mult = multiplicador();
  puntos += 10 * mult;
  agregarTexto(o.x, o.y - 10, `+${10 * mult}`, '#e07b00');
  explotar(o.x, o.y, '#ffb300', 8);
  if (combo === 5 || combo === 10 || combo === 15) {
    agregarTexto(canvas.width / 2, canvas.height / 2 - 40, `¡Combo x${mult}!`, '#e07b00', 22, 1.2);
  }
  actualizarHud();
}

function multiplicador() {
  if (combo >= 15) return 4;
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  return 1;
}

function perderVida() {
  vidas--;
  actualizarHud();
  if (vidas <= 0) {
    gameOver();
  }
}

// --- Efectos visuales ---

function explotar(x, y, color, cantidad) {
  for (let i = 0; i < cantidad; i++) {
    const ang = Math.random() * Math.PI * 2;
    const vel = 80 + Math.random() * 160;
    particulas.push({ x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 120, vida: 0.6, color });
  }
}

function agregarTexto(x, y, texto, color, size = 16, vida = 0.8) {
  textos.push({ x, y, texto, color, size, vida, vidaMax: vida });
}

// --- Dibujo ---

function dibujar() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (sacudida > 0) {
    const f = sacudida * 20;
    ctx.translate((Math.random() - 0.5) * f, (Math.random() - 0.5) * f);
  }

  if (efectos.lento > 0) {
    ctx.fillStyle = 'rgba(120, 170, 255, 0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  dibujarAvisos();
  dibujarCanasta();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const o of objetos) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot);
    ctx.font = `${o.size}px serif`;
    ctx.fillText(o.emoji, 0, 0);
    ctx.restore();
  }

  for (const p of particulas) {
    ctx.globalAlpha = Math.max(0, p.vida / 0.6);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const tx of textos) {
    ctx.globalAlpha = Math.max(0, tx.vida / tx.vidaMax);
    ctx.fillStyle = tx.color;
    ctx.font = `bold ${tx.size}px Arial, sans-serif`;
    ctx.fillText(tx.texto, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;

  dibujarEfectosActivos();
  ctx.restore();
}

function dibujarAvisos() {
  for (const a of avisos) {
    const parpadeo = Math.floor(a.t * 10) % 2 === 0;
    if (!parpadeo) continue;
    ctx.fillStyle = 'rgba(220, 40, 60, 0.15)';
    ctx.fillRect(a.x - 18, 0, 36, canvas.height);
    ctx.fillStyle = '#dc283c';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('!', a.x, 6);
  }
}

function dibujarCanasta() {
  const ancho = anchoCanasta();
  const y = canvas.height - CANASTA_H - 10;
  const x = canastaX - ancho / 2;
  ctx.fillStyle = efectos.grande > 0 ? '#3a7bd5' : '#D4537E';
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, CANASTA_H, 10);
  ctx.fill();

  ctx.font = '18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🫳', canastaX, y + CANASTA_H / 2);
}

function dibujarEfectosActivos() {
  let y = 14;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 13px Arial, sans-serif';
  for (const k of ['lento', 'grande']) {
    if (efectos[k] <= 0) continue;
    ctx.fillStyle = '#3a7bd5';
    ctx.fillText(`${POWERUPS[k].emoji} ${Math.ceil(efectos[k])}s`, 10, y);
    y += 20;
  }
}

function dibujarPausa() {
  ctx.fillStyle = 'rgba(255, 228, 239, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#c0396e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('Pausa', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = '14px Arial, sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('Pulsa P para seguir', canvas.width / 2, canvas.height / 2 + 20);
}

// --- HUD y récord ---

function actualizarHud() {
  document.getElementById('vidas-txt').textContent = '🐾'.repeat(Math.max(0, vidas));
  document.getElementById('nivel-txt').textContent =
    `Nivel ${nivel}` + (multiplicador() > 1 ? ` · x${multiplicador()}` : '');
  document.getElementById('puntos-txt').textContent = `${puntos} pts`;
}

function leerRecord() {
  try {
    return parseInt(localStorage.getItem('dayana-record'), 10) || 0;
  } catch (e) {
    return 0;
  }
}

function guardarRecord(valor) {
  try {
    localStorage.setItem('dayana-record', String(valor));
  } catch (e) {
    // sin almacenamiento disponible: el récord solo dura esta partida
  }
}

function mostrarRecordInicio() {
  document.getElementById('record-inicio').textContent = record > 0 ? `Récord: ${record} pts` : '';
}

function gameOver() {
  jugando = false;
  cancelAnimationFrame(animId);

  const nuevoRecord = puntos > record;
  if (nuevoRecord) {
    record = puntos;
    guardarRecord(record);
  }

  document.getElementById('hud').style.display = 'none';
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';
  document.getElementById('overlay-sub').textContent =
    `Lograste ${puntos} puntos · Nivel ${nivel} · Mejor combo ${mejorCombo}`;
  document.getElementById('overlay-record').textContent =
    nuevoRecord ? '¡Nuevo récord!' : `Récord: ${record} pts`;
  mostrarRecordInicio();
}
