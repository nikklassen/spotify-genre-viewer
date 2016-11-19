import * as d3 from 'd3';
import ui from './ui';

const scopes = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'playlist-modify-public',
  'playlist-modify-private'];

const authLocation = 'https://accounts.spotify.com/authorize' +
`?client_id=${CLIENT_ID}` +
`&response_type=token` +
`&redirect_uri=${window.location.toString().replace(/\?.*/, '')}` +
`&scope=${scopes.join('%20')}`;

let token = localStorage.getItem('auth-token');
let userId = null;

function authorize() {
  if (token === null) {
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      token = {};
      // Remove leading #
      hash.slice(1).split('&').forEach(function(param) {
        const [key, val] = param.split('=', 2);
        token[key] = decodeURIComponent(val);
      });
      token['time'] = new Date();
      localStorage.setItem('auth-token', JSON.stringify(token));
    } else {
      window.location = authLocation;
    }
  } else {
    token = JSON.parse(token)
    token['time'] = new Date(token['time']);

    if (token.time.getTime() + parseInt(token.expires_in, 10) * 1000 < new Date()) {
      localStorage.removeItem('auth-token');
      window.location = authLocation;
    }
  }
  query('/v1/me').then(data => {
    userId = data.id;
  });
}

function query(url) {
  let apiUrl = url.startsWith('http') ? url : 'https://api.spotify.com' + url;
  return new Promise(function(resolve, reject) {
    d3.request(apiUrl)
      .header('Authorization', 'Bearer ' + token.access_token)
      .get()
      .on('error', e => reject(e))
      .on('load', function(xhr) {
        resolve(JSON.parse(xhr.responseText));
      });
  }).catch(e => {
    if (e.target.status === 401) {
      authenticate();
    }
  });
}

function post(url, data) {
  let apiUrl = url.startsWith('http') ? url : 'https://api.spotify.com' + url;
  return new Promise(function(resolve, reject) {
    d3.request(apiUrl)
      .header('Authorization', 'Bearer ' + token.access_token)
      .post(data)
      .on('error', e => reject(e))
      .on('load', function(xhr) {
        resolve(JSON.parse(xhr.responseText));
      });
  }).catch(e => {
    if (e.target.status === 401) {
      authenticate();
    }
  });
}

function getPlaylists() {
  return query('/v1/me/playlists?limit=50')
}

function createPlaylist(name, isPublic, isCollaborative) {
  return post(`/v1/users/${userId}/playlists`, JSON.stringify({
    name,
    'public': isPublic,
    collaborative: isCollaborative,
  }));
}

function addTracksToPlaylist(playlistId, uris) {
  return post(`/v1/users/${userId}/playlists/${playlistId}/tracks`, JSON.stringify({
    uris,
  }));
}

function queryPlaylist(url, id) {
  const tracks = {};
  return query(`${url}?limit=100`)
    .then(function(data) {
      let artists = new Set();
      data.items.forEach(function(item) {
        if (item.is_local) return;

        const artistIds = item.track.artists.map(a => {
          artists.add(a.id);
          return a.id;
        });
        tracks[item.track.id] = {
          artists: artistIds,
          name: item.track.name,
          uri: item.track.uri,
          externalLink: item.track.external_urls.spotify,
        };
      });

      const artistRequests = [];

      artists = Array.from(artists);
      for (let i = 0; i < artists.length; i += 50) {
        artistRequests.push(
          query('/v1/artists/?ids=' + artists.slice(i, i + 50).join(','))
        );
      }

      return Promise.all(artistRequests);
    })
    .then(function(artistData) {
      const artists = {};
      artistData.reduce((acc, as) => acc.concat(as.artists), []).map(function(artist) {
        artists[artist.id] = {
          name: artist.name,
          genres: artist.genres,
        };
      });
      ui.buildGraph({
        tracks,
        artists,
      });
    });
}

export default {
  query,
  authorize,
  getPlaylists,
  queryPlaylist,
  createPlaylist,
  addTracksToPlaylist,
};
