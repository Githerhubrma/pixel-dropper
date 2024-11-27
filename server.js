const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuration
const GRID_SIZE = 350;

// Servir les fichiers statiques
app.use(express.static('public'));

// État du jeu
let gameState = {
    grid: {},
    players: new Map()
};

// Chemin de la base de données
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/var/data/game.db'
    : path.join(__dirname, 'game.db');

// Créer une nouvelle instance de la base de données
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
        process.exit(1);
    }
    console.log('Connecté à la base de données SQLite');
});

// Initialiser la base de données et charger les pixels existants
db.serialize(() => {
    // Activer les foreign keys et le mode WAL pour de meilleures performances
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');

    // Créer la table des pixels si elle n'existe pas
    db.run(`CREATE TABLE IF NOT EXISTS pixels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        color TEXT NOT NULL,
        player_name TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(x, y)
    )`, (err) => {
        if (err) {
            console.error('Erreur lors de la création de la table:', err);
            return;
        }
        console.log('Table pixels créée ou déjà existante');

        // Charger les pixels existants
        db.all('SELECT x, y, color FROM pixels', [], (err, rows) => {
            if (err) {
                console.error('Erreur lors du chargement des pixels:', err);
                return;
            }
            rows.forEach(row => {
                gameState.grid[`${row.x},${row.y}`] = row.color;
            });
            console.log(`${rows.length} pixels chargés de la base de données`);
        });
    });
});

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
    console.log('Un joueur s\'est connecté');

    // Fonction pour mettre à jour le nombre de joueurs
    const updatePlayerCount = () => {
        io.emit('playerCount', gameState.players.size);
    };

    socket.on('join', (playerName) => {
        gameState.players.set(socket.id, { name: playerName });
        // Envoyer l'état complet du jeu au nouveau joueur
        socket.emit('gameState', {
            grid: gameState.grid
        });
        updatePlayerCount();
    });

    socket.on('placePixel', (data) => {
        const player = gameState.players.get(socket.id);
        if (player && data.x >= 0 && data.x < GRID_SIZE && data.y >= 0 && data.y < GRID_SIZE) {
            const cellKey = `${data.x},${data.y}`;
            
            // Mettre à jour ou insérer le pixel dans la base de données
            const query = `
                INSERT OR REPLACE INTO pixels (x, y, color, player_name)
                VALUES (?, ?, ?, ?)
            `;
            
            db.run(query, [data.x, data.y, data.color, player.name], (err) => {
                if (err) {
                    console.error('Erreur lors de la sauvegarde du pixel:', err);
                    return;
                }
                
                // Mettre à jour l'état du jeu et informer les clients seulement si la sauvegarde a réussi
                gameState.grid[cellKey] = data.color;
                io.emit('pixelUpdate', {
                    x: data.x,
                    y: data.y,
                    color: data.color
                });
                
                console.log(`Pixel placé par ${player.name} à (${data.x}, ${data.y})`);
            });
        }
    });

    socket.on('disconnect', () => {
        gameState.players.delete(socket.id);
        console.log('Un joueur s\'est déconnecté');
        updatePlayerCount();
    });
});

// Gérer la fermeture propre de la base de données
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Erreur lors de la fermeture de la base de données:', err);
        } else {
            console.log('Base de données fermée');
        }
        process.exit(err ? 1 : 0);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
