// ===== Firebase Configuration =====
// Substitua pelos dados do SEU projeto Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Referência ao Realtime Database
const db = firebase.database();

// Caminho onde as playlists serão salvas
const PLAYLISTS_REF = db.ref('playlists');

/**
 * Salva ou atualiza uma playlist
 * @param {Object} playlist - { id, name, videos: [{url, title}] }
 */
function savePlaylist(playlist) {
  return PLAYLISTS_REF.child(playlist.id).set(playlist);
}

/**
 * Remove uma playlist
 */
function deletePlaylist(id) {
  return PLAYLISTS_REF.child(id).remove();
}

/**
 * Escuta mudanças nas playlists em tempo real
 * @param {Function} callback - recebe o objeto de playlists
 */
function onPlaylistsChange(callback) {
  PLAYLISTS_REF.on('value', (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
}

/**
 * Gera um ID único simples
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
