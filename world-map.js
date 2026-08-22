// <world-map> — real Natural Earth geometry via d3-geo + topojson (loaded globally).
// Attributes: ground, ink, accent, visited (comma list), planned (comma list),
//   pins (JSON [{name,lon,lat,kind}]), selected, projection ("world"|"asia")
// Clicking a country dispatches a bubbling "country-pick" CustomEvent with the country name.
(() => {
  const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
  let topoPromise = null;

  const waitForLibs = () => new Promise(res => {
    const tick = () => (window.d3 && window.topojson) ? res() : setTimeout(tick, 40);
    tick();
  });

  class WorldMap extends HTMLElement {
    static get observedAttributes() {
      return ['ground', 'ink', 'accent', 'visited', 'planned', 'pins', 'selected', 'projection'];
    }
    connectedCallback() {
      this.style.display = 'block';
      this.style.position = 'relative';
      this.style.width = '100%';
      this.style.height = '100%';
      this._ro = new ResizeObserver(() => this._draw());
      this._ro.observe(this);
      this._load();
    }
    disconnectedCallback() { if (this._ro) this._ro.disconnect(); }
    attributeChangedCallback() { if (this._features) this._draw(); }

    async _load() {
      await waitForLibs();
      if (!topoPromise) {
        // Pages that can't reach the CDN (e.g. a bundled/offline build) may
        // predefine window.__COUNTRIES_TOPO__ with the same topojson data.
        topoPromise = window.__COUNTRIES_TOPO__
          ? Promise.resolve(window.__COUNTRIES_TOPO__)
          : fetch(TOPO_URL).then(r => r.json());
      }
      const topo = await topoPromise;
      this._features = window.topojson.feature(topo, topo.objects.countries).features;
      this._draw();
    }

    _list(attr) {
      return (this.getAttribute(attr) || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    _draw() {
      if (!this._features) return;
      const w = this.clientWidth, h = this.clientHeight;
      if (!w || !h) return;
      const d3 = window.d3;
      const ground = this.getAttribute('ground') || '#f3f2f2';
      const ink = this.getAttribute('ink') || '#201e1d';
      const accent = this.getAttribute('accent') || '#c04a2b';
      const visited = this._list('visited');
      const planned = this._list('planned');
      const selected = this.getAttribute('selected') || '';
      let pins = [];
      try { pins = JSON.parse(this.getAttribute('pins') || '[]'); } catch (e) { pins = []; }

      const mode = this.getAttribute('projection') || 'world';
      const proj = mode === 'asia'
        ? d3.geoMercator().center([135, 36]).scale(Math.max(w, h) * 2.6).translate([w / 2, h / 2])
        : d3.geoNaturalEarth1().fitExtent([[6, 10], [w - 6, h - 10]], { type: 'Sphere' });
      const path = d3.geoPath(proj);

      this.innerHTML = '';
      const svg = d3.select(this).append('svg')
        .attr('width', w).attr('height', h)
        .attr('viewBox', `0 0 ${w} ${h}`)
        .style('display', 'block').style('background', ground);

      svg.append('path').attr('d', path({ type: 'Sphere' }))
        .attr('fill', 'none').attr('stroke', ink).attr('stroke-opacity', 0.25).attr('stroke-width', 1);
      svg.append('path').attr('d', path(d3.geoGraticule10()))
        .attr('fill', 'none').attr('stroke', ink).attr('stroke-opacity', 0.1).attr('stroke-width', 0.6);

      svg.append('g').selectAll('path').data(this._features).join('path')
        .attr('d', path)
        .attr('fill', d => {
          const n = d.properties.name;
          if (n === selected) return accent;
          if (visited.includes(n)) return 'color-mix(in srgb, ' + accent + ' 34%, ' + ground + ')';
          if (planned.includes(n)) return 'color-mix(in srgb, ' + ink + ' 22%, ' + ground + ')';
          return 'color-mix(in srgb, ' + ink + ' 9%, ' + ground + ')';
        })
        .attr('stroke', ink).attr('stroke-opacity', 0.35).attr('stroke-width', 0.5)
        .style('cursor', d => (visited.includes(d.properties.name) || planned.includes(d.properties.name)) ? 'pointer' : 'default')
        .on('click', (ev, d) => {
          this.dispatchEvent(new CustomEvent('country-pick', {
            bubbles: true, composed: true, detail: d.properties.name
          }));
        });

      const pg = svg.append('g');
      const boxes = [];
      const hit = b => boxes.some(o => !(b.x2 < o.x1 || b.x1 > o.x2 || b.y2 < o.y1 || b.y1 > o.y2));
      pins.forEach(p => {
        const xy = proj([p.lon, p.lat]);
        if (!xy) return;
        const s = p.kind === 'friend' ? 7 : 9;
        pg.append('rect')
          .attr('x', xy[0] - s / 2).attr('y', xy[1] - s / 2).attr('width', s).attr('height', s)
          .attr('fill', p.kind === 'friend' ? ground : accent)
          .attr('stroke', ink).attr('stroke-width', 1.6);
        if (!p.name) return;
        // Label placement: try right, then left, then below — take the first slot
        // that doesn't overlap a label already drawn, otherwise draw the square alone.
        const w = p.name.length * 5.9 + 4, h = 11;
        const dy = p.dy || 0;
        const slots = [
          {x: xy[0] + s, y: xy[1] + 3.5 + dy, anchor: 'start'},
          {x: xy[0] - s, y: xy[1] + 3.5 + dy, anchor: 'end'},
          {x: xy[0] + s, y: xy[1] + 14 + dy, anchor: 'start'},
          {x: xy[0] - s, y: xy[1] + 14 + dy, anchor: 'end'}
        ];
        if (p.anchor === 'end') slots.reverse();
        for (const sl of slots) {
          const x1 = sl.anchor === 'start' ? sl.x : sl.x - w;
          const b = {x1: x1 - 2, x2: x1 + w + 2, y1: sl.y - h, y2: sl.y + 3};
          if (hit(b)) continue;
          boxes.push(b);
          pg.append('text')
            .attr('x', sl.x).attr('y', sl.y).attr('text-anchor', sl.anchor)
            .attr('font-family', 'Archivo, system-ui, sans-serif')
            .attr('font-size', 9).attr('font-weight', 800)
            .attr('letter-spacing', '0.04em')
            .attr('fill', ink).text(p.name);
          return;
        }
      });
    }
  }
  if (!customElements.get('world-map')) customElements.define('world-map', WorldMap);
})();
