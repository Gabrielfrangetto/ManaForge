const { Sequelize, DataTypes } = require('sequelize');
const mongoose = require('mongoose');

// Conectar ao PostgreSQL
const sequelize = new Sequelize('magic_system', 'postgres', 'password', {
    host: 'localhost',
    dialect: 'postgres',
    logging: console.log // Habilita logs para setup
});

// MongoDB Atlas Connection
const MONGODB_URI = 'mongodb+srv://gfrangetto:wZHnhH3O33ZXFKv1@cluster0.ibfzdd5.mongodb.net/SistemaMagic?retryWrites=true&w=majority&appName=Cluster0';

async function setupDatabase() {
    try {
        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conectado ao PostgreSQL');
        
        // Sincronizar modelos (criar tabelas)
        await sequelize.sync({ force: false }); // force: true recria as tabelas
        console.log('✅ Tabelas criadas/sincronizadas com sucesso');
        
        // Definir modelos (mesmo código do server.js)
        const Player = sequelize.define('Player', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            title: {
                type: DataTypes.STRING,
                defaultValue: 'Planeswalker Iniciante'
            },
            level: {
                type: DataTypes.INTEGER,
                defaultValue: 1
            },
            xp: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            xpToNext: {
                type: DataTypes.INTEGER,
                defaultValue: 300
            },
            manaCoins: {
                type: DataTypes.INTEGER,
                defaultValue: 250
            },
            avatar: {
                type: DataTypes.STRING,
                defaultValue: 'https://via.placeholder.com/120x120/4a5568/ffffff?text=Avatar'
            },
            rankPoints: {
                type: DataTypes.INTEGER,
                defaultValue: 1000
            },
            rank: {
                type: DataTypes.STRING,
                defaultValue: 'Bronze I'
            },
            rankXP: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            rankIcon: {
                type: DataTypes.STRING,
                defaultValue: '🥉'
            },
            totalMatches: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            wins: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            winStreak: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            fastestWin: {
                type: DataTypes.INTEGER,
                defaultValue: 999
            },
            longestMatch: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            commandersStats: {
                type: DataTypes.JSONB,
                defaultValue: {}
            },
            commanders: {
                type: DataTypes.JSONB,
                allowNull: true
            },
            favoriteDecks: {
                type: DataTypes.JSONB,
                defaultValue: {}
            }
        }, {
            tableName: 'players',
            timestamps: true
        });
        
        // Criar índices para performance
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_matches_player_date ON matches("playerId", date DESC);');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_matches_deck_theme ON matches("deckTheme");');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_matches_result ON matches(result);');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_card_cache_name ON card_cache(name);');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_achievements_player ON achievements("playerId", "achievementId");');
        
        console.log('✅ Índices criados com sucesso');
        
        // Criar jogador padrão se não existir
        const existingPlayer = await Player.findOne({
            where: { name: 'Gabriel - Caçador de Dragões' }
        });
        
        if (!existingPlayer) {
            const defaultPlayer = await Player.create({
                name: 'Gabriel - Caçador de Dragões',
                title: 'Planeswalker Iniciante',
                level: 1,
                xp: 150,
                xpToNext: 300,
                manaCoins: 250,
                avatar: 'https://via.placeholder.com/120x120/4a5568/ffffff?text=Avatar',
                rankPoints: 1247,
                rank: 'Bronze II',
                rankIcon: '🥉',
                totalMatches: 62,
                wins: 42,
                winStreak: 7,
                fastestWin: 4,
                longestMatch: 23,
                favoriteDecks: {
                    'Dragões Vermelhos': { wins: 18, total: 24 },
                    'Controle Azul': { wins: 12, total: 20 },
                    'Aggro Branco': { wins: 8, total: 12 },
                    'Combo Verde': { wins: 4, total: 6 }
                }
            });
            
            console.log('✅ Jogador padrão criado:', defaultPlayer.name);
        } else {
            console.log('ℹ️ Jogador padrão já existe');
        }
        
        console.log('🎉 Configuração do banco de dados concluída!');
        
    } catch (error) {
        console.error('❌ Erro na configuração do banco:', error);
    } finally {
        await sequelize.close();
    }
}

async function setupDatabase() {
    try {
        // Conectar ao MongoDB Atlas
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Conectado ao MongoDB Atlas!');
        
        // Criar índices para otimização
        const db = mongoose.connection.db;
        
        // Índices para jogadores
        await db.collection('players').createIndex({ name: 1 });
        await db.collection('players').createIndex({ email: 1 }, { unique: true });
        
        // Índices para partidas
        await db.collection('matches').createIndex({ playerId: 1 });
        await db.collection('matches').createIndex({ date: -1 });
        await db.collection('matches').createIndex({ winner: 1 });
        
        // Índices para cache de cartas
        await db.collection('cardcaches').createIndex({ cardName: 1 }, { unique: true });
        await db.collection('cardcaches').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
        
        console.log('✅ Índices criados com sucesso!');
        
        // Verificar se existe jogador padrão
        const Player = mongoose.model('Player', new mongoose.Schema({
            name: String,
            email: String,
            level: Number,
            xp: Number,
            totalMatches: Number,
            wins: Number,
            losses: Number,
            winRate: Number
        }));
        
        const existingPlayer = await Player.findOne({ email: 'jogador@exemplo.com' });
        
        if (!existingPlayer) {
            const defaultPlayer = new Player({
                name: 'Jogador Padrão',
                email: 'jogador@exemplo.com',
                level: 1,
                xp: 0,
                totalMatches: 0,
                wins: 0,
                losses: 0,
                winRate: 0
            });
            
            await defaultPlayer.save();
            console.log('✅ Jogador padrão criado!');
        } else {
            console.log('ℹ️ Jogador padrão já existe.');
        }
        
        console.log('🎉 Configuração do banco de dados concluída!');
        
    } catch (error) {
        console.error('❌ Erro na configuração:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Conexão fechada.');
    }
}

setupDatabase();
