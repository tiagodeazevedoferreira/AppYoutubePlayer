// ===== YouTube Player + Background Playback =====

let player = null;                 // instância do YT.Player
let currentPlaylist = null;
let currentIndex = 0;
let isPlaying = false;
let progressInterval = null;

// Carrega a API do YouTube
function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => resolve();
  });
}

/**
 * Abre o player com uma playlist
 */
async function openPlayer(playlist) {
  currentPlaylist = playlist;
  currentIndex = 0;

  // Troca de tela
  document.getElementById('playlists-view').classList.remove('active');
  document.getElementById('player-view').classList.add('active');
  document.getElementById('current-playlist-name').textContent = playlist.name;

  await loadYouTubeAPI();

  // Cria ou reutiliza o player
  if (!player) {
    player = new YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,          // importante para iOS
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError
      }
    });
  } else {
    playCurrentVideo();
  }

  renderQueue();
  setupMediaSession();
}

function onPlayerReady() {
  playCurrentVideo();
}

function onPlayerStateChange(event) {
  const state = event.data;

  if (state === YT.PlayerState.PLAYING) {
    isPlaying = true;
    updatePlayPauseButton();
    startProgressUpdater();
    updateMediaSessionPlaybackState('playing');
  } 
  else if (state === YT.PlayerState.PAUSED) {
    isPlaying = false;
    updatePlayPauseButton();
    stopProgressUpdater();
    updateMediaSessionPlaybackState('paused');
  } 
  else if (state === YT.PlayerState.ENDED) {
    // Vai para o próximo automaticamente
    playNext();
  }
}

function onPlayerError(event) {
  console.warn('Erro no vídeo:', event.data);
  // Pula para o próximo em caso de erro
  setTimeout(() => playNext(), 1500);
}

function playCurrentVideo() {
  if (!currentPlaylist || !currentPlaylist.videos.length) return;

  const video = currentPlaylist.videos[currentIndex];
  if (!video) return;

  document.getElementById('current-title').textContent = video.title || `Vídeo ${currentIndex + 1}`;

  if (player && player.loadVideoById) {
    player.loadVideoById({
      videoId: video.id,
      suggestedQuality: 'medium'
    });
  }

  renderQueue();
  updateMediaSessionMetadata(video);
}

function playNext() {
  if (!currentPlaylist) return;

  if (currentIndex < currentPlaylist.videos.length - 1) {
    currentIndex++;
    playCurrentVideo();
  } else {
    // Chegou ao fim → para ou volta pro início (aqui para)
    isPlaying = false;
    updatePlayPauseButton();
    stopProgressUpdater();
  }
}

function playPrev() {
  if (!currentPlaylist) return;

  // Se passou mais de 3 segundos, volta pro início do vídeo atual
  if (player && player.getCurrentTime && player.getCurrentTime() > 3) {
    player.seekTo(0);
    return;
  }

  if (currentIndex > 0) {
    currentIndex--;
    playCurrentVideo();
  }
}

function togglePlayPause() {
  if (!player) return;

  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

function updatePlayPauseButton() {
  const btn = document.getElementById('btn-play-pause');
  btn.textContent = isPlaying ? '⏸' : '▶';
}

function renderQueue() {
  const list = document.getElementById('queue-list');
  list.innerHTML = '';

  if (!currentPlaylist) return;

  currentPlaylist.videos.forEach((video, index) => {
    const li = document.createElement('li');
    if (index === currentIndex) li.classList.add('active');

    li.innerHTML = `
      <span class="index">${index + 1}</span>
      <span>${escapeHtml(video.title || video.id)}</span>
    `;

    li.addEventListener('click', () => {
      currentIndex = index;
      playCurrentVideo();
    });

    list.appendChild(li);
  });
}

// ===== Progresso =====
function startProgressUpdater() {
  stopProgressUpdater();
  progressInterval = setInterval(updateProgress, 500);
}

function stopProgressUpdater() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

function updateProgress() {
  if (!player || !player.getCurrentTime) return;

  const current = player.getCurrentTime() || 0;
  const duration = player.getDuration() || 0;

  if (duration > 0) {
    const percent = (current / duration) * 100;
    document.getElementById('progress-fill').style.width = percent + '%';
  }

  document.getElementById('current-time').textContent = formatTime(current);
  document.getElementById('duration').textContent = formatTime(duration);
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Clique na barra de progresso
document.addEventListener('DOMContentLoaded', () => {
  const bar = document.getElementById('progress-bar');
  if (bar) {
    bar.addEventListener('click', (e) => {
      if (!player || !player.getDuration) return;
      const rect = bar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const duration = player.getDuration();
      player.seekTo(duration * percent, true);
    });
  }
});

// ===== Media Session API (tela bloqueada / controles do sistema) =====
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', () => {
    if (player) player.playVideo();
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    if (player) player.pauseVideo();
  });

  navigator.mediaSession.setActionHandler('previoustrack', () => {
    playPrev();
  });

  navigator.mediaSession.setActionHandler('nexttrack', () => {
    playNext();
  });

  // Alguns navegadores suportam seek
  try {
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (player && details.seekTime != null) {
        player.seekTo(details.seekTime, true);
      }
    });
  } catch (e) {}
}

function updateMediaSessionMetadata(video) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: video.title || 'YouTube Video',
    artist: currentPlaylist ? currentPlaylist.name : 'YT Playlist',
    album: 'Playlist',
    artwork: [
      { src: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
    ]
  });
}

function updateMediaSessionPlaybackState(state) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = state;
  }
}

// Voltar para a lista
function closePlayer() {
  if (player && player.pauseVideo) {
    player.pauseVideo();
  }
  stopProgressUpdater();

  document.getElementById('player-view').classList.remove('active');
  document.getElementById('playlists-view').classList.add('active');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
