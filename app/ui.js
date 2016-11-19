import * as d3 from 'd3';
import spotify from './spotify';
import './exts';
import _ from 'lodash';

function showToast(msg) {
  d3.select('#toast')
    .attr('class', '')
    .text(msg);
  setTimeout(function() {
    d3.select('#toast')
      .attr('class', 'hide');
  }, 2000);
}

function showModal(id) {
  const content = document.importNode(
    document.getElementById(id).content,
    true);
  const modal = document.querySelector('.modal');
  modal.innerHTML = '';
  modal.appendChild(content);
  d3.select('#overlay')
    .style('display', 'block');
}

function hideModal() {
  d3.select('#overlay')
    .style('display', 'none');
}

function showLoading() {
  d3.select('#loading')
    .attr('class', '');
}

function hideLoading() {
  d3.select('#loading')
    .attr('class', 'hide');
}

function showPlaylistModal() {
  showModal('playlist-modal');
}

function setPlaylists(data) {
  d3.select('#playlists')
    .html('')
    .selectAll('li')
    .data(data.items)
    .enter().append('li')
    .text(playlist => playlist.name)
    .on('click', function(playlist) {
      d3.event.preventDefault();
      hideModal();
      showLoading();
      spotify.queryPlaylist(playlist.tracks.href, playlist.id);
    });
}

function showCreateModal() {
  showModal('create-modal');
  document.querySelector('.create-playlist [type="text"]')
    .focus();
  return new Promise(function(res, rej) {
    d3.select('.create-playlist [value="Cancel"]')
      .on('click', function() {
        hideModal();
        rej();
      });

    d3.select('.create-playlist form')
      .on('submit', function() {
        d3.event.preventDefault();

        hideModal();
        res(this);
      });
  });
}

function populateGraph(data) {
  const genreSet = new Set();
  const genres = {};
  _.forOwn(data.artists, function(artist) {
    artist.genres.forEach(g => genreSet.add(g))
    artist.genres.forEach(function(genre1) {
      if (!genres[genre1]) {
        genres[genre1] = {};
      }
      artist.genres.forEach(function(genre2) {
        if (!genres[genre2]) {
          genres[genre2] = {};
        }
        if (genre1 !== genre2) {
          genres[genre1][genre2] = (genres[genre1][genre2] || 0) + 1;
          genres[genre2][genre1] = (genres[genre2][genre1] || 0) + 1;
        }
      });
    });
  });

  const jsonData = {
    nodes: [],
    links: [],
    genres: genres,
  }

  for (const genre of genreSet) {
    jsonData.nodes.push({
      id: genre,
    });
  }

  _.forOwn(genres, function(connections, genre) {
    _.forOwn(connections, function(weight, genre2) {
      if (genre < genre2) {
        jsonData.links.push({
          source: genre,
          target: genre2,
          value: weight,
        });
      }
    });
  });

  return jsonData;
}

function getColours(graph) {
  const groups = {};
  const connections = {};
  const allGenres = graph.nodes.map(n => n.id);
  allGenres.forEach(function(genre) {
    const counts = {};
    groups[genre] = new Set([genre]);
    let links = graph.genres[genre];
    if (!links) {
      return;
    }
    _.forOwn(links, function(weight, genre2) {
      groups[genre].add(genre2)

      connections[genre] = (connections[genre] || 0) + weight;
      connections[genre2] = (connections[genre2] || 0) + weight;
    });
  })

  let toColour = allGenres.slice(0);
  toColour.sort(function(a, b) {
    if (connections[a] > connections[b]) {
      return -1;
    } else if (connections[a] < connections[b]) {
      return 1;
    }
    return 0;
  })

  let colours = {};
  let colour = 1;
  while (toColour.length > 0) {
    const leader = toColour.shift();
    colours[colour] = {
      leader,
      genres: new Set([leader]),
    };
    for (const genre of toColour) {
      const intersection = groups[leader].intersection(groups[genre]);
      if ((intersection.size > 3 || intersection.equals(groups[leader])) && graph.genres[leader][genre]) {
        colours[colour].genres.add(genre);
      }
    }
    toColour = toColour.filter(c => !colours[colour].genres.has(c))
    colour += 1;
  }

  return colours;
}

var svg = d3.select('svg'),
  width = +svg.attr('width'),
  height = +svg.attr('height');

var div = d3.select('body').append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

var colourMap = d3.scaleSequential(d3.interpolateRainbow);

function init() {
  d3.select('#cancel-btn')
    .attr('class', 'hide');
  d3.select('#create-playlist-btn')
    .attr('class', 'hide');

  function displayPlaylists() {
    showPlaylistModal();
    spotify.getPlaylists()
      .then(setPlaylists);
  }
  d3.select('#choose-playlist-btn')
    .on('click', displayPlaylists);

  displayPlaylists();
}

function showInfoForGroup(group, graphData) {
  const infoPanel = d3.select('#info');
  d3.select('.close').on('click', function(d) {
    infoPanel.node().classList.remove('info-visible')
  });

  infoPanel.select('.name').text(group.leader);
  const members = infoPanel.select('.members')

  members.selectAll('.genres, .tracks')
    .on('click', function() {
      let p = d3.event.target;
      if (p.tagName === 'I') {
        p = p.parentElement
      }
      p.classList.toggle('expand');
      p.nextElementSibling
        .classList.toggle('expand');
    })
    .call(selection => {
      selection.nodes().forEach(n => n.classList.remove('expand'));
    });

  members.selectAll('.genre-list, .track-list')
    .html('')
    .call(selection => {
      selection.nodes().forEach(n => n.classList.remove('expand'));
    });

  const genreList = members.select('.genre-list')
  genreList.selectAll('li')
    .data(Array.from(group.genres))
    .enter().append('li')
    .text(g => g)

  const includedTracks = _.pickBy(graphData.tracks, t => {
    return t.artists.some(function(a) {
      return graphData.artists[a].genres.some(
        g => group.genres.has(g));
    });
  });
  const trackList = members.select('.track-list')
  trackList.selectAll('li')
    .data(_.values(includedTracks))
    .enter().append('li')
    .text(t => {
      const artists = t.artists.map(a => {
        return graphData.artists[a].name;
      });
      return `${t.name} - ${artists.join(', ')}`
    });

  infoPanel.attr('class', 'info-visible');
}

function buildGraph(graphData) {
  // Clear existing graphs
  svg.html('');

  const graph = populateGraph(graphData);
  const colours = getColours(graph);

  function getGenreGroup(genre) {
    return _.find(colours, group => {
      return group.leader === genre || group.genres.has(genre);
    });
  }
  function getGenreColour(genre) {
    return _.findKey(colours, group => {
      return group.leader === genre || group.genres.has(genre);
    });
  }
  let playlistSelection = new Set();
  function fillNodes(highlightGroup) {
    node.selectAll('circle')
      .attr('fill', d => {
        let colour = getGenreColour(d.id);
        let group = colours[colour];
        if (isSelecting && playlistSelection.has(group)) {
          return 'green';
        }
        if (!isSelecting || highlightGroup === colours[colour]) {
          return colourMap(colour / numColours);
        }
        return 'grey';
      });
  }

  const connected = {};
  graph.links = graph.links.filter(function(l) {
    const sourceGroup = getGenreColour(l.source);
    const targetGroup = getGenreColour(l.target);

    if (sourceGroup === targetGroup) return true;

    // Intentionally leaving this direction dependent
    if (_.get(connected, [sourceGroup, targetGroup], false)) {
      return false;
    }
    _.set(connected, [sourceGroup, targetGroup], true);
    return true;
  });

  const simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id))
    .force('charge', d3.forceManyBody()
      .distanceMax(100)
      .strength(-30))
    .force('center', d3.forceCenter(width / 2, height / 2));

  // Graph is starting to be populated now
  hideLoading();

  const link = svg.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(graph.links)
    .enter().append('line')
    .attr('stroke-width', function(d) { return Math.sqrt(d.value); });

  const node = svg.append('g')
    .attr('class', 'nodes')
    .selectAll('circle')
    .data(graph.nodes)
    .enter().append('g')
    .call(d3.drag()
      .on('start', d => {
        if (!d3.event.active) {
          simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', d => {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
      })
      .on('end', d => {
        if (!d3.event.active) {
          simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      }));

  const numColours = _.size(colours);
  node.append('circle')
    .attr('r', 7)
    .attr('fill', d => {
      let colour = getGenreColour(d.id);
      if (isSelecting) {
        if (selected.has(colour)) {
          return 'green';
        }
        return 'grey';
      }
      return colourMap(colour / numColours)
    });

  node.append('title')
    .text(d => d.id);

  node.on('mouseover', function(d) {
    if (isSelecting) {
      fillNodes(getGenreGroup(d.id));
      return;
    }
    if (showLabels) return;

    div.transition()
      .duration(200)
      .style('opacity', .9);
    div.html(d.id)
      .style('left', (d3.event.pageX) + 'px')
      .style('top', (d3.event.pageY - 28) + 'px');
  })
  node.on('mouseout', function(d) {
    if (isSelecting) {
      fillNodes()
      return;
    }

    div.transition()
      .duration(500)
      .style('opacity', 0);
  });

  simulation
    .nodes(graph.nodes)
    .on('tick', ticked)

  simulation.force('link')
    .links(graph.links);

  const titles = graph.nodes.filter(n => _.some(colours, (v, k) => v.leader === n.id));
  const titleNodes = svg.append('g')
    .attr('class', 'titles')
    .selectAll('.title')
    .data(titles)
    .enter().append('g')
    .attr('class', 'title')

  titleNodes.append('text')
    .attr('class', 'text')
    .attr('dy', '1em')
    .attr('text-anchor', 'middle')
    .text(function(d) {
      return d.id;
    });

  let isSelecting = false;
  const buildPlaylistBtn = d3.select('#build-playlist-btn');
  const makePlaylistBtn = d3.select('#create-playlist-btn');
  const cancelBtn = d3.select('#cancel-btn');
  buildPlaylistBtn.on('click', function(d) {
    isSelecting = true;
    fillNodes();
    buildPlaylistBtn.attr('class', 'hide');
    makePlaylistBtn.attr('class', '');
    cancelBtn.attr('class', '');
  });

  function cancelSelection() {
    isSelecting = false;
    playlistSelection.clear();
    fillNodes();
    buildPlaylistBtn.attr('class', '');
    makePlaylistBtn.attr('class', 'hide');
    cancelBtn.attr('class', 'hide');
  }

  makePlaylistBtn.on('click', function(d) {
    let selectedGenres = new Set();
    for (const group of playlistSelection) {
      selectedGenres = selectedGenres.union(group.genres);
    }
    const tracks = _(graphData.tracks)
      .values()
      .filter(t => {
        const genres = _(t.artists)
          .map(a => graphData.artists[a].genres)
          .flatten().value()
        return selectedGenres.intersection(new Set(genres)).size > 0;
      })
      .map('uri').value();

    cancelSelection();
    showCreateModal()
      .then(function(form) {
        spotify.createPlaylist(
          form.name.value,
          form.isPublic.checked,
          form.isCollaborative.checked)
          .then(function(newPlaylist) {
            return spotify.addTracksToPlaylist(newPlaylist.id, tracks);
          })
          .catch(function() {
            showToast('An error occurred while creating the playlist');
          })
          .then(function() {
            showToast('Playlist created');
          });
      });
  });

  cancelBtn.on('click', cancelSelection);

  node.on('click', function(d) {
    d3.event.stopPropagation();
    if (isSelecting) {
      playlistSelection.add(getGenreGroup(d.id));
    } else {
      showInfoForGroup(getGenreGroup(d.id), graphData);
    }
    fillNodes();
  });

  function ticked() {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    svg.selectAll('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    titleNodes.select('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .call(function(selection) {
        selection.each(function(d){d.bbox = this.getBBox();})
      })
  }

  let showLabels = true;
  d3.select('#toggle').on('click', function() {
    showLabels = !showLabels;
    const display = showLabels ? 'initial' : 'none';
    titleNodes
      .select('text')
      .style('display', display);
    titleNodes
      .select('rect')
      .style('display', display);
  });
}

export default {
  buildGraph,
  showPlaylistModal,
  showCreateModal,
  init,
  setPlaylists,
};
