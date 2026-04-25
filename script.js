const COLS = 10;
const ROWS = 20;
const STORAGE_KEY = "codex-tetris-best";

const COLORS = {
  I: "#00a7c8",
  J: "#3767d8",
  L: "#ef8a23",
  O: "#f0c333",
  S: "#2daa65",
  T: "#8b57d9",
  Z: "#d84444",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const scoreEl = document.querySelector("#score");
const linesEl = document.querySelector("#lines");
const levelEl = document.querySelector("#level");
const bestEl = document.querySelector("#best");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const boardCanvas = document.querySelector("#board");
const boardContext = boardCanvas.getContext("2d");
const nextCanvas = document.querySelector("#next");
const nextContext = nextCanvas.getContext("2d");

let board = createBoard();
let bag = [];
let current = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let best = Number(localStorage.getItem(STORAGE_KEY)) || 0;
let dropCounter = 0;
let lastTime = 0;
let paused = false;
let gameOver = false;
let animationFrame = 0;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function nextFromBag() {
  if (bag.length === 0) {
    bag = shuffle(Object.keys(SHAPES));
  }

  return bag.pop();
}

function shuffle(values) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}

function createPiece(type) {
  return {
    type,
    matrix: cloneMatrix(SHAPES[type]),
    row: 0,
    col: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
  };
}

function startGame() {
  board = createBoard();
  bag = [];
  score = 0;
  lines = 0;
  level = 1;
  dropCounter = 0;
  lastTime = 0;
  paused = false;
  gameOver = false;
  nextPiece = nextFromBag();
  spawnPiece();
  updateScore();
  updateOverlay();
  updatePauseButton();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
}

function spawnPiece() {
  current = createPiece(nextPiece);
  nextPiece = nextFromBag();

  if (collides(current)) {
    endGame();
  }
}

function collides(piece, nextRow = piece.row, nextCol = piece.col, nextMatrix = piece.matrix) {
  for (let y = 0; y < nextMatrix.length; y += 1) {
    for (let x = 0; x < nextMatrix[y].length; x += 1) {
      if (!nextMatrix[y][x]) continue;

      const boardY = nextRow + y;
      const boardX = nextCol + x;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }

      if (boardY >= 0 && board[boardY][boardX]) {
        return true;
      }
    }
  }

  return false;
}

function mergePiece() {
  current.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        const boardY = current.row + y;
        const boardX = current.col + x;

        if (boardY >= 0) {
          board[boardY][boardX] = current.type;
        }
      }
    });
  });
}

function sweepLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    const lineScores = [0, 100, 300, 500, 800];
    lines += cleared;
    score += lineScores[cleared] * level;
    level = Math.floor(lines / 10) + 1;
    updateScore();
  }
}

function hardDrop() {
  if (!canPlay()) return;

  let distance = 0;

  while (!collides(current, current.row + 1)) {
    current.row += 1;
    distance += 1;
  }

  score += distance * 2;
  lockPiece();
}

function softDrop() {
  if (!canPlay()) return;

  if (!collides(current, current.row + 1)) {
    current.row += 1;
    score += 1;
    updateScore();
  } else {
    lockPiece();
  }

  dropCounter = 0;
}

function movePiece(direction) {
  if (!canPlay()) return;

  const nextCol = current.col + direction;

  if (!collides(current, current.row, nextCol)) {
    current.col = nextCol;
  }
}

function rotatePiece(direction) {
  if (!canPlay()) return;

  const rotated = rotateMatrix(current.matrix, direction);
  const offsets = [0, -1, 1, -2, 2];

  for (const offset of offsets) {
    if (!collides(current, current.row, current.col + offset, rotated)) {
      current.matrix = rotated;
      current.col += offset;
      return;
    }
  }
}

function rotateMatrix(matrix, direction) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (direction > 0) {
        rotated[x][size - 1 - y] = matrix[y][x];
      } else {
        rotated[size - 1 - x][y] = matrix[y][x];
      }
    }
  }

  return rotated;
}

function lockPiece() {
  mergePiece();
  sweepLines();
  spawnPiece();
  updateScore();
}

function canPlay() {
  return current && !paused && !gameOver;
}

function endGame() {
  gameOver = true;
  paused = false;
  best = Math.max(best, score);
  localStorage.setItem(STORAGE_KEY, String(best));
  updateScore();
  updateOverlay();
  updatePauseButton();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  updateOverlay();
  updatePauseButton();
}

function getDropInterval() {
  return Math.max(90, 720 - (level - 1) * 58);
}

function loop(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += delta;

    if (dropCounter > getDropInterval()) {
      if (!collides(current, current.row + 1)) {
        current.row += 1;
      } else {
        lockPiece();
      }

      dropCounter = 0;
    }
  }

  draw();
  animationFrame = requestAnimationFrame(loop);
}

function draw() {
  resizeCanvasToDisplay(boardCanvas, boardContext);
  resizeCanvasToDisplay(nextCanvas, nextContext);

  const cell = boardCanvas.width / COLS;
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid(boardContext, boardCanvas.width, boardCanvas.height, cell);

  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawCell(boardContext, x, y, cell, COLORS[type]);
    });
  });

  if (current) {
    drawGhost(cell);
    drawPiece(boardContext, current, cell, 1);
  }

  drawPreview(nextContext, nextPiece);
}

function drawGrid(context, width, height, cell) {
  context.fillStyle = "#060913";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(118, 230, 255, 0.08)";
  context.lineWidth = Math.max(1, cell * 0.025);

  for (let x = 0; x <= COLS; x += 1) {
    context.beginPath();
    context.moveTo(x * cell, 0);
    context.lineTo(x * cell, height);
    context.stroke();
  }

  for (let y = 0; y <= ROWS; y += 1) {
    context.beginPath();
    context.moveTo(0, y * cell);
    context.lineTo(width, y * cell);
    context.stroke();
  }
}

function drawPiece(context, piece, cell, alpha) {
  piece.matrix.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (filled) {
        drawCell(context, piece.col + x, piece.row + y, cell, COLORS[piece.type], alpha);
      }
    });
  });
}

function drawGhost(cell) {
  const ghost = {
    ...current,
    matrix: current.matrix,
    row: current.row,
  };

  while (!collides(ghost, ghost.row + 1)) {
    ghost.row += 1;
  }

  drawPiece(boardContext, ghost, cell, 0.22);
}

function drawCell(context, x, y, size, color, alpha = 1) {
  const gap = Math.max(1, size * 0.08);
  const inset = gap / 2;
  const px = x * size + inset;
  const py = y * size + inset;
  const blockSize = size - gap;

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(px, py, blockSize, blockSize);
  context.fillStyle = "rgba(255, 255, 255, 0.24)";
  context.fillRect(px + blockSize * 0.12, py + blockSize * 0.1, blockSize * 0.76, blockSize * 0.18);
  context.fillStyle = "rgba(0, 0, 0, 0.16)";
  context.fillRect(px, py + blockSize * 0.78, blockSize, blockSize * 0.22);
  context.restore();
}

function drawPreview(context, type) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.fillStyle = "#070a16";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);

  if (!type) return;

  const matrix = SHAPES[type];
  const occupied = getMatrixBounds(matrix);
  const width = occupied.maxX - occupied.minX + 1;
  const height = occupied.maxY - occupied.minY + 1;
  const previewSize = Math.min(context.canvas.width, context.canvas.height);
  const cell = Math.floor(Math.min(previewSize / 5, previewSize / (Math.max(width, height) + 1)));
  const offsetX = Math.floor((context.canvas.width - width * cell) / 2) - occupied.minX * cell;
  const offsetY = Math.floor((context.canvas.height - height * cell) / 2) - occupied.minY * cell;

  matrix.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (filled) {
        drawPreviewCell(context, offsetX + x * cell, offsetY + y * cell, cell, COLORS[type]);
      }
    });
  });
}

function drawPreviewCell(context, x, y, size, color) {
  const gap = Math.max(1, size * 0.08);

  context.fillStyle = color;
  context.fillRect(x + gap, y + gap, size - gap * 2, size - gap * 2);
  context.fillStyle = "rgba(255, 255, 255, 0.22)";
  context.fillRect(x + gap * 2, y + gap * 2, size - gap * 4, size * 0.18);
}

function getMatrixBounds(matrix) {
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  matrix.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (filled) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
    });
  });

  return bounds;
}

function resizeCanvasToDisplay(canvas, context) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function updateScore() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines.toLocaleString();
  levelEl.textContent = level.toLocaleString();
  bestEl.textContent = best.toLocaleString();
}

function updateOverlay() {
  if (gameOver) {
    overlayTitle.textContent = "Game Over";
    overlayText.textContent = "";
    overlay.classList.remove("hidden");
    return;
  }

  if (paused) {
    overlayTitle.textContent = "Paused";
    overlayText.textContent = "";
    overlay.classList.remove("hidden");
    return;
  }

  overlay.classList.add("hidden");
}

function updatePauseButton() {
  pauseButton.textContent = paused ? "Resume" : "Pause";
  pauseButton.setAttribute("aria-pressed", String(paused));
}

function handleAction(action) {
  const actions = {
    left: () => movePiece(-1),
    right: () => movePiece(1),
    "soft-drop": softDrop,
    "hard-drop": hardDrop,
    "rotate-left": () => rotatePiece(-1),
    "rotate-right": () => rotatePiece(1),
  };

  actions[action]?.();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && gameOver) {
    startGame();
    return;
  }

  if (event.key.toLowerCase() === "p") {
    togglePause();
    return;
  }

  const keys = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "soft-drop",
    " ": "hard-drop",
    z: "rotate-left",
    Z: "rotate-left",
    ArrowUp: "rotate-right",
    x: "rotate-right",
    X: "rotate-right",
  };

  const action = keys[event.key];

  if (action) {
    event.preventDefault();
    handleAction(action);
  }
});

document.querySelectorAll(".touch-controls button").forEach((button) => {
  button.addEventListener("click", () => {
    handleAction(button.dataset.action);
  });
});

pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", startGame);
window.addEventListener("resize", draw);

bestEl.textContent = best.toLocaleString();
startGame();
