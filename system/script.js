class MagicGameSystem {
    constructor() {
        this.apiUrl = '/api';
        this.currentPlayerId = localStorage.getItem('currentPlayerId');
        this.playerData = null;
        this.authToken = null; // Token agora vem via cookie
        this.currentUser = null;
        this.isAuthenticated = false;
        this.allPlayers = [];
        this.updatingTopCommanders = false; // Flag para evitar execução simultânea
        this.commanders = [];
        
        // Sistema de timeout para inatividade
        this.inactivityTimeout = 30 * 60 * 1000; // 30 minutos em millisegundos
        this.inactivityTimer = null;
        this.lastActivity = Date.now();
        
        // Sistema de verificação de sessão
        this.sessionCheckInterval = null;
        this.sessionWarningShown = false;
        this.selectedAvatar = null;
        this.avatarPlaceholders = [
            { emoji: '🧙‍♂️', color: '#ff8c00', name: 'Mago' },
            { emoji: '⚔️', color: '#4a90e2', name: 'Guerreiro' },
            { emoji: '🛡️', color: '#7ed321', name: 'Defensor' },
            { emoji: '🔥', color: '#d0021b', name: 'Fogo' },
            { emoji: '🌟', color: '#9013fe', name: 'Estrela' },
            { emoji: '💎', color: '#50e3c2', name: 'Diamante' },
            { emoji: '👑', color: '#f5a623', name: 'Rei' },
            { emoji: '🦄', color: '#bd10e0', name: 'Unicórnio' },
            { emoji: '🐉', color: '#b8e986', name: 'Dragão' },
            { emoji: '⚡', color: '#4a5568', name: 'Raio' },
            { emoji: '🗡️', color: '#e74c3c', name: 'Espada' },
            { emoji: '🔮', color: '#3498db', name: 'Cristal' },
            { emoji: '🍀', color: '#2ecc71', name: 'Trevo' },
            { emoji: '☀️', color: '#f39c12', name: 'Sol' },
            { emoji: '🌙', color: '#9b59b6', name: 'Lua' },
            { emoji: '🌊', color: '#1abc9c', name: 'Água' }
        ];
        this.achievementSystem = new AchievementSystem();
        this.achievements = [];
        this.missions = this.initializeMissions();
        this.matchHistory = [];
        this.rankSystem = this.initializeRankSystem();
        
        // Propriedades para paginação e filtros de achievements
        this.achievementsPerPage = 10;
        this.currentAchievementsPage = 1;
        this.currentCategoryFilter = 'all';
        this.currentSearchFilter = '';
        this.featuredAchievements = [];
        this.achievementsControlsSetup = false;
        this.achievementManager = {
            getFeaturedAchievements: () => {
                const featuredIds = JSON.parse(localStorage.getItem(`featuredAchievements_${this.currentPlayerId}`) || '[]');
                return this.achievements.filter(a => featuredIds.includes(a.id));
            },
            setFeaturedAchievements: (ids) => {
                localStorage.setItem(`featuredAchievements_${this.currentPlayerId}`, JSON.stringify(ids));
            }
        };
        
        // Flags para controle de listeners e performance
        this.featuredModalListenersSetup = false;
        this.featuredModalGridListener = null;
        this.featuredModalCurrentPage = 0;
        this.featuredModalItemsPerBatch = 20;
        this.featuredModalIsRendering = false;
    }

    async init() {
        try {
            // Verificar autenticação primeiro
            const isAuthenticated = await this.checkAuthentication();
            
            if (isAuthenticated) {
                await this.loadAllPlayers();
                await this.loadOrCreatePlayer();
            }
            
            // Garantir que matchHistory seja inicializado antes de updateUI
            if (!Array.isArray(this.matchHistory)) {
                this.matchHistory = [];
            }
            
            this.setupEventListeners();
            this.setupPlayerSelection();
            this.setupAvatarSelection();
            this.setupAchievementsControls();
            this.updateUI();
            this.startDailyReset();
            this.setupMatchForm();
        } catch (error) {
            console.error('Erro durante inicialização:', error);
            // Garantir que temos dados mínimos para funcionar
            if (!this.playerData) {
                this.playerData = this.loadPlayerDataFromLocal();
            }
            if (!Array.isArray(this.matchHistory)) {
                this.matchHistory = [];
            }
            this.updateUI();
        }
    }

    async loadAllPlayers() {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Token agora vem via cookie httpOnly
            
            const response = await fetch(`${this.apiUrl}/players`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });
            
            if (response.ok) {
                this.allPlayers = await response.json();
                this.updatePlayerSelector();
                this.populateWinnerSelector();
                this.populateArchenemySelector();
            } else {
                console.error('Erro ao carregar jogadores:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Erro ao carregar lista de jogadores:', error);
        }
    }

    updatePlayerSelector() {
        const selector = document.getElementById('playerSelector');
        if (!selector) return;

        selector.innerHTML = '';
        
        if (this.allPlayers.length === 0) {
            selector.innerHTML = '<option value="">Nenhum jogador encontrado</option>';
            return;
        }

        this.allPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player._id;
            option.textContent = player.name;
            if (player._id === this.currentPlayerId) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
    }

    setupPlayerSelection() {
        const selector = document.getElementById('playerSelector');
        const addPlayerBtn = document.getElementById('addPlayerBtn');
        const newPlayerModal = document.getElementById('newPlayerModal');
        const newPlayerForm = document.getElementById('newPlayerForm');
        const cancelBtn = document.getElementById('cancelNewPlayer');

        // Mudança de jogador
        selector?.addEventListener('change', async (e) => {
            const newPlayerId = e.target.value;
            if (newPlayerId && newPlayerId !== this.currentPlayerId) {
                await this.switchPlayer(newPlayerId);
            }
        });

        // Abrir modal de novo jogador
        addPlayerBtn?.addEventListener('click', () => {
            newPlayerModal.style.display = 'block';
            document.getElementById('newPlayerName').focus();
        });

        // Fechar modal
        cancelBtn?.addEventListener('click', () => {
            newPlayerModal.style.display = 'none';
            this.clearNewPlayerForm();
        });

        // Fechar modal clicando fora
        newPlayerModal?.addEventListener('click', (e) => {
            if (e.target === newPlayerModal) {
                newPlayerModal.style.display = 'none';
                this.clearNewPlayerForm();
            }
        });

        // Criar novo jogador
        newPlayerForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createNewPlayerFromForm();
        });
    }

    async switchPlayer(playerId) {
        try {
            const response = await fetch(`${this.apiUrl}/player/id/${playerId}`, {
                credentials: 'include'
            });
            if (response.ok) {
                this.playerData = await response.json();
                this.currentPlayerId = playerId;
                
                // Garantir que avatarId existe
                if (this.playerData.avatarId === undefined || this.playerData.avatarId === null) {
                    this.playerData.avatarId = 0; // Avatar padrão
                }
                
                // Garantir que frameId existe
                if (this.playerData.frameId === undefined || this.playerData.frameId === null) {
                    this.playerData.frameId = 'none'; // Frame padrão
                }
                
                localStorage.setItem('currentPlayerId', playerId);
                localStorage.setItem('magicPlayerData', JSON.stringify(this.playerData));
                
                // Carregar estatísticas do servidor
                await this.loadPlayerStats();
                
                // Recarregar conquistas para o novo jogador
                await this.initializeAchievements();
                
                // Tentar carregar histórico, mas não falhar se der erro
                try {
                    await this.loadMatchHistory();
                } catch (historyError) {
                    console.warn('Aviso: Não foi possível carregar o histórico de partidas:', historyError);
                    // Continuar mesmo se o histórico falhar
                }
                
                this.updateUI();
                this.showSuccessMessage(`Jogador alterado para: ${this.playerData.name}`);
            } else {
                throw new Error('Jogador não encontrado');
            }
        } catch (error) {
            console.error('Erro ao trocar jogador:', error);
            this.showErrorMessage('Erro ao carregar jogador');
        }
    }

    async createNewPlayerFromForm() {
        const name = document.getElementById('newPlayerName').value.trim();
        const title = document.getElementById('newPlayerTitle').value.trim();
        const avatar = document.getElementById('newPlayerAvatar').value.trim();

        if (!name) {
            this.showErrorMessage('Nome do jogador é obrigatório');
            return;
        }

        // Verificar se já existe um jogador com esse nome
        if (this.allPlayers.some(player => player.name.toLowerCase() === name.toLowerCase())) {
            this.showErrorMessage('Já existe um jogador com esse nome');
            return;
        }

        const newPlayerData = {
            name: name,
            title: title || 'Planeswalker Iniciante',
            avatar: avatar || 'https://via.placeholder.com/120x120/4a5568/ffffff?text=Avatar',
            level: 1,
            xp: 0,
            xpToNext: 300,
            manaCoins: 250,
            rankPoints: 1000,
            rank: 'Bronze I',
            rankIcon: '🥉',
            totalMatches: 0,
            wins: 0,
            winStreak: 0,
            fastestWin: 999,
            longestMatch: 0,
            favoriteDecks: {}
        };

        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Token agora vem via cookie httpOnly
            
            const response = await fetch(`${this.apiUrl}/player`, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(newPlayerData)
            });

            if (response.ok) {
                const createdPlayer = await response.json();
                
                // Atualizar lista de jogadores
                await this.loadAllPlayers();
                
                // Trocar para o novo jogador
                await this.switchPlayer(createdPlayer._id);
                
                // Fechar modal
                document.getElementById('newPlayerModal').style.display = 'none';
                this.clearNewPlayerForm();
                
                this.showSuccessMessage(`Jogador "${createdPlayer.name}" criado com sucesso!`);
            } else {
                throw new Error('Erro ao criar jogador');
            }
        } catch (error) {
            console.error('Erro ao criar jogador:', error);
            this.showErrorMessage('Erro ao criar novo jogador');
        }
    }

    setupAvatarSelection() {
        const avatarModal = document.getElementById('avatarModal');
        const cancelBtn = document.getElementById('cancelAvatar');
        const saveBtn = document.getElementById('saveAvatar');

        // Configurar abas
        this.setupAvatarTabs();

        // Usar delegação de eventos para o avatar
        document.addEventListener('click', (e) => {
            if (e.target.closest('.avatar-frame') || e.target.classList.contains('avatar-display')) {
                e.preventDefault();
                this.openAvatarModal();
            }
        });

        // Fechar modal
        cancelBtn?.addEventListener('click', () => {
            if (avatarModal) {
                avatarModal.style.display = 'none';
            }
            this.selectedAvatar = null;
        });

        // Fechar modal clicando fora
        avatarModal?.addEventListener('click', (e) => {
            if (e.target === avatarModal) {
                avatarModal.style.display = 'none';
                this.selectedAvatar = null;
            }
        });

        // Salvar avatar selecionado
        saveBtn?.addEventListener('click', async () => {
            if (this.selectedAvatar !== null || this.selectedFrame !== null) {
                try {
                    // Salvar tanto avatar quanto frame
                    if (this.selectedAvatar !== null) {
                        await this.updatePlayerAvatar(this.selectedAvatar);
                    }
                    if (this.selectedFrame !== null) {
                        await this.updatePlayerFrame(this.selectedFrame);
                    }
                    if (avatarModal) {
                        avatarModal.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Erro ao salvar avatar/frame:', error);
                    this.showErrorMessage('Erro ao salvar avatar/frame');
                }
            } else {
                this.showErrorMessage('Por favor, selecione um avatar ou frame');
            }
        });
    }

    // Nova função para configurar as abas
    setupAvatarTabs() {
        const tabs = document.querySelectorAll('.avatar-tab');
        const panels = document.querySelectorAll('.tab-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;

                // Remover classe active de todas as abas e painéis
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                // Adicionar classe active à aba clicada e seu painel
                tab.classList.add('active');
                document.getElementById(`${targetTab}-panel`).classList.add('active');

                // Carregar conteúdo da aba se necessário
                if (targetTab === 'frames') {
                    this.loadFrames();
                }
            });
        });
    }

    // Nova função para carregar frames
    loadFrames() {
        const frameGrid = document.getElementById('frameGrid');
        
        // Evitar recarregar se já foi carregado
        if (frameGrid.children.length > 0) return;
        
        // Obter rank atual do jogador
        const currentRankTier = this.playerData?.rankTier || 'Bronze';
        
        // Mapeamento de ranks para frames
        const rankFrameMapping = {
            'Bronze': ['none', 'fire', 'ice', 'lightning', 'shadow', 'bronzerank'],
            'Prata': ['none', 'fire', 'ice', 'lightning', 'shadow', 'bronzerank', 'silverrank'],
            'Ouro': ['none', 'fire', 'ice', 'lightning', 'shadow', 'bronzerank', 'silverrank', 'goldrank'],
            'Platina': ['none', 'fire', 'ice', 'lightning', 'shadow', 'bronzerank', 'silverrank', 'goldrank', 'platinumrank'],
            'Diamante': ['none', 'fire', 'ice', 'lightning', 'shadow', 'bronzerank', 'silverrank', 'goldrank', 'platinumrank', 'diamondrank'],
            'Master': ['none', 'fire', 'ice', 'lightning', 'shadow', 'bronzerank', 'silverrank', 'goldrank', 'platinumrank', 'diamondrank', 'masterrank'],
            'Grandmaster': ['none', 'fire', 'ice', 'lightning', 'shadow', 'bronzerank', 'silverrank', 'goldrank', 'platinumrank', 'diamondrank', 'masterrank', 'grandmasterrank']
        };
        
        // Lista completa de frames disponíveis
        const allFrames = [
            { id: 'none', name: 'Sem Frame', image: null },
            { id: 'fire', name: 'Fire', image: 'assets/frames/basicfireframe.png' },
            { id: 'ice', name: 'Ice', image: 'assets/frames/basiciceframe.png' },
            { id: 'lightning', name: 'Lightning', image: 'assets/frames/basiclightningframe.png' },
            { id: 'shadow', name: 'Shadow', image: 'assets/frames/basicshadowframe.png' },
            { id: 'bronzerank', name: 'Bronze Rank', image: 'assets/frames/bronzerankframe.png' },
            { id: 'silverrank', name: 'Silver Rank', image: 'assets/frames/silverrankframe.png' },
            { id: 'goldrank', name: 'Gold Rank', image: 'assets/frames/goldrankframe.png' },
            { id: 'platinumrank', name: 'Platinum Rank', image: 'assets/frames/platinumrankframe.png' },
            { id: 'diamondrank', name: 'Diamond Rank', image: 'assets/frames/diamondrankframe.png' },
            { id: 'masterrank', name: 'Master Rank', image: 'assets/frames/masterrankframe.png' },
            { id: 'grandmasterrank', name: 'Grandmaster Rank', image: 'assets/frames/grandmasterrankframe.png' }
        ];
        
        // Filtrar frames disponíveis baseado no rank
        const availableFrameIds = rankFrameMapping[currentRankTier] || rankFrameMapping['Bronze'];
        const frames = allFrames.filter(frame => availableFrameIds.includes(frame.id));
        
        frameGrid.innerHTML = '';
        
        frames.forEach(frame => {
            const frameOption = document.createElement('div');
            frameOption.className = 'frame-option';
            frameOption.dataset.frameId = frame.id;
            frameOption.title = frame.name;
            
            if (frame.image) {
                // Usar o frame como background, igual ao perfil
                frameOption.style.backgroundImage = `url('${frame.image}')`;
                frameOption.style.backgroundSize = 'contain';
                frameOption.style.backgroundRepeat = 'no-repeat';
                frameOption.style.backgroundPosition = 'center';
                frameOption.innerHTML = `<div class="frame-name">${frame.name}</div>`;
            } else {
                // Estilo especial para "Sem Frame"
                frameOption.classList.add('no-frame');
                frameOption.innerHTML = `
                    <div style="color: #a0aec0; font-size: 32px; display: flex; align-items: center; justify-content: center; height: 100%;">🚫</div>
                    <div class="frame-name">${frame.name}</div>
                `;
            }
            
            // Marcar frame atual como selecionado
            if (this.playerData && this.playerData.frameId === frame.id) {
                frameOption.classList.add('selected');
                this.selectedFrame = frame.id;
            }
            
            frameOption.addEventListener('click', () => {
                // Remover seleção anterior
                document.querySelectorAll('.frame-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Selecionar novo frame
                frameOption.classList.add('selected');
                this.selectedFrame = frame.id;
            });
            
            frameGrid.appendChild(frameOption);
        });
        
        // Adicionar frames bloqueados para mostrar o que está por vir
        const lockedFrameIds = allFrames.filter(frame => !availableFrameIds.includes(frame.id));
        
        lockedFrameIds.forEach(frame => {
            const frameOption = document.createElement('div');
            frameOption.className = 'frame-option locked';
            frameOption.dataset.frameId = frame.id;
            frameOption.title = `${frame.name} - Desbloqueado em ${this.getRequiredRankForFrame(frame.id)}`;
            
            if (frame.image) {
                frameOption.style.backgroundImage = `url('${frame.image}')`;
                frameOption.style.backgroundSize = 'contain';
                frameOption.style.backgroundRepeat = 'no-repeat';
                frameOption.style.backgroundPosition = 'center';
                frameOption.style.filter = 'grayscale(100%) brightness(0.5)';
                frameOption.innerHTML = `
                    <div class="frame-name" style="color: #666;">${frame.name}</div>
                    <div class="lock-icon" style="position: absolute; top: 5px; right: 5px; font-size: 20px;">🔒</div>
                `;
            }
            
            // Não permitir seleção de frames bloqueados
            frameOption.style.cursor = 'not-allowed';
            frameOption.style.opacity = '0.6';
            
            frameGrid.appendChild(frameOption);
        });
    }
    
    // Função auxiliar para obter o rank necessário para um frame
    getRequiredRankForFrame(frameId) {
        const frameRankMapping = {
            'bronzerank': 'Bronze',
            'silverrank': 'Prata',
            'goldrank': 'Ouro',
            'platinumrank': 'Platina',
            'diamondrank': 'Diamante',
            'masterrank': 'Master',
            'grandmasterrank': 'Grandmaster'
        };
        
        return frameRankMapping[frameId] || 'Bronze';
    }

    openAvatarModal() {
        const avatarModal = document.getElementById('avatarModal');
        
        // Resetar para a aba de avatares
        document.querySelectorAll('.avatar-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        
        document.querySelector('[data-tab="avatars"]').classList.add('active');
        document.getElementById('avatars-panel').classList.add('active');
        
        const avatarGrid = document.getElementById('avatarGrid');
        
        // Limpar grid
        avatarGrid.innerHTML = '';
        
        // Adicionar avatares placeholder
        this.avatarPlaceholders.forEach((avatar, index) => {
            const avatarOption = document.createElement('div');
            avatarOption.className = 'avatar-option';
            avatarOption.style.background = `linear-gradient(135deg, ${avatar.color} 0%, ${this.darkenColor(avatar.color, 20)} 100%)`;
            avatarOption.innerHTML = `<span style="font-size: 40px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">${avatar.emoji}</span>`;
            avatarOption.title = avatar.name;
            avatarOption.dataset.avatarId = index;
            
            // Marcar avatar atual como selecionado
            if (this.playerData && this.playerData.avatarId === index) {
                avatarOption.classList.add('selected');
                this.selectedAvatar = index;
            }
            
            avatarOption.addEventListener('click', () => {
                // Remover seleção anterior
                document.querySelectorAll('.avatar-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Selecionar novo avatar
                avatarOption.classList.add('selected');
                this.selectedAvatar = index;
            });
            
            avatarGrid.appendChild(avatarOption);
        });
        
        avatarModal.style.display = 'block';
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    async updatePlayerAvatar(avatarId) {
        console.log('🔄 Atualizando avatar:', { avatarId, currentPlayerId: this.currentPlayerId });
        
        if (!this.playerData || !this.currentPlayerId) {
            this.showErrorMessage('Erro: Dados do jogador não encontrados');
            return;
        }

        if (avatarId < 0 || avatarId >= this.avatarPlaceholders.length) {
            this.showErrorMessage('Avatar inválido selecionado');
            return;
        }

        try {
            // Atualizar dados locais
            this.playerData.avatarId = avatarId;
            this.playerData.avatar = `avatar_${avatarId}`;
            
            console.log('💾 Salvando no servidor:', this.playerData);
            
            // Salvar no servidor
            const response = await fetch(`${this.apiUrl}/player/${this.currentPlayerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(this.playerData)
            });

            if (response.ok) {
                const savedData = await response.json();
                console.log('✅ Avatar salvo no servidor:', savedData.avatarId);
                
                // Atualizar interface
                this.updatePlayerAvatarDisplay(avatarId);
                this.showSuccessMessage('Avatar atualizado com sucesso!');
            } else {
                const errorData = await response.text();
                console.error('❌ Erro do servidor:', errorData);
                throw new Error(`Erro ao salvar no servidor: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar avatar:', error);
            this.showErrorMessage(`Erro ao atualizar avatar: ${error.message}`);
        }
    }

    async updatePlayerFrame(frameId) {
        console.log('🔄 Atualizando frame:', { frameId, currentPlayerId: this.currentPlayerId });
        
        if (!this.playerData || !this.currentPlayerId) {
            this.showErrorMessage('Erro: Dados do jogador não encontrados');
            return;
        }

        try {
            // Atualizar dados locais
            this.playerData.frameId = frameId;
            
            console.log('💾 Salvando frame no servidor:', this.playerData);
            
            // Salvar no servidor
            const response = await fetch(`${this.apiUrl}/player/${this.currentPlayerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(this.playerData)
            });

            if (response.ok) {
                const savedData = await response.json();
                console.log('✅ Frame salvo no servidor:', savedData.frameId);
                
                // Atualizar interface
                this.updatePlayerAvatarDisplay(this.playerData.avatarId || 0);
                this.showSuccessMessage('Frame atualizado com sucesso!');
            } else {
                const errorData = await response.text();
                console.error('❌ Erro do servidor:', errorData);
                throw new Error(`Erro ao salvar no servidor: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar frame:', error);
            this.showErrorMessage(`Erro ao atualizar frame: ${error.message}`);
        }
    }

    updatePlayerAvatarDisplay(avatarId) {
        const avatarImg = document.getElementById('playerAvatar');
        const avatar = this.avatarPlaceholders[avatarId] || this.avatarPlaceholders[0];
        
        const avatarFrame = avatarImg ? avatarImg.parentElement : document.querySelector('.avatar-frame');
        if (!avatarFrame) {
            console.error('Avatar frame não encontrado');
            return;
        }
        
        const currentLevel = this.playerData ? this.playerData.level : 1;
        const currentFrameId = this.playerData ? this.playerData.frameId : null;
        
        // Obter informações do frame
        const frames = [
            { id: 'none', name: 'Sem Frame', image: null },
            { id: 'fire', name: 'Fire', image: 'assets/frames/basicfireframe.png' },
            { id: 'ice', name: 'Ice', image: 'assets/frames/basiciceframe.png' },
            { id: 'lightning', name: 'Lightning', image: 'assets/frames/basiclightningframe.png' },
            { id: 'shadow', name: 'Shadow', image: 'assets/frames/basicshadowframe.png' },
            { id: 'bronzerank', name: 'Bronze Rank', image: 'assets/frames/bronzerankframe.png' },
            { id: 'silverrank', name: 'Silver Rank', image: 'assets/frames/silverrankframe.png' },
            { id: 'goldrank', name: 'Gold Rank', image: 'assets/frames/goldrankframe.png' },
            { id: 'platinumrank', name: 'Platinum Rank', image: 'assets/frames/platinumrankframe.png' },
            { id: 'diamondrank', name: 'Diamond Rank', image: 'assets/frames/diamondrankframe.png' },
            { id: 'masterrank', name: 'Master Rank', image: 'assets/frames/masterrankframe.png' },
            { id: 'grandmasterrank', name: 'Grandmaster Rank', image: 'assets/frames/grandmasterrankframe.png' }
        ];
        
        const currentFrame = frames.find(f => f.id === currentFrameId);
        
        const rankStyles = {
            bronzerank: {
                top: '-37px',
                left: '-27px',
                width: '172px',
                height: '195px'
            },
            silverrank: {
                top: '-37px',
                left: '-27px',
                width: '172px',
                height: '195px'
            },
            goldrank: {
                top: '-37px',
                left: '-27px',
                width: '172px',
                height: '195px'
            },
            platinumrank: {
                top: '-37px',
                left: '-27px',
                width: '172px',
                height: '195px'
            },
            diamondrank: {
                top: '-37px',
                left: '-27px',
                width: '172px',
                height: '195px'
            },
            masterrank: {
                top: '-37px',
                left: '-27px',
                width: '172px',
                height: '195px'
            },
            grandmasterrank: {
                top: '-37px',
                left: '-27px',
                width: '172px',
                height: '195px'
            }
        };
        const style = rankStyles[currentFrameId] || {
            top: '-50px',
            left: '-43px',
            width: '200px',
            height: '200px'
        };
        avatarFrame.innerHTML = `
            <div style="
                width: 120px;
                height: 120px;
                border-radius: 50%;
                background: linear-gradient(135deg, ${avatar.color} 0%, ${this.darkenColor(avatar.color, 20)} 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 60px;
                transition: all 0.3s ease;
                cursor: pointer;
                position: relative;
            " class="avatar-display">
                ${avatar.emoji}
            </div>
            ${currentFrame && currentFrame.image ? `
                <div style="
                position: absolute;
                ${currentFrameId === 'lightning' ? `
                    top: -50px;
                    left: -52px;
                    width: 223px;
                    height: 223px;
                ` : currentFrameId === 'shadow' ? `
                    top: -34px;
                    left: -37px;
                    width: 198px;
                    height: 198px;
                ` : `
                    top: ${style.top};
                    left: ${style.left};
                    width: ${style.width};
                    height: ${style.height};
                `}
                border-radius: 50%;
                pointer-events: none;
                z-index: 10;
                background-image: url('${currentFrame.image}');
                background-size: contain;
                background-position: center;
                background-repeat: no-repeat;
            " class="avatar-frame-overlay"></div>
            ` : ''}
            <div class="level-badge" id="levelBadge">${currentLevel}</div>
        `;
        
        // Reconfigurar o event listener para o novo elemento
        const newAvatarDisplay = avatarFrame.querySelector('.avatar-display');
        if (newAvatarDisplay) {
            newAvatarDisplay.addEventListener('click', () => {
                this.openAvatarModal();
            });
        }
    }

    clearNewPlayerForm() {
        document.getElementById('newPlayerName').value = '';
        document.getElementById('newPlayerTitle').value = 'Planeswalker Iniciante';
        document.getElementById('newPlayerAvatar').value = '';
    }

    async loadOrCreatePlayer() {
        try {
            if (this.currentPlayerId) {
                const response = await fetch(`${this.apiUrl}/player/id/${this.currentPlayerId}`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    this.playerData = await response.json();
                    
                    // Garantir que avatarId existe
                    if (this.playerData.avatarId === undefined || this.playerData.avatarId === null) {
                        this.playerData.avatarId = 0; // Avatar padrão
                    }
                    
                    // Garantir que frameId existe
                    if (this.playerData.frameId === undefined || this.playerData.frameId === null) {
                        this.playerData.frameId = 'none'; // Frame padrão
                    }
                    
                    // Carregar estatísticas do servidor
                    await this.loadPlayerStats();
                    
                    // Carregar conquistas do jogador
                    await this.initializeAchievements();
                    
                    // Tentar carregar histórico
                    try {
                        await this.loadMatchHistory();
                    } catch (historyError) {
                        console.warn('Aviso: Não foi possível carregar o histórico de partidas:', historyError);
                        this.matchHistory = [];
                    }
                } else {
                    // Se não conseguir carregar do servidor, tentar localStorage
                    this.playerData = this.loadPlayerDataFromLocal();
                    if (!this.playerData) {
                        this.currentPlayerId = null;
                        localStorage.removeItem('currentPlayerId');
                    }
                }
            }
            
            if (!this.currentPlayerId) {
                // Mostrar seleção de jogador se não houver jogador atual
                this.updatePlayerSelector();
            }
        } catch (error) {
            console.error('Erro ao carregar jogador:', error);
            this.playerData = this.loadPlayerDataFromLocal();
            if (!this.playerData) {
                this.currentPlayerId = null;
                localStorage.removeItem('currentPlayerId');
            }
        }
    }

    async createNewPlayer(playerData) {
        try {
            const response = await fetch(`${this.apiUrl}/player`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(playerData)
            });
            
            if (response.ok) {
                this.playerData = await response.json();
                this.currentPlayerId = this.playerData._id;
                localStorage.setItem('currentPlayerId', this.currentPlayerId);
                console.log('✅ Jogador criado no MongoDB:', this.playerData.name);
            } else {
                throw new Error('Erro ao criar jogador');
            }
        } catch (error) {
            console.error('Erro ao criar jogador:', error);
            this.playerData = playerData;
        }
    }

    loadPlayerDataFromLocal() {
        const defaultData = {
            name: "Gabriel - Caçador de Dragões",
            title: "Planeswalker Iniciante",
            level: 1,
            xp: 150,
            xpToNext: 300,
            manaCoins: 250,
            avatar: "https://via.placeholder.com/120x120/4a5568/ffffff?text=Avatar",
            avatarId: 0, // Adicionar avatarId padrão
            frameId: 'none', // Adicionar frameId padrão
            rankPoints: 1247,
            rank: "Bronze II",
            rankIcon: "🥉",
            totalMatches: 0,
            wins: 0,
            winStreak: 0,
            fastestWin: 999,
            longestMatch: 0,
            favoriteDecks: {}
        };
        
        const saved = localStorage.getItem('magicPlayerData');
        return saved ? { ...defaultData, ...JSON.parse(saved) } : defaultData;
    }

    async savePlayerData() {
        try {
            if (this.currentPlayerId) {
                const response = await fetch(`${this.apiUrl}/player/${this.currentPlayerId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(this.playerData)
                });
                
                if (response.ok) {
                    this.playerData = await response.json();
                    console.log('✅ Dados do jogador salvos no MongoDB');
                } else {
                    throw new Error('Erro ao salvar no servidor');
                }
            }
        } catch (error) {
            console.error('Erro ao salvar no MongoDB:', error);
        }
        
        // Sempre salvar localmente como backup
        localStorage.setItem('magicPlayerData', JSON.stringify(this.playerData));
    }

    async saveMatchData() {
        if (!this.validateMatchForm()) {
            return;
        }

        const matchData = this.getMatchFormData();
        
        try {
            // Salvar a partida
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Token agora vem via cookie httpOnly
            
            const response = await fetch(`${this.apiUrl}/matches/multiplayer`, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(matchData)
            });

            if (response.ok) {
                this.showSuccessMessage('Partida salva com sucesso!');
                this.closeMatchForm();
                this.clearMatchForm();
                
                // NOVA LÓGICA: Processar achievements para TODOS os participantes
                if (matchData.participants && matchData.participants.length > 0) {
                    console.log('🎮 Iniciando processamento de achievements para participantes:', matchData.participants);
                    
                    for (const participantId of matchData.participants) {
                        console.log(`🔄 Processando achievements para jogador: ${participantId}`);
                        try {
                            // Carregar estatísticas atualizadas do servidor para cada participante
                            const statsResponse = await fetch(`${this.apiUrl}/stats/${participantId}`, {
                                credentials: 'include'
                            });
                            
                            if (statsResponse.ok) {
                                const participantStats = await statsResponse.json();
                                console.log(`📊 Estatísticas carregadas para ${participantId}:`, participantStats);
                                
                                // Processar conquistas para este participante
                                const unlockedAchievements = await this.achievementSystem.processMatchAchievements(
                                    matchData, 
                                    participantId,  // ← CORREÇÃO: Processar para cada participante
                                    participantStats,
                                    this
                                );
                                
                                console.log(`🏆 Achievements processados para ${participantId}:`, unlockedAchievements.length);
                            } else {
                                console.error(`❌ Erro ao carregar stats para ${participantId}:`, statsResponse.status);
                            }
                        } catch (error) {
                            console.error(`❌ Erro ao processar achievements para jogador ${participantId}:`, error);
                        }
                    }
                    
                    console.log('✅ Processamento de achievements concluído para todos os participantes');
                }
                
                // Recarregar dados apenas se o jogador atual participou
                if (matchData.participants.includes(this.currentPlayerId)) {
                    await this.loadOrCreatePlayer();
                    await this.loadMatchHistory();
                    this.updateUI();
                }
            } else {
                throw new Error('Erro ao salvar partida');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showErrorMessage('Erro ao salvar partida. Tente novamente.');
        }
    }

    async initializeAchievements() {
        if (this.currentPlayerId) {
            this.achievements = await this.achievementSystem.loadPlayerAchievements(this.currentPlayerId);
            
            // NOVO: Carregar estatísticas e recalcular progresso das conquistas baseadas em stats
            try {
                await this.loadPlayerStats(); // Carrega as estatísticas atualizadas
                
                // Recalcular progresso das conquistas não desbloqueadas baseadas em estatísticas
                this.achievements.forEach(achievement => {
                    if (!achievement.unlocked) {
                        switch (achievement.trigger) {
                            case 'win_count':
                                achievement.progress = this.playerData.wins || 0;
                                break;
                            case 'win_streak':
                                achievement.progress = this.playerData.winStreak || 0;
                                break;
                            case 'archenemy_count':
                                achievement.progress = this.playerData.archenemyCount || 0;
                                break;

                            case 'match_count':
                                achievement.progress = this.playerData.totalMatches || 0;
                                break;
                            case 'card_owner_count':
                                achievement.progress = this.playerData.cardOwnerCount || 0;
                                break;
                        }
                    }
                });
            } catch (error) {
                console.error('Erro ao carregar estatísticas para progresso das conquistas:', error);
            }
        } else {
            this.achievements = this.achievementSystem.getAllAchievements();
        }
        return this.achievements;
    }

    initializeMissions() {
        return {
            daily: [
                {
                    id: 'daily_win',
                    name: 'Vitória Diária',
                    description: 'Ganhe 1 partida hoje',
                    progress: 0,
                    maxProgress: 1,
                    xpReward: 25,
                    completed: false
                },
                {
                    id: 'daily_matches',
                    name: 'Jogador Ativo',
                    description: 'Jogue 3 partidas hoje',
                    progress: 1,
                    maxProgress: 3,
                    xpReward: 30,
                    completed: false
                }
            ],
            weekly: [
                {
                    id: 'weekly_wins',
                    name: 'Dominação Semanal',
                    description: 'Ganhe 10 partidas esta semana',
                    progress: 7,
                    maxProgress: 10,
                    xpReward: 100,
                    completed: false
                },
                {
                    id: 'weekly_decks',
                    name: 'Versatilidade',
                    description: 'Jogue com 3 decks diferentes',
                    progress: 2,
                    maxProgress: 3,
                    xpReward: 75,
                    completed: false
                }
            ]
        };
    }

    initializeRankSystem() {
        return {
            ranks: [
                // Bronze
                { name: 'Bronze III', icon: '🥉', image: 'assets/ranks/bronzerank.png', minXP: 0, maxXP: 180, color: '#cd7f32', tier: 'bronze' },
                { name: 'Bronze II', icon: '🥉', image: 'assets/ranks/bronzerank.png', minXP: 180, maxXP: 200, color: '#cd7f32', tier: 'bronze' },
                { name: 'Bronze I', icon: '🥉', image: 'assets/ranks/bronzerank.png', minXP: 200, maxXP: 220, color: '#cd7f32', tier: 'bronze' },
                
                // Prata
                { name: 'Prata III', icon: '🥈', image: 'assets/ranks/silverrank.png', minXP: 220, maxXP: 240, color: '#c0c0c0', tier: 'prata' },
                { name: 'Prata II', icon: '🥈', image: 'assets/ranks/silverrank.png', minXP: 240, maxXP: 260, color: '#c0c0c0', tier: 'prata' },
                { name: 'Prata I', icon: '🥈', image: 'assets/ranks/silverrank.png', minXP: 260, maxXP: 280, color: '#c0c0c0', tier: 'prata' },
                
                // Ouro
                { name: 'Ouro III', icon: '🥇', image: 'assets/ranks/goldrank.png', minXP: 280, maxXP: 300, color: '#ffd700', tier: 'ouro' },
                { name: 'Ouro II', icon: '🥇', image: 'assets/ranks/goldrank.png', minXP: 300, maxXP: 320, color: '#ffd700', tier: 'ouro' },
                { name: 'Ouro I', icon: '🥇', image: 'assets/ranks/goldrank.png', minXP: 320, maxXP: 340, color: '#ffd700', tier: 'ouro' },
                
                // Platina
                { name: 'Platina III', icon: '💎', image: 'assets/ranks/platinumrank.png', minXP: 340, maxXP: 360, color: '#e5e4e2', tier: 'platina' },
                { name: 'Platina II', icon: '💎', image: 'assets/ranks/platinumrank.png', minXP: 360, maxXP: 380, color: '#e5e4e2', tier: 'platina' },
                { name: 'Platina I', icon: '💎', image: 'assets/ranks/platinumrank.png', minXP: 380, maxXP: 400, color: '#e5e4e2', tier: 'platina' },
                
                // Diamante
                { name: 'Diamante III', icon: '💠', image: 'assets/ranks/diamondrank.png', minXP: 400, maxXP: 420, color: '#b9f2ff', tier: 'diamante' },
                { name: 'Diamante II', icon: '💠', image: 'assets/ranks/diamondrank.png', minXP: 420, maxXP: 440, color: '#b9f2ff', tier: 'diamante' },
                { name: 'Diamante I', icon: '💠', image: 'assets/ranks/diamondrank.png', minXP: 440, maxXP: 460, color: '#b9f2ff', tier: 'diamante' },
                
                // Master
                { name: 'Master III', icon: '👑', image: 'assets/ranks/masterrank.png', minXP: 460, maxXP: 500, color: '#ff6b6b', tier: 'master' },
                { name: 'Master II', icon: '👑', image: 'assets/ranks/masterrank.png', minXP: 500, maxXP: 520, color: '#ff6b6b', tier: 'master' },
                { name: 'Master I', icon: '👑', image: 'assets/ranks/masterrank.png', minXP: 520, maxXP: 540, color: '#ff6b6b', tier: 'master' },
                
                // Grandmaster
                { name: 'Grandmaster III', icon: '⭐', image: 'assets/ranks/grandmasterrank.png', minXP: 540, maxXP: 600, color: '#ff8c00', tier: 'grandmaster' },
                { name: 'Grandmaster II', icon: '⭐', image: 'assets/ranks/grandmasterrank.png', minXP: 600, maxXP: 620, color: '#ff8c00', tier: 'grandmaster' },
                { name: 'Grandmaster I', icon: '⭐', image: 'assets/ranks/grandmasterrank.png', minXP: 620, maxXP: 999999, color: '#ff8c00', tier: 'grandmaster' }
            ],
            winXP: 25,
            lossXP: 15
        };
    }

    initializeTitleSystem() {
        return {
            titles: [
                {
                    id: 'planeswalker_iniciante',
                    name: 'Planeswalker Iniciante',
                    description: 'Título inicial de todos os jogadores',
                    unlockCondition: 'default',
                    requiredAchievements: [],
                    unlocked: true
                },
                {
                    id: 'veterano',
                    name: 'Veterano das Batalhas',
                    description: 'Ganhe 10 partidas',
                    unlockCondition: 'achievement',
                    requiredAchievements: ['win_10'],
                    unlocked: false
                },
                {
                    id: 'campeao',
                    name: 'Campeão Supremo',
                    description: 'Ganhe 50 partidas',
                    unlockCondition: 'achievement',
                    requiredAchievements: ['win_50'],
                    unlocked: false
                },
                {
                    id: 'velocista',
                    name: 'Mestre da Velocidade',
                    description: 'Ganhe uma partida no turno 6',
                    unlockCondition: 'achievement',
                    requiredAchievements: ['fast_win'],
                    unlocked: false
                },
                {
                    id: 'archenemy_master',
                    name: 'Senhor do Caos',
                    description: 'Seja o Archenemy 5 vezes',
                    unlockCondition: 'achievement',
                    requiredAchievements: ['archenemy_5'],
                    unlocked: false
                },
                {
                    id: 'commander_slayer',
                    name: 'Caçador de Comandantes',
                    description: 'Remova 25 comandantes',
                    unlockCondition: 'achievement',
                    requiredAchievements: ['commander_removed_25'],
                    unlocked: false
                },
                {
                    id: 'perfectionist',
                    name: 'Perfeccionista',
                    description: 'Complete múltiplos achievements de precisão',
                    unlockCondition: 'achievement',
                    requiredAchievements: ['perfect_landdrops_10', 'no_mulligan_10'],
                    unlocked: false
                },
                {
                    id: 'grandmaster',
                    name: 'Grão-Mestre Planeswalker',
                    description: 'Alcance o rank Grandmaster',
                    unlockCondition: 'rank',
                    requiredRank: 'Grandmaster',
                    unlocked: false
                }
            ]
        };
    }

    async loadMatchHistory() {
        try {
            if (this.currentPlayerId) {
                // Corrigir a URL - remover '/player' da rota
                const response = await fetch(`${this.apiUrl}/matches/${this.currentPlayerId}`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    // Garantir que sempre temos um array válido
                    this.matchHistory = Array.isArray(data) ? data : (Array.isArray(data.matches) ? data.matches : []);
                    return;
                }
            }
        } catch (error) {
            console.warn('Aviso: Não foi possível carregar o histórico de partidas:', error);
        }
        
        // Fallback para array vazio em vez de dados locais problemáticos
        this.matchHistory = [];
    }

    setupEventListeners() {
        // Navegação entre abas
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Modal de conquistas
        document.querySelector('.close').addEventListener('click', () => {
            const modal = document.getElementById('achievementModal');
            modal.style.display = 'none';
            modal.classList.remove('show');
        });

        // Setup do seletor de título
        this.setupTitleSelector();

        // Botões de demonstração
        this.setupDemoButtons();
        
        // Setup do formulário de alteração de senha
        this.setupChangePasswordForm();
        
        // Recalcular paginação quando a janela for redimensionada
        window.addEventListener('resize', this.debounce(async () => {
            if (document.getElementById('achievements').style.display !== 'none') {
                await this.updateAchievementsList();
                this.updatePaginationControls();
            }
        }, 300));
    }

    setupMatchForm() {
        const registerBtn = document.getElementById('registerMatchBtn');
        const matchForm = document.getElementById('matchForm');
        const cancelBtn = document.getElementById('cancelMatch');
        const saveBtn = document.getElementById('saveMatch');
        const addFinishingCardBtn = document.getElementById('addFinishingCard');

        // Verificar se os elementos existem antes de adicionar listeners
        if (!registerBtn || !matchForm || !cancelBtn || !saveBtn) {
            console.warn('Alguns elementos do formulário não foram encontrados');
            return;
        }
        
        // Toggle do formulário
        registerBtn.addEventListener('click', () => {
            const isExpanded = matchForm.classList.contains('expanded');
            
            if (isExpanded) {
                this.closeMatchForm();
            } else {
                matchForm.classList.add('expanded');
                matchForm.classList.remove('hidden');
                registerBtn.classList.add('active');
                registerBtn.innerHTML = '➖ Fechar Formulário';
                
                // Definir data atual
                const matchDateElement = document.getElementById('matchDate');
                if (matchDateElement) {
                    matchDateElement.value = new Date().toISOString().split('T')[0];
                }
                
                // Popular campo firstPlayer com perfis cadastrados
                this.populateFirstPlayerSelector();
            }
        });
        

        // Cancelar
        cancelBtn.addEventListener('click', () => {
            this.closeMatchForm();
            this.clearMatchForm();
        });

        // Salvar partida
        saveBtn.addEventListener('click', () => {
            this.saveMatchData();
        });

        // Adicionar carta finalizadora
        if (addFinishingCardBtn) {
            addFinishingCardBtn.addEventListener('click', () => {
                this.addFinishingCardInput();
            });
        }

        // Auto-preenchimento de jogadores
        const autoFillBtn = document.getElementById('autoFillBtn');
        if (autoFillBtn) {
            autoFillBtn.addEventListener('click', () => {
                this.autoFillPlayers();
            });
        }

        // Setup dos campos de carta
        this.setupCardSearchFields();

        // Setup das cartas finalizadoras
        this.setupFinishingCards();
        
        // Setup comandantes
        this.setupCommandersInput();
        
        // Setup dos campos de carta (mover para depois dos comandantes)
        this.setupCardSearchFields();
        
        // Setup dos seletores de ranking
        this.setupRankingSelectors();
        
        // Setup dos campos multi-jogador
        this.setupMultiPlayerFields();
        
        // Adicionar população do dropdown do dono da carta
        this.populateGameCardOwnerSelector();
    }

    populateFirstPlayerSelector() {
        const firstPlayerSelect = document.getElementById('firstPlayer');
        if (!firstPlayerSelect) {
            console.warn('Elemento firstPlayer não encontrado');
            return;
        }
        
        // Limpar opções existentes (exceto a primeira)
        while (firstPlayerSelect.children.length > 1) {
            firstPlayerSelect.removeChild(firstPlayerSelect.lastChild);
        }
        
        // Adicionar todos os jogadores
        this.allPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player._id || player.id;
            option.textContent = player.name;
            firstPlayerSelect.appendChild(option);
        });
    }

    setupCardSearchFields() {
        // Comandante - usar a classe em vez do ID
        const commanderInputs = document.querySelectorAll('.commander-input');
        
        commanderInputs.forEach(commanderInput => {
            const commanderPreview = commanderInput.parentElement.querySelector('.card-preview');
            
            if (commanderInput && commanderPreview) {
                commanderInput.addEventListener('input', this.debounce(async (e) => {
                    const cardName = e.target.value.trim();
                    if (cardName.length > 2) {
                        await this.searchAndDisplayCard(cardName, commanderPreview);
                    } else {
                        commanderPreview.classList.remove('show');
                    }
                }, 500));
            }
        });

        // Comandante Partner - adicionar configuração para os campos partner
        const partnerInputs = document.querySelectorAll('.commander-partner');
        
        partnerInputs.forEach(partnerInput => {
            const partnerPreview = partnerInput.parentElement.querySelector('.partner-preview');
            
            if (partnerInput && partnerPreview) {
                partnerInput.addEventListener('input', this.debounce(async (e) => {
                    const cardName = e.target.value.trim();
                    if (cardName.length > 2) {
                        await this.searchAndDisplayCard(cardName, partnerPreview);
                    } else {
                        partnerPreview.classList.remove('show');
                    }
                }, 500));
            }
        });

        // Carta do Jogo
        const gameCardInput = document.getElementById('gameCard');
        const gameCardPreview = document.getElementById('gameCardPreview');
        
        if (gameCardInput && gameCardPreview) {
            gameCardInput.addEventListener('input', this.debounce(async (e) => {
                const cardName = e.target.value.trim();
                if (cardName.length > 2) {
                    await this.searchAndDisplayCard(cardName, gameCardPreview);
                } else {
                    gameCardPreview.classList.remove('show');
                }
            }, 500));
        }
    }

    setupFinishingCards() {
        // ✅ Reconfigurar TODOS os inputs existentes
        const allInputGroups = document.querySelectorAll('.card-input-group');
        allInputGroups.forEach(group => {
            const input = group.querySelector('.finishing-card-input');
            const preview = group.querySelector('.card-preview');
            
            // Remover event listeners antigos e reconfigurar
            if (input && preview) {
                // Clonar o elemento para remover todos os event listeners
                const newInput = input.cloneNode(true);
                input.parentNode.replaceChild(newInput, input);
                
                // Configurar novo event listener
                this.setupCardSearch(newInput, preview);
            }
        });
    }

    addFinishingCardInput() {
        const container = document.querySelector('.finishing-cards-container');
        const addBtn = document.getElementById('addFinishingCard');
        
        const newGroup = document.createElement('div');
        newGroup.className = 'card-input-group';
        newGroup.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="text" class="finishing-card-input" placeholder="Carta finalizadora..." style="flex: 1;">
                <button type="button" class="remove-card-btn" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">❌</button>
            </div>
            <div class="card-preview"></div>
        `;
        
        container.insertBefore(newGroup, addBtn);
        
        // Setup do novo input
        this.setupFinishingCardInput(newGroup);
        
        // Setup do botão de remover
        newGroup.querySelector('.remove-card-btn').addEventListener('click', () => {
            newGroup.remove();
        });
    }

    setupFinishingCardInput(group) {
        const input = group.querySelector('.finishing-card-input');
        const preview = group.querySelector('.card-preview');
        
        // Marcar como configurado para evitar duplicação
        input.setAttribute('data-configured', 'true');
        
        input.addEventListener('input', this.debounce(async (e) => {
            const cardName = e.target.value.trim();
            if (cardName.length > 2) {
                await this.searchAndDisplayCard(cardName, preview);
            } else {
                preview.classList.remove('show');
            }
        }, 500));
    }

    async searchAndDisplayCard(cardName, previewElement) {
        try {
            console.log('🔍 Iniciando busca por carta:', cardName);
            previewElement.innerHTML = '<div style="color: #a0aec0;">🔍 Buscando...</div>';
            previewElement.classList.add('show');
            
            // Usar URL completa para garantir que funcione
            const url = `/api/cards/search/${encodeURIComponent(cardName)}`;
            console.log('📡 URL da requisição:', url);
            
            const response = await fetch(url);
            console.log('📊 Status da resposta:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro da API:', errorText);
                throw new Error('Nenhuma carta encontrada');
            }
            
            const cards = await response.json();
            console.log('📦 Dados recebidos da API:', cards);
            console.log('📊 Número de cartas encontradas:', Array.isArray(cards) ? cards.length : 1);
            
            // Se retornou apenas uma carta (compatibilidade), transformar em array
            const cardArray = Array.isArray(cards) ? cards : [cards];
            
            if (cardArray.length === 0) {
                console.log('⚠️ Nenhuma carta encontrada no array');
                throw new Error('Nenhuma carta encontrada');
            }
            
            console.log('✅ Cartas processadas:', cardArray.map(c => c.name));
            
            // Criar HTML para múltiplas cartas
            const cardsHtml = cardArray.map(card => `
                <div class="card-result" style="cursor: pointer; transition: all 0.3s ease; margin-bottom: 8px; border: 1px solid #4a5568; border-radius: 8px; padding: 8px; display: flex; align-items: center;" 
                     onmouseover="this.style.backgroundColor='rgba(255,215,0,0.1)'" 
                     onmouseout="this.style.backgroundColor='transparent'"
                     data-card-name="${card.name}">
                    <img src="${card.imageUrl || card.smallImageUrl || 'https://via.placeholder.com/50x70/4a5568/ffffff?text=?'}" alt="${card.name}" style="width: 50px; height: 70px; object-fit: cover; border-radius: 4px; margin-right: 10px; flex-shrink: 0;">
                    <div class="card-info" style="flex: 1; min-width: 0;">
                        <div class="card-name" style="font-weight: bold; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${card.name}</div>
                        <div class="card-details" style="font-size: 0.75em; color: #a0aec0; line-height: 1.3;">
                            ${card.manaCost || ''} • ${card.typeLine}<br>
                            ${card.rarity} • ${card.setName}
                        </div>
                    </div>
                </div>
            `).join('');
            
            previewElement.innerHTML = `
                <div style="display: flex; flex-direction: column;">
                    <div class="click-hint" style="color: #4facfe; font-size: 0.85em; margin-bottom: 10px; text-align: left; padding: 4px 8px; background: rgba(79, 172, 254, 0.1); border: 1px solid rgba(79, 172, 254, 0.3); border-radius: 4px; font-weight: 500; width: fit-content;">✨ Clique na carta desejada para selecioná-la</div>
                    <div class="cards-container" style="max-height: 300px; overflow-y: auto; overflow-x: hidden; display: flex; flex-wrap: wrap; gap: 12px; padding: 8px 0;">
                        ${cardsHtml}
                    </div>
                </div>
            `;
            
            // Adicionar eventos de clique para todas as cartas
            const cardResults = previewElement.querySelectorAll('.card-result');
            const clickHint = previewElement.querySelector('.click-hint');
            
            cardResults.forEach(cardResult => {
                cardResult.addEventListener('click', () => {
                    const cardName = cardResult.getAttribute('data-card-name');
                    
                    // Encontrar o input relacionado a este preview
                    let inputElement = null;
                    
                    // Primeiro, tentar encontrar o input no mesmo grupo (para cartas finalizadoras)
                    const cardGroup = previewElement.closest('.card-input-group');
                    if (cardGroup) {
                        inputElement = cardGroup.querySelector('.finishing-card-input');
                    } else {
                        // Para comandantes, buscar no grupo pai
                        const commanderGroup = previewElement.closest('.commander-input-group');
                        if (commanderGroup) {
                            // Verificar se é um preview de partner ou comandante principal
                            if (previewElement.classList.contains('partner-preview')) {
                                inputElement = commanderGroup.querySelector('.commander-partner');
                            } else {
                                inputElement = commanderGroup.querySelector('.commander-input');
                            }
                        } else {
                            // Fallback para outros tipos de input (game card)
                            const searchContainer = previewElement.closest('.card-search-container');
                            if (searchContainer) {
                                inputElement = searchContainer.querySelector('input');
                            } else {
                                inputElement = previewElement.previousElementSibling;
                            }
                        }
                    }
                    
                    if (inputElement && (inputElement.tagName === 'INPUT' || inputElement.classList.contains('finishing-card-input') || inputElement.classList.contains('commander-input') || inputElement.classList.contains('commander-partner'))) {
                        inputElement.value = cardName;
                        
                        // Manter as cartas visíveis, mas mudar a dica
                        clickHint.innerHTML = `✅ "${cardName}" selecionada!`;
                        clickHint.style.color = '#10b981';
                        clickHint.style.background = 'rgba(16, 185, 129, 0.1)';
                        clickHint.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                        
                        // Mostrar feedback visual no input
                        inputElement.style.borderColor = '#10b981';
                        inputElement.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)';
                        
                        // Destacar a carta selecionada
                        cardResults.forEach(cr => {
                            cr.style.backgroundColor = 'transparent';
                            cr.style.border = '1px solid #4a5568';
                        });
                        cardResult.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                        cardResult.style.border = '2px solid #10b981';
                        
                        // Resetar o feedback do input após 2 segundos
                        setTimeout(() => {
                            inputElement.style.borderColor = '';
                            inputElement.style.boxShadow = '';
                            clickHint.innerHTML = '✨ Clique na carta desejada para selecioná-la';
                            clickHint.style.color = '#4facfe';
                            clickHint.style.background = 'rgba(79, 172, 254, 0.1)';
                            clickHint.style.borderColor = 'rgba(79, 172, 254, 0.3)';
                        }, 2000);
                    }
                });
            });
            
        } catch (error) {
            console.error('💥 Erro completo ao buscar cartas:', error);
            console.error('📍 Stack trace:', error.stack);
            previewElement.innerHTML = '<div style="color: #f87171;">❌ Nenhuma carta encontrada</div>';
        }
    }

    closeMatchForm() {
        const matchForm = document.getElementById('matchForm');
        const registerBtn = document.getElementById('registerMatchBtn');
        
        matchForm.classList.remove('expanded');
        matchForm.classList.add('hidden');
        registerBtn.classList.remove('active');
        registerBtn.innerHTML = '➕ Cadastrar Partida';
    }

    clearMatchForm() {
        // Limpar todos os campos com verificação
        const fields = [
            'matchDate', 'matchTurns', 'firstPlayer', 'mulligans', 
            'turn1Play', 'missedLandDrop', 'commanderRemoved', 
            'winner', 'gameCard', 'archenemy', 'ranking', 'observations',
            'firstPlace', 'secondPlace', 'thirdPlace', 'fourthPlace'
        ];
        // Limpar seleção do dono da carta
        const gameCardOwnerElement = document.getElementById('gameCardOwner');
        if (gameCardOwnerElement) {
            gameCardOwnerElement.value = '';
        }
        fields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = false;
                } else {
                    element.value = '';
                }
            }
        });
        
        // Limpar comandantes
        document.querySelectorAll('.commander-input').forEach(input => {
            input.value = '';
        });
        
        // Limpar partners dos comandantes
        document.querySelectorAll('.commander-partner').forEach(input => {
            input.value = '';
        });
        
        // Limpar temas dos comandantes
        document.querySelectorAll('.commander-theme').forEach(input => {
            input.value = '';
        });
        
        // Limpar seletores de jogadores dos comandantes
        document.querySelectorAll('.commander-player').forEach(select => {
            select.value = '';
        });
        
        // Limpar previews
        document.querySelectorAll('.card-preview').forEach(preview => {
            preview.classList.remove('show');
        });
        
        // Resetar cartas finalizadoras
        const container = document.querySelector('.finishing-cards-container');
        if (container) {
            const groups = container.querySelectorAll('.card-input-group');
            groups.forEach((group, index) => {
                if (index === 0) {
                    const finishingInput = group.querySelector('.finishing-card-input');
                    const finishingPreview = group.querySelector('.card-preview');
                    if (finishingInput) finishingInput.value = '';
                    if (finishingPreview) finishingPreview.classList.remove('show');
                } else {
                    group.remove();
                }
            });
        }
        
        // Limpar campos multi-jogador
        const multiPlayerContainers = [
            'mulligansContainer',
            'turn1Container', 
            'landdropContainer',
            'commanderRemovedContainer'
        ];
        
        multiPlayerContainers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                const entries = container.querySelectorAll('.mulligan-entry, .turn1-entry, .landdrop-entry, .commander-removed-entry');
                entries.forEach(entry => entry.remove());
            }
        });
        
        // Resetar botões de adicionar
        this.updateAddMulliganButton();
        this.updateAddTurn1Button();
        this.updateAddLanddropButton();
        this.updateAddCommanderRemovedButton();
    }

    getFinishingCards() {
        const inputs = document.querySelectorAll('.finishing-card-input');
        const cards = [];
        
        inputs.forEach(input => {
            if (input.value.trim()) {
                cards.push(input.value.trim());
            }
        });
        
        return cards;
    }

    validateMatchData(data) {
        const required = ['date', 'turns', 'firstPlayer', 'winner', 'ranking'];
        
        for (const field of required) {
            if (!data[field] && data[field] !== 0) {
                this.showNotification('❌ Erro', `Campo obrigatório: ${field}`);
                return false;
            }
        }
        
        return true;
    }

    updatePlayerStatsFromMatch(matchData) {
        this.playerData.totalMatches++;
        
        // Adicionar XP de ranking baseado no resultado
        const isWin = matchData.winner === this.currentPlayerId;
        const rankXPChange = isWin ? this.rankSystem.winXP : -this.rankSystem.lossXP;
        
        this.addRankXP(rankXPChange, isWin);
        
        if (matchData.winner === this.currentPlayerId) {
            this.playerData.wins++;
            this.addXP(50);
            
            // Atualizar fastest win
            if (matchData.turns < this.playerData.fastestWin) {
                this.playerData.fastestWin = matchData.turns;
            }
        }
        
        // Atualizar deck stats baseado nos temas dos comandantes
        if (matchData.commanders && matchData.commanders.length > 0) {
            const myCommander = matchData.commanders.find(cmd => cmd.playerId === this.currentPlayerId);
            if (myCommander && myCommander.theme) {
                if (!this.playerData.favoriteDecks[myCommander.theme]) {
                    this.playerData.favoriteDecks[myCommander.theme] = { wins: 0, total: 0 };
                }
                
                this.playerData.favoriteDecks[myCommander.theme].total++;
                if (matchData.winner === this.currentPlayerId) {
                    this.playerData.favoriteDecks[myCommander.theme].wins++;
                }
            }
        }
        
        // Atualizar estatísticas de comandante
        if (matchData.commanders && matchData.commanders.length > 0) {
            const myCommander = matchData.commanders.find(cmd => cmd.playerId === this.currentPlayerId);
            
            if (myCommander) {
                if (!this.playerData.commanderStats) {
                    this.playerData.commanderStats = {};
                }
                
                // Estatísticas do comandante principal
                if (!this.playerData.commanderStats[myCommander.name]) {
                    this.playerData.commanderStats[myCommander.name] = { wins: 0, total: 0 };
                }
                this.playerData.commanderStats[myCommander.name].total++;
                if (matchData.winner === this.currentPlayerId) {
                    this.playerData.commanderStats[myCommander.name].wins++;
                }
                
                // Estatísticas do comandante partner (se existir)
                if (myCommander.partnerName) {
                    const partnerKey = `${myCommander.name} // ${myCommander.partnerName}`;
                    if (!this.playerData.commanderStats[partnerKey]) {
                        this.playerData.commanderStats[partnerKey] = { wins: 0, total: 0 };
                    }
                    this.playerData.commanderStats[partnerKey].total++;
                    if (matchData.winner === this.currentPlayerId) {
                        this.playerData.commanderStats[partnerKey].wins++;
                    }
                }
            }
        }
        
        this.savePlayerData();
    }

    // Função debounce para otimizar as buscas
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        }.bind(this);
    }

    setupTitleSelector() {
        const titleSelect = document.getElementById('playerTitleSelect');
        if (titleSelect) {
            titleSelect.addEventListener('change', async (e) => {
                const newTitle = e.target.value;
                await this.updatePlayerTitleValue(newTitle);
            });
        }
    }

    async updatePlayerTitleValue(newTitle) {
        try {
            const response = await fetch(`${this.apiUrl}/player/${this.currentPlayerId}/title`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ title: newTitle })
            });
            
            if (response.ok) {
                this.playerData.title = newTitle;
                document.getElementById('playerTitle').textContent = newTitle;
                this.showSuccessMessage(`Título alterado para: ${newTitle}`);
            } else {
                this.showErrorMessage('Erro ao alterar título');
            }
        } catch (error) {
            console.error('Erro ao atualizar título:', error);
            this.showErrorMessage('Erro ao alterar título');
        }
    }

    setupDemoButtons() {
        // Só criar botões de demonstração se o usuário for master
        if (!this.currentUser || !this.currentUser.isMaster) {
            return;
        }
        
        // Criar botões de demonstração se não existirem
        if (!document.querySelector('.demo-buttons')) {
            const demoSection = document.createElement('div');
            demoSection.className = 'demo-buttons';
            demoSection.innerHTML = `
                <h3>🎮 Simulação de Partidas</h3>
                <button id="simulateWin" class="demo-btn win">🏆 Simular Vitória</button>
                <button id="simulateLoss" class="demo-btn loss">💀 Simular Derrota</button>
                <h3>🏆 Demo de Ranking</h3>
                <button id="demoWinBtn" class="demo-btn win">+60 XP (Vitória)</button>
                <button id="demoLossBtn" class="demo-btn loss">-10 XP (Derrota)</button>
            `;
            
            document.querySelector('#stats').appendChild(demoSection);
        }

        // Event listeners para botões de demo
        const winBtn = document.getElementById('simulateWin');
        const lossBtn = document.getElementById('simulateLoss');
        const demoWinBtn = document.getElementById('demoWinBtn');
        const demoLossBtn = document.getElementById('demoLossBtn');
        
        if (winBtn) {
            winBtn.addEventListener('click', () => this.simulateMatch('win'));
        }
        if (lossBtn) {
            lossBtn.addEventListener('click', () => this.simulateMatch('loss'));
        }
        if (demoWinBtn) {
            demoWinBtn.addEventListener('click', () => this.demoRankingXP(60));
        }
        if (demoLossBtn) {
            demoLossBtn.addEventListener('click', () => this.demoRankingXP(-10));
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    updateUI() {
        this.updatePlayerInfo();
        this.updateStats();
        this.updateAchievements();
        this.updateRanking();
        this.updateMissions();
        this.updateMatchHistory();
        this.updateTopCommanders();
        this.updateGeneralTab();
    }

    updatePlayerInfo() {
        if (!this.playerData) return;
        
        document.getElementById('playerName').textContent = this.playerData.name;
        this.updatePlayerTitle();
        document.getElementById('manaCoins').textContent = `🔮 ${this.playerData.manaCoins}`;
        
        // Atualizar avatar - usar o avatarId salvo no servidor
        const avatarId = this.playerData.avatarId !== undefined ? this.playerData.avatarId : 0;
        this.updatePlayerAvatarDisplay(avatarId);
        
        // Atualizar barra de XP
        const xpPercentage = (this.playerData.xp / this.playerData.xpToNext) * 100;
        document.getElementById('xpBar').style.width = `${xpPercentage}%`;
        document.getElementById('xpText').textContent = `${this.playerData.xp} / ${this.playerData.xpToNext} XP`;
        
        // Atualizar título
        this.updatePlayerTitle();
    }

    updatePlayerTitle() {
        const titleSelect = document.getElementById('playerTitleSelect');
        if (!titleSelect) return;
        
        // Definir o título atual
        titleSelect.value = this.playerData.title || 'Planeswalker Iniciante';
        
        // Atualizar títulos disponíveis
        this.updateAvailableTitles();
    }

    async updateAvailableTitles() {
        const titleSelect = document.getElementById('playerTitleSelect');
        const titleUnlockInfo = document.getElementById('titleUnlockInfo');
        if (!titleSelect) return;
        
        const titleSystem = this.initializeTitleSystem();
        const playerAchievements = await this.loadPlayerAchievements();
        const currentRank = this.playerData.rankTier || 'Bronze';
        
        // Limpar opções existentes
        titleSelect.innerHTML = '';
        
        let unlockedCount = 0;
        
        titleSystem.titles.forEach(title => {
            let isUnlocked = false;
            
            if (title.unlockCondition === 'default') {
                isUnlocked = true;
            } else if (title.unlockCondition === 'achievement') {
                isUnlocked = title.requiredAchievements.every(achievementId => 
                    playerAchievements.some(pa => pa.achievement_id === achievementId && pa.unlocked)
                );
            } else if (title.unlockCondition === 'rank') {
                const rankOrder = ['Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Master', 'Grandmaster'];
                const currentRankIndex = rankOrder.indexOf(currentRank);
                const requiredRankIndex = rankOrder.indexOf(title.requiredRank);
                isUnlocked = currentRankIndex >= requiredRankIndex;
            }
            
            if (isUnlocked) {
                unlockedCount++;
                const option = document.createElement('option');
                option.value = title.name;
                option.textContent = title.name;
                option.title = title.description;
                titleSelect.appendChild(option);
            }
        });
        
        // Atualizar informação de desbloqueio
        if (titleUnlockInfo) {
            if (unlockedCount > 1) {
                titleUnlockInfo.textContent = `🏆 ${unlockedCount}/${titleSystem.titles.length} títulos desbloqueados`;
            } else {
                titleUnlockInfo.textContent = '🔒 Desbloqueie mais títulos completando achievements!';
            }
        }
    }

    async loadPlayerAchievements() {
        try {
            const response = await fetch(`${this.apiUrl}/achievements/${this.currentPlayerId}`, {
                credentials: 'include'
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Erro ao carregar achievements:', error);
        }
        return [];
    }

    async updateStats() {
        if (!this.playerData) {
            console.warn('playerData não está disponível para updateStats');
            return;
        }
        
        // Carregar estatísticas atualizadas do servidor UMA ÚNICA VEZ
        const stats = await this.loadPlayerStats();
        
        const winrate = this.playerData.totalMatches > 0 ? Math.round((this.playerData.wins / this.playerData.totalMatches) * 100) : 0;
        const generalWinrateElement = document.getElementById('generalWinrate');
        if (generalWinrateElement) {
            generalWinrateElement.textContent = this.playerData.totalMatches > 0 ? `${winrate}%` : '-';
        }
        
        const winrateDetail = document.querySelector('#generalWinrate')?.nextElementSibling;
        if (winrateDetail) {
            winrateDetail.textContent = `${this.playerData.wins} vitórias / ${this.playerData.totalMatches} partidas`;
        }
        
        // Corrigir exibição da vitória mais rápida
        const fastestWinElement = document.getElementById('fastestWin');
        if (fastestWinElement) {
            if (this.playerData.fastestWin === 999 || this.playerData.fastestWin === null || this.playerData.wins === 0) {
                fastestWinElement.textContent = '-';
            } else {
                fastestWinElement.textContent = `Turno ${this.playerData.fastestWin}`;
            }
        }
        
        const winStreakElement = document.getElementById('winStreak');
        if (winStreakElement) {
            // Mostrar o recorde em vez da sequência atual
            winStreakElement.textContent = `${stats?.bestWinStreak || 0} jogos`;
        }
        
        // Atualizar dados do jogador com estatísticas do servidor
        if (stats) {
            this.playerData.winStreak = stats.winStreak;
            this.playerData.bestWinStreak = stats.bestWinStreak || 0; // NOVO
        }
        
        // Passar stats como parâmetro para evitar nova chamada de rede
        this.updateFavoriteDeck(stats);
        this.updateCommanderStats();
        await this.updateTopCommanders();
    }

    // NOVA FUNÇÃO: Carregar estatísticas do servidor
    async loadPlayerStats() {
        try {
            if (this.currentPlayerId) {
                const response = await fetch(`${this.apiUrl}/stats/${this.currentPlayerId}`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    const stats = await response.json();
                    
                    // Atualizar dados do jogador com estatísticas do servidor
                    this.playerData.totalMatches = stats.totalMatches;
                    this.playerData.wins = stats.wins;
                    this.playerData.winStreak = stats.winStreak;
                    this.playerData.fastestWin = stats.fastestWin;
                    this.playerData.longestMatch = stats.longestMatch;
                    this.playerData.mostUsedDeck = stats.mostUsedDeck;
                    this.playerData.deckStats = stats.deckStats;
                    // CORREÇÃO: Adicionar as estatísticas que estavam faltando
                    this.playerData.archenemyCount = stats.archenemyCount;
                    this.playerData.commanderRemovals = stats.commanderRemovals;
                    
                    return stats;
                }
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
        return null;
    }

    // MODIFICAR: Aceitar stats como parâmetro opcional
    updateFavoriteDeck(stats = null) {
        const favoriteDeckElement = document.getElementById('favoriteDeck');
        const favoriteDeckDetail = favoriteDeckElement?.nextElementSibling;
        
        if (!favoriteDeckElement) return;
        
        // Usar stats passado como parâmetro ou carregar do servidor se não fornecido
        if (stats && stats.mostUsedDeck) {
            const deck = stats.mostUsedDeck;
            favoriteDeckElement.textContent = `${deck.name}`;
            if (favoriteDeckDetail) {
                favoriteDeckDetail.textContent = `Winrate: ${deck.winrate}% (${deck.wins}/${deck.total})`;
            }
        } else if (!stats) {
            // Fallback: carregar do servidor apenas se stats não foi fornecido
            this.loadPlayerStats().then(serverStats => {
                if (serverStats && serverStats.mostUsedDeck) {
                    const deck = serverStats.mostUsedDeck;
                    favoriteDeckElement.textContent = `${deck.name}`;
                    if (favoriteDeckDetail) {
                        favoriteDeckDetail.textContent = `Winrate: ${deck.winrate}% (${deck.wins}/${deck.total})`;
                    }
                } else {
                    favoriteDeckElement.textContent = 'Nenhum deck';
                    if (favoriteDeckDetail) {
                        favoriteDeckDetail.textContent = 'Nenhuma partida registrada';
                    }
                }
            });
        } else {
            favoriteDeckElement.textContent = 'Nenhum deck';
            if (favoriteDeckDetail) {
                favoriteDeckDetail.textContent = 'Nenhuma partida registrada';
            }
        }
    }

    updateCommanderStats() {
        const commanderStatsContainer = document.getElementById('commanderStats');
        if (!commanderStatsContainer) return;
        
        commanderStatsContainer.innerHTML = '';
        
        if (!this.playerData || !this.playerData.commanderStats) {
            commanderStatsContainer.innerHTML = '<div class="commander-item">Nenhum comandante registrado</div>';
            return;
        }
        
        for (const [commanderName, stats] of Object.entries(this.playerData.commanderStats)) {
            if (stats && typeof stats.wins === 'number' && typeof stats.total === 'number') {
                const winrate = Math.round((stats.wins / stats.total) * 100);
                const commanderElement = document.createElement('div');
                commanderElement.className = 'commander-item';
                commanderElement.innerHTML = `
                    <div class="commander-name">${commanderName}</div>
                    <div class="commander-winrate">
                        <div class="winrate-percentage">${winrate}%</div>
                        <div class="winrate-details">(${stats.wins}/${stats.total})</div>
                    </div>
                `;
                commanderStatsContainer.appendChild(commanderElement);
            }
        }
    }

    // Função para obter os 3 comandantes mais utilizados
    getTopCommanders() {
        if (!this.matchHistory || this.matchHistory.length === 0) {
            return [];
        }

        const commanderUsage = {};
        
        // Contar uso e vitórias de cada comandante (usando apenas o nome principal)
        this.matchHistory.forEach(match => {
            if (match.commanders && Array.isArray(match.commanders)) {
                const playerCommander = match.commanders.find(cmd => 
                    cmd.playerId?.toString() === this.currentPlayerId?.toString()
                );
                
                if (playerCommander) {
                    // Usar apenas o nome do comandante principal como chave
                    const commanderKey = playerCommander.name;
                    
                    if (!commanderUsage[commanderKey]) {
                        commanderUsage[commanderKey] = {
                            name: playerCommander.name,
                            mainName: playerCommander.name,
                            theme: playerCommander.theme,
                            total: 0,
                            wins: 0
                        };
                    }
                    
                    commanderUsage[commanderKey].total++;
                    
                    if (match.winner?.toString() === this.currentPlayerId?.toString()) {
                        commanderUsage[commanderKey].wins++;
                    }
                    
                    // Atualizar tema se não estiver definido
                    if (!commanderUsage[commanderKey].theme && playerCommander.theme) {
                        commanderUsage[commanderKey].theme = playerCommander.theme;
                    }
                }
            }
        });
        
        // Converter para array e ordenar por winrate (depois por total de partidas)
        const commanderArray = Object.values(commanderUsage)
            .filter(commander => commander.total > 0) // Apenas comandantes com partidas
            .map(commander => ({
                ...commander,
                winrate: Math.round((commander.wins / commander.total) * 100)
            }))
            .sort((a, b) => {
                // Ordenar por total de partidas primeiro (mais usado), depois por winrate
                if (b.total !== a.total) {
                    return b.total - a.total;
                }
                return b.winrate - a.winrate;
            })
            .slice(0, 3); // Pegar apenas os 3 primeiros
        
        return commanderArray;
    }

    // Função para atualizar a exibição dos top comandantes
    async updateTopCommanders() {
        // Evitar execução simultânea
        if (this.updatingTopCommanders) return;
        this.updatingTopCommanders = true;
        
        const topCommandersContainer = document.getElementById('topCommandersGrid');
        if (!topCommandersContainer) {
            this.updatingTopCommanders = false;
            return;
        }
        
        topCommandersContainer.innerHTML = '';
        
        const topCommanders = this.getTopCommanders();
        
        // URLs das imagens de placeholder
        const placeholderImages = [
            'https://raw.githubusercontent.com/Gabrielfrangetto/MagicSystem/main/CommanderStatistics/Firstplace.png',
            'https://raw.githubusercontent.com/Gabrielfrangetto/MagicSystem/main/CommanderStatistics/Secondplace.png',
            'https://raw.githubusercontent.com/Gabrielfrangetto/MagicSystem/main/CommanderStatistics/Thirdplace.png'
        ];
        
        // Sempre exibir 3 slots (preenchidos ou placeholders)
        for (let i = 0; i < 3; i++) {
            const commander = topCommanders[i];
            const commanderElement = document.createElement('div');
            commanderElement.className = 'top-commander-card';
            
            if (commander) {
                // Comandante real
                const winrate = commander.total > 0 ? Math.round((commander.wins / commander.total) * 100) : 0;
                const cardImageUrl = await this.getCardImageUrl(commander.mainName);
                
                commanderElement.innerHTML = `
                    <div class="commander-image">
                        <img src="${cardImageUrl}" alt="${commander.name}" onerror="this.src='https://via.placeholder.com/208x290/4a5568/ffffff?text=Card'">
                    </div>
                    <div class="commander-info">
                        <div class="commander-name">${commander.name}</div>
                        <div class="commander-theme">${commander.theme || 'Tema não informado'}</div>
                        <div class="commander-stats">
                            <div class="winrate">${winrate}%</div>
                            <div class="usage">${commander.wins}/${commander.total} vitórias</div>
                        </div>
                    </div>
                `;
            } else {
                // Placeholder com imagens personalizadas
                const position = i + 1;
                const positionText = position === 1 ? '1º' : position === 2 ? '2º' : '3º';
                const placeholderImage = placeholderImages[i];
                
                commanderElement.innerHTML = `
                    <div class="commander-image">
                        <img src="${placeholderImage}" alt="${positionText} Lugar">
                    </div>
                    <div class="commander-info">
                        <div class="commander-theme">Aguardando comandante</div>
                        <div class="commander-stats">
                            <div class="winrate">--%</div>
                            <div class="usage">0/0 vitórias</div>
                        </div>
                    </div>
                `;
                
                // Adicionar classe especial para placeholder
                commanderElement.classList.add('placeholder-card');
            }
            
            topCommandersContainer.appendChild(commanderElement);
        }
        
        // Reset do flag para permitir futuras execuções
        this.updatingTopCommanders = false;
    }

    // Função auxiliar para obter URL da imagem da carta
    async getCardImageUrl(cardName) {
        try {
            const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
            if (response.ok) {
                const cardData = await response.json();
                return cardData.image_uris?.normal || cardData.image_uris?.large || 'https://via.placeholder.com/120x168/4a5568/ffffff?text=Card';
            }
        } catch (error) {
            console.error('Erro ao buscar imagem da carta:', error);
        }
        return 'https://via.placeholder.com/120x168/4a5568/ffffff?text=Card';
    }

    async updateAchievements() {
        this.updateFeaturedAchievements();
        
        // Aguardar o próximo frame para garantir que o DOM esteja renderizado
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        await this.updateAchievementsList();
        this.updatePaginationControls();
    }

    async updateFeaturedAchievements() {
        const featuredContainer = document.getElementById('featuredAchievementsList');
        if (!featuredContainer) return;
        
        featuredContainer.innerHTML = '';
        
        // Carregar conquistas em destaque do servidor
        const featuredIds = await this.achievementSystem.getFeaturedAchievements(this.currentPlayerId);
        const featured = this.achievements.filter(a => featuredIds.includes(a.id));
        
        if (featured.length === 0) {
            featuredContainer.innerHTML = '<div class="no-featured">Nenhuma conquista em destaque. Clique em "Gerenciar Destaques" para adicionar.</div>';
            return;
        }
        
        featured.forEach(achievement => {
            const achievementElement = document.createElement('div');
            achievementElement.className = `featured-achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`;
            achievementElement.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-info">
                    <h4>${achievement.name}</h4>
                    <p>${achievement.description}</p>
                    <div class="achievement-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(achievement.progress / achievement.maxProgress) * 100}%"></div>
                        </div>
                        <span>${achievement.progress}/${achievement.maxProgress}</span>
                    </div>
                    <div class="category-badge">${achievement.category}</div>
                </div>
            `;
            
            // Adicionar evento de clique para achievements desbloqueados ou especiais
            if (achievement.unlocked || achievement.requiresPassword) {
                achievementElement.addEventListener('click', () => {
                    this.showAchievementModal(achievement.id);
                });
                
                // Adicionar cursor pointer para indicar que é clicável
                achievementElement.style.cursor = 'pointer';
            }
            
            featuredContainer.appendChild(achievementElement);
        });
    }

    // Função para calcular dinamicamente quantos achievements cabem no grid
    calculateDynamicAchievementsPerPage() {
        return new Promise((resolve) => {
            const achievementsContainer = document.getElementById('achievementsList');
            if (!achievementsContainer) {
                resolve(10); // fallback
                return;
            }
            
            const checkDimensions = () => {
                const containerWidth = achievementsContainer.offsetWidth || achievementsContainer.clientWidth;
                const containerHeight = window.innerHeight * 0.6; // Usar 60% da altura da tela
                
                // Se o contêiner ainda não tem largura, aguardar mais um pouco
                if (containerWidth === 0) {
                    setTimeout(checkDimensions, 50);
                    return;
                }
                
                // Dimensões de cada achievement card (baseado no CSS)
                const cardMinWidth = 200; // minmax(200px, 1fr)
                const cardHeight = 280; // altura aproximada do card + padding
                const gap = 20; // gap do grid
                
                // Calcular quantas colunas cabem (mínimo 1)
                const columns = Math.max(1, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));
                
                // Calcular quantas linhas cabem na altura disponível (mínimo 2)
                const rows = Math.max(2, Math.floor((containerHeight + gap) / (cardHeight + gap)));
                
                // Total de achievements que cabem na tela (pelo menos 2 fileiras)
                const totalPerPage = Math.max(columns * rows, columns * 2, 6); // garantir pelo menos 2 fileiras
                
                resolve(totalPerPage);
            };
            
            // Aguardar o próximo frame e então verificar as dimensões
            requestAnimationFrame(() => {
                setTimeout(checkDimensions, 10);
            });
        });
    }

    async updateAchievementsList() {
        const achievementsContainer = document.getElementById('achievementsList');
        if (!achievementsContainer) return;
        
        // Aguardar o cálculo dinâmico da paginação
        this.achievementsPerPage = await this.calculateDynamicAchievementsPerPage();
        
        // Limpar container completamente
        achievementsContainer.innerHTML = '';
        
        // Filtrar achievements
        let filteredAchievements = this.achievements;
        
        // Filtro por categoria
        if (this.currentCategoryFilter !== 'all') {
            filteredAchievements = filteredAchievements.filter(achievement => 
                achievement.category === this.currentCategoryFilter
            );
        }
        
        // Filtro por busca
        if (this.currentSearchFilter) {
            const searchTerm = this.currentSearchFilter.toLowerCase();
            filteredAchievements = filteredAchievements.filter(achievement => 
                achievement.name.toLowerCase().includes(searchTerm) ||
                achievement.description.toLowerCase().includes(searchTerm)
            );
        }
        
        // Atualizar informações de paginação ANTES de calcular a paginação
        this.totalFilteredAchievements = filteredAchievements.length;
        this.totalAchievementsPages = Math.ceil(filteredAchievements.length / this.achievementsPerPage);
        
        // Validar e corrigir página atual
        if (this.totalAchievementsPages > 0 && this.currentAchievementsPage > this.totalAchievementsPages) {
            this.currentAchievementsPage = this.totalAchievementsPages;
        }
        if (this.currentAchievementsPage < 1) {
            this.currentAchievementsPage = 1;
        }
        
        // Calcular paginação com página já validada
        const startIndex = (this.currentAchievementsPage - 1) * this.achievementsPerPage;
        const endIndex = startIndex + this.achievementsPerPage;
        const paginatedAchievements = filteredAchievements.slice(startIndex, endIndex);
        
        if (paginatedAchievements.length === 0) {
            achievementsContainer.innerHTML = '<div class="no-achievements">Nenhuma conquista encontrada.</div>';
            return;
        }
        
        // Renderizar achievements
        paginatedAchievements.forEach(achievement => {
            const achievementElement = document.createElement('div');
            achievementElement.className = `achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`;
            achievementElement.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-info">
                    <h4>${achievement.name}</h4>
                    <p>${achievement.description}</p>
                    <div class="achievement-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(achievement.progress / achievement.maxProgress) * 100}%"></div>
                        </div>
                        <span>${achievement.progress}/${achievement.maxProgress}</span>
                    </div>
                    <div class="achievement-meta">
                        <div class="xp-reward">+${achievement.xpReward} XP</div>
                        <div class="category-badge">${achievement.category}</div>
                    </div>
                </div>
            `;
            
            // Adicionar evento de clique para achievements desbloqueados ou que requerem senha
            if (achievement.unlocked || achievement.requiresPassword) {
                achievementElement.style.cursor = 'pointer';
                achievementElement.addEventListener('click', () => {
                    this.showAchievementModal(achievement.id);
                });
            }
            
            achievementsContainer.appendChild(achievementElement);
        });
    }

    updatePaginationControls() {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const pageInfo = document.getElementById('currentPageInfo');
        const totalInfo = document.getElementById('totalAchievementsInfo');
        
        if (!prevBtn || !nextBtn || !pageInfo || !totalInfo) return;
        
        // Validar e corrigir página atual se necessário
        if (this.totalAchievementsPages > 0 && this.currentAchievementsPage > this.totalAchievementsPages) {
            this.currentAchievementsPage = this.totalAchievementsPages;
        }
        if (this.currentAchievementsPage < 1) {
            this.currentAchievementsPage = 1;
        }
        
        // Atualizar botões
        prevBtn.disabled = this.currentAchievementsPage <= 1;
        nextBtn.disabled = this.currentAchievementsPage >= this.totalAchievementsPages;
        
        // Atualizar informações
        pageInfo.textContent = `Página ${this.currentAchievementsPage} de ${this.totalAchievementsPages || 1}`;
        totalInfo.textContent = `(${this.totalFilteredAchievements || 0} conquistas)`;
    }

    updateRanking() {
        if (!this.playerData) return;
        
        // CORREÇÃO: Usar rankTier e rankDivision do servidor ao invés de calcular baseado em XP total
        const currentRankTier = this.playerData.rankTier || 'Bronze';
        const currentRankDivision = this.playerData.rankDivision || 'III';
        const currentRankName = `${currentRankTier} ${currentRankDivision}`;
        
        // Encontrar o rank atual baseado no tier/division do servidor
        const currentRank = this.rankSystem.ranks.find(rank => rank.name === currentRankName) || this.rankSystem.ranks[0];
        const nextRank = this.getNextRank();
        
        // Renderizar ícone com imagem
        this.renderRankIcon(currentRank, currentRankDivision);
        
        // Atualizar elementos da UI
        const rankName = document.getElementById('rankName');
        const rankPoints = document.getElementById('rankPoints');
        const rankXpInfo = document.getElementById('rankXpInfo');
        
        if (rankName) rankName.textContent = currentRank.name;
        if (rankPoints) rankPoints.textContent = `${this.playerData.rankXP || 0} pontos de ranking`;
        
        // Calcular progresso para próximo rank
        if (nextRank) {
            const currentXP = this.playerData.rankXP || 0;
            
            // CORREÇÃO: XP necessário baseado no sistema do backend
            const backendRankSystem = {
                'Bronze': { 'III': 180, 'II': 200, 'I': 220 },
                'Prata': { 'III': 240, 'II': 260, 'I': 280 },
                'Ouro': { 'III': 300, 'II': 320, 'I': 340 },
                'Platina': { 'III': 360, 'II': 380, 'I': 400 },
                'Diamante': { 'III': 420, 'II': 440, 'I': 460 },
                'Master': { 'III': 500, 'II': 520, 'I': 540 },
                'Grandmaster': { 'III': 600, 'II': 620, 'I': 640 }
            };
            
            const xpNeededForPromotion = backendRankSystem[currentRankTier]?.[currentRankDivision] || 180;
            
            // Calcular progresso (0-100%)
            let progressPercentage = (currentXP / xpNeededForPromotion) * 100;
            progressPercentage = Math.min(100, Math.max(0, progressPercentage));
            
            if (rankXpInfo) {
                rankXpInfo.textContent = `${currentXP} / ${xpNeededForPromotion} XP para ${nextRank.name}`;
            }
            
            const rankBar = document.getElementById('rankBar');
            if (rankBar) {
                rankBar.style.width = `${progressPercentage}%`;
            }
        } else {
            if (rankXpInfo) {
                rankXpInfo.textContent = 'Rank Máximo Alcançado!';
            }
            const rankBar = document.getElementById('rankBar');
            if (rankBar) {
                rankBar.style.width = '100%';
            }
        }
    }

    getCurrentRank() {
        const currentXP = this.playerData.rankXP || 0;
        
        // Encontrar o rank correto baseado no XP atual
        for (let i = this.rankSystem.ranks.length - 1; i >= 0; i--) {
            const rank = this.rankSystem.ranks[i];
            if (currentXP >= rank.minXP) {
                return rank;
            }
        }
        
        // Fallback para o primeiro rank
        return this.rankSystem.ranks[0];
    }

    // Função para renderizar o ícone de ranking com imagem
    renderRankIcon(rank, division = null) {
        const rankIcon = document.getElementById('rankIcon');
        if (!rankIcon) return;
        
        // Limpar conteúdo anterior
        rankIcon.innerHTML = '';
        
        // Remover classes anteriores
        rankIcon.className = 'rank-icon';
        
        // Adicionar classe do tier
        if (rank.tier) {
            rankIcon.classList.add(rank.tier);
        }
        
        // Adicionar indicador de divisão
        if (division) {
            rankIcon.setAttribute('data-division', division);
        }
        
        // Tentar carregar imagem
        if (rank.image) {
            const img = document.createElement('img');
            img.src = rank.image;
            img.alt = rank.name;
            img.title = rank.name;
            
            // Fallback para emoji se imagem não carregar
            img.onerror = () => {
                rankIcon.innerHTML = rank.icon;
                rankIcon.classList.add('emoji-fallback');
            };
            
            rankIcon.appendChild(img);
        } else {
            // Usar emoji como fallback
            rankIcon.innerHTML = rank.icon;
            rankIcon.classList.add('emoji-fallback');
        }
    }

    getNextRank() {
        if (!this.playerData) return null;
        
        const currentRankTier = this.playerData.rankTier || 'Bronze';
        const currentRankDivision = this.playerData.rankDivision || 'III';
        
        // Definir ordem dos tiers e divisões
        const tiers = ['Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Master', 'Grandmaster'];
        const divisions = ['III', 'II', 'I'];
        
        const currentTierIndex = tiers.indexOf(currentRankTier);
        const currentDivisionIndex = divisions.indexOf(currentRankDivision);
        
        // Se não está na divisão I, próxima divisão no mesmo tier
        if (currentDivisionIndex < divisions.length - 1) {
            const nextDivision = divisions[currentDivisionIndex + 1];
            const nextRankName = `${currentRankTier} ${nextDivision}`;
            return this.rankSystem.ranks.find(rank => rank.name === nextRankName);
        }
        
        // Se está na divisão I, próximo tier divisão III
        if (currentTierIndex < tiers.length - 1) {
            const nextTier = tiers[currentTierIndex + 1];
            const nextRankName = `${nextTier} III`;
            return this.rankSystem.ranks.find(rank => rank.name === nextRankName);
        }
        
        // Já está no rank máximo (Grandmaster I)
        return null;
    }

    addRankXP(amount, isWin = true) {
        if (!this.playerData.rankXP) {
            this.playerData.rankXP = 0;
        }
        
        const oldRank = this.getCurrentRank();
        
        // Adicionar ou remover XP
        this.playerData.rankXP = Math.max(0, this.playerData.rankXP + amount);
        
        const newRank = this.getCurrentRank();
        
        // Verificar se subiu ou desceu de rank
        if (oldRank.name !== newRank.name) {
            const rankUp = this.rankSystem.ranks.findIndex(r => r.name === newRank.name) > 
                          this.rankSystem.ranks.findIndex(r => r.name === oldRank.name);
            
            if (rankUp) {
                this.showNotification('🎉 Rank Up!', `Você alcançou ${newRank.name}!`);
            } else {
                this.showNotification('📉 Rank Down', `Você desceu para ${newRank.name}`);
            }
        }
        
        // Mostrar ganho/perda de XP
        const xpText = amount > 0 ? `+${amount}` : `${amount}`;
        const xpType = isWin ? 'Vitória' : 'Derrota';
        this.showNotification(`${isWin ? '🏆' : '💔'} ${xpType}`, `${xpText} XP de Ranking`);
        
        this.savePlayerData();
        this.updateRanking();
    }

    updateMissions() {
        this.updateMissionsList('dailyMissions', this.missions.daily);
        this.updateMissionsList('weeklyMissions', this.missions.weekly);
    }

    updateMissionsList(containerId, missions) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        missions.forEach(mission => {
            const missionElement = document.createElement('div');
            missionElement.className = `mission-card ${mission.completed ? 'completed' : ''}`;
            missionElement.innerHTML = `
                <div class="mission-info">
                    <h4>${mission.name}</h4>
                    <p>${mission.description}</p>
                    <div class="mission-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(mission.progress / mission.maxProgress) * 100}%"></div>
                        </div>
                        <span>${mission.progress}/${mission.maxProgress}</span>
                    </div>
                </div>
                <div class="mission-reward">+${mission.xpReward} XP</div>
            `;
            container.appendChild(missionElement);
        });
    }

    updateMatchHistory() {
        const historyContainer = document.getElementById('matchHistory');
        if (!historyContainer) return;
        
        historyContainer.innerHTML = '';
        
        // Garantir que matchHistory é um array válido
        if (!Array.isArray(this.matchHistory)) {
            this.matchHistory = [];
        }
        
        if (this.matchHistory.length === 0) {
            historyContainer.innerHTML = '<div class="no-matches">Nenhuma partida registrada ainda</div>';
            return;
        }
        
        // Reverter a ordem para mostrar as partidas mais recentes primeiro
        this.matchHistory.slice().reverse().slice(0, 10).forEach(match => {
            if (!match) return; // Pular entradas inválidas
            
            // Determinar se foi vitória ou derrota baseado no winner
            let isWin = false;
            let resultText = 'Derrota';
            let resultIcon = '💀';
            
            // Corrigir comparação - remover condição problemática do match.result
            if (match.winner?.toString() === this.currentPlayerId?.toString()) {
                isWin = true;
                resultText = 'Vitória';
                resultIcon = '🏆';
            }

            // Buscar informações do comandante do jogador atual
            let deckInfo = 'Deck não informado';
            if (match.commanders && Array.isArray(match.commanders)) {
                const playerCommander = match.commanders.find(cmd => 
                    cmd.playerId?.toString() === this.currentPlayerId?.toString()
                );
                
                if (playerCommander) {
                    const commanderName = playerCommander.partnerName ? 
                        `${playerCommander.name} + ${playerCommander.partnerName}` : 
                        playerCommander.name;
                    const theme = playerCommander.theme || 'Tema não informado';
                    deckInfo = `${commanderName} - ${theme}`;
                }
            }
            
            // Formatar a data removendo a parte T00:00:00.000Z
            let formattedDate = 'Data não informada';
            if (match.date) {
                if (match.date.includes('T')) {
                    // Se a data contém 'T', extrair apenas a parte da data
                    const datePart = match.date.split('T')[0];
                    const [year, month, day] = datePart.split('-');
                    formattedDate = `${day}/${month}/${year}`;
                } else {
                    formattedDate = match.date;
                }
            }
            
            const matchElement = document.createElement('div');
            matchElement.className = `match-card ${isWin ? 'win' : 'loss'}`;
            matchElement.innerHTML = `
                <div class="match-result">
                    <span class="result-icon">${resultIcon}</span>
                    <span class="result-text">${resultText}</span>
                </div>
                <div class="match-info">
                    <div class="match-deck">${deckInfo}</div>
                    <div class="match-details">
                        <span>${match.turns || 0} turnos</span>
                        <span>${formattedDate}</span>
                    </div>
                </div>
            `;
            
            // Adicionar event listener para abrir o modal de detalhes
            matchElement.addEventListener('click', () => {
                this.showMatchDetails(match);
            });
            
            historyContainer.appendChild(matchElement);
        });
    }

    showMatchDetails(match) {
        const modal = document.getElementById('matchDetailsModal');
        if (!modal) return;

        // Preencher informações básicas
        this.populateBasicMatchInfo(match);
        
        // Preencher comandantes
        this.populateCommandersInfo(match);
        
        // Preencher ranking
        this.populateRankingInfo(match);
        
        // Preencher dados multiplayer
        this.populateMultiplayerData(match);
        
        // Preencher cartas e outros dados
        this.populateCardsAndOtherData(match);
        
        // Mostrar modal
        modal.style.display = 'block';
        modal.classList.add('show');
        
        // Configurar botão de fechar - usar addEventListener ao invés de onclick
        const closeBtn = document.getElementById('closeMatchDetails');
        if (closeBtn) {
            // Remover listeners anteriores para evitar duplicação
            closeBtn.replaceWith(closeBtn.cloneNode(true));
            const newCloseBtn = document.getElementById('closeMatchDetails');
            
            newCloseBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                modal.classList.remove('show');
            });
        }
        
        // Fechar ao clicar fora do modal - usar addEventListener
        const handleOutsideClick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
                modal.classList.remove('show');
                // Remover o listener após uso
                document.removeEventListener('click', handleOutsideClick);
            }
        };
        
        // Adicionar listener com delay para evitar fechamento imediato
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 100);
    }

    populateBasicMatchInfo(match) {
        // Badge de resultado
        const resultBadge = document.getElementById('matchResultBadge');
        const isWin = match.winner?.toString() === this.currentPlayerId?.toString();
        if (resultBadge) {
            resultBadge.textContent = isWin ? '🏆 Vitória' : '💀 Derrota';
            resultBadge.className = `match-result-badge ${isWin ? 'win' : 'loss'}`;
        }

        // Informações básicas
        const detailDate = document.getElementById('detailDate');
        if (detailDate) {
            // Corrigir problema de fuso horário
            let date = 'Data não informada';
            if (match.date) {
                if (typeof match.date === 'string' && match.date.includes('-')) {
                    // Se a data está no formato YYYY-MM-DD, converter diretamente
                    const [year, month, day] = match.date.split('T')[0].split('-');
                    date = `${day}/${month}/${year}`;
                } else {
                    // Fallback para outros formatos
                    const dateObj = new Date(match.date);
                    date = dateObj.toLocaleDateString('pt-BR');
                }
            }
            detailDate.textContent = date;
        }

        const detailTurns = document.getElementById('detailTurns');
        if (detailTurns) {
            detailTurns.textContent = match.turns || 'Não informado';
        }

        const detailWinner = document.getElementById('detailWinner');
        if (detailWinner) {
            detailWinner.textContent = match.winnerName || 'Não informado';
        }

        const detailFirstPlayer = document.getElementById('detailFirstPlayer');
        if (detailFirstPlayer) {
            // Buscar nome do primeiro jogador
            const firstPlayerName = this.getPlayerNameById(match.firstPlayer) || 'Não informado';
            detailFirstPlayer.textContent = firstPlayerName;
        }
    }

    populateCommandersInfo(match) {
        const commandersContainer = document.getElementById('detailCommanders');
        if (!commandersContainer) return;

        commandersContainer.innerHTML = '';

        if (!match.commanders || match.commanders.length === 0) {
            commandersContainer.innerHTML = '<div class="empty-section">Nenhum comandante registrado</div>';
            return;
        }

        match.commanders.forEach(commander => {
            const commanderItem = document.createElement('div');
            commanderItem.className = 'commander-item';
            
            const commanderName = commander.partnerName ? 
                `${commander.name} + ${commander.partnerName}` : 
                commander.name;
            
            commanderItem.innerHTML = `
                <div>
                    <div class="commander-name">${commanderName}</div>
                    <div class="player-name">${commander.playerName}</div>
                </div>
                <div class="commander-theme">${commander.theme}</div>
            `;
            
            commandersContainer.appendChild(commanderItem);
        });
    }

    populateRankingInfo(match) {
        const rankingContainer = document.getElementById('detailRanking');
        if (!rankingContainer) return;

        rankingContainer.innerHTML = '';

        if (!match.ranking) {
            rankingContainer.innerHTML = '<div class="empty-section">Ranking não registrado</div>';
            return;
        }

        const positions = ['first', 'second', 'third', 'fourth'];
        const positionLabels = ['🥇 1º Lugar', '🥈 2º Lugar', '🥉 3º Lugar', '4º Lugar'];

        positions.forEach((position, index) => {
            if (match.ranking[position]) {
                const rankingItem = document.createElement('div');
                rankingItem.className = `ranking-item ${position}`;
                
                const playerName = this.getPlayerNameById(match.ranking[position]) || 'Jogador não encontrado';
                
                rankingItem.innerHTML = `
                    <span>${positionLabels[index]}</span>
                    <span>${playerName}</span>
                `;
                
                rankingContainer.appendChild(rankingItem);
            }
        });
    }

    populateMultiplayerData(match) {
        // Mulligans
        this.populatePlayerStatSection('detailMulligans', 'mulligansSection', match.playerMulligans, 
            (player) => `${player.count} mulligan(s)`, 'Nenhum mulligan registrado');

        // Jogadas do Turno 1
        this.populatePlayerStatSection('detailTurn1', 'turn1Section', match.playerTurn1, 
            (player) => player.play, 'Nenhuma jogada do turno 1 registrada');

        // Land Drops
        this.populatePlayerStatSection('detailLandDrop', 'landDropSection', match.playerLandDrop, 
            (player) => player.missed ? 'Sim' : 'Não', 'Nenhum land drop registrado');

        // Comandante Removido
        this.populatePlayerStatSection('detailCommanderRemoved', 'commanderRemovedSection', match.playerCommanderRemoved, 
            (player) => `${player.count} vez(es)`, 'Nenhuma remoção de comandante registrada');
    }

    populatePlayerStatSection(containerId, sectionId, data, valueFormatter, emptyMessage) {
        const container = document.getElementById(containerId);
        const section = document.getElementById(sectionId);
        
        if (container && section) {
            if (data && data.length > 0) {
                section.style.display = 'block';
                container.innerHTML = '';
                
                data.forEach(player => {
                    const playerName = this.getPlayerNameById(player.playerId) || 'Jogador não encontrado';
                    const value = valueFormatter(player);
                    const statClass = this.getStatValueClass(player, containerId);
                    
                    const playerItem = document.createElement('div');
                    playerItem.className = 'player-stat-item';
                    
                    // Remover todos os ícones - apenas texto
                    playerItem.innerHTML = `
                        <span class="player-name">${playerName}</span>
                        <span class="stat-value ${statClass}">${value}</span>
                    `;
                    container.appendChild(playerItem);
                });
            } else {
                section.style.display = 'none';
            }
        }
    }

    getStatValueClass(player, containerId) {
        if (containerId === 'detailMulligans') {
            return player.count === 0 ? 'positive' : 'negative';
        }
        if (containerId === 'detailLandDrop') {
            return player.missed ? 'negative' : 'positive';
        }
        if (containerId === 'detailCommanderRemoved') {
            return player.count === 0 ? 'positive' : 'negative';
        }
        return 'neutral';
    }

    async populateCardsAndOtherData(match) {
        // Carta do Jogo
        const gameCardContainer = document.getElementById('detailGameCard');
        const gameCardSection = document.getElementById('gameCardSection');
        
        if (gameCardContainer && gameCardSection) {
            if (match.gameCard && match.gameCard.name) {
                gameCardSection.style.display = 'block';
                gameCardContainer.innerHTML = `
                    <div class="game-card-display">
                        ${match.gameCard.imageUrl ? `<img src="${match.gameCard.imageUrl}" alt="${match.gameCard.name}">` : ''}
                    </div>
                `;
            } else {
                gameCardSection.style.display = 'none';
            }
        }

        // Cartas Finalizadoras
        const finishingCardsContainer = document.getElementById('detailFinishingCards');
        const finishingCardsSection = document.getElementById('finishingCardsSection');
        
        if (finishingCardsContainer && finishingCardsSection) {
            if (match.finishingCards && match.finishingCards.length > 0) {
                finishingCardsSection.style.display = 'block';
                finishingCardsContainer.innerHTML = '';
                
                // Buscar imagens para cada carta finalizadora
                for (const card of match.finishingCards) {
                    const cardItem = document.createElement('div');
                    cardItem.className = 'card-display-item';
                    
                    // Verificar se é um objeto com propriedades ou apenas uma string
                    const cardName = typeof card === 'string' ? card : (card.name || card);
                    let cardImage = typeof card === 'object' && card.imageUrl ? card.imageUrl : null;
                    
                    // Se não tiver imagem, tentar buscar na API
                    if (!cardImage && cardName) {
                        try {
                            const response = await fetch(`/api/cards/search/${encodeURIComponent(cardName)}`);
                            if (response.ok) {
                                const cardData = await response.json();
                                const cardArray = Array.isArray(cardData) ? cardData : [cardData];
                                if (cardArray.length > 0 && cardArray[0].imageUrl) {
                                    cardImage = cardArray[0].imageUrl;
                                }
                            }
                        } catch (error) {
                            console.log('Erro ao buscar imagem da carta:', cardName, error);
                        }
                    }
                    
                    cardItem.innerHTML = `
                        ${cardImage ? `<img src="${cardImage}" alt="${cardName}">` : ''}
                        <div class="card-name">${cardName}</div>
                    `;
                    finishingCardsContainer.appendChild(cardItem);
                }
            } else {
                finishingCardsSection.style.display = 'none';
            }
        }

        // Archenemy
        const archenemyContainer = document.getElementById('detailArchenemy');
        const archenemySection = document.getElementById('archenemySection');
        
        if (archenemyContainer && archenemySection) {
            if (match.archenemy) {
                archenemySection.style.display = 'block';
                const archenemyName = this.getPlayerNameById(match.archenemy) || 'Jogador não encontrado';
                archenemyContainer.textContent = archenemyName;
            } else {
                archenemySection.style.display = 'none';
            }
        }

        // Observações
        const observationsContainer = document.getElementById('detailObservations');
        const observationsSection = document.getElementById('observationsSection');
        
        if (observationsContainer && observationsSection) {
            if (match.observations && match.observations.trim()) {
                observationsSection.style.display = 'block';
                observationsContainer.textContent = match.observations;
            } else {
                observationsSection.style.display = 'none';
            }
        }
    }

    getPlayerNameById(playerId) {
        if (!playerId) return null;
        
        // Buscar nos jogadores carregados
        const player = this.allPlayers.find(p => p._id === playerId || p._id === playerId.toString());
        return player ? player.name : null;
    }

    setupAchievementsControls() {
        // Evitar configurar listeners múltiplas vezes
        if (this.achievementsControlsSetup) return;
        this.achievementsControlsSetup = true;
        
        // Filtro por categoria
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', async (e) => {
                this.currentCategoryFilter = e.target.value;
                this.currentAchievementsPage = 1;
                await this.updateAchievements();
            });
        }
        
        // Busca
        const searchInput = document.getElementById('achievementSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(async (e) => {
                this.currentSearchFilter = e.target.value;
                this.currentAchievementsPage = 1;
                await this.updateAchievements();
            }, 300));
        }
        
        // Paginação
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', async () => {
                if (this.currentAchievementsPage > 1) {
                    this.currentAchievementsPage--;
                    await this.updateAchievements();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', async () => {
                if (this.currentAchievementsPage < this.totalAchievementsPages) {
                    this.currentAchievementsPage++;
                    await this.updateAchievements();
                }
            });
        }
        
        // Gerenciar conquistas em destaque
        const manageFeaturedBtn = document.getElementById('manageFeaturedBtn');
        if (manageFeaturedBtn) {
            manageFeaturedBtn.addEventListener('click', () => {
                this.showFeaturedManagementModal();
            });
        }
    }

    async showFeaturedManagementModal() {
        const modal = document.getElementById('featuredManagementModal');
        if (!modal) return;
        
        // Configurar os filtros do modal apenas uma vez
        if (!this.featuredModalListenersSetup) {
            this.setupFeaturedModalFilters();
            this.setupFeaturedModalEventDelegation();
            this.featuredModalListenersSetup = true;
        }
        
        // Mostrar modal com skeleton loading
        modal.style.display = 'block';
        this.showFeaturedModalSkeleton();
        
        // Carregar primeiro lote de conquistas
        this.featuredModalCurrentPage = 0;
        await this.populateFeaturedSelectionGridOptimized();
        
        // Event listeners para os botões do modal (mantidos aqui pois são específicos da instância)
        const saveBtn = document.getElementById('saveFeaturedBtn');
        const cancelBtn = document.getElementById('cancelFeaturedBtn');
        const closeBtn = modal.querySelector('.close');
        
        const closeModal = () => {
            modal.style.display = 'none';
            // Limpar filtros ao fechar
            const categoryFilter = document.getElementById('featuredCategoryFilter');
            const searchInput = document.getElementById('featuredAchievementSearch');
            if (categoryFilter) categoryFilter.value = 'all';
            if (searchInput) searchInput.value = '';
            // Reset pagination
            this.featuredModalCurrentPage = 0;
        };
        
        if (saveBtn) {
            saveBtn.onclick = async () => {
                await this.saveFeaturedAchievements();
                closeModal();
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = closeModal;
        }
        
        if (closeBtn) {
            closeBtn.onclick = closeModal;
        }
        
        // Fechar modal clicando fora dele
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
    }

    async populateFeaturedSelectionGridOptimized() {
        if (this.featuredModalIsRendering) return;
        this.featuredModalIsRendering = true;
        
        const grid = document.getElementById('featuredSelectionGrid');
        if (!grid) {
            this.featuredModalIsRendering = false;
            return;
        }
        
        let unlockedAchievements = this.achievements.filter(a => a.unlocked);
        
        // Aplicar filtros
        const categoryFilter = document.getElementById('featuredCategoryFilter');
        const searchInput = document.getElementById('featuredAchievementSearch');
        
        if (categoryFilter && categoryFilter.value !== 'all') {
            unlockedAchievements = unlockedAchievements.filter(achievement => 
                achievement.category === categoryFilter.value
            );
        }
        
        if (searchInput && searchInput.value.trim()) {
            const searchTerm = searchInput.value.toLowerCase();
            unlockedAchievements = unlockedAchievements.filter(achievement => 
                achievement.name.toLowerCase().includes(searchTerm) ||
                achievement.description.toLowerCase().includes(searchTerm)
            );
        }
        
        // Usar a API do servidor em vez do localStorage
        const currentFeaturedIds = await this.achievementSystem.getFeaturedAchievements(this.currentPlayerId);
        
        // Limpar grid apenas se for a primeira página
        if (this.featuredModalCurrentPage === 0) {
            grid.replaceChildren();
        }
        
        if (unlockedAchievements.length === 0) {
            const noAchievementsDiv = document.createElement('div');
            noAchievementsDiv.className = 'no-achievements';
            noAchievementsDiv.textContent = 'Nenhuma conquista encontrada com os filtros aplicados.';
            grid.replaceChildren(noAchievementsDiv);
            this.featuredModalIsRendering = false;
            return;
        }
        
        // Calcular itens para esta página
        const startIndex = this.featuredModalCurrentPage * this.featuredModalItemsPerBatch;
        const endIndex = Math.min(startIndex + this.featuredModalItemsPerBatch, unlockedAchievements.length);
        const itemsToRender = unlockedAchievements.slice(startIndex, endIndex);
        
        // Render em lotes usando DocumentFragment e requestAnimationFrame
        await this.renderFeaturedItemsInBatches(itemsToRender, currentFeaturedIds, grid);
        
        // Adicionar botão "Carregar mais" se houver mais itens
        this.updateLoadMoreButton(unlockedAchievements.length, endIndex, grid);
        
        this.featuredModalIsRendering = false;
    }

    async renderFeaturedItemsInBatches(items, currentFeaturedIds, grid) {
        const fragment = document.createDocumentFragment();
        const batchSize = 10; // Renderizar 10 itens por frame
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            
            // Renderizar lote atual
            batch.forEach(achievement => {
                const isSelected = currentFeaturedIds.includes(achievement.id);
                const selectionItem = this.createFeaturedSelectionItem(achievement, isSelected);
                fragment.appendChild(selectionItem);
            });
            
            // Aguardar próximo frame se não for o último lote
            if (i + batchSize < items.length) {
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
        }
        
        // Adicionar todos os itens de uma vez
        grid.appendChild(fragment);
    }

    createFeaturedSelectionItem(achievement, isSelected) {
        const selectionItem = document.createElement('div');
        selectionItem.className = `featured-selection-item ${isSelected ? 'selected' : ''}`;
        selectionItem.dataset.achievementId = achievement.id;
        
        selectionItem.innerHTML = `
            <div class="selection-checkbox">
                <input type="checkbox" ${isSelected ? 'checked' : ''} id="featured_${achievement.id}">
            </div>
            <div class="achievement-preview">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="category-badge">${achievement.category}</div>
            </div>
        `;
        
        return selectionItem;
    }

    updateLoadMoreButton(totalItems, currentEndIndex, grid) {
        // Remover botão existente
        const existingButton = grid.querySelector('.load-more-featured');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Adicionar novo botão se houver mais itens
        if (currentEndIndex < totalItems) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'load-more-featured';
            loadMoreBtn.textContent = `Carregar mais (${totalItems - currentEndIndex} restantes)`;
            loadMoreBtn.onclick = () => {
                this.featuredModalCurrentPage++;
                this.populateFeaturedSelectionGridOptimized();
            };
            grid.appendChild(loadMoreBtn);
        }
    }

    async populateFeaturedSelectionGrid() {
        // Manter método original para compatibilidade, mas redirecionar para otimizado
        this.featuredModalCurrentPage = 0;
        await this.populateFeaturedSelectionGridOptimized();
    }

    setupFeaturedModalFilters() {
        // Filtro por categoria no modal
        const featuredCategoryFilter = document.getElementById('featuredCategoryFilter');
        if (featuredCategoryFilter) {
            featuredCategoryFilter.addEventListener('change', () => {
                this.featuredModalCurrentPage = 0;
                this.populateFeaturedSelectionGridOptimized();
            });
        }
        
        // Busca no modal
        const featuredSearchInput = document.getElementById('featuredAchievementSearch');
        if (featuredSearchInput) {
            featuredSearchInput.addEventListener('input', this.debounce(() => {
                this.featuredModalCurrentPage = 0;
                this.populateFeaturedSelectionGridOptimized();
            }, 300));
        }
    }

    setupFeaturedModalEventDelegation() {
        const grid = document.getElementById('featuredSelectionGrid');
        if (!grid || this.featuredModalGridListener) return;
        
        // Delegação de eventos - um único listener para todo o grid
        this.featuredModalGridListener = (e) => {
            const selectionItem = e.target.closest('.featured-selection-item');
            if (!selectionItem) return;
            
            const checkbox = selectionItem.querySelector('input[type="checkbox"]');
            if (!checkbox) return;
            
            // Se clicou no checkbox, deixa o comportamento padrão
            if (e.target.type === 'checkbox') {
                this.handleFeaturedSelection(e.target, selectionItem);
                return;
            }
            
            // Se clicou no card, simula clique no checkbox
            const currentlySelected = checkbox.checked;
            const selectedCount = grid.querySelectorAll('input[type="checkbox"]:checked').length;
            
            if (!currentlySelected && selectedCount >= 5) {
                this.showErrorMessage('Máximo de 5 conquistas em destaque permitidas!');
                return;
            }
            
            checkbox.checked = !currentlySelected;
            this.handleFeaturedSelection(checkbox, selectionItem);
        };
        
        grid.addEventListener('click', this.featuredModalGridListener);
        grid.addEventListener('change', this.featuredModalGridListener);
    }

    handleFeaturedSelection(checkbox, selectionItem) {
        const grid = document.getElementById('featuredSelectionGrid');
        const selectedCount = grid.querySelectorAll('input[type="checkbox"]:checked').length;
        
        if (checkbox.checked && selectedCount > 5) {
            checkbox.checked = false;
            this.showErrorMessage('Máximo de 5 conquistas em destaque permitidas!');
            return;
        }
        
        selectionItem.classList.toggle('selected', checkbox.checked);
    }

    showFeaturedModalSkeleton() {
        const grid = document.getElementById('featuredSelectionGrid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="loading-skeleton">
                <div class="skeleton-item"></div>
                <div class="skeleton-item"></div>
                <div class="skeleton-item"></div>
                <div class="skeleton-item"></div>
                <div class="skeleton-item"></div>
                <div class="skeleton-item"></div>
            </div>
        `;
    }

    async saveFeaturedAchievements() {
        const grid = document.getElementById('featuredSelectionGrid');
        if (!grid) return;
        
        const selectedIds = Array.from(grid.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.id.replace('featured_', ''));
        
        // Usar a API do servidor em vez do localStorage
        const success = await this.achievementSystem.setFeaturedAchievements(this.currentPlayerId, selectedIds);
        
        if (success) {
            this.showSuccessMessage(`${selectedIds.length} conquistas em destaque salvas!`);
            this.updateFeaturedAchievements(); // Atualizar a exibição
        } else {
            this.showErrorMessage('Erro ao salvar conquistas em destaque!');
        }
    }

    showAchievementModal(achievementId) {
        const achievement = this.achievements.find(a => a.id === achievementId);
        if (!achievement) return;
        
        // Elementos do modal
        const modal = document.getElementById('achievementModal');
        const titleElement = document.getElementById('modalAchievementTitle');
        const nameElement = document.getElementById('modalAchievementName');
        const descElement = document.getElementById('modalAchievementDesc');
        const xpElement = document.getElementById('modalAchievementXP');
        const dateElement = document.getElementById('modalAchievementDate');
        const specialSection = document.getElementById('specialAchievementSection');
        const passwordInput = document.getElementById('achievementPassword');
        const errorDiv = document.getElementById('passwordError');
        const successDiv = document.getElementById('passwordSuccess');
        
        // Preencher informações básicas
        nameElement.textContent = achievement.name;
        descElement.textContent = achievement.description;
        xpElement.textContent = `+${achievement.xpReward} XP`;
        
        // Exibir data de desbloqueio se disponível
        if (achievement.unlockedAt && achievement.unlocked) {
            const date = new Date(achievement.unlockedAt);
            dateElement.textContent = `📅 Desbloqueado em: ${date.toLocaleDateString('pt-BR')}`;
            dateElement.style.display = 'block';
        } else {
            dateElement.style.display = 'none';
        }
        
        // Verificar se é um achievement especial
        if (achievement.requiresPassword && !achievement.unlocked) {
            titleElement.textContent = 'Achievement Especial';
            specialSection.style.display = 'block';
            
            // Limpar campos
            passwordInput.value = '';
            errorDiv.style.display = 'none';
            successDiv.style.display = 'none';
            
            // Configurar evento do botão de desbloqueio
            const unlockBtn = document.getElementById('unlockSpecialBtn');
            unlockBtn.onclick = () => this.handleSpecialUnlock(achievementId);
            
            // Permitir Enter para desbloquear
            passwordInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    this.handleSpecialUnlock(achievementId);
                }
            };
        } else {
            titleElement.textContent = achievement.unlocked ? 'Conquista Desbloqueada!' : 'Conquista';
            specialSection.style.display = 'none';
        }
        
        modal.style.display = 'block';
        modal.classList.add('show');
    }
    
    async handleSpecialUnlock(achievementId) {
        const passwordInput = document.getElementById('achievementPassword');
        const errorDiv = document.getElementById('passwordError');
        const successDiv = document.getElementById('passwordSuccess');
        const unlockBtn = document.getElementById('unlockSpecialBtn');
        
        const password = passwordInput.value.trim();
        
        if (!password) {
            this.showPasswordError('Por favor, digite a senha.');
            return;
        }
        
        // Desabilitar botão durante o processo
        unlockBtn.disabled = true;
        unlockBtn.textContent = '🔄 Desbloqueando...';
        
        try {
            // Capturar a data customizada do input
            const customDateInput = document.getElementById('customUnlockDate');
            const customUnlockedAt = customDateInput && customDateInput.value ? customDateInput.value : null;
            
            const result = await this.achievementSystem.unlockSpecialAchievement(
                achievementId, 
                password, 
                this.currentPlayerId,
                customUnlockedAt
            );
            
            if (result.success) {
                // Atualizar achievement local
                const achievement = this.achievements.find(a => a.id === achievementId);
                if (achievement) {
                    achievement.unlocked = true;
                    achievement.progress = achievement.maxProgress;
                }
                
                // Mostrar sucesso
                successDiv.textContent = result.message;
                successDiv.style.display = 'block';
                errorDiv.style.display = 'none';
                
                // Adicionar XP
                this.addXP(achievement.xpReward);
                
                // Mostrar notificação
                this.showNotification('🏆 Achievement Especial Desbloqueado!', 
                    `${achievement.name} - +${achievement.xpReward} XP`);
                
                // Atualizar UI
                await this.updateAchievements();
                await this.updateAchievementsList();
                
                // Fechar modal após 2 segundos
                setTimeout(() => {
                    const modal = document.getElementById('achievementModal');
                    modal.style.display = 'none';
                    modal.classList.remove('show');
                }, 2000);
            }
        } catch (error) {
            this.showPasswordError(error.message);
        } finally {
            // Reabilitar botão
            unlockBtn.disabled = false;
            unlockBtn.textContent = '🔓 Desbloquear';
        }
    }
    
    showPasswordError(message) {
        const errorDiv = document.getElementById('passwordError');
        const successDiv = document.getElementById('passwordSuccess');
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
    }

    simulateMatch(result) {
        const decks = Object.keys(this.playerData.favoriteDecks);
        const randomDeck = decks[Math.floor(Math.random() * decks.length)];
        const turns = Math.floor(Math.random() * 15) + 3;
        
        const newMatch = {
            id: this.matchHistory.length + 1,
            result: result,
            deck: randomDeck,
            opponent: 'Oponente Simulado',
            duration: `${Math.floor(turns * 2)} min`,
            turns: turns,
            date: new Date().toLocaleDateString(),
            winner: result === 'win' ? this.currentPlayerId : 'opponent_id'
        };
        
        this.matchHistory.unshift(newMatch);
        
        // Atualizar estatísticas
        this.playerData.totalMatches++;
        if (result === 'win') {
            this.playerData.wins++;
            this.addXP(50);
            
            if (turns < this.playerData.fastestWin) {
                this.playerData.fastestWin = turns;
            }
        }
        
        // Atualizar deck stats
        if (this.playerData.favoriteDecks[randomDeck]) {
            this.playerData.favoriteDecks[randomDeck].total++;
            if (result === 'win') {
                this.playerData.favoriteDecks[randomDeck].wins++;
            }
        }
        
        this.savePlayerData();
        this.checkAchievements();
        this.updateUI();
        
        this.showNotification(
            result === 'win' ? '🏆 Vitória!' : '💀 Derrota',
            `Partida simulada com ${randomDeck}`
        );
    }

    addXP(amount) {
        this.playerData.xp += amount;
        
        // Verificar level up
        while (this.playerData.xp >= this.playerData.xpToNext) {
            this.playerData.xp -= this.playerData.xpToNext;
            this.playerData.level++;
            this.playerData.xpToNext = Math.floor(this.playerData.xpToNext * 1.2);
            
            this.showNotification('🎉 Level Up!', `Você alcançou o nível ${this.playerData.level}!`);
        }
        
        this.savePlayerData();
    }

    async checkAchievements() {
        if (this.currentPlayerId) {
            await this.achievementSystem.processMatchAchievements(
                {}, // Dados vazios para verificação apenas de stats
                this.currentPlayerId,
                this.playerData,
                this
            );
        }
    }

    unlockAchievement(achievementId) {
        const achievement = this.achievements.find(a => a.id === achievementId);
        if (achievement && !achievement.unlocked) {
            achievement.unlocked = true;
            this.addXP(achievement.xpReward);
            this.showNotification('🏆 Conquista Desbloqueada!', achievement.name);
        }
    }

    showNotification(title, message) {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
        `;
        
        // Adicionar estilos se não existirem
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    z-index: 1000;
                    animation: slideIn 0.3s ease-out;
                    max-width: 300px;
                }
                .notification-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .notification-message {
                    font-size: 0.9em;
                    opacity: 0.9;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remover após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    startDailyReset() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
            this.resetDailyMissions();
            setInterval(() => this.resetDailyMissions(), 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
    }

    resetDailyMissions() {
        this.missions.daily.forEach(mission => {
            mission.progress = 0;
            mission.completed = false;
        });
    }

    showSuccessMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showErrorMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    setupRankingSelectors() {
        const rankingSelectors = ['firstPlace', 'secondPlace', 'thirdPlace', 'fourthPlace'];
        
        rankingSelectors.forEach(selectorId => {
            const select = document.getElementById(selectorId);
            if (select) {
                select.addEventListener('change', () => this.updateRankingOptions());
            }
        });
        
        this.populateRankingSelectors();
        this.populateWinnerSelector();
    }

    populateRankingSelectors() {
        const rankingSelectors = ['firstPlace', 'secondPlace', 'thirdPlace', 'fourthPlace'];
        
        rankingSelectors.forEach(selectorId => {
            const select = document.getElementById(selectorId);
            if (select) {
                // Limpar opções existentes (exceto a primeira)
                while (select.children.length > 1) {
                    select.removeChild(select.lastChild);
                }
                
                // Adicionar todos os jogadores
                this.allPlayers.forEach(player => {
                    const option = document.createElement('option');
                    option.value = player._id || player.id;
                    option.textContent = player.name;
                    select.appendChild(option);
                });
            }
        });
    }

    populateWinnerSelector() {
        const winnerSelect = document.getElementById('winner');
        if (winnerSelect) {
            // Limpar opções existentes (exceto a primeira)
            while (winnerSelect.children.length > 1) {
                winnerSelect.removeChild(winnerSelect.lastChild);
            }
            
            // Adicionar todos os jogadores
            this.allPlayers.forEach(player => {
                const option = document.createElement('option');
                option.value = player._id || player.id;
                option.textContent = player.name;
                winnerSelect.appendChild(option);
            });
        }
        
        // Popular também o seletor de archenemy
        this.populateArchenemySelector();
    }

    populateArchenemySelector() {
        const archenemySelect = document.getElementById('archenemy');
        if (!archenemySelect) return;
        
        // Limpar opções existentes
        archenemySelect.innerHTML = '<option value="">Nenhum</option>';
        
        // Adicionar todos os jogadores
        this.allPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player._id;
            option.textContent = player.name;
            archenemySelect.appendChild(option);
        });
    }

    populateGameCardOwnerSelector() {
        const gameCardOwnerElement = document.getElementById('gameCardOwner');
        if (!gameCardOwnerElement) return;
        
        // Limpar opções existentes (exceto a primeira)
        gameCardOwnerElement.innerHTML = '<option value="">Selecione o dono da carta...</option>';
        
        // Adicionar todos os jogadores disponíveis
        this.allPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player._id;
            option.textContent = player.name;
            gameCardOwnerElement.appendChild(option);
        });
    }

    updateRankingOptions() {
        const rankingSelectors = ['firstPlace', 'secondPlace', 'thirdPlace', 'fourthPlace'];
        const selectedPlayers = new Set();
        
        // Coletar jogadores já selecionados
        rankingSelectors.forEach(selectorId => {
            const select = document.getElementById(selectorId);
            if (select && select.value) {
                selectedPlayers.add(select.value);
            }
        });
        
        // Atualizar opções disponíveis em cada selector
        rankingSelectors.forEach(selectorId => {
            const select = document.getElementById(selectorId);
            if (select) {
                const currentValue = select.value;
                
                // Desabilitar opções já selecionadas em outros selectors
                Array.from(select.options).forEach(option => {
                    if (option.value === '') return; // Manter opção vazia
                    
                    if (selectedPlayers.has(option.value) && option.value !== currentValue) {
                        option.disabled = true;
                        option.style.color = '#666';
                    } else {
                        option.disabled = false;
                        option.style.color = 'white';
                    }
                });
            }
        });
    }

    setupCommandersInput() {
        const addCommanderBtn = document.getElementById('addCommanderBtn');
        
        addCommanderBtn?.addEventListener('click', () => {
            this.addCommanderInput();
        });
        
        // Inicializar com um comandante
        this.populateCommanderPlayers();
    }

    addCommanderInput() {
        const container = document.getElementById('commandersContainer');
        const currentEntries = container.querySelectorAll('.commander-entry');
        
        if (currentEntries.length >= 4) {
            this.showErrorMessage('Máximo de 4 comandantes por partida');
            return;
        }
        
        const entryDiv = document.createElement('div');
        entryDiv.className = 'commander-entry';
        entryDiv.innerHTML = `
            <div class="commander-input-group">
                <input type="text" class="commander-input" placeholder="Digite o nome do comandante..." required>
                <input type="text" class="commander-partner" placeholder="Comandante Partner (opcional)">
                <select class="commander-theme" required>
                    <option value="">Selecione o tema do deck...</option>
                    <option value="Big Mana">Big Mana</option>
                    <option value="Clones // Theft">Clones // Theft</option>
                    <option value="Combo">Combo</option>
                    <option value="Control">Control</option>
                    <option value="Discard">Discard</option>
                    <option value="Exile">Exile</option>
                    <option value="Fight">Fight</option>
                    <option value="Group Slug">Group Slug</option>
                    <option value="Kindred">Kindred</option>
                    <option value="Kindred // Blink">Kindred // Blink</option>
                    <option value="Kindred // Clones">Kindred // Clones</option>
                    <option value="Kindred // Control">Kindred // Control</option>
                    <option value="Kindred // Lifegain">Kindred // Lifegain</option>
                    <option value="Lands Matter">Lands Matter</option>
                    <option value="Legends // Aristocrats">Legends // Aristocrats</option>
                    <option value="Lifegain">Lifegain</option>
                    <option value="Mill">Mill</option>
                    <option value="Self-Mill">Self-Mill</option>
                    <option value="Control // Stax">Control // Stax</option>
                    <option value="Theft">Theft</option>
                    <option value="Tokens // +1/+1 Counters">Tokens // +1/+1 Counters</option>
                    <option value="Voltron">Voltron</option>
                    <option value="Wheels">Wheels</option>
                </select>
                <select class="commander-player" required>
                    <option value="">Selecione o jogador...</option>
                </select>
                <div class="card-preview"></div>
                <div class="partner-preview"></div>
            </div>
            <button type="button" class="remove-commander-btn">×</button>
        `;
        
        container.appendChild(entryDiv);
        
        // Adicionar evento de remoção
        const removeBtn = entryDiv.querySelector('.remove-commander-btn');
        removeBtn.addEventListener('click', () => {
            entryDiv.remove();
            this.updateAddCommanderButton();
        });
        
        // Popular jogadores no select
        this.populateCommanderPlayersInEntry(entryDiv);
        
        // Setup busca de carta
        const input = entryDiv.querySelector('.commander-input');
        const preview = entryDiv.querySelector('.card-preview');
        this.setupCardSearch(input, preview);
        
        // Setup busca de carta para partner
        const partnerInput = entryDiv.querySelector('.commander-partner');
        const partnerPreview = entryDiv.querySelector('.partner-preview');
        this.setupCardSearch(partnerInput, partnerPreview);
        
        this.updateAddCommanderButton();
    }

    populateCommanderPlayers() {
        const entries = document.querySelectorAll('.commander-entry');
        entries.forEach(entry => {
            this.populateCommanderPlayersInEntry(entry);
        });
    }

    populateCommanderPlayersInEntry(entry) {
        const playerSelect = entry.querySelector('.commander-player');
        
        if (playerSelect) {
            playerSelect.innerHTML = '<option value="">Selecione o jogador...</option>';
            this.allPlayers.forEach(player => {
                const option = document.createElement('option');
                option.value = player._id;
                option.textContent = player.name;
                playerSelect.appendChild(option);
            });
        }
        
        // Remover a população do partner - agora é input de texto para busca de cartas
    }

    updateAddCommanderButton() {
        const addBtn = document.getElementById('addCommanderBtn');
        const entries = document.querySelectorAll('.commander-entry');
        
        if (entries.length >= 4) {
            addBtn.disabled = true;
            addBtn.textContent = 'Máximo de 4 comandantes';
        } else {
            addBtn.disabled = false;
            addBtn.textContent = '+ Adicionar Comandante';
        }
    }
    // === FUNÇÕES MULTI-JOGADOR ===
    setupMultiPlayerFields() {
        // Setup Mulligans
        document.getElementById('addMulliganBtn')?.addEventListener('click', () => {
            this.addMulliganInput();
        });
        
        // Setup Turn 1
        document.getElementById('addTurn1Btn')?.addEventListener('click', () => {
            this.addTurn1Input();
        });
        
        // Setup Land Drop
        document.getElementById('addLanddropBtn')?.addEventListener('click', () => {
            this.addLanddropInput();
        });
        
        // Setup Commander Removed
        document.getElementById('addCommanderRemovedBtn')?.addEventListener('click', () => {
            this.addCommanderRemovedInput();
        });
        
        // Popular seletores iniciais
        this.populateMultiPlayerSelectors();
    }
    
    addMulliganInput() {
        const container = document.getElementById('mulligansContainer');
        const entries = container.querySelectorAll('.mulligan-entry');
        
        if (entries.length >= 4) {
            this.showErrorMessage('Máximo de 4 jogadores permitido');
            return;
        }
        
        const newEntry = document.createElement('div');
        newEntry.className = 'mulligan-entry';
        newEntry.innerHTML = `
            <div class="mulligan-input-group">
                <select class="mulligan-player" required>
                    <option value="">Selecione o jogador...</option>
                </select>
                <input type="number" class="mulligan-count" min="0" max="7" placeholder="0" required>
            </div>
        `;
        
        container.appendChild(newEntry);
        this.populatePlayerSelector(newEntry.querySelector('.mulligan-player'));
        this.updateAddMulliganButton();
    }
    
    addTurn1Input() {
        const container = document.getElementById('turn1Container');
        const entries = container.querySelectorAll('.turn1-entry');
        
        if (entries.length >= 4) {
            this.showErrorMessage('Máximo de 4 jogadores permitido');
            return;
        }
        
        const newEntry = document.createElement('div');
        newEntry.className = 'turn1-entry';
        newEntry.innerHTML = `
            <div class="turn1-input-group">
                <select class="turn1-player" required>
                    <option value="">Selecione o jogador...</option>
                </select>
                <select class="turn1-play" required>
                    <option value="">Selecione...</option>
                    <option value="land">Land</option>
                    <option value="land-1-card">Land, 1 Card</option>
                    <option value="land-2-cards">Land, 2 Cards</option>
                    <option value="land-3-cards">Land, 3 Cards</option>
                    <option value="no-drop">No Drop</option>
                </select>
            </div>
        `;
        
        container.appendChild(newEntry);
        this.populatePlayerSelector(newEntry.querySelector('.turn1-player'));
        this.updateAddTurn1Button();
    }
    
    addLanddropInput() {
        const container = document.getElementById('landdropContainer');
        const entries = container.querySelectorAll('.landdrop-entry');
        
        if (entries.length >= 4) {
            this.showErrorMessage('Máximo de 4 jogadores permitido');
            return;
        }
        
        const newEntry = document.createElement('div');
        newEntry.className = 'landdrop-entry';
        newEntry.innerHTML = `
            <div class="landdrop-input-group">
                <select class="landdrop-player" required>
                    <option value="">Selecione o jogador...</option>
                </select>
                <select class="landdrop-missed" required>
                    <option value="">Selecione...</option>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                </select>
            </div>
        `;
        
        container.appendChild(newEntry);
        this.populatePlayerSelector(newEntry.querySelector('.landdrop-player'));
        this.updateAddLanddropButton();
    }
    
    addCommanderRemovedInput() {
        const container = document.getElementById('commanderRemovedContainer');
        const entries = container.querySelectorAll('.commander-removed-entry');
        
        if (entries.length >= 4) {
            this.showErrorMessage('Máximo de 4 jogadores permitido');
            return;
        }
        
        const newEntry = document.createElement('div');
        newEntry.className = 'commander-removed-entry';
        newEntry.innerHTML = `
            <div class="commander-removed-input-group">
                <select class="commander-removed-player" required>
                    <option value="">Selecione o jogador...</option>
                </select>
                <input type="number" class="commander-removed-main-count" min="0" placeholder="Comandante Principal" required>
                <input type="number" class="commander-removed-partner-count" min="0" placeholder="Partner (opcional)">
            </div>
        `;
        
        container.appendChild(newEntry);
        this.populatePlayerSelector(newEntry.querySelector('.commander-removed-player'));
        this.updateAddCommanderRemovedButton();
    }
    
    populateMultiPlayerSelectors() {
        // Popular todos os seletores de jogador nos campos multi-jogador
        document.querySelectorAll('.mulligan-player, .turn1-player, .landdrop-player, .commander-removed-player').forEach(select => {
            this.populatePlayerSelector(select);
        });
    }
    
    populatePlayerSelector(selectElement) {
        // Limpar opções existentes (exceto a primeira)
        while (selectElement.children.length > 1) {
            selectElement.removeChild(selectElement.lastChild);
        }
        
        // Adicionar todos os jogadores
        this.allPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player._id || player.id;
            option.textContent = player.name;
            selectElement.appendChild(option);
        });
    }
    
    updateAddMulliganButton() {
        const container = document.getElementById('mulligansContainer');
        const button = document.getElementById('addMulliganBtn');
        if (!container || !button) return;
        
        const entries = container.querySelectorAll('.mulligan-entry');
        
        if (entries.length >= 4) {
            button.style.display = 'none';
        } else {
            button.style.display = 'block';
        }
    }
    
    updateAddTurn1Button() {
        const container = document.getElementById('turn1Container');
        const button = document.getElementById('addTurn1Btn');
        if (!container || !button) return;
        
        const entries = container.querySelectorAll('.turn1-entry');
        
        if (entries.length >= 4) {
            button.style.display = 'none';
        } else {
            button.style.display = 'block';
        }
    }
    
    updateAddLanddropButton() {
        const container = document.getElementById('landdropContainer');
        const button = document.getElementById('addLanddropBtn');
        if (!container || !button) return;
        
        const entries = container.querySelectorAll('.landdrop-entry');
        
        if (entries.length >= 4) {
            button.style.display = 'none';
        } else {
            button.style.display = 'block';
        }
    }
    
    updateAddCommanderRemovedButton() {
        const container = document.getElementById('commanderRemovedContainer');
        const button = document.getElementById('addCommanderRemovedBtn');
        if (!container || !button) return;
        
        const entries = container.querySelectorAll('.commander-removed-entry');
        
        if (entries.length >= 4) {
            button.style.display = 'none';
        } else {
            button.style.display = 'block';
        }
    }
    setupCardSearch(input, preview) {
        input.addEventListener('input', this.debounce(async (e) => {
            const cardName = e.target.value.trim();
            if (cardName.length > 2) {
                await this.searchAndDisplayCard(cardName, preview);
            } else {
                preview.classList.remove('show');
            }
        }, 500));
    }

    getMatchFormData() {
        const ranking = {
            first: document.getElementById('firstPlace').value,
            second: document.getElementById('secondPlace').value,
            third: document.getElementById('thirdPlace').value,
            fourth: document.getElementById('fourthPlace').value
        };

        // Coletar dados dos comandantes
        const commanderEntries = document.querySelectorAll('.commander-entry');
        const commanders = [];
        const playerProfiles = [];
        
        commanderEntries.forEach(entry => {
            const commanderInput = entry.querySelector('.commander-input');
            const partnerInput = entry.querySelector('.commander-partner');
            const themeInput = entry.querySelector('.commander-theme');
            const playerSelect = entry.querySelector('.commander-player');
            
            if (commanderInput && themeInput && playerSelect && 
                commanderInput.value.trim() && themeInput.value.trim() && playerSelect.value) {
                const commanderData = {
                    name: commanderInput.value.trim(),
                    theme: themeInput.value.trim(),
                    playerId: playerSelect.value,
                    playerName: playerSelect.options[playerSelect.selectedIndex].text
                };
                
                // Adicionar partner se preenchido
                if (partnerInput && partnerInput.value.trim()) {
                    commanderData.partnerName = partnerInput.value.trim();
                }
                
                commanders.push(commanderData);
                
                // Adicionar aos playerProfiles
                playerProfiles.push({
                    playerId: playerSelect.value,
                    commander: commanderInput.value.trim()
                });
            }
        });

        // === COLETAR DADOS MULTI-JOGADOR ===
        
        // Coletar Mulligans por jogador
        const mulliganEntries = document.querySelectorAll('.mulligan-entry');
        const mulligansData = [];
        mulliganEntries.forEach(entry => {
            const playerSelect = entry.querySelector('.mulligan-player');
            const countInput = entry.querySelector('.mulligan-count');
            
            if (playerSelect && countInput && playerSelect.value && countInput.value !== '') {
                mulligansData.push({
                    playerId: playerSelect.value,
                    playerName: playerSelect.options[playerSelect.selectedIndex].text,
                    count: parseInt(countInput.value) || 0
                });
            }
        });

        // Coletar Turn 1 por jogador
        const turn1Entries = document.querySelectorAll('.turn1-entry');
        const turn1Data = [];
        turn1Entries.forEach(entry => {
            const playerSelect = entry.querySelector('.turn1-player');
            const playInput = entry.querySelector('.turn1-play');
            
            if (playerSelect && playInput && playerSelect.value && playInput.value.trim()) {
                turn1Data.push({
                    playerId: playerSelect.value,
                    playerName: playerSelect.options[playerSelect.selectedIndex].text,
                    play: playInput.value.trim()
                });
            }
        });

        // Coletar Land Drop por jogador
        const landdropEntries = document.querySelectorAll('.landdrop-entry');
        const landdropData = [];
        landdropEntries.forEach(entry => {
            const playerSelect = entry.querySelector('.landdrop-player');
            const missedSelect = entry.querySelector('.landdrop-missed');
            
            if (playerSelect && missedSelect && playerSelect.value && missedSelect.value) {
                landdropData.push({
                    playerId: playerSelect.value,
                    playerName: playerSelect.options[playerSelect.selectedIndex].text,
                    missed: missedSelect.value === 'sim'
                });
            }
        });

        // Coletar Comandante Removido por jogador
        const commanderRemovedEntries = document.querySelectorAll('.commander-removed-entry');
        const commanderRemovedData = [];
        commanderRemovedEntries.forEach(entry => {
            const playerSelect = entry.querySelector('.commander-removed-player');
            const mainCountInput = entry.querySelector('.commander-removed-main-count');
            const partnerCountInput = entry.querySelector('.commander-removed-partner-count');
            
            if (playerSelect && playerSelect.value && 
                (mainCountInput && mainCountInput.value !== '' || 
                 partnerCountInput && partnerCountInput.value !== '')) {
                const playerData = {
                    playerId: playerSelect.value,
                    playerName: playerSelect.options[playerSelect.selectedIndex].text
                };
                
                // Adicionar comandante principal se preenchido
                if (mainCountInput && mainCountInput.value !== '' && parseInt(mainCountInput.value) > 0) {
                    commanderRemovedData.push({
                        ...playerData,
                        type: 'main',
                        count: parseInt(mainCountInput.value) || 0
                    });
                }
                
                // Adicionar partner se preenchido
                if (partnerCountInput && partnerCountInput.value !== '' && parseInt(partnerCountInput.value) > 0) {
                    commanderRemovedData.push({
                        ...playerData,
                        type: 'partner',
                        count: parseInt(partnerCountInput.value) || 0
                    });
                }
            }
        });

        const winnerElement = document.getElementById('winner');
        const winnerPlayerId = winnerElement ? winnerElement.value : '';
        const winnerPlayerName = winnerElement && winnerElement.selectedOptions[0] ? winnerElement.selectedOptions[0].text : '';

        const matchDateElement = document.getElementById('matchDate');
        const matchTurnsElement = document.getElementById('matchTurns');
        const firstPlayerElement = document.getElementById('firstPlayer');
        const gameCardElement = document.getElementById('gameCard');
        const gameCardOwnerElement = document.getElementById('gameCardOwner');
        const archenemyElement = document.getElementById('archenemy');
        const observationsElement = document.getElementById('observations');
        const gameCardPreview = document.querySelector('#gameCardPreview img');

        return {
            // CAMPO OBRIGATÓRIO: ID do jogador que está registrando a partida
            playerId: this.currentPlayerId,
            
            date: matchDateElement ? matchDateElement.value : new Date().toISOString().split('T')[0],
            turns: matchTurnsElement ? parseInt(matchTurnsElement.value) : 0,
            firstPlayer: firstPlayerElement ? firstPlayerElement.value : '',
            
            // === DADOS MULTI-JOGADOR ===
            playerMulligans: mulligansData,
            playerTurn1: turn1Data,
            playerLandDrop: landdropData,
            playerCommanderRemoved: commanderRemovedData,
            
            // === DADOS GERAIS ===
            winner: winnerPlayerId,
            winnerName: winnerPlayerName,
            gameCard: {
                name: gameCardElement ? gameCardElement.value : '',
                imageUrl: gameCardPreview ? gameCardPreview.src : null,
                ownerId: gameCardOwnerElement ? gameCardOwnerElement.value : null
            },
            archenemy: archenemyElement ? archenemyElement.value || null : null,
            finishingCards: this.getFinishingCards(),
            ranking: ranking,
            observations: observationsElement ? observationsElement.value : '',
            participants: [ranking.first, ranking.second, ranking.third, ranking.fourth].filter(id => id),
            result: winnerPlayerId === this.currentPlayerId ? 'win' : 'loss',
            commanders: commanders,
            playerProfiles: playerProfiles
        };
    }

    validateMatchForm() {
        const requiredFields = [
            'matchDate', 'matchTurns',
            'firstPlayer', 'winner'
        ];
        
        // Validar campos básicos
        for (const fieldId of requiredFields) {
            const field = document.getElementById(fieldId);
            if (!field || !field.value.trim()) {
                const label = field?.previousElementSibling?.textContent || fieldId;
                this.showErrorMessage(`Campo obrigatório: ${label}`);
                if (field) field.focus();
                return false;
            }
        }
        
        // Validar ranking (pelo menos 2 jogadores)
        const rankingFields = ['firstPlace', 'secondPlace', 'thirdPlace', 'fourthPlace'];
        const selectedPlayers = rankingFields.filter(fieldId => {
            const field = document.getElementById(fieldId);
            return field && field.value.trim();
        });
        
        if (selectedPlayers.length < 2) {
            this.showErrorMessage('É necessário selecionar pelo menos 2 jogadores no ranking');
            return false;
        }
        
        // Validar se o vencedor está no ranking
        const winnerId = document.getElementById('winner').value;
        const rankingValues = rankingFields.map(fieldId => document.getElementById(fieldId).value).filter(val => val);
        
        if (!rankingValues.includes(winnerId)) {
            this.showErrorMessage('O vencedor deve estar presente no ranking da partida');
            return false;
        }
        
        return true;
    }

    // Adicionar nova função para auto-preenchimento
    autoFillPlayers() {
        const playersInput = document.getElementById('playersAutoFill');
        if (!playersInput || !playersInput.value.trim()) {
            alert('⚠️ Por favor, insira os nomes dos jogadores separados por vírgula.');
            return;
        }
        
        // Extrair e limpar nomes dos jogadores
        const playerNames = playersInput.value
            .split(',')
            .map(name => name.trim())
            .filter(name => name.length > 0);
        
        if (playerNames.length < 2 || playerNames.length > 4) {
            alert('⚠️ Por favor, insira entre 2 e 4 jogadores.');
            return;
        }
        
        console.log('Auto-preenchendo com jogadores:', playerNames);
        
        // 1. Preencher comandantes
        this.autoFillCommanders(playerNames);
        
        // 2. Preencher mulligans
        this.autoFillMulligans(playerNames);
        
        // 3. Preencher turno 1
        this.autoFillTurn1(playerNames);
        
        // 4. Preencher land drops
        this.autoFillLandDrops(playerNames);
        
        // 5. Preencher comandante removido
        this.autoFillCommanderRemoved(playerNames);
        
        // REMOVER: 6. Preencher ranking (agora deve ser manual)
        // this.autoFillRanking(playerNames);
        
        // Mostrar mensagem de sucesso
        this.showAutoFillSuccess(playerNames.length);
        
        // Mostrar aviso sobre campos manuais
        setTimeout(() => {
            alert('✅ Jogadores distribuídos!\n\n⚠️ Lembre-se de preencher manualmente:\n• Quem começou\n• Vencedor\n• Ranking da partida (1º, 2º, 3º, 4º)');
        }, 500);
    }

    autoFillCommanders(playerNames) {
        // Limpar comandantes existentes
        const existingEntries = document.querySelectorAll('.commander-entry');
        existingEntries.forEach(entry => entry.remove());
        
        // Adicionar um comandante para cada jogador
        playerNames.forEach(playerName => {
            this.addCommanderInput();
            
            // Pegar a última entrada adicionada
            const entries = document.querySelectorAll('.commander-entry');
            const lastEntry = entries[entries.length - 1];
            
            if (lastEntry) {
                // AGUARDAR que o DOM seja atualizado antes de popular
                setTimeout(() => {
                    this.populateCommanderPlayersInEntry(lastEntry);
                    
                    const playerSelect = lastEntry.querySelector('.commander-player');
                    if (playerSelect) {
                        // Buscar o jogador pelo nome e usar o ID
                        const player = this.allPlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
                        if (player) {
                            playerSelect.value = player._id;
                        }
                    }
                }, 100); // Pequeno delay para garantir que o DOM foi atualizado
                
                // Configurar busca de cartas para os campos de comandante
                const commanderInput = lastEntry.querySelector('.commander-input');
                const partnerInput = lastEntry.querySelector('.commander-partner');
                const commanderPreview = lastEntry.querySelector('.card-preview');
                const partnerPreview = lastEntry.querySelector('.partner-preview');
                
                if (commanderInput && commanderPreview) {
                    this.setupCardSearch(commanderInput, commanderPreview);
                }
                if (partnerInput && partnerPreview) {
                    this.setupCardSearch(partnerInput, partnerPreview);
                }
            }
        });
    }

    autoFillMulligans(playerNames) {
        // Limpar entradas existentes
        const existingEntries = document.querySelectorAll('.mulligan-entry');
        existingEntries.forEach(entry => entry.remove());
        
        // Adicionar uma entrada para cada jogador
        playerNames.forEach(playerName => {
            this.addMulliganInput();
            
            // Pegar a última entrada adicionada
            const entries = document.querySelectorAll('.mulligan-entry');
            const lastEntry = entries[entries.length - 1];
            
            if (lastEntry) {
                const playerSelect = lastEntry.querySelector('.mulligan-player');
                if (playerSelect) {
                    // Buscar o jogador pelo nome e usar o ID
                    const player = this.allPlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
                    if (player) {
                        playerSelect.value = player._id; // Usar ID em vez do nome
                    }
                }
            }
        });
    }

    autoFillTurn1(playerNames) {
        // Limpar entradas existentes
        const existingEntries = document.querySelectorAll('.turn1-entry');
        existingEntries.forEach(entry => entry.remove());
        
        // Adicionar uma entrada para cada jogador
        playerNames.forEach(playerName => {
            this.addTurn1Input();
            
            // Pegar a última entrada adicionada
            const entries = document.querySelectorAll('.turn1-entry');
            const lastEntry = entries[entries.length - 1];
            
            if (lastEntry) {
                const playerSelect = lastEntry.querySelector('.turn1-player');
                if (playerSelect) {
                    // Buscar o jogador pelo nome e usar o ID
                    const player = this.allPlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
                    if (player) {
                        playerSelect.value = player._id; // Usar ID em vez do nome
                    }
                }
            }
        });
    }

    autoFillLandDrops(playerNames) {
        // Limpar entradas existentes
        const existingEntries = document.querySelectorAll('.landdrop-entry');
        existingEntries.forEach(entry => entry.remove());
        
        // Adicionar uma entrada para cada jogador
        playerNames.forEach(playerName => {
            this.addLanddropInput();
            
            // Pegar a última entrada adicionada
            const entries = document.querySelectorAll('.landdrop-entry');
            const lastEntry = entries[entries.length - 1];
            
            if (lastEntry) {
                const playerSelect = lastEntry.querySelector('.landdrop-player');
                if (playerSelect) {
                    // Buscar o jogador pelo nome e usar o ID
                    const player = this.allPlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
                    if (player) {
                        playerSelect.value = player._id; // Usar ID em vez do nome
                    }
                }
            }
        });
    }

    autoFillCommanderRemoved(playerNames) {
        // Limpar entradas existentes
        const existingEntries = document.querySelectorAll('.commander-removed-entry');
        existingEntries.forEach(entry => entry.remove());
        
        // Adicionar uma entrada para cada jogador
        playerNames.forEach(playerName => {
            this.addCommanderRemovedInput();
            
            // Pegar a última entrada adicionada
            const entries = document.querySelectorAll('.commander-removed-entry');
            const lastEntry = entries[entries.length - 1];
            
            if (lastEntry) {
                const playerSelect = lastEntry.querySelector('.commander-removed-player');
                if (playerSelect) {
                    // Buscar o jogador pelo nome e usar o ID
                    const player = this.allPlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
                    if (player) {
                        playerSelect.value = player._id; // Usar ID em vez do nome
                    }
                }
            }
        });
    }

    autoFillRanking(playerNames) {
        // REMOVER: Não preencher automaticamente ranking, primeiro jogador e vencedor
        // Estes campos devem ser preenchidos manualmente pelo usuário
        
        // Comentar ou remover todo o conteúdo desta função
        console.log('Auto-preenchimento de ranking desabilitado - preencha manualmente');
    }

    showAutoFillSuccess(playerCount) {
        // Criar notificação de sucesso
        const notification = document.createElement('div');
        notification.className = 'auto-fill-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">✅</span>
                <span class="notification-text">Auto-preenchimento concluído! ${playerCount} jogadores distribuídos automaticamente.</span>
            </div>
        `;
        
        // Adicionar estilos inline para a notificação
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #50c878, #4a90e2);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        // Adicionar ao body
        document.body.appendChild(notification);
        
        // Remover após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    setupChangePasswordForm() {
        const form = document.getElementById('changePasswordForm');
        const modal = document.getElementById('changePasswordModal');
        
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const currentPassword = document.getElementById('currentPassword').value;
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                
                // Validar se as senhas coincidem
                if (newPassword !== confirmPassword) {
                    document.getElementById('changePasswordError').textContent = 'As senhas não coincidem';
                    return;
                }
                
                // Validar tamanho mínimo
                if (newPassword.length < 6) {
                    document.getElementById('changePasswordError').textContent = 'A nova senha deve ter pelo menos 6 caracteres';
                    return;
                }
                
                const result = await this.changePassword(currentPassword, newPassword);
                
                if (result.success) {
                    this.showSuccessMessage('Senha alterada com sucesso!');
                    modal.style.display = 'none';
                    form.reset();
                    document.getElementById('changePasswordError').textContent = '';
                } else {
                    document.getElementById('changePasswordError').textContent = result.error;
                }
            });
        }
        
        // Fechar modal
        modal?.querySelector('.close')?.addEventListener('click', () => {
            modal.style.display = 'none';
            form?.reset();
            const errorElement = document.getElementById('changePasswordError');
            if (errorElement) {
                errorElement.textContent = '';
            }
        });
    }

    // Função para demo de XP
    async demoRankingXP(xpChange) {
        if (!this.currentPlayerId) {
            this.showErrorMessage('Selecione um jogador primeiro!');
            return;
        }
        
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Token agora vem via cookie httpOnly
            
            const response = await fetch(`${this.apiUrl}/demo/ranking-xp/${this.currentPlayerId}`, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify({ xpChange })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Atualizar dados do jogador
                this.playerData.rankXP = data.player.rankXP;
                this.playerData.rankTier = data.player.rankTier;
                this.playerData.rankDivision = data.player.rankDivision;
                
                // Atualizar display do ranking
                this.updateRanking();
                
                // Mostrar notificação
                const message = xpChange > 0 ? 
                    `+${xpChange} XP! Novo rank: ${data.player.rankTier} ${data.player.rankDivision}` :
                    `${xpChange} XP. Rank atual: ${data.player.rankTier} ${data.player.rankDivision}`;
                
                this.showSuccessMessage(message);
            } else {
                this.showErrorMessage('Erro ao aplicar XP de demo');
            }
        } catch (error) {
            console.error('Erro no demo:', error);
            this.showErrorMessage('Erro ao conectar com o servidor');
        }
    }

    // === MÉTODOS DE AUTENTICAÇÃO ===
    
    async checkAuthentication() {
        try {
            const response = await fetch(`${this.apiUrl}/auth/verify`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Para enviar cookies
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.isAuthenticated = true;
                this.currentPlayerId = this.currentUser.id;
                this.hideLoginScreen();
                this.setupAccessRestrictions();
                
                // Iniciar sistema de detecção de inatividade
                this.setupInactivityDetection();
                
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Erro na verificação de autenticação:', error);
            this.logout();
            return false;
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Para enviar/receber cookies
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.authToken = 'cookie'; // Token agora vem via cookie
                this.currentUser = data.user;
                this.isAuthenticated = true;
                
                // Remover localStorage do token, manter apenas currentPlayerId
                localStorage.setItem('currentPlayerId', this.currentUser.id);
                this.currentPlayerId = this.currentUser.id;
                
                this.hideLoginScreen();
                this.setupAccessRestrictions();
                
                // ADICIONAR: Inicializar sistema completo após login
                await this.init();
                
                // Iniciar sistema de detecção de inatividade
                this.setupInactivityDetection();
                
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, error: 'Erro ao conectar com o servidor' };
        }
    }

    async logout() {
        try {
            // Chamar endpoint de logout para limpar cookie
            await fetch(`${this.apiUrl}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Erro no logout:', error);
        }
        
        // Parar sistema de detecção de inatividade
        this.stopInactivityDetection();
        
        this.authToken = null;
        this.currentUser = null;
        this.isAuthenticated = false;
        this.currentPlayerId = null;
        
        // Remover apenas currentPlayerId do localStorage
        localStorage.removeItem('currentPlayerId');
        
        this.showLoginScreen();
    }

    async changePassword(currentPassword, newPassword) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            const data = await response.json();
            
            if (data.success) {
                return { success: true, message: data.message };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            return { success: false, error: 'Erro ao conectar com o servidor' };
        }
    }

    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    }

    hideLoginScreen() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    }

    setupAccessRestrictions() {
        if (!this.currentUser) return;

        // Elementos administrativos que só devem aparecer para master
        const playerSelectorContainer = document.querySelector('.player-selector-container');
        const demoControls = document.querySelector('.demo-controls');
        const matchRegistration = document.querySelector('.match-registration');
        const demoButtons = document.querySelector('.demo-buttons');

        if (this.currentUser.isMaster) {
            // Mostrar elementos administrativos para usuários master
            if (playerSelectorContainer) playerSelectorContainer.style.display = 'block';
            if (demoControls) demoControls.style.display = 'block';
            if (matchRegistration) matchRegistration.style.display = 'block';
            if (demoButtons) demoButtons.style.display = 'block';
        } else {
            // Ocultar elementos administrativos para usuários não-master
            if (playerSelectorContainer) playerSelectorContainer.style.display = 'none';
            if (demoControls) demoControls.style.display = 'none';
            if (matchRegistration) matchRegistration.style.display = 'none';
            if (demoButtons) demoButtons.style.display = 'none';
        }
    }

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const loginError = document.getElementById('loginError');
        const logoutBtn = document.getElementById('logoutBtn');

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                const result = await this.login(email, password);
                
                if (!result.success) {
                    loginError.textContent = result.error;
                    loginError.style.display = 'block';
                } else {
                    loginError.style.display = 'none';
                }
            });
        }

        // Configurar botão de logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
    }

    // === SISTEMA DE TIMEOUT DE INATIVIDADE ===
    
    startInactivityTimer() {
        if (!this.isAuthenticated) return;
        
        // Limpar timer existente
        this.clearInactivityTimer();
        
        // Iniciar novo timer
        this.inactivityTimer = setTimeout(() => {
            this.handleInactivityTimeout();
        }, this.inactivityTimeout);
    }
    
    clearInactivityTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }
    
    resetInactivityTimer() {
        this.lastActivity = Date.now();
        this.startInactivityTimer();
    }
    
    handleInactivityTimeout() {
        console.log('Usuário inativo por muito tempo. Fazendo logout automático...');
        alert('Sua sessão expirou devido à inatividade. Você será deslogado automaticamente.');
        this.logout();
    }
    
    setupInactivityDetection() {
         if (!this.isAuthenticated) return;
         
         const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
         
         const resetTimer = () => {
             this.resetInactivityTimer();
         };
         
         // Adicionar listeners para detectar atividade
         events.forEach(event => {
             document.addEventListener(event, resetTimer, true);
         });
         
         // Iniciar o timer de inatividade
         this.startInactivityTimer();
         
         // Iniciar verificação periódica de sessão
         this.startSessionCheck();
     }
    
    stopInactivityDetection() {
         this.clearInactivityTimer();
         this.stopSessionCheck();
         
         const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
         
         const resetTimer = () => {
             this.resetInactivityTimer();
         };
         
         // Remover listeners
         events.forEach(event => {
             document.removeEventListener(event, resetTimer, true);
         });
     }
     
     // === SISTEMA DE VERIFICAÇÃO DE SESSÃO ===
     
     startSessionCheck() {
         if (!this.isAuthenticated) return;
         
         // Verificar sessão a cada 2 minutos
         this.sessionCheckInterval = setInterval(() => {
             this.checkSessionStatus();
         }, 2 * 60 * 1000);
     }
     
     stopSessionCheck() {
         if (this.sessionCheckInterval) {
             clearInterval(this.sessionCheckInterval);
             this.sessionCheckInterval = null;
         }
         this.sessionWarningShown = false;
     }
     
     async checkSessionStatus() {
         try {
             const response = await fetch(`${this.apiUrl}/auth/verify`, {
                 method: 'GET',
                 headers: {
                     'Content-Type': 'application/json'
                 },
                 credentials: 'include'
             });
             
             if (response.ok) {
                 const data = await response.json();
                 
                 if (data.tokenInfo && data.tokenInfo.isExpiringSoon && !this.sessionWarningShown) {
                     this.showSessionExpiryWarning(data.tokenInfo.timeUntilExpiry);
                 }
             } else {
                 const errorData = await response.json();
                 if (errorData.expired) {
                     console.log('Sessão expirada detectada pelo servidor');
                     alert('Sua sessão expirou. Você será redirecionado para a tela de login.');
                     this.logout();
                 }
             }
         } catch (error) {
             console.error('Erro ao verificar status da sessão:', error);
         }
     }
     
     showSessionExpiryWarning(timeUntilExpiry) {
         this.sessionWarningShown = true;
         const minutes = Math.floor(timeUntilExpiry / 60);
         const seconds = timeUntilExpiry % 60;
         
         const timeString = minutes > 0 ? `${minutes} minuto(s)` : `${seconds} segundo(s)`;
         
         const shouldExtend = confirm(
             `Sua sessão expirará em ${timeString}. \n\n` +
             'Deseja estender sua sessão? Clique em "OK" para continuar logado ou "Cancelar" para fazer logout.'
         );
         
         if (shouldExtend) {
             // Reset do timer de inatividade para estender a sessão
             this.resetInactivityTimer();
             this.sessionWarningShown = false;
         } else {
             this.logout();
         }
     }

     async updateGeneralTab() {
         try {
             const response = await fetch(`/api/commander-removed-stats/${this.currentPlayerId}`);
             if (!response.ok) {
                 throw new Error('Falha ao carregar estatísticas de comandantes removidos');
             }
             
             const commanderRemovals = await response.json();
             
             const container = document.getElementById('commandersRemovalGrid');
             if (!container) return;
             
             if (!commanderRemovals || commanderRemovals.length === 0) {
                 container.innerHTML = '<div class="empty-commanders">Nenhum comandante foi removido ainda</div>';
                 return;
             }
             
             container.innerHTML = '';
             
             for (const removal of commanderRemovals) {
                 const removalCard = document.createElement('div');
                 removalCard.className = 'commander-removal-card';
                 
                 const imageUrl = await this.getCardImageUrl(removal.name);
                 
                 removalCard.innerHTML = `
                     <div class="commander-removal-image">
                         <img src="${imageUrl}" alt="${removal.name}" loading="lazy">
                     </div>
                     <div class="commander-removal-info">
                         <h4>${removal.name}${removal.partnerName ? ` // ${removal.partnerName}` : ''}</h4>
                         <div class="removal-count">Removido: ${removal.totalRemovals} vezes</div>
                         <div class="theme">Tema: ${removal.theme}</div>
                         <div class="matches-played">Partidas: ${removal.matchesPlayed}</div>
                     </div>
                 `;
                 
                 container.appendChild(removalCard);
             }
         } catch (error) {
             console.error('Erro ao carregar estatísticas de comandantes removidos:', error);
             const container = document.getElementById('commandersRemovalGrid');
             if (container) {
                 container.innerHTML = '<div class="error-message">Erro ao carregar estatísticas</div>';
             }
         }
     }
}

// Adicionar estilos para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Inicializar sistema quando a página carregar
document.addEventListener('DOMContentLoaded', async () => {
    const system = new MagicGameSystem();
    system.setupLoginForm();
    
    // Verificar autenticação antes de inicializar o sistema principal
    const isAuthenticated = await system.checkAuthentication();
    if (isAuthenticated) {
        await system.init();
    }
});