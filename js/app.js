// ===== App Principal =====

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Escuta mudanças no Firebase em tempo real
  onPlaylistsChange((data) => {
    playlists = data;
    renderPlaylistsList();
  });

  // Botões principais
  document.getElementById('btn-new-playlist').addEventListener('click', () => {
    openModal();
  });

  document.getElementById('btn-add-video').addEventListener('click', () => {
    addVideoInput();
  });

  document.getElementById('btn-save-playlist').addEventListener('click', () => {
    saveCurrentPlaylist();
  });

  document.getElementById('btn-cancel').addEventListener('click', () => {
    closeModal();
  });

  // Controles do player
  document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);
  document.getElementById('btn-next').addEventListener('click', playNext);
  document.getElementById('btn-prev').addEventListener('click', playPrev);
  document.getElementById('btn-back').addEventListener('click', closePlayer);

  // Fechar modal clicando fora
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
      closeModal();
    }
  });

  // Registrar Service Worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => console.log('Service Worker registrado'))
      .catch(err => console.warn('SW falhou:', err));
  }
}
