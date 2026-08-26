// ===== YouTube Player + Background Playback =====

let player = null;                 // instância do YT.Player
let currentPlaylist = null;
let currentIndex = 0;
let isPlaying = false;
let progressInterval = null;
let wasPlayingBeforeHide = false;  // para retomar após tela travar / segundo plano
let positionStateInterval = null;

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
 * Importante: evita await longo para não quebrar o gesto do usuário (autoplay no mobile)
 */
function openPlayer(playlist) {
  currentPlaylist = playlist;
  currentIndex = 0;

  // Troca de tela imediatamente (feedback visual rápido)
  document.getElementById('playlists-view').classList.remove('active');
  document.getElementById('player-view').classList.add('active');
  document.getElementById('current-playlist-name').textContent = playlist.name;

  renderQueue();
  setupMediaSession();
  setupBackgroundHandlers();

  // Se a API já estiver carregada, cria/toca imediatamente (mantém o gesto do usuário)
  if (window.YT && window.YT.Player) {
    createOrPlayPlayer();
  } else {
    // Carrega a API e depois cria o player
    loadYouTubeAPI().then(() => {
      createOrPlayPlayer();
    }).catch(err => {
      console.error('Erro ao carregar YouTube API:', err);
      alert('Erro ao carregar o player do YouTube. Tente novamente.');
    });
  }
}

function createOrPlayPlayer() {
  if (!player) {
    player = new YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,          // essencial para iOS e background
        enablejsapi: 1,
        origin: window.location.origin,
        fs: 0,
        iv_load_policy: 3
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError
      }
    });
  } else {
    // Player já existe → toca o vídeo atual
    playCurrentVideo();
    // Força play (ajuda no mobile)
    setTimeout(() => {
      try {
        if (player && player.playVideo) player.playVideo();
      } catch (e) {}
    }, 300);
  }
}

function onPlayerReady() {
  playCurrentVideo();
  // Força play logo após o ready (importante no celular)
  setTimeout(() => {
    try {
      if (player && player.playVideo) {
        player.playVideo();
      }
    } catch (e) {}
  }, 200);
  setTimeout(() => {
    try {
      if (player && player.getPlayerState && player.getPlayerState() !== YT.PlayerState.PLAYING) {
        player.playVideo();
      }
    } catch (e) {}
  }, 800);
}

function onPlayerStateChange(event) {
  const state = event.data;

  if (state === YT.PlayerState.PLAYING) {
    isPlaying = true;
    wasPlayingBeforeHide = true;
    updatePlayPauseButton();
    startProgressUpdater();
    startPositionStateUpdater();
    updateMediaSessionPlaybackState('playing');
  } 
  else if (state === YT.PlayerState.PAUSED) {
    isPlaying = false;
    // Se o usuário pausou manualmente enquanto a tela está visível,
    // não queremos forçar o play depois
    if (!document.hidden) {
      wasPlayingBeforeHide = false;
      stopAggressiveKeepAlive();
    }
    updatePlayPauseButton();
    stopProgressUpdater();
    stopPositionStateUpdater();
    updateMediaSessionPlaybackState('paused');
  } 
  else if (state === YT.PlayerState.ENDED) {
    // Vai para o próximo automaticamente
    playNext();
  }
  else if (state === YT.PlayerState.BUFFERING) {
    // Mantém o estado de "tocando" enquanto bufferiza
    updateMediaSessionPlaybackState('playing');
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
    // Chegou ao fim → para
    isPlaying = false;
    wasPlayingBeforeHide = false;
    updatePlayPauseButton();
    stopProgressUpdater();
    stopPositionStateUpdater();
    updateMediaSessionPlaybackState('none');
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
  if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
    wasPlayingBeforeHide = false; // pausa intencional
    stopAggressiveKeepAlive();
    player.pauseVideo();
  } else {
    wasPlayingBeforeHide = true;
    player.playVideo();
  }
}

function updatePlayPauseButton() {
  const btn = document.getElementById('btn-play-pause');
  if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
}

function renderQueue() {
  const list = document.getElementById('queue-list');
  if (!list) return;
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
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = percent + '%';
  }

  const currentEl = document.getElementById('current-time');
  const durationEl = document.getElementById('duration');
  if (currentEl) currentEl.textContent = formatTime(current);
  if (durationEl) durationEl.textContent = formatTime(duration);
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
    if (player) {
      player.playVideo();
      wasPlayingBeforeHide = true;
    }
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    if (player) {
      player.pauseVideo();
      wasPlayingBeforeHide = false;
    }
  });

  navigator.mediaSession.setActionHandler('previoustrack', () => {
    playPrev();
  });

  navigator.mediaSession.setActionHandler('nexttrack', () => {
    playNext();
  });

  // Seek (alguns navegadores / Android)
  try {
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (player && details.seekTime != null) {
        player.seekTo(details.seekTime, true);
      }
    });
  } catch (e) {}

  try {
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (player && player.getCurrentTime) {
        const skip = details.seekOffset || 10;
        player.seekTo(Math.max(0, player.getCurrentTime() - skip), true);
      }
    });
  } catch (e) {}

  try {
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (player && player.getCurrentTime) {
        const skip = details.seekOffset || 10;
        player.seekTo(player.getCurrentTime() + skip, true);
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
      { src: `https://i.ytimg.com/vi/${video.id}/default.jpg`, sizes: '120x90', type: 'image/jpeg' },
      { src: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
      { src: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
    ]
  });
}

function updateMediaSessionPlaybackState(state) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = state;
  }
}

// Atualiza a posição na tela de bloqueio (progresso)
function startPositionStateUpdater() {
  stopPositionStateUpdater();
  positionStateInterval = setInterval(updatePositionState, 1000);
}

function stopPositionStateUpdater() {
  if (positionStateInterval) {
    clearInterval(positionStateInterval);
    positionStateInterval = null;
  }
}

function updatePositionState() {
  if (!('mediaSession' in navigator) || !player || !player.getCurrentTime || !player.getDuration) return;

  try {
    const duration = player.getDuration() || 0;
    const position = player.getCurrentTime() || 0;
    if (duration > 0) {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: player.getPlaybackRate ? player.getPlaybackRate() : 1,
        position: Math.min(position, duration)
      });
    }
  } catch (e) {
    // Alguns navegadores não suportam setPositionState
  }
}

// ===== Background / Tela bloqueada (modo agressivo) =====
let keepAliveInterval = null;
const RETRY_DELAYS = [100, 300, 600, 1000, 1500, 2500, 4000]; // tentativas escalonadas

function forcePlay() {
  if (!player || !wasPlayingBeforeHide) return;
  try {
    const state = player.getPlayerState();
    // Só força play se não estiver tocando nem bufferizando
    if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
      player.playVideo();
    }
  } catch (e) {}
}

function startAggressiveKeepAlive() {
  stopAggressiveKeepAlive();

  // Várias tentativas rápidas no começo
  RETRY_DELAYS.forEach((delay) => {
    setTimeout(forcePlay, delay);
  });

  // Depois fica tentando periodicamente enquanto estiver em background
  keepAliveInterval = setInterval(() => {
    if (document.hidden && wasPlayingBeforeHide) {
      forcePlay();
    } else if (!document.hidden) {
      // Já voltou ao primeiro plano → para o keep-alive agressivo
      stopAggressiveKeepAlive();
    }
  }, 2000);
}

function stopAggressiveKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

function setupBackgroundHandlers() {
  // Evita registrar múltiplas vezes
  if (window._bgHandlersSetup) return;
  window._bgHandlersSetup = true;

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // pagehide / pageshow (bfcache e alguns Android)
  window.addEventListener('pagehide', () => {
    if (isPlaying || wasPlayingBeforeHide) {
      wasPlayingBeforeHide = true;
      startAggressiveKeepAlive();
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (wasPlayingBeforeHide && player) {
      forcePlay();
      // Mais algumas tentativas
      setTimeout(forcePlay, 200);
      setTimeout(forcePlay, 600);
      setTimeout(forcePlay, 1200);
    }
  });

  // Eventos de freeze/resume (Chrome Android)
  document.addEventListener('freeze', () => {
    if (isPlaying || wasPlayingBeforeHide) {
      wasPlayingBeforeHide = true;
      startAggressiveKeepAlive();
    }
  });

  document.addEventListener('resume', () => {
    if (wasPlayingBeforeHide && player) {
      forcePlay();
      setTimeout(forcePlay, 300);
      setTimeout(forcePlay, 800);
    }
  });

  // Alguns aparelhos disparam blur
  window.addEventListener('blur', () => {
    if (isPlaying) {
      wasPlayingBeforeHide = true;
      startAggressiveKeepAlive();
    }
  });

  window.addEventListener('focus', () => {
    if (wasPlayingBeforeHide) {
      forcePlay();
    }
  });
}

function handleVisibilityChange() {
  if (!player) return;

  if (document.hidden) {
    // Tela travou ou app foi para segundo plano
    if (isPlaying || wasPlayingBeforeHide) {
      wasPlayingBeforeHide = true;
      startAggressiveKeepAlive();
    }
  } else {
    // Voltou a ficar visível
    stopAggressiveKeepAlive();
    if (wasPlayingBeforeHide) {
      forcePlay();
      setTimeout(forcePlay, 200);
      setTimeout(forcePlay, 500);
      setTimeout(forcePlay, 1000);
    }
  }
}

// Voltar para a lista
function closePlayer() {
  if (player && player.pauseVideo) {
    player.pauseVideo();
  }
  isPlaying = false;
  wasPlayingBeforeHide = false;
  stopProgressUpdater();
  stopPositionStateUpdater();
  stopAggressiveKeepAlive();
  updateMediaSessionPlaybackState('none');

  document.getElementById('player-view').classList.remove('active');
  document.getElementById('playlists-view').classList.add('active');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
