const mongoose = require('mongoose');

// Conectar ao MongoDB
const MONGODB_URI = 'mongodb+srv://gfrangetto:wZHnhH3O33ZXFKv1@cluster0.ibfzdd5.mongodb.net/SistemaMagic?retryWrites=true&w=majority';

console.log('🔄 Conectando ao MongoDB Atlas para reset...');

// Configurações otimizadas de conexão
const mongooseOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
    bufferCommands: false,
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 5000,
    retryWrites: true,
    w: 'majority'
};

mongoose.connect(MONGODB_URI, mongooseOptions)
.then(async () => {
    console.log('Conectado ao MongoDB');
    
    // 1. Deletar todas as partidas
    const matchesResult = await mongoose.connection.db.collection('matches').deleteMany({});
    console.log(`✅ ${matchesResult.deletedCount} partidas deletadas`);
    
    // 2. Deletar todos os achievements
    const achievementsResult = await mongoose.connection.db.collection('achievements').deleteMany({});
    console.log(`✅ ${achievementsResult.deletedCount} achievements deletados`);
    
    // 3. Resetar apenas as estatísticas dos jogadores (mantendo perfil)
    const playersResult = await mongoose.connection.db.collection('players').updateMany({}, {
        $set: {
            // Resetar estatísticas de jogo
            level: 1,
            xp: 0,
            xpToNext: 100,
            totalMatches: 0,
            wins: 0,
            winStreak: 0,
            bestWinStreak: 0,
            fastestWin: 999,
            longestMatch: 0,
            
            // Resetar estatísticas de comandantes e decks
            favoriteDecks: {},
            commanderStats: {},
            
            // Resetar estatísticas de first player
            'firstPlayerStats.timesStarted': 0,
            'firstPlayerStats.winsWhenStarted': 0,
            
            // Resetar novo sistema de ranking
            rankTier: 'Bronze',
            rankDivision: 'III',
            rankXP: 0,
            
            // Resetar campos antigos de ranking (para compatibilidade)
            rankPoints: 1000,
            rank: 'Bronze III',
            rankIcon: '🥉',
            
            // Resetar Manacoins
            manaCoins: 0
        }
        // NÃO resetamos: name, title, avatar, avatarId
    });
    
    console.log(`✅ Estatísticas de ${playersResult.modifiedCount} jogadores resetadas`);
    
    console.log('\n🎉 Reset completo!');
    console.log('📋 O que foi resetado:');
    console.log('   - Todas as partidas');
    console.log('   - Todos os achievements');
    console.log('   - Estatísticas dos jogadores (level, XP, wins, etc.)');
    console.log('   - Sistema de ranking (tier, divisão, XP de ranking)');
    console.log('   - Histórico de comandantes e decks');
    console.log('   - Mana Coins');
    console.log('\n👤 O que foi mantido:');
    console.log('   - Nomes dos jogadores');
    console.log('   - Avatares');
    console.log('   - Títulos');
    
    process.exit(0);
})
.catch((err) => {
    console.error('❌ Erro:', err);
    process.exit(1);
});