import * as d3 from 'd3';
import ui from './ui';

const scopes = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'playlist-modify-public',
  'playlist-modify-private'];

const callbackURI = window.location.toString()
  .replace(/\?.*/, '')
  .replace(/#.*/, '')
const authLocation = 'https://accounts.spotify.com/authorize' +
`?client_id=${CLIENT_ID}` +
`&response_type=token` +
`&redirect_uri=${callbackURI}` +
`&scope=${scopes.join('%20')}`;

let token = localStorage.getItem('auth-token');
let userId = null;

const LIBRARY_URL = 'https://api.spotify.com/v1/me/tracks';
const LIBRARY_ITEM = Object.freeze({
  name: 'My Library *',
  tracks: {
    href: LIBRARY_URL,
  },
});

function authorize() {
  if (token === null) {
    const hash = window.location.hash;
    window.location.hash = '';
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

function authorizationFilter(e) {
  if (e.target.status === 401) {
    token = null;
    authorize();
  } else {
    throw e;
  }
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
  }).catch(authorizationFilter);
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
  }).catch(authorizationFilter);
}

function getPlaylists() {
  return query('/v1/me/playlists?limit=50');
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

function queryAll(url) {
  return query(url)
    .then(data => {
      if (data.next !== null) {
        return queryAll(data.next)
          .then(all => {
            all.items = all.items.concat(data.items);
            return all;
          });
      }
      return data;
    });
}

function queryPlaylist(url) {
  const tracks = {};
  let limit = 100;
  if (url === LIBRARY_URL) {
    limit = 50;
  }
  return queryAll(`${url}?limit=${limit}`)
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
  LIBRARY_ITEM,
};
