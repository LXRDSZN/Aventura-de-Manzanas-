const AudioFX = {
	ctx: null,
	init() {
		if (!this.ctx) {
			this.ctx = new (window.AudioContext || window.webkitAudioContext)();
		}
		if (this.ctx.state === 'suspended') this.ctx.resume();
	},
	tone(type, startFrequency, endFrequency, duration, volume) {
		if (!this.ctx) return;
		const oscillator = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		const now = this.ctx.currentTime;
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(startFrequency, now);
		oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
		gain.gain.setValueAtTime(volume, now);
		gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
		oscillator.connect(gain);
		gain.connect(this.ctx.destination);
		oscillator.start(now);
		oscillator.stop(now + duration);
	},
	playCollect() { this.tone('triangle', 523.25, 1046.5, 0.15, 0.2); },
	playJump() { this.tone('square', 150, 400, 0.12, 0.1); },
	playHurt() { this.tone('sawtooth', 200, 60, 0.25, 0.25); },
	playGolden() {
		[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
			window.setTimeout(() => this.tone('sine', frequency, frequency, 0.1, 0.15), index * 50);
		});
	},
	playGameOver() {
		[300, 250, 200, 150].forEach((frequency, index) => {
			window.setTimeout(() => this.tone('sawtooth', frequency, frequency, 0.15, 0.2), index * 120);
		});
	}
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScore = document.getElementById('final-score');
const highScoreLabel = document.getElementById('high-score');

let isRunning = false;
let score = 0;
let lives = 3;
let highScore = Number(localStorage.getItem('manzanas_highscore') || 0);
let gameFrame = 0;
let apples = [];
let enemies = [];
let lastTime = 0;
let appleTimer = 0;
let enemyTimer = 0;

const keys = { left: false, right: false, jump: false };
const platforms = [
	{ x: 0, y: 470, w: 400, h: 80, color: '#38a169', topColor: '#48bb78' },
	{ x: 30, y: 370, w: 120, h: 20, color: '#2f855a', topColor: '#38a169' },
	{ x: 250, y: 370, w: 120, h: 20, color: '#2f855a', topColor: '#38a169' },
	{ x: 140, y: 260, w: 120, h: 20, color: '#2f855a', topColor: '#38a169' },
	{ x: 20, y: 150, w: 100, h: 20, color: '#2f855a', topColor: '#38a169' },
	{ x: 280, y: 150, w: 100, h: 20, color: '#2f855a', topColor: '#38a169' }
];

const player = {
	x: 180, y: 400, width: 32, height: 42, vx: 0, vy: 0,
	speed: 4, jumpPower: -9.5, gravity: 0.45, grounded: false, facingRight: true,
	reset() { this.x = 180; this.y = 400; this.vx = 0; this.vy = 0; },
	update() {
		if (keys.left) { this.vx = -this.speed; this.facingRight = false; }
		else if (keys.right) { this.vx = this.speed; this.facingRight = true; }
		else this.vx *= 0.7;
		if (keys.jump && this.grounded) {
			this.vy = this.jumpPower;
			this.grounded = false;
			keys.jump = false;
			AudioFX.playJump();
		}
		this.vy += this.gravity;
		this.x += this.vx;
		this.y += this.vy;
		this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
		this.grounded = false;
		platforms.forEach((platform) => {
			const overlaps = this.x + this.width - 6 > platform.x && this.x + 6 < platform.x + platform.w;
			const lands = this.y + this.height >= platform.y && this.y + this.height - this.vy <= platform.y + 10;
			if (overlaps && lands && this.vy >= 0) {
				this.y = platform.y - this.height;
				this.vy = 0;
				this.grounded = true;
			}
		});
	},
	draw(targetCtx = ctx) {
		targetCtx.save();
		targetCtx.translate(this.facingRight ? this.x : this.x + this.width, this.y);
		if (!this.facingRight) targetCtx.scale(-1, 1);
		const px = 2;
		targetCtx.fillStyle = 'rgba(0,0,0,0.2)';
		targetCtx.beginPath();
		targetCtx.ellipse(16, 40, 12, 4, 0, 0, Math.PI * 2);
		targetCtx.fill();
		targetCtx.fillStyle = '#2d3748';
		targetCtx.fillRect(5 * px, 16 * px, 2.5 * px, 5 * px);
		targetCtx.fillRect(8.5 * px, 16 * px, 2.5 * px, 5 * px);
		targetCtx.fillStyle = '#e2e8f0';
		targetCtx.fillRect(4 * px, 19.5 * px, 3.5 * px, 1.5 * px);
		targetCtx.fillRect(8.5 * px, 19.5 * px, 3.5 * px, 1.5 * px);
		targetCtx.fillStyle = '#fff';
		targetCtx.fillRect(5 * px, 10 * px, 6 * px, 7 * px);
		targetCtx.fillStyle = '#1a202c';
		targetCtx.fillRect(3.5 * px, 10 * px, 2 * px, 7 * px);
		targetCtx.fillRect(10.5 * px, 10 * px, 2 * px, 7 * px);
		targetCtx.fillStyle = '#38bdf8';
		targetCtx.fillRect(3 * px, 2 * px, 10 * px, 9 * px);
		targetCtx.fillStyle = '#f6d0b1';
		targetCtx.fillRect(4.5 * px, 3.5 * px, 7 * px, 5.5 * px);
		targetCtx.fillStyle = '#1e293b';
		targetCtx.fillRect(8 * px, 4.5 * px, 1.5 * px, 2 * px);
		targetCtx.fillRect(10 * px, 4.5 * px, 1.5 * px, 2 * px);
		targetCtx.fillStyle = '#92400e';
		targetCtx.fillRect(7.5 * px, 6.2 * px, 3.5 * px, 2.2 * px);
		targetCtx.fillStyle = '#1a202c';
		targetCtx.fillRect(3 * px, 1 * px, 10 * px, 2.5 * px);
		targetCtx.fillRect(2.5 * px, 2 * px, 2 * px, 8 * px);
		targetCtx.fillRect(11.5 * px, 2 * px, 2 * px, 8 * px);
		targetCtx.fillStyle = '#92400e';
		targetCtx.fillRect(1 * px, 1.5 * px, 3.5 * px, 4.5 * px);
		targetCtx.fillRect(11.5 * px, 1.5 * px, 3.5 * px, 4.5 * px);
		targetCtx.fillStyle = '#f472b6';
		targetCtx.fillRect(2 * px, 2.5 * px, 1.5 * px, 2.5 * px);
		targetCtx.fillRect(12.5 * px, 2.5 * px, 1.5 * px, 2.5 * px);
		targetCtx.restore();
	}
};

function spawnApple() {
	const platform = platforms[Math.floor(Math.random() * platforms.length)];
	apples.push({ x: platform.x + 10 + Math.random() * (platform.w - 20), y: -20,
		targetY: platform.y - 18, vy: 2 + Math.random() * 2, type: Math.random() < 0.15 ? 'golden' : 'red', size: 16 });
}

function spawnEnemy() {
	const platform = platforms[1 + Math.floor(Math.random() * (platforms.length - 1))];
	if (Math.random() < 0.4) {
		enemies.push({ type: 'rotten', x: Math.random() * (canvas.width - 20), y: -20,
			vx: (Math.random() - 0.5) * 2, vy: 2.5 + Math.random() * 2, size: 18 });
	} else {
		enemies.push({ type: 'worm', x: platform.x + 10, y: platform.y - 12, vx: 1.2,
			minX: platform.x, maxX: platform.x + platform.w - 16, size: 14 });
	}
}

function drawApple(apple) {
	ctx.save(); ctx.translate(apple.x, apple.y);
	if (apple.type === 'golden') {
		ctx.fillStyle = 'rgba(254, 240, 138, 0.4)'; ctx.beginPath(); ctx.arc(8, 8, 12, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#facc15';
	} else ctx.fillStyle = '#dc2626';
	ctx.fillRect(2, 4, 12, 11); ctx.fillRect(4, 2, 8, 14);
	ctx.fillStyle = apple.type === 'golden' ? '#fef08a' : '#fca5a5'; ctx.fillRect(4, 4, 3, 3);
	ctx.fillStyle = '#78350f'; ctx.fillRect(7, 0, 2, 3);
	ctx.fillStyle = '#16a34a'; ctx.fillRect(9, 1, 3, 2); ctx.restore();
}

function drawEnemy(enemy) {
	ctx.save(); ctx.translate(enemy.x, enemy.y);
	if (enemy.type === 'worm') {
		ctx.fillStyle = '#fb923c'; ctx.fillRect(0, 4, 14, 8); ctx.fillRect(2, 2, 4, 10);
		ctx.fillStyle = '#000'; ctx.fillRect(10, 5, 2, 2);
		ctx.fillStyle = '#ef4444'; ctx.fillRect(2, 0, 2, 3);
	} else {
		ctx.fillStyle = '#713f12'; ctx.fillRect(2, 4, 12, 11); ctx.fillRect(4, 2, 8, 14);
		ctx.fillStyle = '#3f2208'; ctx.fillRect(8, 6, 5, 5);
		ctx.fillStyle = '#ef4444'; ctx.fillRect(3, 5, 2, 2); ctx.fillRect(11, 5, 2, 2);
	}
	ctx.restore();
}

function drawScene() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = '#7dd3fc'; ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = 'rgba(255,255,255,0.45)';
	for (let index = 0; index < 5; index++) ctx.fillRect((index * 97 + 20) % 380, 40 + (index % 3) * 35, 42, 8);
	platforms.forEach((platform) => {
		ctx.fillStyle = platform.color; ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
		ctx.fillStyle = platform.topColor; ctx.fillRect(platform.x, platform.y, platform.w, 5);
	});
	apples.forEach(drawApple); enemies.forEach(drawEnemy); player.draw();
	ctx.fillStyle = '#1e293b'; ctx.font = '12px "Press Start 2P"';
	ctx.fillText(`PUNTOS: ${score}`, 12, 24); ctx.fillText(`VIDAS: ${lives}`, 280, 24);
}

function overlaps(first, second, size) {
	return first.x < second.x + size && first.x + first.width > second.x && first.y < second.y + size && first.y + first.height > second.y;
}

function loseLife() {
	lives -= 1; player.reset(); AudioFX.playHurt();
	if (lives <= 0) endGame();
}

function update(delta) {
	gameFrame += delta; appleTimer += delta; enemyTimer += delta; player.update();
	if (appleTimer > 900) { appleTimer = 0; spawnApple(); }
	if (enemyTimer > 1500) { enemyTimer = 0; spawnEnemy(); }
	apples.forEach((apple) => { if (apple.y < apple.targetY) apple.y += apple.vy; });
	enemies.forEach((enemy) => {
		if (enemy.type === 'worm') { enemy.x += enemy.vx; if (enemy.x <= enemy.minX || enemy.x >= enemy.maxX) enemy.vx *= -1; }
		else { enemy.x += enemy.vx; enemy.y += enemy.vy; }
	});
	apples = apples.filter((apple) => {
		if (overlaps(player, apple, apple.size)) {
			score += apple.type === 'golden' ? 25 : 10;
			apple.type === 'golden' ? AudioFX.playGolden() : AudioFX.playCollect();
			return false;
		}
		return apple.y < canvas.height + 20;
	});
	enemies = enemies.filter((enemy) => {
		if (overlaps(player, enemy, enemy.size)) { loseLife(); return false; }
		return enemy.y < canvas.height + 30;
	});
}

function endGame() {
	isRunning = false; highScore = Math.max(highScore, score);
	localStorage.setItem('manzanas_highscore', highScore);
	finalScore.textContent = score; highScoreLabel.textContent = highScore;
	gameOverScreen.classList.remove('hidden'); AudioFX.playGameOver();
}

function startGame() {
	AudioFX.init(); isRunning = true; score = 0; lives = 3; apples = []; enemies = [];
	player.reset(); startScreen.classList.add('hidden'); gameOverScreen.classList.add('hidden');
	lastTime = performance.now();
	window.requestAnimationFrame(frame);
}

function frame(timestamp) {
	const delta = Math.min(timestamp - lastTime || 16, 50); lastTime = timestamp;
	if (isRunning) update(delta);
	drawScene();
	if (isRunning) window.requestAnimationFrame(frame);
}

function bindHoldButton(id, key) {
	const button = document.getElementById(id);
	const setKey = (value) => { keys[key] = value; };
	button.addEventListener('pointerdown', () => setKey(true));
	['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => button.addEventListener(eventName, () => setKey(false)));
}

window.addEventListener('keydown', (event) => {
	if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') keys.left = true;
	if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') keys.right = true;
	if (event.key === 'ArrowUp' || event.key === ' ') { keys.jump = true; event.preventDefault(); }
});
window.addEventListener('keyup', (event) => {
	if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') keys.left = false;
	if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') keys.right = false;
});
bindHoldButton('btn-left', 'left'); bindHoldButton('btn-right', 'right');
document.getElementById('btn-jump').addEventListener('pointerdown', () => { keys.jump = true; });
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

highScoreLabel.textContent = highScore;
player.draw(previewCtx);
drawScene();
window.requestAnimationFrame(frame);
