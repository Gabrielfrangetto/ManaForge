require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não definido!");
}


// Rate limiting para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 tentativas por IP
    message: {
        error: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    // Tenta obter token do cookie primeiro, depois do header Authorization
    let token = req.cookies.authToken;
    
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expirado', expired: true });
            }
            return res.status(403).json({ error: 'Token inválido' });
        }
        
        // Verificar se o token está próximo do vencimento (menos de 5 minutos)
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = user.exp - now;
        const fiveMinutes = 5 * 60; // 5 minutos em segundos
        
        if (timeUntilExpiry < fiveMinutes) {
            // Adicionar header indicando que o token está próximo do vencimento
            res.set('X-Token-Warning', 'Token expiring soon');
            res.set('X-Time-Until-Expiry', timeUntilExpiry.toString());
        }
        
        req.user = user;
        req.tokenInfo = {
            expiresAt: user.exp,
            timeUntilExpiry: timeUntilExpiry,
            isExpiringSoon: timeUntilExpiry < fiveMinutes
        };
        next();
    });
};

// Middleware para verificar se é master
const requireMaster = (req, res, next) => {
    if (!req.user.isMaster) {
        return res.status(403).json({ error: 'Acesso negado. Apenas usuários master podem acessar esta funcionalidade.' });
    }
    next();
};

// SISTEMA DE RANKING - Definições baseadas na tabela
const RANKING_SYSTEM = {
    tiers: {
        'Bronze': { divisions: { 'III': 180, 'II': 200, 'I': 220 }, icon: '🥉', winXP: 60, lossXP: -10 },
        'Prata': { divisions: { 'III': 240, 'II': 260, 'I': 280 }, icon: '🥈', winXP: 55, lossXP: -12 },
        'Ouro': { divisions: { 'III': 300, 'II': 320, 'I': 340 }, icon: '🥇', winXP: 50, lossXP: -15 },
        'Platina': { divisions: { 'III': 360, 'II': 380, 'I': 400 }, icon: '💎', winXP: 45, lossXP: -18 },
        'Diamante': { divisions: { 'III': 420, 'II': 440, 'I': 460 }, icon: '💠', winXP: 40, lossXP: -20 },
        'Master': { divisions: { 'III': 500, 'II': 520, 'I': 540 }, icon: '👑', winXP: 35, lossXP: -22 },
        'Grandmaster': { divisions: { 'III': 600, 'II': 620, 'I': 640 }, icon: '⭐', winXP: 30, lossXP: -25 }
    },
    tierOrder: ['Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Master', 'Grandmaster'],
    divisionOrder: ['III', 'II', 'I']
};

// Função para calcular XP de ranking baseado na posição
function calculateRankingXP(position, isArchenemy, winStreak, currentTier, turns, playerLandDropData, playerMulliganData, firstPlayerId, currentPlayerId, playerCommanderRemovedData) {
    let baseXP = 0;
    
    // XP base por posição (baseado na tabela)
    const tierData = RANKING_SYSTEM.tiers[currentTier];
    if (position === 1) {
        baseXP = tierData.winXP; // Vitória - XP positivo
    } else {
        baseXP = tierData.lossXP; // Derrota - XP negativo (já é negativo na tabela)
    }
    
    // Bônus Archenemy (+25 XP APENAS para vitória)
    if (position === 1 && isArchenemy) {
        baseXP += 25;
    }
    
    // Bônus Win Streak (+5 XP APENAS para vitória e a partir da 2ª vitória consecutiva)
    if (position === 1 && winStreak >= 2) {
        baseXP += 5;
    }
    
    // Bônus Vitória Rápida (+10 XP APENAS para vitória em 6 turnos ou menos)
    if (position === 1 && turns <= 6) {
        baseXP += 10;
    }
    
    // Bônus Land Drop Perfeito (+5 XP APENAS para vitória e não perder land drop)
    if (position === 1 && playerLandDropData && !playerLandDropData.missed) {
        baseXP += 5;
    }
    
    // Bônus Sem Mulligan (+5 XP APENAS para vitória com 0 mulligans)
    if (position === 1 && playerMulliganData && playerMulliganData.count === 0) {
        baseXP += 5;
    }
    
    // Bônus Não Começou (+5 XP APENAS para vitória quando não foi o primeiro jogador)
    if (position === 1 && firstPlayerId && currentPlayerId && firstPlayerId.toString() !== currentPlayerId.toString()) {
        baseXP += 5;
    }
    
    // Bônus Comandante Intacto (+5 XP APENAS para vitória quando comandante não foi removido)
    if (position === 1 && playerCommanderRemovedData && playerCommanderRemovedData.count === 0) {
        baseXP += 5;
    }
    
    return baseXP;
}

// Função para promover/rebaixar jogador
function updatePlayerRanking(player, xpChange) {
  let { rankTier, rankDivision, rankXP } = player;
  let newXP = (rankXP || 0) + xpChange;

  const getMaxXP = (tier, division) => RANKING_SYSTEM.tiers[tier].divisions[division];

  // --- PROMOÇÃO ---
  while (newXP >= getMaxXP(rankTier, rankDivision)) {
    const cost = getMaxXP(rankTier, rankDivision);
    newXP -= cost;

    const divIdx = RANKING_SYSTEM.divisionOrder.indexOf(rankDivision);
    if (divIdx < RANKING_SYSTEM.divisionOrder.length - 1) {
      // Sobe dentro do mesmo tier: III -> II -> I
      rankDivision = RANKING_SYSTEM.divisionOrder[divIdx + 1];
    } else {
      // Já está em I: sobe de tier e volta para III
      const tierIdx = RANKING_SYSTEM.tierOrder.indexOf(rankTier);
      if (tierIdx < RANKING_SYSTEM.tierOrder.length - 1) {
        rankTier = RANKING_SYSTEM.tierOrder[tierIdx + 1];
        rankDivision = RANKING_SYSTEM.divisionOrder[0]; // 'III'
      } else {
        // Topo do topo: cap no XP da divisão
        const cap = getMaxXP(rankTier, rankDivision);
        newXP = Math.min(newXP, cap);
        break;
      }
    }
  }

  // --- REBAIXAMENTO ---
  while (newXP < 0) {
    // Bronze III é o piso
    if (rankTier === 'Bronze' && rankDivision === 'III') {
      newXP = 0;
      break;
    }

    const divIdx = RANKING_SYSTEM.divisionOrder.indexOf(rankDivision);
    if (divIdx > 0) {
      // Desce dentro do mesmo tier: I -> II -> III
      rankDivision = RANKING_SYSTEM.divisionOrder[divIdx - 1];
    } else {
      // Estava em III: desce de tier e vai para I do tier anterior
      const tierIdx = RANKING_SYSTEM.tierOrder.indexOf(rankTier);
      rankTier = RANKING_SYSTEM.tierOrder[tierIdx - 1];
      rankDivision = RANKING_SYSTEM.divisionOrder[RANKING_SYSTEM.divisionOrder.length - 1]; // 'I'
    }

    // Herda o "negativo" para a divisão/tier novo
    const newMax = getMaxXP(rankTier, rankDivision);
    newXP = newMax + newXP; // (lembre que newXP < 0 aqui)
  }

  return { rankTier, rankDivision, rankXP: Math.max(0, newXP) };
}


// Middleware
// Configurar CORS origins baseado em variáveis de ambiente
const corsOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: corsOrigins,
    credentials: true, // IMPORTANTE: Permitir cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('.'));

// MongoDB Atlas Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/SistemaMagic';

console.log('🔄 Tentando conectar ao MongoDB Atlas...');
console.log('📍 URI:', MONGODB_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://<username>:<password>@'));

// Configurações específicas para resolver problemas de conectividade
const mongooseOptions = {
    serverSelectionTimeoutMS: 30000, // 30 segundos
    socketTimeoutMS: 45000, // 45 segundos
    family: 4, // Força IPv4
    bufferCommands: false,
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 5000,
    retryWrites: true,
    w: 'majority'
};

mongoose.connect(MONGODB_URI, mongooseOptions)
.then(() => {
    console.log('✅ Conectado ao MongoDB Atlas com sucesso!');
    console.log('🗄️ Database:', mongoose.connection.db.databaseName);
    console.log('🌐 Host:', mongoose.connection.host);
    console.log('📊 Estado da conexão:', mongoose.connection.readyState);
})
.catch((err) => {
    console.error('❌ Erro ao conectar ao MongoDB Atlas:', err.message);
    console.error('🔍 Detalhes do erro:', {
        name: err.name,
        code: err.code,
        codeName: err.codeName,
        reason: err.reason
    });
    console.error('📋 Stack completo:', err.stack);
});

// Schemas do MongoDB
const playerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isMaster: { type: Boolean, default: false },
    title: { type: String, default: 'Planeswalker Iniciante' },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    xpToNext: { type: Number, default: 100 },
    manaCoins: { type: Number, default: 0 },
    avatar: { type: String, default: 'https://via.placeholder.com/120x120/4a5568/ffffff?text=Avatar' },
    avatarId: { type: Number, default: 0 },
    frameId: { type: String, default: 'none' }, // NOVO: Campo para salvar o frame do avatar
    
    // NOVO SISTEMA DE RANKING
    rankTier: { type: String, default: 'Bronze' }, // Bronze, Prata, Ouro, Platina, Diamante, Master, Grandmaster
    rankDivision: { type: String, default: 'III' }, // III, II, I
    rankXP: { type: Number, default: 0 }, // XP atual no tier/divisão
    
    totalMatches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 }, // Para bônus de win streak
    bestWinStreak: { type: Number, default: 0 }, // NOVO: Recorde da maior sequência
    fastestWin: { type: Number, default: 999 },
    longestMatch: { type: Number, default: 0 },
    favoriteDecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    cardOwnerCount: { type: Number, default: 0 }, // ADICIONAR ESTA LINHA
    // Adicionar estatísticas de firstPlayer
    firstPlayerStats: {
        timesStarted: { type: Number, default: 0 },
        winsWhenStarted: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});
const matchSchema = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    date: { type: Date, required: true },
    turns: { type: Number, required: true },
    commanders: [{
        name: { type: String, required: true },
        partnerName: { type: String, default: null },
        themePrimary: { type: String, required: true },
        themeSecondary: { type: String, default: '' },
        playerId: { type: String, required: true },
        playerName: { type: String, required: true }
    }],
    firstPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    
    // === CAMPOS MULTIPLAYER ===
    playerMulligans: [{
        playerId: { type: String, required: true },
        playerName: { type: String, required: true },
        count: { type: Number, default: 0 }
    }],
    playerTurn1: [{
        playerId: { type: String, required: true },
        playerName: { type: String, required: true },
        play: { type: String, required: true }
    }],
    playerLandDrop: [{
        playerId: { type: String, required: true },
        playerName: { type: String, required: true },
        missed: { type: Boolean, default: false }
    }],
    playerCommanderRemoved: [{
        playerId: { type: String, required: true },
        playerName: { type: String, required: true },
        count: { type: Number, default: 0 }
    }],
    
    // === CAMPOS GERAIS ===
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    winnerName: { type: String },
    gameCard: { type: mongoose.Schema.Types.Mixed },
    archenemy: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    finishingCards: { type: [mongoose.Schema.Types.Mixed], default: [] },
    
    // Ranking como objeto
    ranking: {
        first: { type: String },
        second: { type: String },
        third: { type: String },
        fourth: { type: String }
    },
    
    participants: [{ type: String }], // Array de IDs dos participantes
    observations: { type: String },
    result: { type: String, enum: ['win', 'loss'], required: true }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

const achievementSchema = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    achievementId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    xpReward: { type: Number, required: true },
    unlockedAt: { type: Date, required: true }
});

// NOVO: Índice único composto para evitar duplicações
achievementSchema.index({ playerId: 1, achievementId: 1 }, { unique: true });

const cardCacheSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    scryfallId: { type: String, required: true },
    imageUrl: { type: String },
    smallImageUrl: { type: String },
    manaCost: { type: String },
    typeLine: { type: String },
    rarity: { type: String },
    setName: { type: String },
    cachedAt: { type: Date, default: Date.now }
});

// Modelos
const Player = mongoose.model('Player', playerSchema);
const Match = mongoose.model('Match', matchSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);
const CardCache = mongoose.model('CardCache', cardCacheSchema);

// Schema para conquistas em destaque
const featuredAchievementSchema = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    achievementIds: [{ type: String, required: true }]
}, {
    timestamps: true
});

const FeaturedAchievement = mongoose.model('FeaturedAchievement', featuredAchievementSchema);

// Rotas da API
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// === ROTAS DE AUTENTICAÇÃO ===

// Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        // Buscar usuário por email
        const user = await Player.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Verificar senha
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Gerar token JWT
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email, 
                name: user.name,
                isMaster: user.isMaster 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Definir cookie httpOnly com o token
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // HTTPS em produção
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 horas
        });

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                isMaster: user.isMaster,
                avatar: user.avatar,
                title: user.title
            },
            tokenInfo: req.tokenInfo ? {
                expiresAt: req.tokenInfo.expiresAt,
                timeUntilExpiry: req.tokenInfo.timeUntilExpiry,
                isExpiringSoon: req.tokenInfo.isExpiringSoon
            } : null
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Verificar token
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const user = await Player.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                isMaster: user.isMaster,
                avatar: user.avatar,
                title: user.title
            }
        });
    } catch (error) {
        console.error('Erro na verificação do token:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('authToken');
    res.json({ success: true, message: 'Logout realizado com sucesso' });
});

// === ROTAS PROTEGIDAS ===

// Buscar jogador por nome
app.get('/api/player/:name', async (req, res) => {
    try {
        const player = await Player.findOne({ name: req.params.name });
        
        if (!player) {
            return res.status(404).json({ error: 'Jogador não encontrado' });
        }
        
        res.json(player);
    } catch (error) {
        console.error('Erro ao buscar jogador:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar jogador
app.put('/api/player/:id', async (req, res) => {
    try {
        const updatedPlayer = await Player.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!updatedPlayer) {
            return res.status(404).json({ error: 'Jogador não encontrado' });
        }
        
        res.json(updatedPlayer);
    } catch (error) {
        console.error('Erro ao atualizar jogador:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar rota de salvar partida
// Buscar histórico de partidas
app.get('/api/matches/:playerId', async (req, res) => {
    try {
        const { page = 1, limit = 10, deckTheme, result, dateFrom, dateTo } = req.query;
        const skip = (page - 1) * limit;
        
        // Filter corrigido para incluir todas as partidas onde o jogador participou
        const filter = {
            $or: [
                { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                { 'commanders.playerId': req.params.playerId },
                { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
            ]
        };
        
        if (deckTheme) {
            // Para filtrar por deck theme, precisamos verificar se o jogador usou esse deck
            filter['commanders'] = {
                $elemMatch: {
                    playerId: req.params.playerId,
                    $or: [
                        { themePrimary: deckTheme },
                        { themeSecondary: deckTheme },
                        { theme: deckTheme }
                    ]
                }
            };
        }
        
        if (result) {
            if (result === 'win') {
                filter.winner = new mongoose.Types.ObjectId(req.params.playerId);
            } else if (result === 'loss') {
                filter.winner = { $ne: new mongoose.Types.ObjectId(req.params.playerId) };
            }
        }
        
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }
        
        const matches = await Match.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);
            
        const totalMatches = await Match.countDocuments(filter);
        
        res.json({
            matches,
            totalMatches,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalMatches / limit)
        });
    } catch (error) {
        console.error('Erro ao buscar partidas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar estatísticas do jogador
app.get('/api/stats/:playerId', async (req, res) => {
    try {
        const player = await Player.findById(req.params.playerId);
        if (!player) {
            return res.status(404).json({ error: 'Jogador não encontrado' });
        }
        
        // Estatísticas básicas - VERSÃO CORRIGIDA
        const totalMatches = await Match.countDocuments({
            $or: [
                { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                { 'commanders.playerId': req.params.playerId },
                { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
            ]
        });
        
        const wins = await Match.countDocuments({
            $and: [
                {
                    $or: [
                        { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                        { 'commanders.playerId': req.params.playerId },
                        { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                        { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
                    ]
                },
                { winner: new mongoose.Types.ObjectId(req.params.playerId) }
            ]
        });
        
        const winrate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;
        
        // Estatísticas de firstPlayer
        const firstPlayerStats = player.firstPlayerStats || { timesStarted: 0, winsWhenStarted: 0 };
        const firstPlayerWinrate = firstPlayerStats.timesStarted > 0 ? 
            ((firstPlayerStats.winsWhenStarted / firstPlayerStats.timesStarted) * 100).toFixed(1) : 0;
        
        // Deck mais usado
        // CORRIGIR: Primeira rota de estatísticas (linha ~270)
        // Deck mais usado - VERSÃO CORRIGIDA
        const deckStats = await Match.aggregate([
            {
                $match: {
                    $or: [
                        { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                        { 'commanders.playerId': req.params.playerId },
                        { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                        { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
                    ]
                }
            },
            {
                $addFields: {
                    playerCommander: {
                        $filter: {
                            input: '$commanders',
                            cond: { $eq: ['$$this.playerId', req.params.playerId] }
                        }
                    }
                }
            },
            {
                $match: {
                    'playerCommander.0': { $exists: true }
                }
            },
            {
                $addFields: {
                    deckTheme: { 
                        $let: {
                            vars: {
                                primary: { $arrayElemAt: ['$playerCommander.themePrimary', 0] },
                                secondary: { $arrayElemAt: ['$playerCommander.themeSecondary', 0] },
                                legacy: { $arrayElemAt: ['$playerCommander.theme', 0] }
                            },
                            in: {
                                $cond: {
                                    if: { $ne: [{ $ifNull: ['$$primary', ''] }, ''] },
                                    then: {
                                        $concat: [
                                            '$$primary',
                                            {
                                                $cond: {
                                                    if: { $ne: [{ $ifNull: ['$$secondary', ''] }, ''] },
                                                    then: { $concat: [' / ', '$$secondary'] },
                                                    else: ''
                                                }
                                            }
                                        ]
                                    },
                                    else: '$$legacy'
                                }
                            }
                        }
                    },
                    isWin: {
                        $cond: [
                            { $eq: ['$winner', new mongoose.Types.ObjectId(req.params.playerId)] },
                            1,
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$deckTheme',
                    total: { $sum: 1 },
                    wins: { $sum: '$isWin' }
                }
            },
            { $sort: { total: -1 } }
        ]);
        
        const mostUsedDeck = deckStats.length > 0 ? {
            name: deckStats[0]._id,
            total: deckStats[0].total,
            wins: deckStats[0].wins,
            winrate: deckStats[0].total > 0 ? 
                ((deckStats[0].wins / deckStats[0].total) * 100).toFixed(1) : 0
        } : null;
        
        // Calcular estatísticas de comandante removido
        const commanderRemovedStats = await Match.aggregate([
            {
                $match: {
                    $or: [
                        { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                        { 'commanders.playerId': req.params.playerId },
                        { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                        { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
                    ]
                }
            },
            {
                $unwind: '$playerCommanderRemoved'
            },
            {
                $match: {
                    'playerCommanderRemoved.playerId': req.params.playerId
                }
            },
            {
                $group: {
                    _id: null,
                    totalRemovals: { $sum: '$playerCommanderRemoved.count' }
                }
            }
        ]);
        
        const commanderRemovals = commanderRemovedStats.length > 0 ? commanderRemovedStats[0].totalRemovals : 0;
        
        // Calcular quantas vezes foi archenemy
        const archenemyCount = await Match.countDocuments({
            archenemy: new mongoose.Types.ObjectId(req.params.playerId)
        });
        
        res.json({
            totalMatches,
            wins,
            losses: totalMatches - wins,
            winrate: parseFloat(winrate),
            winStreak: player.winStreak,
            bestWinStreak: player.bestWinStreak || 0,
            fastestWin: player.fastestWin === 999 ? null : player.fastestWin,
            longestMatch: player.longestMatch,
            commanderRemovals,
            archenemyCount,
            mostUsedDeck,
            firstPlayerStats: {
                timesStarted: firstPlayerStats.timesStarted,
                winsWhenStarted: firstPlayerStats.winsWhenStarted,
                winrateWhenStarted: parseFloat(firstPlayerWinrate)
            },
            deckStats: deckStats.map(deck => ({
                name: deck._id,
                total: deck.total,
                wins: deck.wins,
                winrate: deck.total > 0 ? 
                    ((deck.wins / deck.total) * 100).toFixed(1) : 0
            }))
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar cartas
app.get('/api/cards/search/:name', async (req, res) => {
    try {
        const cardName = req.params.name;
        
        // Buscar múltiplas cartas no cache primeiro
        const cachedCards = await CardCache.find({
            name: { $regex: cardName, $options: 'i' }
        }).limit(10); // Limitar a 10 resultados
        
        if (cachedCards.length > 0) {
            return res.json(cachedCards);
        }
        
        // Buscar múltiplas cartas na API Scryfall
        const cardData = await getMultipleCardData(cardName);
        if (cardData && cardData.length > 0) {
            // Salvar todas no cache
            for (const card of cardData) {
                try {
                    await CardCache.create(card);
                } catch (error) {
                    // Ignorar erros de duplicação
                    if (!error.message.includes('duplicate key')) {
                        console.error('Erro ao salvar carta no cache:', error);
                    }
                }
            }
            res.json(cardData);
        } else {
            res.status(404).json({ error: 'Nenhuma carta encontrada' });
        }
    } catch (error) {
        console.error('Erro ao buscar cartas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

async function getMultipleCardData(cardName, retryCount = 0) {
    const maxRetries = 3;
    const timeout = 10000; // 10 segundos
    
    console.log(`🔍 Buscando cartas para: "${cardName}" (tentativa ${retryCount + 1}/${maxRetries + 1})`);
    
    try {
        // Criar AbortController para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Configurar headers com User-Agent
        const headers = {
            'User-Agent': 'ManaForge/1.0 (Magic Card Game System)',
            'Accept': 'application/json'
        };
        
        console.log(`📡 Fazendo requisição para Scryfall API...`);
        const startTime = Date.now();
        
        // Fazer requisição com timeout e headers
        const response = await fetch(
            `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}`,
            {
                signal: controller.signal,
                headers: headers,
                timeout: timeout
            }
        );
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        console.log(`⏱️ Tempo de resposta: ${responseTime}ms`);
        
        if (!response.ok) {
            console.error(`❌ Resposta da API Scryfall não OK:`, {
                status: response.status,
                statusText: response.statusText,
                url: response.url,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            // Se for erro 429 (rate limit) ou 5xx, tentar novamente
            if ((response.status === 429 || response.status >= 500) && retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Backoff exponencial
                console.log(`⏳ Aguardando ${delay}ms antes de tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return getMultipleCardData(cardName, retryCount + 1);
            }
            
            return null;
        }
        
        console.log(`✅ Resposta OK da API Scryfall (${response.status})`);
        const data = await response.json();
        console.log('📊 Total de cartas encontradas no Scryfall:', data.data?.length || 0);
        
        // A resposta vem em data.data
        const cards = data.data || [];
        
        if (cards.length === 0) {
            console.log('⚠️ Nenhuma carta encontrada para:', cardName);
            return null;
        }
        
        // Processar até 10 cartas
        const processedCards = cards.slice(0, 10).map(card => ({
            name: card.name,
            scryfallId: card.id,
            imageUrl: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
            smallImageUrl: card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small,
            manaCost: card.mana_cost || card.card_faces?.[0]?.mana_cost,
            typeLine: card.type_line || card.card_faces?.[0]?.type_line,
            rarity: card.rarity,
            setName: card.set_name
        }));
        
        console.log(`✨ Processadas ${processedCards.length} cartas com sucesso`);
        return processedCards;
        
    } catch (error) {
        console.error(`💥 Erro ao buscar cartas na API Scryfall (tentativa ${retryCount + 1}):`, {
            message: error.message,
            name: error.name,
            stack: error.stack,
            cardName: cardName
        });
        
        // Se for erro de timeout ou rede e ainda temos tentativas
        if (retryCount < maxRetries && 
            (error.name === 'AbortError' || 
             error.message.includes('fetch') || 
             error.message.includes('network') ||
             error.message.includes('timeout'))) {
            
            const delay = Math.pow(2, retryCount) * 1000; // Backoff exponencial
            console.log(`🔄 Tentando novamente em ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return getMultipleCardData(cardName, retryCount + 1);
        }
        
        console.error(`❌ Falha definitiva após ${retryCount + 1} tentativas`);
        return null;
    }
}

// Criar novo jogador (PROTEGIDO - APENAS MASTER)
app.post('/api/player', authenticateToken, requireMaster, async (req, res) => {
    try {
        const playerData = req.body;
        
        // Verificar se já existe um jogador com esse nome
        const existingPlayer = await Player.findOne({ name: playerData.name });
        if (existingPlayer) {
            return res.status(400).json({ error: 'Já existe um jogador com esse nome' });
        }
        
        const player = await Player.create(playerData);
        res.status(201).json(player);
    } catch (error) {
        console.error('Erro ao criar jogador:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar todos os jogadores (LIBERADO PARA USUÁRIOS AUTENTICADOS)
app.get('/api/players', authenticateToken, async (req, res) => {
    try {
        const players = await Player.find().sort({ createdAt: -1 });
        res.json(players);
    } catch (error) {
        console.error('Erro ao buscar jogadores:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Salvar partida (PROTEGIDO - APENAS MASTER)
app.post('/api/matches', authenticateToken, requireMaster, async (req, res) => {
    try {
        const matchData = req.body;
        
        // Criar a partida
        const match = await Match.create(matchData);
        
        // Atualizar estatísticas do jogador principal
        const player = await Player.findById(matchData.playerId);
        if (player) {
            const isWin = matchData.result === 'win';
            const updateData = {
                totalMatches: player.totalMatches + 1,
                wins: isWin ? player.wins + 1 : player.wins,
                winStreak: isWin ? player.winStreak + 1 : 0,
                fastestWin: isWin && matchData.turns < player.fastestWin ? matchData.turns : player.fastestWin,
                longestMatch: matchData.turns > player.longestMatch ? matchData.turns : player.longestMatch
            };
            
            // ADICIONAR: XP e level up (replicando lógica dos outros participantes)
            let xpGained = 0;
            
            // Determinar posição do jogador principal no ranking
            let playerPosition = null;
            if (matchData.ranking) {
                if (matchData.ranking.first === matchData.playerId.toString()) playerPosition = 1;
                else if (matchData.ranking.second === matchData.playerId.toString()) playerPosition = 2;
                else if (matchData.ranking.third === matchData.playerId.toString()) playerPosition = 3;
                else if (matchData.ranking.fourth === matchData.playerId.toString()) playerPosition = 4;
            }
            
            // Calcular XP baseado na posição
            switch (playerPosition) {
                case 1: // 1º lugar
                    xpGained = 50;
                    // Verificar se é Archenemy para bônus
                    if (matchData.archenemy && matchData.archenemy.toString() === matchData.playerId.toString()) {
                        xpGained += 25; // Total: 75 XP
                    }
                    break;
                case 2: // 2º lugar
                    xpGained = 35;
                    break;
                case 3: // 3º lugar
                    xpGained = 25;
                    break;
                case 4: // 4º lugar
                    xpGained = 15;
                    break;
                default:
                    // Fallback para sistema antigo se ranking não estiver disponível
                    xpGained = isWin ? 40 : 15;
            }
            
            // Aplicar XP e verificar level up
            updateData.xp = (player.xp || 0) + xpGained;
            
            // Verificar level up
                    let currentXP = updateData.xp;
                    let currentLevel = player.level || 1;
                    let xpToNext = player.xpToNext || 100;
            
            while (currentXP >= xpToNext) {
                currentXP -= xpToNext;
                currentLevel++;
                xpToNext = Math.floor(xpToNext * 1.2);
            }
            
            updateData.xp = currentXP;
            updateData.level = currentLevel;
            updateData.xpToNext = xpToNext;
            
            // Atualizar deck favorito
            const favoriteDecks = player.favoriteDecks || {};
            if (!favoriteDecks[matchData.deckTheme]) {
                favoriteDecks[matchData.deckTheme] = { wins: 0, total: 0 };
            }
            favoriteDecks[matchData.deckTheme].total += 1;
            if (isWin) {
                favoriteDecks[matchData.deckTheme].wins += 1;
            }
            updateData.favoriteDecks = favoriteDecks;
            
            await Player.findByIdAndUpdate(matchData.playerId, updateData);
        }
        
        // Atualizar estatísticas de firstPlayer
        if (matchData.firstPlayer) {
            const firstPlayer = await Player.findById(matchData.firstPlayer);
            if (firstPlayer) {
                const firstPlayerStats = firstPlayer.firstPlayerStats || { timesStarted: 0, winsWhenStarted: 0 };
                firstPlayerStats.timesStarted += 1;
                
                // Verificar se o jogador que começou ganhou
                // Assumindo que o firstPlayer ganhou se o resultado for 'win' e o firstPlayer for o jogador principal
                // ou se o firstPlayer estiver em primeiro lugar no ranking
                const firstPlayerWon = (matchData.firstPlayer.toString() === matchData.playerId.toString() && matchData.result === 'win') ||
                                     (matchData.ranking && matchData.ranking.firstPlace === matchData.firstPlayer.toString());
                
                if (firstPlayerWon) {
                    firstPlayerStats.winsWhenStarted += 1;
                }
                
                await Player.findByIdAndUpdate(matchData.firstPlayer, {
                    firstPlayerStats: firstPlayerStats
                });
            }
        }
        
        res.status(201).json(match);
    } catch (error) {
        console.error('Erro ao salvar partida:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
app.post('/api/matches/multiplayer', async (req, res) => {
    try {
        const matchData = req.body;
        
        // Criar a partida
        const match = await Match.create(matchData);
        
        
        // Atualizar estatísticas de todos os participantes
        if (matchData.commanders && matchData.commanders.length > 0) {
            for (const commander of matchData.commanders) {
                // CORREÇÃO: Converter string para ObjectId
                const player = await Player.findById(new mongoose.Types.ObjectId(commander.playerId));
                if (player) {
                    // Atualizar total de partidas para todos os jogadores
                    const isWinner = commander.playerId === matchData.winner.toString();
                    const updateData = {
                        totalMatches: player.totalMatches + 1
                    };
                    
                    // Determinar posição do jogador no ranking
                    let playerPosition = null;
                    if (matchData.ranking) {
                        if (matchData.ranking.first === commander.playerId) playerPosition = 1;
                        else if (matchData.ranking.second === commander.playerId) playerPosition = 2;
                        else if (matchData.ranking.third === commander.playerId) playerPosition = 3;
                        else if (matchData.ranking.fourth === commander.playerId) playerPosition = 4;
                    }
                    
                    // XP de perfil (mantém o sistema antigo)
                    let profileXP = 0;
                    switch (playerPosition) {
                        case 1: // 1º lugar
                            profileXP = 50;
                            // Verificar se é Archenemy para bônus
                            if (matchData.archenemy && matchData.archenemy.toString() === commander.playerId) {
                                profileXP += 25; // Total: 75 XP
                            }
                            break;
                        case 2: // 2º lugar
                            profileXP = 35;
                            break;
                        case 3: // 3º lugar
                            profileXP = 25;
                            break;
                        case 4: // 4º lugar
                            profileXP = 15;
                            break;
                        default:
                            // Fallback para sistema antigo se ranking não estiver disponível
                            profileXP = isWinner ? 40 : 15;
                    }
                    
                    // NOVO: XP de ranking
                    const isArchenemy = matchData.archenemy && matchData.archenemy.toString() === commander.playerId;
                    
                    // Buscar dados de land drop para este jogador
                    const playerLandDropData = matchData.playerLandDrop?.find(landDrop => landDrop.playerId === commander.playerId);
                    
                    // Buscar dados de mulligan para este jogador
                    const playerMulliganData = matchData.playerMulligans?.find(mulligan => mulligan.playerId === commander.playerId);
                    
                    // Buscar dados de remoção do comandante para este jogador
                    const playerCommanderRemovedData = matchData.playerCommanderRemoved?.find(removed => removed.playerId === commander.playerId);
                    
                    // CORREÇÃO: Calcular winStreak correto ANTES do cálculo de XP
                    const currentWinStreak = isWinner ? player.winStreak + 1 : 0;
                    
                    const rankingXP = calculateRankingXP(
                        playerPosition || (isWinner ? 1 : 4), 
                        isArchenemy, 
                        currentWinStreak, 
                        player.rankTier, 
                        matchData.turns, 
                        playerLandDropData, 
                        playerMulliganData,
                        matchData.firstPlayer,
                        commander.playerId,
                        playerCommanderRemovedData
                    );
                    
                    // Atualizar ranking
                    const newRankingData = updatePlayerRanking(player, rankingXP);
                    
                    if (isWinner) {
                        updateData.wins = player.wins + 1;
                        updateData.winStreak = currentWinStreak;
                        // NOVO: Atualizar recorde se a sequência atual for maior
                        updateData.bestWinStreak = Math.max(player.bestWinStreak || 0, currentWinStreak);
                        updateData.fastestWin = matchData.turns < player.fastestWin ? matchData.turns : player.fastestWin;
                        updateData.longestMatch = matchData.turns > player.longestMatch ? matchData.turns : player.longestMatch;
                    } else {
                        updateData.winStreak = 0;
                        // bestWinStreak NÃO é resetado - mantém o recorde
                    }
                    
                    // Atualizar campos de ranking
                    updateData.rankTier = newRankingData.rankTier;
                    updateData.rankDivision = newRankingData.rankDivision;
                    updateData.rankXP = newRankingData.rankXP;
                    
                    // Aplicar XP de perfil (separado do ranking)
                    updateData.xp = (player.xp || 0) + profileXP;
                    
                    // Verificar level up
                    let currentXP = updateData.xp;
                    let currentLevel = player.level || 1;
                    let xpToNext = player.xpToNext || 100;
                    
                    while (currentXP >= xpToNext) {
                        currentXP -= xpToNext;
                        currentLevel++;
                        xpToNext = Math.floor(xpToNext * 1.2);
                    }
                    
                    updateData.xp = currentXP;
                    updateData.level = currentLevel;
                    updateData.xpToNext = xpToNext;
                    
                    // NOVO: Sistema de Manacoins
                    // Vencedor recebe 50 Manacoins, demais participantes recebem 25
                    const manaCoinsReward = isWinner ? 50 : 25;
                    updateData.manaCoins = (player.manaCoins || 0) + manaCoinsReward;
                    
                    // Atualizar estatísticas do comandante
                    const commanderStats = player.commanderStats || {};
                    if (!commanderStats[commander.name]) {
                        commanderStats[commander.name] = { wins: 0, total: 0 };
                    }
                    commanderStats[commander.name].total += 1;
                    
                    if (isWinner) {
                        commanderStats[commander.name].wins += 1;
                    }
                    
                    // Atualizar estatísticas do partner (se existir)
                    if (commander.partnerPlayerId) {
                        const partnerPlayer = await Player.findById(commander.partnerPlayerId);
                        if (partnerPlayer) {
                            const partnerStats = partnerPlayer.commanderStats || {};
                            const partnerKey = `Partner: ${commander.partnerPlayerName}`;
                            
                            if (!partnerStats[partnerKey]) {
                                partnerStats[partnerKey] = { wins: 0, total: 0 };
                            }
                            partnerStats[partnerKey].total += 1;
                            
                            if (isWinner) {
                                partnerStats[partnerKey].wins += 1;
                            }
                            
                            await Player.findByIdAndUpdate(commander.partnerPlayerId, {
                                commanderStats: partnerStats
                            });
                        }
                    }
                    
                     // ADICIONAR: Atualizar deck favorito (replicando comportamento do jogador principal)
                    const favoriteDecks = player.favoriteDecks || {};
                    
                    const updateThemeStats = (theme) => {
                        if (!theme) return;
                        if (!favoriteDecks[theme]) {
                            favoriteDecks[theme] = { wins: 0, total: 0 };
                        }
                        favoriteDecks[theme].total += 1;
                        if (isWinner) {
                            favoriteDecks[theme].wins += 1;
                        }
                    };

                    updateThemeStats(commander.themePrimary);
                    if (commander.themeSecondary) {
                        updateThemeStats(commander.themeSecondary);
                    }
                    
                    updateData.favoriteDecks = favoriteDecks;
                    
                    await Player.findByIdAndUpdate(new mongoose.Types.ObjectId(commander.playerId), updateData);
                }
            }
        }
        
        // Atualizar estatísticas de firstPlayer
        if (matchData.firstPlayer) {
            const firstPlayer = await Player.findById(matchData.firstPlayer);
            if (firstPlayer) {
                const firstPlayerStats = firstPlayer.firstPlayerStats || { timesStarted: 0, winsWhenStarted: 0 };
                firstPlayerStats.timesStarted += 1;
                
                // Verificar se o jogador que começou ganhou
                if (matchData.firstPlayer.toString() === matchData.winner.toString()) {
                    firstPlayerStats.winsWhenStarted += 1;
                }
                
                await Player.findByIdAndUpdate(matchData.firstPlayer, {
                    firstPlayerStats: firstPlayerStats
                });
            }
        }
        
        // NOVO: Atualizar estatísticas de cardOwner
        if (matchData.gameCard && matchData.gameCard.ownerId) {
            const cardOwner = await Player.findById(matchData.gameCard.ownerId);
            if (cardOwner) {
                const currentCardOwnerCount = cardOwner.cardOwnerCount || 0;
                await Player.findByIdAndUpdate(matchData.gameCard.ownerId, {
                    cardOwnerCount: currentCardOwnerCount + 1
                });
                console.log(`Card Owner Count atualizado para jogador ${matchData.gameCard.ownerId}: ${currentCardOwnerCount + 1}`);
            }
        }
        
        res.status(201).json(match);
    } catch (error) {
        console.error('Erro ao salvar partida multiplayer:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
// Buscar histórico de partidas
app.get('/api/matches/:playerId', async (req, res) => {
    try {
        const { page = 1, limit = 10, deckTheme, result, dateFrom, dateTo } = req.query;
        const skip = (page - 1) * limit;
        
        // Filter corrigido para incluir todas as partidas onde o jogador participou
        const filter = {
            $or: [
                { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                { 'commanders.playerId': req.params.playerId },
                { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
            ]
        };
        
        if (deckTheme) {
            // Para filtrar por deck theme, precisamos verificar se o jogador usou esse deck
            filter['commanders'] = {
                $elemMatch: {
                    playerId: req.params.playerId,
                    $or: [
                        { themePrimary: deckTheme },
                        { themeSecondary: deckTheme },
                        { theme: deckTheme }
                    ]
                }
            };
        }
        
        if (result) {
            if (result === 'win') {
                filter.winner = new mongoose.Types.ObjectId(req.params.playerId);
            } else if (result === 'loss') {
                filter.winner = { $ne: new mongoose.Types.ObjectId(req.params.playerId) };
            }
        }
        
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }
        
        const matches = await Match.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);
            
        const totalMatches = await Match.countDocuments(filter);
        
        res.json({
            matches,
            totalMatches,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalMatches / limit)
        });
    } catch (error) {
        console.error('Erro ao buscar partidas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar estatísticas do jogador
app.get('/api/stats/:playerId', async (req, res) => {
    try {
        const player = await Player.findById(req.params.playerId);
        if (!player) {
            return res.status(404).json({ error: 'Jogador não encontrado' });
        }
        
        // Estatísticas básicas - VERSÃO CORRIGIDA
        const totalMatches = await Match.countDocuments({
            $or: [
                { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                { 'commanders.playerId': req.params.playerId },
                { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
            ]
        });
        
        const wins = await Match.countDocuments({
            $and: [
                {
                    $or: [
                        { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                        { 'commanders.playerId': req.params.playerId },
                        { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                        { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
                    ]
                },
                { winner: new mongoose.Types.ObjectId(req.params.playerId) }
            ]
        });
        
        const winrate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;
        
        // Deck mais usado
        // CORRIGIR: Segunda rota de estatísticas (linha ~700)
        // Deck mais usado - VERSÃO CORRIGIDA
        const deckStats = await Match.aggregate([
            {
                $match: {
                    $or: [
                        { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                        { 'commanders.playerId': req.params.playerId },
                        { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                        { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
                    ]
                }
            },
            {
                $addFields: {
                    playerCommander: {
                        $filter: {
                            input: '$commanders',
                            cond: { $eq: ['$$this.playerId', req.params.playerId] }
                        }
                    }
                }
            },
            {
                $match: {
                    'playerCommander.0': { $exists: true }
                }
            },
            {
                $addFields: {
                    deckTheme: { 
                        $let: {
                            vars: {
                                primary: { $arrayElemAt: ['$playerCommander.themePrimary', 0] },
                                secondary: { $arrayElemAt: ['$playerCommander.themeSecondary', 0] },
                                legacy: { $arrayElemAt: ['$playerCommander.theme', 0] }
                            },
                            in: {
                                $cond: {
                                    if: { $ne: [{ $ifNull: ['$$primary', ''] }, ''] },
                                    then: {
                                        $concat: [
                                            '$$primary',
                                            {
                                                $cond: {
                                                    if: { $ne: [{ $ifNull: ['$$secondary', ''] }, ''] },
                                                    then: { $concat: [' / ', '$$secondary'] },
                                                    else: ''
                                                }
                                            }
                                        ]
                                    },
                                    else: '$$legacy'
                                }
                            }
                        }
                    },
                    isWin: {
                        $cond: [
                            { $eq: ['$winner', new mongoose.Types.ObjectId(req.params.playerId)] },
                            1,
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$deckTheme',
                    total: { $sum: 1 },
                    wins: { $sum: '$isWin' }
                }
            },
            { $sort: { total: -1 } }
        ]);
        
        const mostUsedDeck = deckStats.length > 0 ? {
            name: deckStats[0]._id,
            total: deckStats[0].total,
            wins: deckStats[0].wins,
            winrate: deckStats[0].total > 0 ? 
                ((deckStats[0].wins / deckStats[0].total) * 100).toFixed(1) : 0
        } : null;
        
        // Calcular estatísticas de comandante removido
        const commanderRemovedStats = await Match.aggregate([
            {
                $match: {
                    $or: [
                        { playerId: new mongoose.Types.ObjectId(req.params.playerId) },
                        { 'commanders.playerId': req.params.playerId },
                        { winner: new mongoose.Types.ObjectId(req.params.playerId) },
                        { firstPlayer: new mongoose.Types.ObjectId(req.params.playerId) }
                    ]
                }
            },
            {
                $unwind: '$playerCommanderRemoved'
            },
            {
                $match: {
                    'playerCommanderRemoved.playerId': req.params.playerId
                }
            },
            {
                $group: {
                    _id: null,
                    totalRemovals: { $sum: '$playerCommanderRemoved.count' }
                }
            }
        ]);
        
        const commanderRemovals = commanderRemovedStats.length > 0 ? commanderRemovedStats[0].totalRemovals : 0;
        
        // Calcular quantas vezes foi archenemy
        const archenemyCount = await Match.countDocuments({
            archenemy: new mongoose.Types.ObjectId(req.params.playerId)
        });
        
        res.json({
            totalMatches,
            wins,
            losses: totalMatches - wins,
            winrate: parseFloat(winrate),
            winStreak: player.winStreak,
            bestWinStreak: player.bestWinStreak || 0,
            fastestWin: player.fastestWin === 999 ? null : player.fastestWin,
            longestMatch: player.longestMatch,
            commanderRemovals,
            archenemyCount,
            mostUsedDeck,
            deckStats: deckStats.map(deck => ({
                name: deck._id,
                total: deck.total,
                wins: deck.wins,
                winrate: deck.total > 0 ? 
                    ((deck.wins / deck.total) * 100).toFixed(1) : 0
            }))
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Salvar conquista (CORRIGIDO - PERMITE MÚLTIPLOS JOGADORES)
app.post('/api/achievements', async (req, res) => {
    console.log('🎯 REQUISIÇÃO RECEBIDA - /api/achievements POST');
    console.log('📋 Dados da requisição:', {
        playerId: req.body.playerId,
        achievementId: req.body.achievementId,
        name: req.body.name,
        xpReward: req.body.xpReward
    });
    
    try {
        const {
            playerId,
            achievementId,
            name,
            description,
            icon,
            xpReward,
            unlockedAt,
            progress
        } = req.body;

        if (!playerId || !achievementId || !unlockedAt) {
            return res.status(400).json({ error: 'playerId, achievementId e unlockedAt são obrigatórios' });
        }

        const unlockedDate = new Date(unlockedAt);
        if (Number.isNaN(unlockedDate.getTime())) {
            return res.status(400).json({ error: 'unlockedAt inválido' });
        }

        const existing = await Achievement.findOne({ playerId, achievementId });

        if (existing) {
            if (existing.unlocked === true || existing.unlockedAt) {
                // Já desbloqueado: não altere data/histórico
                console.log(`⚠️ Achievement "${name}" já desbloqueado para jogador ${playerId}`);
                return res.json(existing);
            }
            // Existente bloqueado → desbloqueia agora com a data da partida
            console.log(`🔓 Desbloqueando achievement bloqueado "${name}" para jogador ${playerId}`);
            existing.unlocked = true;
            existing.unlockedAt = unlockedDate;
            existing.progress = Math.max(existing.progress || 0, typeof progress === 'number' ? progress : 1);
            await existing.save();
            
            // Processar XP após desbloquear
            const achievement = existing;
            console.log('💾 Achievement desbloqueado no banco:', achievement._id);
        } else {
            // Não existe → criar desbloqueado
            console.log(`✨ Criando novo achievement "${name}" para jogador ${playerId}`);
            const achievement = await Achievement.create({
                playerId,
                achievementId,
                name,
                description,
                icon,
                xpReward,
                unlocked: true,
                unlockedAt: unlockedDate,
                progress: typeof progress === 'number' ? progress : 1,
            });
            console.log('💾 Achievement criado no banco:', achievement._id);
        }
        
        // Adicionar XP ao jogador
        const player = await Player.findById(playerId);
        if (player && xpReward) {
            console.log(`👤 Jogador encontrado: ${player.name || player._id} - XP atual: ${player.xp || 0}`);
            
            // Adicionar XP do achievement
            const newXP = (player.xp || 0) + xpReward;
            console.log(`📈 Calculando novo XP: ${player.xp || 0} + ${xpReward} = ${newXP}`);
            
            // Verificar level up
            let currentXP = newXP;
            let currentLevel = player.level || 1;
            let xpToNext = player.xpToNext || 100;
            
            while (currentXP >= xpToNext) {
                currentXP -= xpToNext;
                currentLevel++;
                xpToNext = Math.floor(xpToNext * 1.2);
                console.log(`🆙 LEVEL UP! Novo nível: ${currentLevel}`);
            }
            
            // Atualizar jogador
            const updateResult = await Player.findByIdAndUpdate(playerId, {
                xp: currentXP,
                level: currentLevel,
                xpToNext: xpToNext
            }, { new: true });
            
            console.log(`✅ XP adicionado para jogador ${playerId}: +${xpReward} XP (Achievement: ${name})`);
            console.log(`📊 Status final: Level ${currentLevel}, XP: ${currentXP}/${xpToNext}`);
        } else {
            console.log(`❌ Jogador não encontrado ou sem XP reward: playerId=${playerId}, xpReward=${xpReward}`);
        }
        
        // Retornar o achievement atualizado ou criado
        const finalAchievement = existing || await Achievement.findOne({ playerId, achievementId });
        res.status(201).json(finalAchievement);
    } catch (err) {
        // Race condition do índice único
        if (err.code === 11000) {
            const doc = await Achievement.findOne({ playerId: req.body.playerId || playerId, achievementId: req.body.achievementId || achievementId });
            if (doc) return res.json(doc);
        }
        console.error('Erro em POST /api/achievements:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Buscar conquistas do jogador
app.get('/api/achievements/:playerId', async (req, res) => {
    try {
        const achievements = await Achievement.find({ playerId: req.params.playerId })
            .sort({ unlockedAt: -1 });
        res.json(achievements);
    } catch (error) {
        console.error('Erro ao buscar conquistas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar jogador por ID (NOVA ROTA)
// Adicionar esta rota ANTES da rota existente /api/player/:name
app.get('/api/player/id/:id', async (req, res) => {
    try {
        const player = await Player.findById(req.params.id);
        
        if (!player) {
            return res.status(404).json({ error: 'Jogador não encontrado' });
        }
        
        res.json(player);
    } catch (error) {
        console.error('Erro ao buscar jogador por ID:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar jogador por nome (rota existente)
app.get('/api/player/:name', async (req, res) => {
    try {
        const player = await Player.findOne({ name: req.params.name });
        
        if (!player) {
            return res.status(404).json({ error: 'Jogador não encontrado' });
        }
        
        res.json(player);
    } catch (error) {
        console.error('Erro ao buscar jogador:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar conquistas em destaque do jogador
app.get('/api/players/:playerId/featured-achievements', async (req, res) => {
    try {
        const featured = await FeaturedAchievement.findOne({ playerId: req.params.playerId });
        res.json(featured ? featured.achievementIds : []);
    } catch (error) {
        console.error('Erro ao buscar conquistas em destaque:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Salvar conquistas em destaque do jogador
app.post('/api/players/:playerId/featured-achievements', async (req, res) => {
    try {
        const { achievementIds } = req.body;
        
        // Validar que não são mais de 5 conquistas
        if (achievementIds.length > 5) {
            return res.status(400).json({ error: 'Máximo de 5 conquistas em destaque permitidas' });
        }
        
        await FeaturedAchievement.findOneAndUpdate(
            { playerId: req.params.playerId },
            { achievementIds },
            { upsert: true, new: true }
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao salvar conquistas em destaque:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Desbloquear achievement especial com senha
app.post('/api/achievements/unlock-special', async (req, res) => {
    try {
        const { achievementId, password, playerId, customUnlockedAt } = req.body;
        
        // Verificar se a senha está correta
        const correctPassword = process.env.SPECIAL_ACHIEVEMENT_PASSWORD || 'default_password';
        if (password !== correctPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Senha incorreta. Tente novamente.' 
            });
        }
        
        // Verificar se o achievement já foi desbloqueado
        const existingAchievement = await Achievement.findOne({ 
            playerId: playerId, 
            achievementId: achievementId 
        });
        
        if (existingAchievement) {
            return res.status(400).json({ 
                success: false, 
                message: 'Este achievement já foi desbloqueado.' 
            });
        }
        
        // Função para processar data local corretamente
        function parseLocalDate(dateStr) {
            if (!dateStr) return new Date();
            if (dateStr instanceof Date) return dateStr;
            // espera 'YYYY-MM-DD'
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d, 12, 0, 0); // meio-dia evita "voltar 1 dia" por timezone
        }
        
        // Processar a data corretamente
        const unlockedDate = customUnlockedAt ? parseLocalDate(customUnlockedAt) : new Date();
        
        // Buscar dados do achievement
        const achievementData = {
            first_win: { name: 'Primeira Vitória', xpReward: 50 },
            win_10: { name: 'Veterano', xpReward: 100 },
            win_50: { name: 'Campeão', xpReward: 200 },
            win_100: { name: 'Lenda', xpReward: 500 },
            first_match: { name: 'Primeiro Passo', xpReward: 25 },
            match_10: { name: 'Dedicado', xpReward: 75 },
            match_50: { name: 'Persistente', xpReward: 150 },
            match_100: { name: 'Incansável', xpReward: 300 },
            win_streak_3: { name: 'Em Chamas', xpReward: 75 },
            win_streak_5: { name: 'Imparável', xpReward: 150 },
            win_streak_10: { name: 'Dominador', xpReward: 300 },
            archenemy_5: { name: 'Caçador de Arqui-inimigos', xpReward: 100 },
            archenemy_15: { name: 'Pesadelo dos Arqui-inimigos', xpReward: 200 },
            commander_mastery: { name: 'Maestria de Comandante', xpReward: 100 },
            card_owner_10: { name: 'Dono das Cartas', xpReward: 75 },
            card_owner_25: { name: 'Mestre das Cartas', xpReward: 100 },
            card_owner_50: { name: 'Lenda das Cartas', xpReward: 200 },
            commander_damage_kill: {
                name: 'Golpe Fatal do Comandante',
                description: 'Elimine um jogador com dano de comandante',
                icon: '⚔️',
                xpReward: 150
            },
            land_destruction: {
                name: 'Destruidor de Terras',
                description: 'Destrua uma Land',
                icon: '💥',
                xpReward: 100
            },
            total_land_destruction: {
                name: 'Apocalipse de Terras',
                description: 'Em uma única partida, destrua todas as lands de pelo menos um oponente',
                icon: '🌋',
                xpReward: 300
            },
            combo_win: {
                name: 'Mestre do Combo',
                description: 'Ganhe uma partida combando',
                icon: '🎯',
                xpReward: 200
            },
            first_win_new_deck: {
                name: 'Estreia Vitoriosa',
                description: 'Comece sua primeira partida com um deck novo e ganhe',
                icon: '🌟',
                xpReward: 300
            },
            precon_victory: {
                name: 'Poder Pré-Construído',
                description: 'Ganhe uma partida com um precon',
                icon: '📦',
                xpReward: 300
            }
        }[achievementId] || { name: 'Achievement Especial', xpReward: 50 };
        
        // Criar novo achievement
        const newAchievement = new Achievement({
            playerId: playerId,
            achievementId: achievementId,
            name: achievementData.name,
            description: achievementData.description || 'Achievement especial desbloqueado via senha',
            icon: achievementData.icon || '🏆',
            xpReward: achievementData.xpReward,
            progress: 1,
            unlocked: true,
            unlockedAt: unlockedDate  // Usando a data processada corretamente
        });
        
        await newAchievement.save();
        
        res.json({ 
            success: true, 
            message: `🏆 ${achievementData.name} desbloqueado com sucesso!`,
            achievement: newAchievement
        });
        
    } catch (error) {
        console.error('Erro ao desbloquear achievement especial:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// Atualizar título do jogador
app.put('/api/players/:id/title', async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;
        
        const player = await Player.findById(id);
        if (!player) {
            return res.status(404).json({ error: 'Jogador não encontrado' });
        }
        
        player.title = title;
        await player.save();
        
        res.json({ message: 'Título atualizado com sucesso', title });
    } catch (error) {
        console.error('Erro ao atualizar título:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Alterar senha do usuário
app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
        }
        
        // Buscar usuário
        const user = await Player.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Verificar senha atual
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }
        
        // Criptografar nova senha
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Atualizar senha no banco
        await Player.findByIdAndUpdate(req.user.userId, {
            password: hashedNewPassword
        });
        
        res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota de demo para testar XP de ranking (PROTEGIDO - APENAS MASTER)
app.post('/api/demo/ranking-xp/:playerId', authenticateToken, requireMaster, async (req, res) => {
    try {
        const { playerId } = req.params;
        const { xpChange } = req.body; // +60 para ganhar, -10 para perder
        
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({ error: 'Jogador não encontrado' });
        }
        
        // Aplicar mudança de XP usando a função existente
        const rankingUpdate = updatePlayerRanking(player, xpChange);
        
        // Atualizar jogador no banco
        player.rankTier = rankingUpdate.rankTier;
        player.rankDivision = rankingUpdate.rankDivision;
        player.rankXP = rankingUpdate.rankXP;
        
        await player.save();
        
        res.json({
            success: true,
            player: {
                rankTier: player.rankTier,
                rankDivision: player.rankDivision,
                rankXP: player.rankXP
            },
            xpChange
        });
    } catch (error) {
        console.error('Erro no demo de XP:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para estatísticas de comandantes removidos por jogador
// Endpoint para estatísticas de maestria por comandante único
app.get('/api/commander-mastery-stats/:playerId', async (req, res) => {
    try {
        const playerId = req.params.playerId;
        
        // Buscar todas as partidas onde o jogador participou
        const matches = await Match.find({
            $or: [
                { playerId: new mongoose.Types.ObjectId(playerId) },
                { 'commanders.playerId': playerId },
                { winner: new mongoose.Types.ObjectId(playerId) },
                { firstPlayer: new mongoose.Types.ObjectId(playerId) }
            ]
        });
        
        const commanderStats = {};
        
        // Processar cada partida
        matches.forEach(match => {
            // Encontrar o comandante usado pelo jogador nesta partida
            const playerCommander = match.commanders.find(cmd => cmd.playerId === playerId);
            
            if (playerCommander) {
                // Usar apenas o nome do comandante (sem partner) como chave única
                const commanderKey = playerCommander.name;
                
                // Verificar se foi vitória
                const isWin = match.winner.toString() === playerId || match.winner === playerId;
                
                // Encontrar quantas vezes o comandante foi removido nesta partida
                const removalData = match.playerCommanderRemoved.find(removal => removal.playerId === playerId);
                const removalsCount = removalData ? removalData.count : 0;
                
                // Verificar se o comandante foi carta do jogo E pertence ao jogador específico
                const isGameCard = match.gameCard && 
                    match.gameCard.ownerId === playerId &&
                    (match.gameCard.name === playerCommander.name || 
                     (playerCommander.partnerName && match.gameCard.name === playerCommander.partnerName));
                
                if (!commanderStats[commanderKey]) {
                    commanderStats[commanderKey] = {
                        name: playerCommander.name,
                        totalMatches: 0,
                        wins: 0,
                        totalRemovals: 0,
                        gameCardCount: 0
                    };
                }
                
                commanderStats[commanderKey].totalMatches += 1;
                if (isWin) commanderStats[commanderKey].wins += 1;
                commanderStats[commanderKey].totalRemovals += removalsCount;
                if (isGameCard) commanderStats[commanderKey].gameCardCount += 1;
            }
        });
        
        // Converter para array, calcular winrate e ordenar por total de partidas
        const statsArray = Object.values(commanderStats)
            .map(stat => ({
                ...stat,
                winrate: stat.totalMatches > 0 ? ((stat.wins / stat.totalMatches) * 100).toFixed(1) : '0.0'
            }))
            .sort((a, b) => b.totalMatches - a.totalMatches);
        
        res.json(statsArray);
    } catch (error) {
        console.error('Erro ao buscar estatísticas de maestria de comandantes:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint legado para comandantes removidos (mantido para compatibilidade)
app.get('/api/commander-removed-stats/:playerId', async (req, res) => {
    try {
        const playerId = req.params.playerId;
        
        // Buscar todas as partidas onde o jogador participou
        const matches = await Match.find({
            $or: [
                { playerId: new mongoose.Types.ObjectId(playerId) },
                { 'commanders.playerId': playerId },
                { winner: new mongoose.Types.ObjectId(playerId) },
                { firstPlayer: new mongoose.Types.ObjectId(playerId) }
            ]
        });
        
        const commanderStats = {};
        
        // Processar cada partida
        matches.forEach(match => {
            // Encontrar o comandante usado pelo jogador nesta partida
            const playerCommander = match.commanders.find(cmd => cmd.playerId === playerId);
            
            if (playerCommander) {
                const commanderKey = playerCommander.partnerName 
                    ? `${playerCommander.name} // ${playerCommander.partnerName}`
                    : playerCommander.name;
                
                // Encontrar quantas vezes o comandante foi removido nesta partida
                const removalData = match.playerCommanderRemoved.find(removal => removal.playerId === playerId);
                const removalsCount = removalData ? removalData.count : 0;
                
                if (!commanderStats[commanderKey]) {
                    commanderStats[commanderKey] = {
                        name: playerCommander.name,
                        partnerName: playerCommander.partnerName,
                        theme: playerCommander.themePrimary || playerCommander.theme,
                        totalRemovals: 0,
                        matchesPlayed: 0
                    };
                }
                
                commanderStats[commanderKey].totalRemovals += removalsCount;
                commanderStats[commanderKey].matchesPlayed += 1;
            }
        });
        
        // Converter para array e ordenar por total de remoções
        const statsArray = Object.values(commanderStats)
            .filter(stat => stat.totalRemovals > 0)
            .sort((a, b) => b.totalRemovals - a.totalRemovals);
        
        res.json(statsArray);
    } catch (error) {
        console.error('Erro ao buscar estatísticas de comandantes removidos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Acesse: http://localhost:${PORT}`);
});
