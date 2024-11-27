const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Chemin vers la base de données
const DB_PATH = path.join(__dirname, 'game.db');

// Fonction pour réinitialiser la base de données
function resetDatabase() {
    console.log('Connexion à la base de données...');
    const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Erreur de connexion à la base de données:', err);
            process.exit(1);
        }

        console.log('Début de la réinitialisation...');
        db.serialize(() => {
            // Désactiver les contraintes de clé étrangère temporairement
            db.run('PRAGMA foreign_keys = OFF', (err) => {
                if (err) {
                    console.error('Erreur lors de la désactivation des clés étrangères:', err);
                    return;
                }

                // Supprimer la table existante
                db.run('DROP TABLE IF EXISTS pixels', (err) => {
                    if (err) {
                        console.error('Erreur lors de la suppression de la table:', err);
                        return;
                    }
                    console.log('Ancienne table supprimée');

                    // Recréer la table
                    db.run(`CREATE TABLE pixels (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        x INTEGER NOT NULL,
                        y INTEGER NOT NULL,
                        color TEXT NOT NULL,
                        player_name TEXT NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(x, y)
                    )`, (err) => {
                        if (err) {
                            console.error('Erreur lors de la création de la nouvelle table:', err);
                            return;
                        }
                        console.log('Nouvelle table créée');

                        // Réactiver les contraintes de clé étrangère
                        db.run('PRAGMA foreign_keys = ON', (err) => {
                            if (err) {
                                console.error('Erreur lors de la réactivation des clés étrangères:', err);
                            }

                            // Fermer la connexion
                            db.close((err) => {
                                if (err) {
                                    console.error('Erreur lors de la fermeture de la base de données:', err);
                                    process.exit(1);
                                }
                                console.log('Base de données réinitialisée avec succès !');
                                console.log('Redémarrez le serveur pour voir les changements.');
                            });
                        });
                    });
                });
            });
        });
    });
}

// Exécuter la réinitialisation
resetDatabase();
