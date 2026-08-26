# YT Playlist Player (PWA)

Aplicativo web/PWA simples para criar playlists de vídeos do YouTube e tocá-las em sequência, funcionando inclusive com a tela desligada (usando Media Session API + YouTube IFrame API).

## Tecnologias

- HTML + CSS + JavaScript puro (sem frameworks)
- Firebase Realtime Database (armazenamento das playlists)
- YouTube IFrame API
- Media Session API (controles na tela bloqueada)
- PWA (instalável + funciona offline básico)
- GitHub Pages (hospedagem)

## Estrutura de arquivos

```
youtube-playlist-pwa/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js          → lógica principal e eventos
│   ├── player.js       → player do YouTube + background
│   ├── playlist.js     → CRUD das playlists
│   └── firebase.js     → conexão com Firebase
├── assets/             → ícones do PWA (você precisa adicionar)
├── manifest.json
├── service-worker.js
└── README.md
```

## Como configurar (passo a passo)

### 1. Criar projeto no Firebase

1. Acesse https://console.firebase.google.com
2. Clique em **Adicionar projeto**
3. Dê um nome (ex: yt-playlist-player)
4. Desative Google Analytics se quiser (não é necessário)
5. Crie o projeto

### 2. Ativar Realtime Database

1. No menu lateral → **Build** → **Realtime Database**
2. Clique em **Criar banco de dados**
3. Escolha a localização (recomendado: `southamerica-east1` se estiver no Brasil)
4. Comece no modo **teste** (depois você trava as regras)

### 3. Copiar a configuração

1. Clique na engrenagem → **Configurações do projeto**
2. Role até **Seus aplicativos** → clique no ícone **</>** (Web)
3. Dê um apelido (ex: web)
4. Copie o objeto `firebaseConfig`

### 4. Colar no código

Abra o arquivo `js/firebase.js` e substitua o objeto `firebaseConfig` pelos seus dados reais.

### 5. Regras do Realtime Database (importante)

No Firebase → Realtime Database → **Regras**, coloque temporariamente:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> Isso deixa público (qualquer um pode ler/escrever).  
> Depois que o app estiver funcionando, você pode restringir.

### 6. Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex: `yt-playlist-player`)
2. Faça upload de **todos** os arquivos desta pasta
3. Vá em **Settings** → **Pages**
4. Em **Source**, escolha a branch `main` e a pasta `/ (root)`
5. Salve. Em alguns minutos o site estará no ar:
   `https://SEU_USUARIO.github.io/yt-playlist-player/`

### 7. Ícones do PWA (opcional mas recomendado)

Coloque dois arquivos na pasta `assets/`:

- `icon-192.png` (192x192)
- `icon-512.png` (512x512)

Você pode gerar em: https://favicon.io ou qualquer gerador de ícones PWA.

## Como usar

1. Abra o site no celular ou computador
2. Clique no **+** para criar uma playlist
3. Digite o nome e cole os links do YouTube
4. Salve
5. Clique na playlist para tocar
6. No celular: coloque na tela inicial (Adicionar à tela inicial) para usar como app

## Funcionamento com tela desligada

- Usa a **Media Session API** (controles aparecem na tela de bloqueio)
- O YouTube IFrame API mantém o áudio tocando
- Funciona melhor no **Android Chrome**
- No iOS o comportamento é mais limitado por restrições da Apple

## Próximas melhorias possíveis

- Buscar título real do vídeo via oEmbed
- Reordenação dos vídeos (drag and drop)
- Modo aleatório / repetir
- Autenticação Firebase (playlists privadas)
- Melhor tratamento de erros de vídeo

---

Desenvolvido para ser simples, leve e fácil de manter.
