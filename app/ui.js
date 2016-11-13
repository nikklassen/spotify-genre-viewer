import * as d3 from 'd3';
import spotify from './spotify';
import { ObjectExts as oe } from './exts';

function renderPlaylists(data) {
    const playlistUrl = data.href.slice(0, data.href.indexOf('?'));
    d3.select('#playlists')
      .selectAll('li')
      .data(data.items)
      .enter().append('li')
      .text(playlist => playlist.name)
      .on('click', function(playlist) {
        d3.event.stopPropagation();
        spotify.queryPlaylist(playlistUrl, playlist.id)
          .then(() => {
            d3.select('#overlay')
              .style('display', 'none');
          });
      });
}

function populateGraph(data) {
  const genreSet = new Set();
  const genres = {};
  oe.forEach(data.artists, function(_, artist) {
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

  oe.forEach(genres, function(genre, connections) {
    oe.forEach(connections, function(genre2, weight) {
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
    oe.forEach(links, function(genre2) {
      groups[genre].add(genre2)

      const count = links[genre2];
      connections[genre] = (connections[genre] || 0) + count;
      connections[genre2] = (connections[genre2] || 0) + count;
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

var colorMap = d3.scaleSequential(d3.interpolateRainbow);

var simulation = d3.forceSimulation()
  .force('link', d3.forceLink().id(d => d.id))
  .force('charge', d3.forceManyBody()
    .distanceMax(100)
    .strength(-30))
  .force('center', d3.forceCenter(width / 2, height / 2));


function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

function buildGraph(graphData) {
  const graph = populateGraph(graphData);
  const colours = getColours(graph);

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
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  node.append('circle')
    .attr('r', 7)
    .attr('fill', function(d) {
      const colourGroups = Object.keys(colours);
      for (const colour of colourGroups) {
        if (colours[colour].genres.has(d.id)) {
          return colorMap(colour / colourGroups.length);
        }
      }
    })

  node.append('title')
      .text(d => d.id);

  node.on('mouseover', function(d) {
    if (showLabels) return;

    div.transition()
      .duration(200)
      .style('opacity', .9);
    div.html(d.id)
      .style('left', (d3.event.pageX) + 'px')
      .style('top', (d3.event.pageY - 28) + 'px');
  })
  node.on('mouseout', function(d) {
    div.transition()
      .duration(500)
      .style('opacity', 0);
  });

  simulation
    .nodes(graph.nodes)
    .on('tick', ticked)

  simulation.force('link')
    .links(graph.links);

  const titles = graph.nodes.filter(n => oe.some(colours, (k, v) => v.leader === n.id));
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

  const infoPanel = d3.select('#info');
  d3.select('.close').on('click', function(d) {
    infoPanel.node().classList.remove('info-visible')
  });

  node.on('click', function(d) {
    d3.event.stopPropagation();
    let group;
    oe.forEach(colours, function(colour, obj) {
      if (obj.genres.has(d.id)) {
        group = obj;
      }
    });

    infoPanel.select('.name').text(group.leader);

    const genreList = Array.from(group.genres).map(g => {
      if (g !== group.leader) {
        return `<li>${g}</li>`;
      }
    });
    infoPanel.select('.members').html(`<ul>${genreList.join('')}</ul>`);
    infoPanel.attr('class', 'info-visible');
  });

  function clamp(a, x, b) {
    if (x < a) {
      return a;
    } else if (x > b) {
      return b;
    }
    return x;
  }

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
  renderPlaylists,
  buildGraph,
};
