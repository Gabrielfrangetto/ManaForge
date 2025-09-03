class AchievementSystem {
    constructor() {
        this.achievements = this.initializeAchievements();
    }

    initializeAchievements() {
        return [
            // Conquistas existentes
            {
                id: 'first_win',
                name: 'Primeira Vitória',
                description: 'Ganhe sua primeira partida',
                icon: '🏆',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 50,
                trigger: 'win',
                category: 'Vitória'
            },
            {
                id: 'win_10',
                name: 'Veterano',
                description: 'Ganhe 10 partidas',
                icon: '⚔️',
                unlocked: false,
                progress: 0,
                maxProgress: 10,
                xpReward: 100,
                trigger: 'win_count',
                category: 'Vitória'
            },
            {
                id: 'win_50',
                name: 'Campeão',
                description: 'Ganhe 50 partidas',
                icon: '👑',
                unlocked: false,
                progress: 0,
                maxProgress: 50,
                xpReward: 200,
                trigger: 'win_count',
                category: 'Vitória'
            },
            {
                id: 'fast_win',
                name: 'Velocidade da Luz',
                description: 'Ganhe uma partida até o turno 6',
                icon: '⚡',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 150,
                trigger: 'fast_win',
                category: 'Vitória'
            },
            {
                id: 'win_streak_5',
                name: 'Sequência Imparável',
                description: 'Ganhe 5 partidas seguidas',
                icon: '🔥',
                unlocked: false,
                progress: 0,
                maxProgress: 5,
                xpReward: 300,
                trigger: 'win_streak',
                category: 'Lendárias'
            },
            {
                id: 'win_5',
                name: 'Iniciante Experiente',
                description: 'Ganhe 5 partidas',
                icon: '🎯',
                unlocked: false,
                progress: 0,
                maxProgress: 5,
                xpReward: 75,
                trigger: 'win_count',
                category: 'Vitória'
            },
            {
                id: 'win_25',
                name: 'Jogador Dedicado',
                description: 'Ganhe 25 partidas',
                icon: '🏅',
                unlocked: false,
                progress: 0,
                maxProgress: 25,
                xpReward: 150,
                trigger: 'win_count',
                category: 'Vitória'
            },
            {
                id: 'archenemy_5',
                name: 'Alvo Frequente',
                description: 'Seja archenemy 5 vezes',
                icon: '🎭',
                unlocked: false,
                progress: 0,
                maxProgress: 5,
                xpReward: 100,
                trigger: 'archenemy_count',
                category: 'Archenemy'
            },
            {
                id: 'archenemy_10',
                name: 'Inimigo Conhecido',
                description: 'Seja archenemy 10 vezes',
                icon: '👹',
                unlocked: false,
                progress: 0,
                maxProgress: 10,
                xpReward: 150,
                trigger: 'archenemy_count',
                category: 'Archenemy'
            },
            {
                id: 'archenemy_25',
                name: 'Terror da Mesa',
                description: 'Seja archenemy 25 vezes',
                icon: '💀',
                unlocked: false,
                progress: 0,
                maxProgress: 25,
                xpReward: 200,
                trigger: 'archenemy_count',
                category: 'Archenemy'
            },
            {
                id: 'archenemy_50',
                name: 'Lenda Sombria',
                description: 'Seja archenemy 50 vezes',
                icon: '🔱',
                unlocked: false,
                progress: 0,
                maxProgress: 50,
                xpReward: 200,
                trigger: 'archenemy_count',
                category: 'Archenemy'
            },
            {
                id: 'win_as_archenemy',
                name: 'Contra Todos',
                description: 'Ganhe uma partida sendo archenemy',
                icon: '⚡',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 100,
                trigger: 'win_archenemy',
                category: 'Archenemy'
            },
            {
                id: 'win_after_land_drop_miss',
                name: 'Recuperação Épica',
                description: 'Ganhe uma partida após perder land drop',
                icon: '🌱',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 75,
                trigger: 'win_after_land_miss',
                category: 'Vitória'
            },
            {
                id: 'win_after_mulligan_3',
                name: 'Persistência Premiada',
                description: 'Ganhe uma partida após mulligar pelo menos 3 vezes',
                icon: '🎲',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 100,
                trigger: 'win_after_mulligan_3',
                category: 'Vitória'
            },
            {
                id: 'first_land_drop_miss',
                name: 'Oportunidade Perdida',
                description: 'Perca um land drop pela primeira vez',
                icon: '💔',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 20,
                trigger: 'land_drop_miss',
                category: 'Land Drop'
            },
            {
                id: 'explosive_start',
                name: 'Início Explosivo',
                description: 'No seu primeiro turno, jogue land e mais 3 cards',
                icon: '💥',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 75,
                trigger: 'explosive_turn1',
                category: 'Land Drop'
            },
            {
                id: 'first_mulligan',
                name: 'Segunda Chance',
                description: 'Mulligue pela primeira vez',
                icon: '🔄',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 30,
                trigger: 'mulligan',
                category: 'Mulligan' // Movido de Tutorial para Mulligan
            },
            {
                id: 'first_archenemy',
                name: 'Inimigo Público',
                description: 'Seja archenemy pela primeira vez',
                icon: '😈',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 75,
                trigger: 'archenemy',
                category: 'Archenemy' // Movido de Tutorial para Archenemy
            },
            {
                id: 'first_game',
                name: 'Primeiro Passo',
                description: 'Comece um jogo pela primeira vez',
                icon: '🎮',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 25,
                trigger: 'first_player',
                category: 'Vitória' // Movido de Tutorial para Vitória
            },
            // NOVOS ACHIEVEMENTS DE COMANDANTE
            {
                id: 'commander_removed_1',
                name: 'Primeira Queda',
                description: 'Tenha seu comandante removido 1 vez',
                icon: '⚔️',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 25,
                trigger: 'commander_removed_count',
                category: 'Comandante'
            },
            {
                id: 'commander_removed_5',
                name: 'Alvo Persistente',
                description: 'Tenha seu comandante removido 5 vezes',
                icon: '🎯',
                unlocked: false,
                progress: 0,
                maxProgress: 5,
                xpReward: 50,
                trigger: 'commander_removed_count',
                category: 'Comandante'
            },
            {
                id: 'commander_removed_10',
                name: 'Ameaça Constante',
                description: 'Tenha seu comandante removido 10 vezes',
                icon: '🛡️',
                unlocked: false,
                progress: 0,
                maxProgress: 10,
                xpReward: 75,
                trigger: 'commander_removed_count',
                category: 'Comandante'
            },
            {
                id: 'commander_removed_25',
                name: 'Terror Recorrente',
                description: 'Tenha seu comandante removido 25 vezes',
                icon: '💀',
                unlocked: false,
                progress: 0,
                maxProgress: 25,
                xpReward: 125,
                trigger: 'commander_removed_count',
                category: 'Comandante'
            },
            {
                id: 'commander_removed_50',
                name: 'Lenda Imortal',
                description: 'Tenha seu comandante removido 50 vezes',
                icon: '👑',
                unlocked: false,
                progress: 0,
                maxProgress: 50,
                xpReward: 200,
                trigger: 'commander_removed_count',
                category: 'Comandante'
            },
            {
                id: 'win_after_commander_removed_5',
                name: 'Vingança do Comandante',
                description: 'Ganhe uma partida após ter seu comandante removido pelo menos 5 vezes nela',
                icon: '⚡',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 300,
                trigger: 'win_after_commander_removed_5',
                category: 'Lendárias'
            },
            {
                id: 'commander_as_match_card',
                name: 'Protagonista da Partida',
                description: 'Tenha seu comandante como carta da partida',
                icon: '🌟',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 75,
                trigger: 'commander_match_card',
                category: 'Comandante'
            },
            // Achievements Especiais - Desbloqueados por senha
            {
                id: 'commander_damage_kill',
                name: 'Golpe Fatal do Comandante',
                description: 'Elimine um jogador com dano de comandante',
                icon: '⚔️',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 100,
                requiresPassword: true,
                category: 'Especial'
            },
            {
                id: 'land_destruction',
                name: 'Destruidor de Terras',
                description: 'Destrua uma Land',
                icon: '💥',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 100,
                requiresPassword: true,
                category: 'Especial'
            },
            {
                id: 'total_land_destruction',
                name: 'Apocalipse de Terras',
                description: 'Em uma única partida, destrua todas as lands de pelo menos um oponente',
                icon: '🌋',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 200,
                requiresPassword: true,
                category: 'Especial'
            },
            {
                id: 'combo_win',
                name: 'Mestre do Combo',
                description: 'Ganhe uma partida combando',
                icon: '🎭',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 200,
                requiresPassword: true,
                category: 'Especial'
            },
            // NOVAS CONQUISTAS LENDÁRIAS
            {
                id: 'first_win_new_deck',
                name: 'Estreia Vitoriosa',
                description: 'Comece sua primeira partida com um deck novo e ganhe',
                icon: '🌟',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 300,
                requiresPassword: true,
                category: 'Lendárias'
            },
            {
                id: 'precon_victory',
                name: 'Poder Pré-Construído',
                description: 'Ganhe uma partida com um precon',
                icon: '📦',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 300,
                requiresPassword: true,
                category: 'Lendárias'
            },
            {
                id: 'first_match',
                name: 'Primeiro Passo',
                description: 'Jogue sua primeira partida',
                icon: '🎮',
                unlocked: false,
                progress: 0,
                maxProgress: 1,
                xpReward: 25,
                trigger: 'match_count',
                category: 'Participação'
            },
            {
                id: 'match_5',
                name: 'Explorador Iniciante',
                description: 'Jogue 5 partidas',
                icon: '🗺️',
                unlocked: false,
                progress: 0,
                maxProgress: 5,
                xpReward: 50,
                trigger: 'match_count',
                category: 'Participação'
            },
            {
                id: 'match_10',
                name: 'Jogador Ativo',
                description: 'Jogue 10 partidas',
                icon: '⚽',
                unlocked: false,
                progress: 0,
                maxProgress: 10,
                xpReward: 75,
                trigger: 'match_count',
                category: 'Participação'
            },
            {
                id: 'match_25',
                name: 'Veterano da Mesa',
                description: 'Jogue 25 partidas',
                icon: '🎯',
                unlocked: false,
                progress: 0,
                maxProgress: 25,
                xpReward: 100,
                trigger: 'match_count',
                category: 'Participação'
            },
            {
                id: 'match_50',
                name: 'Mestre da Participação',
                description: 'Jogue 50 partidas',
                icon: '🏛️',
                unlocked: false,
                progress: 0,
                maxProgress: 50,
                xpReward: 150,
                trigger: 'match_count',
                category: 'Participação'
            }
        ];
    }

    checkMatchAchievements(matchData, playerId) {
        const unlockedAchievements = [];
        
        // CORREÇÃO: Criar cópias independentes dos achievements para evitar conflitos de estado
        this.achievements.forEach(achievement => {
            if (achievement.unlocked) return;
            
            // Criar uma cópia do achievement para este jogador
            const achievementCopy = {
                ...achievement,
                progress: achievement.progress,
                unlocked: false
            };
            
            let shouldUnlock = false;
            
            switch (achievementCopy.trigger) {
                case 'win':
                    if (matchData.winner === playerId) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                case 'archenemy':
                    if (matchData.archenemy === playerId) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                case 'first_player':
                    if (matchData.firstPlayer === playerId) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                case 'mulligan':
                    const playerMulligan = matchData.playerMulligans?.find(m => m.playerId === playerId);
                    if (playerMulligan && playerMulligan.count > 0) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                case 'land_drop_miss':
                    const playerLandDrop = matchData.playerLandDrop?.find(ld => ld.playerId === playerId);
                    if (playerLandDrop && playerLandDrop.missed === true) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                case 'fast_win':
                    if (matchData.winner === playerId && matchData.turns <= 6) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                // NOVOS TRIGGERS PARA AS CONQUISTAS ESPECÍFICAS
                case 'win_archenemy':
                    if (matchData.winner === playerId && matchData.archenemy === playerId) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                case 'win_after_land_miss':
                    const playerLandDropWin = matchData.playerLandDrop?.find(ld => ld.playerId === playerId);
                    if (matchData.winner === playerId && playerLandDropWin && playerLandDropWin.missed === true) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                case 'win_after_mulligan_3':
                    const playerMulliganWin = matchData.playerMulligans?.find(m => m.playerId === playerId);
                    if (matchData.winner === playerId && playerMulliganWin && playerMulliganWin.count >= 3) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                case 'explosive_turn1':
                    const playerTurn1Data = matchData.playerTurn1?.find(t1 => t1.playerId === playerId);
                    
                    if (playerTurn1Data) {
                        const playDescription = playerTurn1Data.play.toLowerCase();
                        
                        if (playDescription.includes('land') && 
                            (playDescription.includes('3') || playDescription.includes('três'))) {
                            achievementCopy.progress = 1;
                            shouldUnlock = true;
                        }
                    }
                    break;
                    
                // NOVOS TRIGGERS PARA COMANDANTE
                case 'win_after_commander_removed_5':
                    const playerCommanderData = matchData.playerCommanderRemovals?.find(cr => cr.playerId === playerId);
                    if (matchData.winner === playerId && playerCommanderData && playerCommanderData.count >= 5) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
                    
                case 'commander_match_card':
                    const playerProfile = matchData.playerProfiles?.find(p => p.playerId === playerId);
                    
                    // LOGS DE DEBUG TEMPORÁRIOS
                    console.log('=== DEBUG COMMANDER MATCH CARD ===');
                    console.log('playerId:', playerId);
                    console.log('playerProfile:', playerProfile);
                    console.log('playerProfile.commander:', playerProfile?.commander);
                    console.log('matchData.gameCard:', matchData.gameCard);
                    console.log('matchData.gameCard.name:', matchData.gameCard?.name);
                    console.log('matchData.gameCard.ownerId:', matchData.gameCard?.ownerId);
                    console.log('ownerId === playerId:', matchData.gameCard?.ownerId === playerId);
                    console.log('commander === gameCard.name:', playerProfile?.commander === matchData.gameCard?.name);
                    console.log('==================================');
                    
                    if (playerProfile && playerProfile.commander && 
                        matchData.gameCard && matchData.gameCard.name && 
                        playerProfile.commander === matchData.gameCard.name &&
                        matchData.gameCard.ownerId === playerId) {
                        achievementCopy.progress = 1;
                        shouldUnlock = true;
                    }
                    break;
            }
            
            if (shouldUnlock) {
                achievementCopy.unlocked = true;
                unlockedAchievements.push(achievementCopy);
            }
        });
        
        return unlockedAchievements;
    }

    // Verificar conquistas baseadas em estatísticas acumuladas
    checkStatAchievements(playerStats) {
        const unlockedAchievements = [];
        
        console.log('Verificando conquistas com estatísticas:', playerStats); // Debug
        
        this.achievements.forEach(achievement => {
            if (achievement.unlocked) return;
            
            let shouldUnlock = false;
            
            switch (achievement.trigger) {
                case 'win_count':
                    achievement.progress = playerStats.wins || 0;
                    shouldUnlock = achievement.progress >= achievement.maxProgress;
                    console.log(`Conquista ${achievement.name}: progresso ${achievement.progress}/${achievement.maxProgress}`);
                    break;
                    
                case 'win_streak':
                    // Linha ~438 e ~535
                    achievement.progress = playerStats.bestWinStreak || 0; // Usar recorde em vez de sequência atual
                    shouldUnlock = achievement.progress >= achievement.maxProgress;
                    console.log(`Conquista ${achievement.name}: progresso ${achievement.progress}/${achievement.maxProgress}`);
                    break;
                    
                case 'commander_removed_count':
                    achievement.progress = playerStats.commanderRemovals || 0;
                    shouldUnlock = achievement.progress >= achievement.maxProgress;
                    console.log(`Conquista ${achievement.name}: progresso ${achievement.progress}/${achievement.maxProgress}`);
                    break;
                    
                case 'archenemy_count':
                    achievement.progress = playerStats.archenemyCount || 0;
                    shouldUnlock = achievement.progress >= achievement.maxProgress;
                    console.log(`Conquista ${achievement.name}: progresso ${achievement.progress}/${achievement.maxProgress}`);
                    break;
                case 'match_count':
                    achievement.progress = playerStats.totalMatches || 0;
                    shouldUnlock = achievement.progress >= achievement.maxProgress;
                    console.log(`Conquista ${achievement.name}: progresso ${achievement.progress}/${achievement.maxProgress}`);
                    break;
            }
            
            if (shouldUnlock) {
                achievement.unlocked = true;
                unlockedAchievements.push(achievement);
            }
        });
        
        return unlockedAchievements;
    }

    // Salvar conquista no servidor
    async saveAchievement(playerId, achievement, customUnlockedAt = null) {
        try {
            const response = await fetch('/api/achievements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    playerId: playerId,
                    achievementId: achievement.id,
                    name: achievement.name,
                    description: achievement.description,
                    icon: achievement.icon,
                    xpReward: achievement.xpReward,
                    unlockedAt: customUnlockedAt || new Date()
                })
            });
            
            if (!response.ok) {
                throw new Error('Erro ao salvar conquista');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao salvar conquista:', error);
            throw error;
        }
    }

    // Carregar conquistas do jogador do servidor
    async loadPlayerAchievements(playerId) {
        try {
            // IMPORTANTE: Resetar todas as conquistas antes de carregar
            this.achievements.forEach(achievement => {
                achievement.unlocked = false;
                achievement.progress = 0;
            });
            
            const response = await fetch(`/api/achievements/${playerId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar conquistas');
            }
            
            const serverAchievements = await response.json();
            
            // Marcar conquistas como desbloqueadas baseado nos dados do servidor
            serverAchievements.forEach(serverAch => {
                const localAch = this.achievements.find(a => a.id === serverAch.achievementId);
                if (localAch) {
                    localAch.unlocked = true;
                    localAch.progress = localAch.maxProgress;
                    localAch.unlockedAt = serverAch.unlockedAt; // Armazenar data de desbloqueio
                }
            });
            
            // NOVO: Carregar estatísticas do jogador e recalcular progresso das conquistas baseadas em stats
            try {
                const statsResponse = await fetch(`/api/stats/${playerId}`, {
                    credentials: 'include'
                });
                if (statsResponse.ok) {
                    const playerStats = await statsResponse.json();
                    
                    // Apenas atualizar progresso para exibição, sem salvar
                    this.achievements.forEach(achievement => {
                        if (!achievement.unlocked) {
                            switch (achievement.trigger) {
                                case 'win_count':
                                    achievement.progress = playerStats.wins || 0;
                                    break;
                                case 'win_streak':
                                    achievement.progress = playerStats.winStreak || 0;
                                    break;
                                case 'commander_removed_count':
                                    achievement.progress = playerStats.commanderRemovals || 0;
                                    break;
                                case 'match_count':
                                    achievement.progress = playerStats.totalMatches || 0;
                                    break;
                            }
                        }
                    });
                }
            } catch (statsError) {
                console.error('Erro ao carregar estatísticas para progresso das conquistas:', statsError);
            }
            
            return this.achievements;
        } catch (error) {
            console.error('Erro ao carregar conquistas:', error);
            // Em caso de erro, resetar conquistas para estado inicial
            this.achievements.forEach(achievement => {
                achievement.unlocked = false;
                achievement.progress = 0;
            });
            return this.achievements;
        }
    }

    // Processar conquistas após salvar uma partida
    async processMatchAchievements(matchData, playerId, playerStats, gameSystem) {
        // Verificar conquistas baseadas na partida
        const matchAchievements = this.checkMatchAchievements(matchData, playerId);
        
        // Verificar conquistas baseadas em estatísticas
        const statAchievements = this.checkStatAchievements(playerStats);
        
        // Combinar todas as conquistas desbloqueadas
        const allUnlocked = [...matchAchievements, ...statAchievements];
        
        // Usar a data da partida para achievements baseados na partida, data atual para achievements de estatística
        const matchDate = matchData?.date ? new Date(matchData.date) : (matchData?.createdAt ? new Date(matchData.createdAt) : new Date());
        
        // Salvar cada conquista desbloqueada (servidor processa XP automaticamente)
        // Para achievements de estatística, buscar data da primeira partida
        
        // Salvar achievements com datas apropriadas
        for (const achievement of allUnlocked) {
            try {
                               
                const unlockedAt = matchDate; // serve p/ eventos de partida e p/ estatística que disparou agora
                await this.saveAchievement(playerId, achievement, unlockedAt);
                                
                // CORREÇÃO: Mostrar notificação APENAS para o usuário master, XP é processado no servidor
                if (gameSystem && gameSystem.currentPlayerId === playerId) {
                    // Mostrar notificação
                    if (gameSystem.showNotification) {
                        gameSystem.showNotification(
                            '🏆 Conquista Desbloqueada!', 
                            `${achievement.name} - +${achievement.xpReward} XP`
                        );
                    }
                }
            } catch (error) {
                console.error('Erro ao salvar achievement:', achievement.name, error);
            }
        }
        
        return allUnlocked;
    }

    // Obter conquista por ID
    getAchievement(id) {
        return this.achievements.find(a => a.id === id);
    }

    // Obter todas as conquistas
    getAllAchievements() {
        return this.achievements;
    }

    // Obter conquistas desbloqueadas
    getUnlockedAchievements() {
        return this.achievements.filter(a => a.unlocked);
    }

    // Obter conquistas bloqueadas
    getLockedAchievements() {
        return this.achievements.filter(a => !a.unlocked);
    }

    // Adicionar após o método getLockedAchievements
    
    getCategories() {
        const categories = [...new Set(this.achievements.map(achievement => achievement.category))];
        return categories.sort();
    }
    
    getAchievementsByCategory(category) {
        return this.achievements.filter(achievement => achievement.category === category);
    }
    
    getPaginatedAchievements(achievements, page = 1, itemsPerPage = 10) {
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return {
            achievements: achievements.slice(startIndex, endIndex),
            totalPages: Math.ceil(achievements.length / itemsPerPage),
            currentPage: page,
            totalItems: achievements.length
        };
    }
    
    // Métodos para conquistas em destaque
    async getFeaturedAchievements(playerId) {
        try {
            const response = await fetch(`/api/players/${playerId}/featured-achievements`, {
                credentials: 'include'
            });
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Erro ao carregar conquistas em destaque:', error);
            return [];
        }
    }
    
    async setFeaturedAchievements(playerId, achievementIds) {
        try {
            const response = await fetch(`/api/players/${playerId}/featured-achievements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ achievementIds })
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao salvar conquistas em destaque:', error);
            return false;
        }
    }

    // Método para verificar senha e desbloquear achievements especiais
    async unlockSpecialAchievement(achievementId, password, playerId, customUnlockedAt = null) {
        try {
            const response = await fetch('/api/achievements/unlock-special', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    achievementId: achievementId,
                    password: password,
                    playerId: playerId,
                    customUnlockedAt: customUnlockedAt
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Erro ao desbloquear achievement');
            }
            
            // Atualizar o achievement local se desbloqueado com sucesso
            const achievement = this.getAchievement(achievementId);
            if (achievement && result.success) {
                achievement.unlocked = true;
                achievement.progress = achievement.maxProgress;
            }
            
            return result;
        } catch (error) {
            throw new Error(error.message || 'Erro de conexão com o servidor');
        }
    }

    // Obter achievements especiais (que requerem senha)
    getSpecialAchievements() {
        return this.achievements.filter(achievement => achievement.requiresPassword);
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AchievementSystem;
} else {
    window.AchievementSystem = AchievementSystem;
}