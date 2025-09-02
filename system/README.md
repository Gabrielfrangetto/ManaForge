# Sistema Magic - Gamificação

Sistema de gamificação para Magic: The Gathering com conquistas, ranking e estatísticas.

## 🚀 Deploy no Render

### Pré-requisitos
1. Conta no [Render](https://render.com)
2. Banco de dados MongoDB Atlas configurado
3. Repositório Git com o código

### Configuração das Variáveis de Ambiente

No painel do Render, configure as seguintes variáveis de ambiente:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/SistemaMagic?retryWrites=true&w=majority
JWT_SECRET=seu_jwt_secret_super_seguro_aqui
SPECIAL_ACHIEVEMENT_PASSWORD=sua_senha_especial_para_achievements
NODE_ENV=production
CORS_ORIGINS=https://seudominio.onrender.com
```

### Passos para Deploy

1. **Conectar Repositório**
   - Faça login no Render
   - Clique em "New" > "Web Service"
   - Conecte seu repositório GitHub/GitLab

2. **Configurar Serviço**
   - **Name**: `sistema-magic`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Configurar Variáveis de Ambiente**
   - Vá para a aba "Environment"
   - Adicione todas as variáveis listadas acima
   - **IMPORTANTE**: Use valores reais, não os exemplos

4. **Deploy**
   - Clique em "Create Web Service"
   - Aguarde o build e deploy automático

### Configuração do MongoDB Atlas

1. **Whitelist de IPs**
   - No MongoDB Atlas, vá em "Network Access"
   - Adicione `0.0.0.0/0` para permitir conexões do Render
   - Ou configure IPs específicos do Render se disponível

2. **String de Conexão**
   - Use a string completa com usuário e senha
   - Certifique-se de que o usuário tem permissões de leitura/escrita

### Variáveis de Ambiente Detalhadas

| Variável | Descrição | Exemplo |
|----------|-----------|----------|
| `MONGODB_URI` | String de conexão do MongoDB | `mongodb+srv://user:pass@cluster.net/db` |
| `JWT_SECRET` | Chave secreta para tokens JWT | `minha_chave_super_secreta_123` |
| `SPECIAL_ACHIEVEMENT_PASSWORD` | Senha para achievements especiais | `MinhaSenh@Especial123` |
| `NODE_ENV` | Ambiente de execução | `production` |
| `CORS_ORIGINS` | Domínios permitidos (separados por vírgula) | `https://app.onrender.com` |

### Verificação Pós-Deploy

1. Acesse a URL fornecida pelo Render
2. Teste o login/cadastro
3. Verifique se as conquistas estão funcionando
4. Teste o sistema de achievements especiais

### Troubleshooting

**Erro de Conexão com MongoDB:**
- Verifique se a string `MONGODB_URI` está correta
- Confirme que o IP do Render está na whitelist
- Teste a conexão localmente primeiro

**Erro de CORS:**
- Adicione o domínio do Render em `CORS_ORIGINS`
- Formato: `https://seuapp.onrender.com`

**Achievements Especiais não funcionam:**
- Verifique se `SPECIAL_ACHIEVEMENT_PASSWORD` está definida
- Teste com a senha configurada

### Comandos Úteis

```bash
# Instalar dependências
npm install

# Executar localmente
npm start

# Executar em modo desenvolvimento
npm run dev

# Configurar banco de dados
npm run setup-db
```

### Estrutura do Projeto

```
├── server.js          # Servidor principal
├── script.js          # Frontend JavaScript
├── achievements.js    # Sistema de conquistas
├── style.css          # Estilos
├── index.html         # Interface principal
├── package.json       # Dependências
├── .env.example       # Exemplo de variáveis
└── README.md          # Este arquivo
```

### Segurança

- ✅ Senhas hasheadas com bcrypt
- ✅ JWT para autenticação
- ✅ Rate limiting para login
- ✅ Variáveis de ambiente para dados sensíveis
- ✅ CORS configurado adequadamente
- ✅ Cookies httpOnly para tokens

### Suporte

Para problemas ou dúvidas, verifique:
1. Logs do Render no painel administrativo
2. Console do navegador para erros frontend
3. Configuração das variáveis de ambiente