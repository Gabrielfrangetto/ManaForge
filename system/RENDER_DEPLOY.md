# 🚀 Deploy no Render - Guia Completo

## Configurações Obrigatórias no Render

### 1. Configurações do Serviço

**Build Settings:**
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18.x ou superior

### 2. Variáveis de Ambiente (Environment Variables)

**⚠️ IMPORTANTE: Configure TODAS essas variáveis no painel do Render**

```
MONGODB_URI=mongodb+srv://seu_usuario:sua_senha@cluster.mongodb.net/SistemaMagic?retryWrites=true&w=majority
JWT_SECRET=sua_chave_jwt_super_secreta_aqui_min_32_chars
SPECIAL_ACHIEVEMENT_PASSWORD=sua_senha_especial_para_achievements
NODE_ENV=production
CORS_ORIGINS=https://seu-app.onrender.com
PORT=3000
```

### 3. Configuração Detalhada das Variáveis

#### MONGODB_URI
- **Obrigatória**: Sim
- **Descrição**: String de conexão completa do MongoDB Atlas
- **Formato**: `mongodb+srv://usuario:senha@cluster.mongodb.net/database?retryWrites=true&w=majority`
- **Como obter**: No painel do MongoDB Atlas > Connect > Connect your application

#### JWT_SECRET
- **Obrigatória**: Sim
- **Descrição**: Chave secreta para assinatura de tokens JWT
- **Requisitos**: Mínimo 32 caracteres, use caracteres aleatórios
- **Exemplo**: `minha_super_chave_secreta_jwt_2024_render_deploy_123456789`

#### SPECIAL_ACHIEVEMENT_PASSWORD
- **Obrigatória**: Sim
- **Descrição**: Senha para desbloquear achievements especiais
- **Formato**: Qualquer string segura
- **Exemplo**: `MinhaSenh@Especial2024!`

#### CORS_ORIGINS
- **Obrigatória**: Sim
- **Descrição**: Domínios permitidos para CORS
- **Formato**: URLs completas separadas por vírgula
- **Exemplo**: `https://sistema-magic.onrender.com,https://www.sistema-magic.onrender.com`

#### NODE_ENV
- **Obrigatória**: Sim
- **Valor**: `production`

#### PORT
- **Opcional**: O Render define automaticamente
- **Valor padrão**: `3000`

## 📋 Checklist de Deploy

### Antes do Deploy
- [ ] MongoDB Atlas configurado e funcionando
- [ ] Whitelist de IPs configurada no MongoDB (0.0.0.0/0 ou IPs do Render)
- [ ] Usuário do MongoDB com permissões de leitura/escrita
- [ ] Código commitado no repositório Git

### Durante o Deploy
- [ ] Repositório conectado ao Render
- [ ] Build command: `npm install`
- [ ] Start command: `npm start`
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Deploy iniciado

### Após o Deploy
- [ ] Aplicação acessível via URL do Render
- [ ] Login/cadastro funcionando
- [ ] Conexão com MongoDB estabelecida
- [ ] Achievements carregando corretamente
- [ ] Sistema de achievements especiais funcionando

## 🔧 Troubleshooting

### Erro: "Cannot connect to MongoDB"
**Solução:**
1. Verifique se `MONGODB_URI` está correta
2. Confirme whitelist de IPs no MongoDB Atlas
3. Teste a string de conexão localmente

### Erro: "CORS policy"
**Solução:**
1. Adicione a URL do Render em `CORS_ORIGINS`
2. Use o formato completo: `https://seu-app.onrender.com`
3. Não esqueça do `https://`

### Erro: "JWT malformed"
**Solução:**
1. Verifique se `JWT_SECRET` está definida
2. Certifique-se de que tem pelo menos 32 caracteres
3. Limpe cookies do navegador

### Erro: "Achievement password incorrect"
**Solução:**
1. Verifique se `SPECIAL_ACHIEVEMENT_PASSWORD` está definida
2. Use a senha exata configurada na variável
3. Teste localmente primeiro

### Build falha
**Solução:**
1. Verifique se `package.json` está correto
2. Confirme que todas as dependências estão listadas
3. Teste `npm install` localmente

## 📱 URLs Importantes

- **Painel do Render**: https://dashboard.render.com
- **MongoDB Atlas**: https://cloud.mongodb.com
- **Documentação Render**: https://render.com/docs

## 🔒 Segurança

### Variáveis Sensíveis Removidas do Código
- ✅ String de conexão MongoDB movida para variável de ambiente
- ✅ JWT Secret movido para variável de ambiente
- ✅ Senha de achievements especiais movida para variável de ambiente
- ✅ CORS origins configurável via variável de ambiente

### Arquivos de Segurança
- `.env.example` - Template das variáveis necessárias
- `.gitignore` - Previne commit de arquivos sensíveis
- `README.md` - Documentação completa

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no painel do Render
2. Confirme todas as variáveis de ambiente
3. Teste a aplicação localmente primeiro
4. Verifique a conectividade com MongoDB Atlas