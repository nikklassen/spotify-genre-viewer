import * as d3 from 'd3';
import ui from './ui';

const authLocation = 'https://accounts.spotify.com/authorize' +
`?client_id=${CLIENT_ID}` +
`&response_type=token` +
`&redirect_uri=${window.location}` +
`&scope=playlist-read-private%20playlist-read-collaborative%20user-library-read`;

let token = localStorage.getItem('auth-token');

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
  });
}

function getPlaylists() {
  query('/v1/me/playlists?limit=50')
  .then(ui.renderPlaylists);
}

function queryPlaylist(url, id) {
  const tracks = {};
  return query(`${url}/${id}/tracks?limit=100`)
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
};
