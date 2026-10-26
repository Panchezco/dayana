const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let puntos = 0;
let vidas = 3;
let objetos = [];
let animId = null;
let jugando = false;
let mouseX = 200;

const CANASTA_W = 60;
const CANASTA_H = 20;

function iniciar() {
  document.getElementById('inicio').style.display = 'none';
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('overlay').style.display = 'none';
  canvas.style.display = 'block';

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  puntos = 0;
  vidas = 3;
  objetos = [];
  jugando = true;

  actualizarHud();
  canvas.addEventListener('mousemove', moverMouse);
  canvas.addEventListener('touchmove', moverTouch, { passive: false });

  spawnLoop();
  gameLoop();
}

function reiniciar() {
  iniciar();
}

function moverMouse(e) {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
}

function moverTouch(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  mouseX = e.touches[0].clientX - rect.left;
}

function spawnLoop() {
  if (!jugando) return;
  spawnObjeto();
  setTimeout(spawnLoop, 700 + Math.random() * 500);
}

function spawnObjeto() {
  const esMalo = Math.random() < 0.35;
  const esImposible = esMalo && Math.random() < 0.12;

  objetos.push({
    x: 30 + Math.random() * (canvas.width - 60),
    y: -20,
    emoji: esMalo ? '🍫' : '🥭',
    malo: esMalo,
    speed: esImposible ? 32 : esMalo ? 5 + Math.random() * 4 : 2 + Math.random() * 1.5,
    size: esImposible ? 32 : esMalo ? 28 : 26,
  });
}

function gameLoop() {
  if (!jugando) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  dibujarCanasta();

  for (let i = objetos.length - 1; i >= 0; i--) {
    const o = objetos[i];
    o.y += o.speed;

    ctx.font = `${o.size}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(o.emoji, o.x, o.y);

    const canastaY = canvas.height - CANASTA_H - 10;
    const canastaX = mouseX - CANASTA_W / 2;

    const golpea =
      o.y + o.size / 2 >= canastaY &&
      o.y - o.size / 2 <= canastaY + CANASTA_H &&
      o.x >= canastaX &&
      o.x <= canastaX + CANASTA_W;

    if (golpea) {
      objetos.splice(i, 1);
      if (o.malo) {
        perderVida();
      } else {
        puntos += 10;
        actualizarHud();
      }
      continue;
    }

    if (o.y > canvas.height + 30) {
      objetos.splice(i, 1);
      if (!o.malo) {
        perderVida();
      }
    }
  }

  animId = requestAnimationFrame(gameLoop);
}

function dibujarCanasta() {
  const y = canvas.height - CANASTA_H - 10;
  const x = mouseX - CANASTA_W / 2;
  ctx.fillStyle = '#D4537E';
  ctx.beginPath();
  ctx.roundRect(x, y, CANASTA_W, CANASTA_H, 10);
  ctx.fill();

  ctx.font = '18px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🫳', mouseX, y + 16);
}

function perderVida() {
  vidas--;
  actualizarHud();
  if (vidas <= 0) {
    gameOver();
  }
}

function actualizarHud() {
  document.getElementById('vidas-txt').textContent = '🐾'.repeat(Math.max(0, vidas));
  document.getElementById('puntos-txt').textContent = `${puntos} pts`;
}

function gameOver() {
  jugando = false;
  cancelAnimationFrame(animId);
  canvas.removeEventListener('mousemove', moverMouse);
  canvas.removeEventListener('touchmove', moverTouch);

  document.getElementById('hud').style.display = 'none';
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';
  document.getElementById('overlay-sub').textContent = `Lograste ${puntos} puntos`;
}