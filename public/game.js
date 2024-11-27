const socket = io();

// Configuration
const CELL_SIZE = 50;
const VISIBLE_CELLS = 20;
const GRID_SIZE = 500;
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 5;
const GRID_LEVELS = [
    { zoom: 0.02, size: 100 },
    { zoom: 0.05, size: 50 },
    { zoom: 0.1, size: 40 },
    { zoom: 0.2, size: 20 },
    { zoom: 0.5, size: 10 },
    { zoom: 1, size: 4 }
];

const COLORS = [
    '#FF0000', // Rouge
    '#00FF00', // Vert
    '#0000FF', // Bleu
    '#FFFF00', // Jaune
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#000000', // Noir
    '#FFFFFF', // Blanc
    '#FFA500', // Orange
    '#255142',
    '#800080'  // Violet
];

// Variables globales
let currentColor = COLORS[0];
let canvas, ctx;
let viewportX = 0;
let viewportY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let zoom = 1;
let isPlacingPixel = false;
let moveMode = false;
let moveTimeout = null;
let moveStartX = 0;
let moveStartY = 0;

// Variables pour les statistiques
let totalPixels = GRID_SIZE * GRID_SIZE;
let placedPixels = 0;
let remainingPixels = totalPixels;
let remainingPlayers = 1;

// Variables pour la gestion tactile
let lastTouchX = 0;
let lastTouchY = 0;
let isTouching = false;

// Éléments DOM
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const startButton = document.getElementById('start-button');
const playerNameDisplay = document.getElementById('player-name-display');
const colorPalette = document.getElementById('color-palette');
const moveToggle = document.getElementById('move-toggle');

// Initialisation
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Gestionnaires d'événements de la souris
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Gestionnaires d'événements tactiles
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    
    // Gestionnaire du bouton de démarrage
    startButton.addEventListener('click', startGame);
    
    // Gestionnaire du mode déplacement
    document.getElementById('move-toggle').addEventListener('change', (e) => {
        moveMode = e.target.checked;
        canvas.style.cursor = moveMode ? 'grab' : 'pointer';
    });

    // Créer la palette de couleurs
    createColorPalette();
    
    // Redimensionner le canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Démarrer la boucle de dessin
    draw();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 60;
    draw();
}

// Gestion des couleurs
function createColorPalette() {
    COLORS.forEach((color, index) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option' + (index === 0 ? ' selected' : '');
        colorOption.style.backgroundColor = color;
        colorOption.addEventListener('click', () => selectColor(color, colorOption));
        colorPalette.appendChild(colorOption);
    });
}

function selectColor(color, element) {
    currentColor = color;
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
    });
    element.classList.add('selected');
}

// Gestion des événements de la souris
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    lastMouseX = mouseX;
    lastMouseY = mouseY;

    // Clic droit pour le déplacement rapide
    if (e.button === 2) {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
        return;
    }

    // Mode déplacement avec clic gauche
    if (moveMode && e.button === 0) {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
        return;
    }

    // Mode placement de pixel avec clic gauche
    if (!moveMode && e.button === 0) {
        canvas.style.cursor = 'pointer';
        const gridX = Math.floor((mouseX / zoom + viewportX) / CELL_SIZE);
        const gridY = Math.floor((mouseY / zoom + viewportY) / CELL_SIZE);

        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            isPlacingPixel = true;
            const cellKey = `${gridX},${gridY}`;
            if (gameState.grid[cellKey] !== currentColor) {
                socket.emit('placePixel', {
                    x: gridX,
                    y: gridY,
                    color: currentColor
                });
            }
        }
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Déplacement de la vue (drag)
    if (isDragging) {
        viewportX -= (mouseX - lastMouseX) / zoom;
        viewportY -= (mouseY - lastMouseY) / zoom;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        draw();
        return;
    }

    // Placement continu de pixels
    if (!moveMode && isPlacingPixel && e.buttons === 1) {
        canvas.style.cursor = 'pointer';
        const gridX = Math.floor((mouseX / zoom + viewportX) / CELL_SIZE);
        const gridY = Math.floor((mouseY / zoom + viewportY) / CELL_SIZE);
        
        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            const cellKey = `${gridX},${gridY}`;
            if (gameState.grid[cellKey] !== currentColor) {
                socket.emit('placePixel', {
                    x: gridX,
                    y: gridY,
                    color: currentColor
                });
                
                // Mise à jour locale immédiate pour les statistiques
                if (!gameState.grid[cellKey]) {
                    placedPixels++;
                    remainingPixels = totalPixels - placedPixels;
                    updateStats();
                }
                gameState.grid[cellKey] = currentColor;
                draw();
            }
        }
    } else if (!isDragging && !moveMode) {
        canvas.style.cursor = 'pointer';
    }
}

function handleMouseUp(e) {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = moveMode ? 'grab' : 'pointer';
    }
    isPlacingPixel = false;
}

function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = viewportX + mouseX / zoom;
    const worldY = viewportY + mouseY / zoom;
    
    zoom *= zoomFactor;
    zoom = Math.max(MIN_ZOOM, Math.min(zoom, MAX_ZOOM));
    
    viewportX = worldX - mouseX / zoom;
    viewportY = worldY - mouseY / zoom;
    
    draw();
}

// Gestion des événements tactiles
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    lastTouchX = touch.clientX - rect.left;
    lastTouchY = touch.clientY - rect.top;
    isTouching = true;

    if (!moveMode) {
        // Placement immédiat du premier pixel
        const touchX = lastTouchX;
        const touchY = lastTouchY;
        const gridX = Math.floor((touchX / zoom + viewportX) / CELL_SIZE);
        const gridY = Math.floor((touchY / zoom + viewportY) / CELL_SIZE);
        
        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            const cellKey = `${gridX},${gridY}`;
            if (gameState.grid[cellKey] !== currentColor) {
                socket.emit('placePixel', {
                    x: gridX,
                    y: gridY,
                    color: currentColor
                });
                
                if (!gameState.grid[cellKey]) {
                    placedPixels++;
                    remainingPixels = totalPixels - placedPixels;
                    updateStats();
                }
                gameState.grid[cellKey] = currentColor;
                draw();
            }
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!isTouching) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    if (moveMode) {
        // Mode déplacement
        viewportX -= (touchX - lastTouchX) / zoom;
        viewportY -= (touchY - lastTouchY) / zoom;
        draw();
    } else {
        // Mode placement de pixels
        const gridX = Math.floor((touchX / zoom + viewportX) / CELL_SIZE);
        const gridY = Math.floor((touchY / zoom + viewportY) / CELL_SIZE);
        
        if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
            const cellKey = `${gridX},${gridY}`;
            if (gameState.grid[cellKey] !== currentColor) {
                socket.emit('placePixel', {
                    x: gridX,
                    y: gridY,
                    color: currentColor
                });
                
                if (!gameState.grid[cellKey]) {
                    placedPixels++;
                    remainingPixels = totalPixels - placedPixels;
                    updateStats();
                }
                gameState.grid[cellKey] = currentColor;
                draw();
            }
        }
    }

    lastTouchX = touchX;
    lastTouchY = touchY;
}

function handleTouchEnd(e) {
    e.preventDefault();
    isTouching = false;
}

// Gestion du zoom tactile
function handleTouchZoom(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dist = Math.hypot(
            touch1.clientX - touch2.clientX,
            touch1.clientY - touch2.clientY
        );

        if (this.lastDist) {
            const delta = this.lastDist - dist;
            const zoomFactor = delta > 0 ? 0.95 : 1.05;
            
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = centerX - rect.left;
            const mouseY = centerY - rect.top;
            
            const worldX = (mouseX / zoom) + viewportX;
            const worldY = (mouseY / zoom) + viewportY;
            
            zoom *= zoomFactor;
            zoom = Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
            
            viewportX = worldX - (mouseX / zoom);
            viewportY = worldY - (mouseY / zoom);
            
            draw();
        }
        this.lastDist = dist;
    }
}

// Dessin
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculer les cellules visibles
    const startX = Math.max(0, Math.floor(viewportX / CELL_SIZE));
    const startY = Math.max(0, Math.floor(viewportY / CELL_SIZE));
    const endX = Math.min(Math.ceil((viewportX + canvas.width / zoom) / CELL_SIZE), GRID_SIZE);
    const endY = Math.min(Math.ceil((viewportY + canvas.height / zoom) / CELL_SIZE), GRID_SIZE);
    
    // Trouver le niveau de grille approprié
    let gridLevel = GRID_LEVELS[0];
    for (let level of GRID_LEVELS) {
        if (zoom >= level.zoom) {
            gridLevel = level;
            break;
        }
    }
    
    // Dessiner la grille adaptative
    const gridSize = gridLevel.size;
    const gridOpacity = Math.min(0.3, zoom * 2);
    ctx.strokeStyle = `rgba(150, 150, 150, ${gridOpacity})`;
    ctx.lineWidth = Math.max(0.5, zoom);
    
    // Calculer les limites de la grille adaptative
    const gridStartX = Math.floor(viewportX / (CELL_SIZE * gridSize)) * gridSize;
    const gridStartY = Math.floor(viewportY / (CELL_SIZE * gridSize)) * gridSize;
    const gridEndX = Math.ceil((viewportX + canvas.width / zoom) / (CELL_SIZE * gridSize)) * gridSize;
    const gridEndY = Math.ceil((viewportY + canvas.height / zoom) / (CELL_SIZE * gridSize)) * gridSize;
    
    // Dessiner les lignes de la grille
    for (let x = gridStartX; x <= gridEndX; x += gridSize) {
        if (x >= 0 && x <= GRID_SIZE) {
            const screenX = (x * CELL_SIZE - viewportX) * zoom;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        }
    }
    
    for (let y = gridStartY; y <= gridEndY; y += gridSize) {
        if (y >= 0 && y <= GRID_SIZE) {
            const screenY = (y * CELL_SIZE - viewportY) * zoom;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(canvas.width, screenY);
            ctx.stroke();
        }
    }
    
    // Dessiner les cellules
    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            const screenX = (x * CELL_SIZE - viewportX) * zoom;
            const screenY = (y * CELL_SIZE - viewportY) * zoom;
            const cellSize = CELL_SIZE * zoom;
            
            // Dessiner le contour de chaque case
            const borderOpacity = Math.min(1, Math.max(0.15, zoom * 0.5));
            ctx.strokeStyle = `rgba(180, 180, 180, ${borderOpacity})`;
            ctx.lineWidth = Math.max(0.5, zoom * 0.5);
            ctx.strokeRect(screenX, screenY, cellSize, cellSize);
            
            // Remplir si colorée
            const cellKey = `${x},${y}`;
            const color = gameState.grid[cellKey];
            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(screenX, screenY, cellSize, cellSize);
            }
        }
    }
}

// Gestion du jeu
function startGame() {
    const playerName = playerNameInput.value.trim();
    if (playerName) {
        loginScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        playerNameDisplay.textContent = playerName;
        
        // Émettre l'événement correct pour rejoindre la partie
        socket.emit('join', playerName);
        
        // Initialiser les statistiques
        placedPixels = Object.keys(gameState.grid).length;
        remainingPixels = totalPixels - placedPixels;
        updateStats();
    }
}

// Fonction pour mettre à jour les statistiques dans l'interface
function updateStats() {
    const placedPercent = ((placedPixels / totalPixels) * 100).toFixed(1);
    const remainingPercent = ((remainingPixels / totalPixels) * 100).toFixed(1);
    
    document.getElementById('pixels-placed').textContent = placedPixels;
    document.getElementById('pixels-placed-percent').textContent = placedPercent;
    document.getElementById('pixels-remaining').textContent = remainingPixels;
    document.getElementById('pixels-remaining-percent').textContent = remainingPercent;
    document.getElementById('players-remaining').textContent = remainingPlayers;
}

// Gestion des événements Socket.IO
let gameState = {
    grid: {}
};

socket.on('gameState', (state) => {
    console.log('État du jeu reçu:', state);
    gameState.grid = state.grid || {};
    placedPixels = Object.keys(gameState.grid).length;
    remainingPixels = totalPixels - placedPixels;
    updateStats();
    draw();
});

socket.on('pixelUpdate', (data) => {
    console.log('Mise à jour de pixel reçue:', data);
    const cellKey = `${data.x},${data.y}`;
    
    // Vérifier si c'est un nouveau pixel
    if (!gameState.grid[cellKey]) {
        placedPixels++;
        remainingPixels = totalPixels - placedPixels;
    }
    
    gameState.grid[cellKey] = data.color;
    updateStats();
    draw();
});

// Supprimer l'événement pixelPlaced car nous utilisons pixelUpdate
socket.off('pixelPlaced');

socket.on('playerCount', (count) => {
    remainingPlayers = count;
    updateStats(); // Mettre à jour les statistiques
});

// Initialiser le jeu au chargement
window.addEventListener('load', init);
