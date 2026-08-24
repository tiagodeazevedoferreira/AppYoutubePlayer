// ===== Gerenciamento de Playlists =====

let playlists = {};           // cache local
let currentEditingId = null;  // id da playlist sendo editada (null = nova)

/**
 * Extrai o ID do vídeo a partir de qualquer URL do YouTube
 */
function extractVideoId(url) {
  if (!url) return null;

  // Já é só o ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
    return url.trim();
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

/**
 * Renderiza a lista de playlists na tela principal
 */
function renderPlaylistsList() {
  const container = document.getElementById('playlists-list');
  const emptyState = document.getElementById('empty-playlists');

  container.innerHTML = '';

  const ids = Object.keys(playlists);

  if (ids.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  ids.forEach(id => {
    const pl = playlists[id];
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `
      <div class="playlist-info">
        <h3>${escapeHtml(pl.name)}</h3>
        <p>${pl.videos?.length || 0} vídeo(s)</p>
      </div>
      <div class="playlist-actions">
        <button class="btn-edit" title="Editar">✏️</button>
        <button class="btn-delete" title="Excluir">🗑️</button>
      </div>
    `;

    // Clicar no card → tocar
    card.querySelector('.playlist-info').addEventListener('click', () => {
      openPlayer(pl);
    });

    // Editar
    card.querySelector('.btn-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(pl);
    });

    // Excluir
    card.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Excluir a playlist "${pl.name}"?`)) {
        deletePlaylist(id).catch(err => {
          console.error(err);
          alert('Erro ao excluir. Verifique o Firebase.');
        });
      }
    });

    container.appendChild(card);
  });
}

/**
 * Abre o modal para criar ou editar
 */
function openModal(playlist = null) {
  currentEditingId = playlist ? playlist.id : null;

  document.getElementById('modal-title').textContent = playlist ? 'Editar Playlist' : 'Nova Playlist';
  document.getElementById('playlist-name').value = playlist ? playlist.name : '';

  const videosContainer = document.getElementById('videos-inputs');
  videosContainer.innerHTML = '';

  if (playlist && playlist.videos && playlist.videos.length > 0) {
    playlist.videos.forEach(video => {
      addVideoInput(video.url || `https://www.youtube.com/watch?v=${video.id}`);
    });
  } else {
    addVideoInput();
  }

  document.getElementById('modal').classList.remove('hidden');
}

/**
 * Adiciona um campo de input de vídeo
 */
function addVideoInput(value = '') {
  const container = document.getElementById('videos-inputs');
  const row = document.createElement('div');
  row.className = 'video-input-row';
  row.innerHTML = `
    <input type="text" placeholder="Cole o link do YouTube aqui" value="${escapeHtml(value)}">
    <button type="button" title="Remover">✕</button>
  `;

  row.querySelector('button').addEventListener('click', () => {
    row.remove();
  });

  container.appendChild(row);
}

/**
 * Salva a playlist (nova ou edição)
 */
function saveCurrentPlaylist() {
  const name = document.getElementById('playlist-name').value.trim();
  if (!name) {
    alert('Digite um nome para a playlist.');
    return;
  }

  const inputs = document.querySelectorAll('#videos-inputs input');
  const videos = [];

  inputs.forEach(input => {
    const url = input.value.trim();
    if (!url) return;

    const videoId = extractVideoId(url);
    if (!videoId) {
      alert(`Link inválido do YouTube:\n${url}`);
      return;
    }

    videos.push({
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: `Vídeo ${videoId}` // título real será buscado depois se quiser
    });
  });

  if (videos.length === 0) {
    alert('Adicione pelo menos um vídeo.');
    return;
  }

  const playlist = {
    id: currentEditingId || generateId(),
    name,
    videos,
    updatedAt: Date.now()
  };

  savePlaylist(playlist)
    .then(() => {
      closeModal();
    })
    .catch(err => {
      console.error(err);
      alert('Erro ao salvar. Verifique a configuração do Firebase.');
    });
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  currentEditingId = null;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
