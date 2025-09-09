// MagicGameSystem.js

class MagicGameSystem {
    constructor() {
        this.currentPlayerId = null;
        this.inactivityTimeout = 10 * 60 * 1000;
        this.inactivityTimer = null;
        this.sessionCheckInterval = null;
        this.sessionWarningShown = false;
        this.allPlayers = [];
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
             const response = await fetch(`/api/commander-mastery-stats/${this.currentPlayerId}`);
             if (!response.ok) {
                 throw new Error('Falha ao carregar estatísticas de maestria de comandantes');
             }
             
             const commanderMastery = await response.json();
             
             // Armazenar dados para paginação
             this.allCommanderMastery = commanderMastery || [];
             this.currentMasteryPage = 1;
             this.masteryItemsPerPage = 10;
             
             this.renderCommanderMasteryPage();
         } catch (error) {
             console.error('Erro ao carregar estatísticas de maestria de comandantes:', error);
             const container = document.getElementById('commanderMasteryGrid');
             if (container) {
                 container.innerHTML = '<div class="error-message">Erro ao carregar estatísticas</div>';
             }
         }
     }

     async renderCommanderMasteryPage() {
         const container = document.getElementById('commanderMasteryGrid');
         if (!container) return;
         
         if (!this.allCommanderMastery || this.allCommanderMastery.length === 0) {
             container.innerHTML = '<div class="empty-commanders">Nenhum comandante jogado ainda</div>';
             this.updateMasteryPaginationControls();
             return;
         }
         
         // Calcular índices da página atual
         const startIndex = (this.currentMasteryPage - 1) * this.masteryItemsPerPage;
         const endIndex = startIndex + this.masteryItemsPerPage;
         const pageCommanders = this.allCommanderMastery.slice(startIndex, endIndex);
         
         container.innerHTML = '';
         
         for (const mastery of pageCommanders) {
             const masteryCard = document.createElement('div');
             masteryCard.className = 'commander-mastery-card';
             
             const imageUrl = await this.getCardImageUrl(mastery.name);
             
             // Determinar classe do winrate baseado na porcentagem
             const winrateValue = parseFloat(mastery.winrate);
             let winrateClass = 'winrate-low';
             if (winrateValue >= 70) winrateClass = 'winrate-high';
             else if (winrateValue >= 50) winrateClass = 'winrate-medium';
             
             masteryCard.innerHTML = `
                 <div class="commander-mastery-image">
                     <img src="${imageUrl}" alt="${mastery.name}" loading="lazy">
                 </div>
                 <div class="commander-mastery-info">
                     <h4>${mastery.name}</h4>
                     <div class="mastery-stats">
                         <div class="stat-item">
                             <span class="stat-label">Winrate:</span>
                             <span class="stat-value ${winrateClass}">${mastery.winrate}%</span>
                         </div>
                         <div class="stat-item">
                             <span class="stat-label">Partidas:</span>
                             <span class="stat-value">${mastery.totalMatches}</span>
                         </div>
                         <div class="stat-item">
                             <span class="stat-label">Vitórias:</span>
                             <span class="stat-value">${mastery.wins}</span>
                         </div>
                         <div class="stat-item">
                             <span class="stat-label">Removido:</span>
                             <span class="stat-value">${mastery.totalRemovals}x</span>
                         </div>
                         <div class="stat-item">
                             <span class="stat-label">Carta do Jogo:</span>
                             <span class="stat-value">${mastery.gameCardCount}x</span>
                         </div>
                     </div>
                 </div>
             `;
             
             // Adicionar event listener para abrir o modal
             masteryCard.addEventListener('click', () => {
                 this.openCommanderMasteryModal(mastery, imageUrl);
             });
             
             // Adicionar cursor pointer para indicar que é clicável
             masteryCard.style.cursor = 'pointer';
             
             container.appendChild(masteryCard);
         }
         
         this.updateMasteryPaginationControls();
     }

     updateMasteryPaginationControls() {
        const totalPages = Math.ceil(this.allCommanderMastery.length / this.masteryItemsPerPage);
        
        const paginationContainer = document.getElementById('masteryPaginationControls');
        
        if (!paginationContainer) {
            const masterySection = document.querySelector('.commander-mastery-section');
            
            if (masterySection) {
                const paginationDiv = document.createElement('div');
                paginationDiv.id = 'masteryPaginationControls';
                paginationDiv.className = 'mastery-pagination-controls';
                masterySection.appendChild(paginationDiv);
            }
        }
         
         const controls = document.getElementById('masteryPaginationControls');
         if (!controls) return;
         
         // Sempre mostrar informações, mesmo com 1 página
         if (totalPages <= 1) {
             let paginationHTML = '<div class="pagination-info">';
             paginationHTML += `<span>Página 1 de 1</span>`;
             paginationHTML += `<span class="total-items">(${this.allCommanderMastery.length} comandante${this.allCommanderMastery.length !== 1 ? 's' : ''})</span>`;
             paginationHTML += '</div>';
             controls.innerHTML = paginationHTML;
             return;
         }
         
         let paginationHTML = '<div class="pagination-info">';
         paginationHTML += `<span>Página ${this.currentMasteryPage} de ${totalPages}</span>`;
         paginationHTML += `<span class="total-items">(${this.allCommanderMastery.length} comandantes)</span>`;
         paginationHTML += '</div>';
         
         paginationHTML += '<div class="pagination-buttons">';
         
         // Botão Anterior
         if (this.currentMasteryPage > 1) {
             paginationHTML += `<button class="pagination-btn" onclick="gameSystem.changeMasteryPage(${this.currentMasteryPage - 1})">‹ Anterior</button>`;
         }
         
         // Números das páginas
         const startPage = Math.max(1, this.currentMasteryPage - 2);
         const endPage = Math.min(totalPages, this.currentMasteryPage + 2);
         
         for (let i = startPage; i <= endPage; i++) {
             const activeClass = i === this.currentMasteryPage ? 'active' : '';
             paginationHTML += `<button class="pagination-btn page-number ${activeClass}" onclick="gameSystem.changeMasteryPage(${i})">${i}</button>`;
         }
         
         // Botão Próximo
         if (this.currentMasteryPage < totalPages) {
             paginationHTML += `<button class="pagination-btn" onclick="gameSystem.changeMasteryPage(${this.currentMasteryPage + 1})">Próximo ›</button>`;
         }
         
         paginationHTML += '</div>';
         
         controls.innerHTML = paginationHTML;
     }

     async changeMasteryPage(page) {
         this.currentMasteryPage = page;
         await this.renderCommanderMasteryPage();
     }

     // Função para abrir o modal de maestria do comandante
     openCommanderMasteryModal(mastery, imageUrl) {
         const modal = document.getElementById('commanderMasteryModal');
         if (!modal) return;

         // Preencher informações do comandante
         const commanderImage = modal.querySelector('#masteryCommanderImage');
         const commanderName = modal.querySelector('#masteryCommanderName');
         const commanderType = modal.querySelector('.commander-title-info p');

         if (commanderImage) commanderImage.src = imageUrl;
         if (commanderName) commanderName.textContent = mastery.name;
         if (commanderType) commanderType.textContent = 'Comandante Lendário';

         // Preencher estatísticas
         this.populateMasteryStats(modal, mastery);

         // Calcular e exibir níveis
         this.populateMasteryLevels(modal, mastery);

         // Mostrar modal
         modal.style.display = 'block';

         // Configurar botão de fechar
         const closeBtn = modal.querySelector('.mastery-close');
         if (closeBtn) {
             closeBtn.onclick = () => {
                 modal.style.display = 'none';
             };
         }

         // Fechar ao clicar fora do modal
         modal.onclick = (e) => {
             if (e.target === modal) {
                 modal.style.display = 'none';
             }
         };
     }

     // Função para preencher as estatísticas do modal
     populateMasteryStats(modal, mastery) {
         // Atualizar elementos específicos usando IDs
         const winrateElement = modal.querySelector('#masteryWinrate');
         const matchesElement = modal.querySelector('#masteryMatches');
         const winsElement = modal.querySelector('#masteryWins');
         const removalsElement = modal.querySelector('#masteryRemovals');
         const gameCardElement = modal.querySelector('#masteryGameCard');

         if (winrateElement) winrateElement.textContent = `${mastery.winrate}%`;
         if (matchesElement) matchesElement.textContent = mastery.totalMatches;
         if (winsElement) winsElement.textContent = mastery.wins || Math.round(mastery.totalMatches * parseFloat(mastery.winrate) / 100);
         if (removalsElement) removalsElement.textContent = `${mastery.commanderRemovedCount || 0}x`;
         if (gameCardElement) gameCardElement.textContent = `${mastery.gameCardCount || 0}x`;
     }

     // Função para calcular e exibir os níveis de maestria
     populateMasteryLevels(modal, mastery) {
        // Definir requisitos e recompensas para cada nível
        const levelRequirements = {
            1: { matches: 5, winrate: 0 },
            2: { matches: 10, winrate: 0 },
            3: { matches: 20, winrate: 50 },
            4: { matches: 35, winrate: 55 },
            5: { matches: 50, winrate: 60 },
            6: { matches: 75, winrate: 65 },
            7: { matches: 100, winrate: 70 },
            8: { matches: 150, winrate: 75 },
            9: { matches: 200, winrate: 80 },
            10: { matches: 300, winrate: 85 }
        };
        
        const rewardTriggers = {
            1: 'Título: Iniciante',
            2: 'Frame Bronze',
            3: 'Título: Aprendiz',
            4: 'Avatar Especial',
            5: 'Título: Competente',
            6: 'Frame Prata',
            7: 'Título: Experiente',
            8: 'Frame Ouro',
            9: 'Título: Mestre',
            10: 'Frame Lendário + Título: Lenda'
        };
        
        const currentLevel = this.calculateCommanderLevel(mastery);
        const levelProgress = this.calculateLevelProgress(mastery, currentLevel);
         
         // Atualizar informações do nível atual
         const currentLevelDisplay = modal.querySelector('#currentLevelDisplay');
         const currentLevelPoints = modal.querySelector('#currentLevelPoints');
         const nextLevelPoints = modal.querySelector('#nextLevelPoints');
         const levelProgressFill = modal.querySelector('#levelProgressFill');
         const commanderCurrentLevel = modal.querySelector('#commanderCurrentLevel');
         
         if (currentLevelDisplay) currentLevelDisplay.textContent = currentLevel;
         if (commanderCurrentLevel) commanderCurrentLevel.textContent = currentLevel;
         if (currentLevelPoints) currentLevelPoints.textContent = levelProgress.current;
         if (nextLevelPoints) nextLevelPoints.textContent = levelProgress.required;
         if (levelProgressFill) {
             const progressPercent = (levelProgress.current / levelProgress.required) * 100;
             levelProgressFill.style.width = `${Math.min(progressPercent, 100)}%`;
         }
         
         // Atualizar os círculos de nível
         const levelItems = modal.querySelectorAll('.level-item');
         levelItems.forEach((item, index) => {
             const level = index + 1;
             const levelCircle = item.querySelector('.level-circle');
             
             if (level <= currentLevel) {
                 item.classList.add('unlocked');
                 if (level === currentLevel) {
                     item.classList.add('current');
                 }
             } else {
                 item.classList.add('level-locked');
             }
         });
     }

     // Função para calcular o nível atual do comandante
     calculateCommanderLevel(mastery) {
         const matches = mastery.totalMatches;
         const winrate = parseFloat(mastery.winrate);
         const gameCards = mastery.gameCardCount;

         // Sistema de níveis baseado em múltiplos critérios
         let level = 1;

         // Nível baseado em partidas jogadas
         if (matches >= 50) level = Math.max(level, 10);
         else if (matches >= 40) level = Math.max(level, 9);
         else if (matches >= 30) level = Math.max(level, 8);
         else if (matches >= 25) level = Math.max(level, 7);
         else if (matches >= 20) level = Math.max(level, 6);
         else if (matches >= 15) level = Math.max(level, 5);
         else if (matches >= 10) level = Math.max(level, 4);
         else if (matches >= 7) level = Math.max(level, 3);
         else if (matches >= 5) level = Math.max(level, 2);

         // Bônus por performance
         if (winrate >= 80 && matches >= 10) level = Math.min(10, level + 2);
         else if (winrate >= 70 && matches >= 5) level = Math.min(10, level + 1);

         // Bônus por cartas do jogo
         if (gameCards >= 5) level = Math.min(10, level + 1);

         return Math.max(1, Math.min(10, level));
     }

     // Função para calcular o progresso dentro do nível atual
     calculateLevelProgress(mastery, level) {
         const currentLevel = this.calculateCommanderLevel(mastery);
         
         if (level < currentLevel) return 100;
         if (level > currentLevel + 1) return 0;
         if (level === currentLevel) return 100;

         // Calcular progresso para o próximo nível
         const requirements = this.getLevelRequirements()[level];
         if (!requirements) return 0;

         const matchProgress = Math.min(100, (mastery.totalMatches / requirements.matches) * 100);
         const winrateProgress = requirements.winrate > 0 ? 
             Math.min(100, (parseFloat(mastery.winrate) / requirements.winrate) * 100) : 100;

         return Math.min(100, Math.min(matchProgress, winrateProgress));
     }

     // Função para obter os requisitos de cada nível
     getLevelRequirements() {
         return {
             1: { matches: 1, winrate: 0 },
             2: { matches: 5, winrate: 0 },
             3: { matches: 7, winrate: 0 },
             4: { matches: 10, winrate: 0 },
             5: { matches: 15, winrate: 0 },
             6: { matches: 20, winrate: 50 },
             7: { matches: 25, winrate: 55 },
             8: { matches: 30, winrate: 60 },
             9: { matches: 40, winrate: 65 },
             10: { matches: 50, winrate: 70 }
         };
     }

     // Função para obter os triggers de recompensas
     getRewardTriggers() {
         return {
             1: '🎯 Título: "Iniciante"',
             2: '🖼️ Frame: Bronze',
             3: '🎭 Avatar: Aprendiz',
             4: '🏆 Título: "Dedicado"',
             5: '🖼️ Frame: Prata',
             6: '🎭 Avatar: Veterano',
             7: '🏆 Título: "Especialista"',
             8: '🖼️ Frame: Ouro',
             9: '🎭 Avatar: Mestre',
             10: '👑 Título: "Lenda" + Frame Especial'
         };
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