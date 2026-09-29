// huangguo_fongmi.js
// FongMi / 影视TV QuickJS Spider adapter
// Adapted from Yswag/xptv-extensions huangguo.js

const SITE = 'https://huangguoai.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Referer': SITE + '/'
};

const CLASSES = [
  { type_id: 'ai-duanju',  type_name: 'AI成人短剧' },
  { type_id: 'ai-manju',   type_name: 'AI成人漫剧' },
  { type_id: 'ai-huanlian', type_name: 'AI换脸' },
  { type_id: 'ai-mogai',   type_name: 'AI魔改' },
  { type_id: 'ranks/hot',  type_name: '排行榜' }
];

function fix(u) {
  if (!u) return '';
  u = String(u).replace(/&amp;/g, '&');
  if (u.indexOf('//') === 0) return 'https:' + u;
  if (u.indexOf('/') === 0) return SITE + u;
  return u;
}

function stripTags(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function getHtml(url, referer) {
  const headers = Object.assign({}, HEADERS);
  if (referer) headers.Referer = referer;
  const r = req(url, { method: 'get', headers: headers, timeout: 15000 });
  if (!r) return '';
  return typeof r.content === 'string' ? r.content : '';
}

function gridSlices(html, allGrids) {
  const re = /<div\s+class="[^"]*\bhg-card-grid\b[^"]*"[^>]*>/g;
  const starts = [];
  let m;
  while ((m = re.exec(html)) !== null) starts.push(m.index + m[0].length);
  if (!starts.length) return [html];
  const slices = [];
  const n = allGrids ? starts.length : 1;
  for (let i = 0; i < n; i++) {
    const to = i + 1 < starts.length ? starts[i + 1] : html.length;
    slices.push(html.slice(starts[i], to));
  }
  return slices;
}

function cardBlocks(slice) {
  const re = /<div\s+class="[^"]*\bhg-drama-card\b[^"]*"[^>]*>/g;
  const starts = [];
  let m;
  while ((m = re.exec(slice)) !== null) starts.push(m.index + m[0].length);
  const blocks = [];
  for (let i = 0; i < starts.length; i++) {
    const to = i + 1 < starts.length ? starts[i + 1] : slice.length;
    blocks.push(slice.slice(starts[i], to));
  }
  return blocks;
}

function parseCardBlock(block) {
  // New site uses /video/ID/ ; old source used /detail/ID/
  const a = block.match(/href="[^"]*\/(?:detail|video)\/(\d+)\/[^"]*"/);
  if (!a) return null;
  const vid = a[1];

  const imgM = block.match(/data-src="([^"]+)"/) || block.match(/src="([^"]+)"/);
  let title = '';

  const t = block.match(/hg-drama-card__title[^>]*>([\s\S]*?)<\/a>/);
  if (t) title = stripTags(t[1]);

  if (!title) {
    const tt = block.match(/<a[^>]+href="[^"]*\/(?:detail|video)\/\d+\/[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (tt) title = stripTags(tt[1]);
  }
  if (!title) return null;

  const ep = block.match(/hg-drama-card__episode[^>]*>([\s\S]*?)<\/span>/);
  const score = block.match(/hg-drama-card__score[^>]*>([\s\S]*?)<\/span>/);
  const rem = ep ? stripTags(ep[1]) : '';
  const sc = score ? stripTags(score[1]) : '';

  return {
    vod_id: vid,
    vod_name: title,
    vod_pic: fix(imgM ? imgM[1] : ''),
    vod_remarks: rem && sc ? rem + ' · ' + sc : (rem || sc)
  };
}

function parseGridCards(html, allGrids) {
  if (!html) return [];
  const list = [];
  const seen = {};
  const slices = gridSlices(html, allGrids);

  for (let si = 0; si < slices.length; si++) {
    const blocks = cardBlocks(slices[si]);
    for (let bi = 0; bi < blocks.length; bi++) {
      try {
        const item = parseCardBlock(blocks[bi]);
        if (!item || seen[item.vod_id]) continue;
        seen[item.vod_id] = true;
        list.push(item);
      } catch (e) {}
    }
  }

  // Fallback for site layout changes: parse links around /video/ID/
  if (!list.length) {
    const re = /<a\b[^>]*href="([^"]*\/video\/(\d+)\/)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const id = m[2];
      if (seen[id]) continue;
      let name = stripTags(m[3]);
      name = name.replace(/全集在线观看\s*$/g, '').trim();
      if (!name || /^\d+$/.test(name)) continue;
      seen[id] = true;
      list.push({ vod_id: id, vod_name: name, vod_pic: '', vod_remarks: '' });
    }
  }

  return list;
}

function parseRanks(html) {
  if (!html) return [];
  const list = [];
  const seen = {};

  const listM = html.match(/<div\s+class="[^"]*\bhg-rank-list\b[^"]*"[^>]*>/);
  const slice = html.slice(listM ? listM.index + listM[0].length : 0);
  const re = /<div\s+class="[^"]*\bhg-rank-item\b[^"]*"[^>]*>/g;
  const starts = [];
  let m;
  while ((m = re.exec(slice)) !== null) starts.push(m.index + m[0].length);

  for (let i = 0; i < starts.length; i++) {
    const to = i + 1 < starts.length ? starts[i + 1] : slice.length;
    const block = slice.slice(starts[i], to);
    const a = block.match(/href="[^"]*\/(?:detail|video)\/(\d+)\/[^"]*"/);
    if (!a || seen[a[1]]) continue;

    const id = a[1];
    const imgM = block.match(/data-src="([^"]+)"/) || block.match(/src="([^"]+)"/);
    let title = '';
    const t = block.match(/hg-rank-item__title[^>]*>([\s\S]*?)<\/h2>/);
    if (t) title = stripTags(t[1]);
    if (!title) {
      const tt = block.match(/<a[^>]+href="[^"]*\/(?:detail|video)\/\d+\/[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      if (tt) title = stripTags(tt[1]);
    }
    if (!title) continue;

    const tags = block.match(/hg-rank-item__tags[^>]*>([\s\S]*?)<\/div>/);
    seen[id] = true;
    list.push({
      vod_id: id,
      vod_name: title,
      vod_pic: fix(imgM ? imgM[1] : ''),
      vod_remarks: tags ? stripTags(tags[1]) : ''
    });
  }

  return list.length ? list : parseGridCards(html, true);
}

function parseTitle(html, fallback) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return stripTags(title[1]).replace(/\s*[-|｜].*$/, '').trim();
  return fallback || '';
}

function parsePic(html) {
  const og = html.match(/<meta\b[^>]*(?:property|name)="og:image"[^>]*content="([^"]+)"[^>]*>/i) ||
             html.match(/<meta\b[^>]*content="([^"]+)"[^>]*(?:property|name)="og:image"[^>]*>/i);
  if (og) return fix(og[1]);
  const pic = html.match(/<img\b[^>]*(?:class="[^"]*hg-web-detail[^\"]*"[^>]*)?(?:data-src|src)="([^"]+)"/i);
  return fix(pic ? pic[1] : '');
}

function parseEpisodes(html, id) {
  const eps = [];
  const seen = {};

  // First try the dedicated episode grid used by the original site source.
  const gridM = html.match(/<div\s+class="[^"]*\bhg-web-detail__ep-grid\b[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const scope = gridM ? gridM[1] : html;
  const are = /<a\b[^>]*>[\s\S]*?<\/a>/g;
  let m;
  while ((m = are.exec(scope)) !== null) {
    const tag = m[0];
    const hrefM = tag.match(/href="([^"]+)"/);
    if (!hrefM) continue;
    const href = fix(hrefM[1]);
    if (href.indexOf('/video/' + id + '/') === -1 && href.indexOf('/detail/' + id + '/') === -1) continue;

    let ep = '';
    const eidM = tag.match(/data-ep-id="([^"]*)"/);
    if (eidM && eidM[1]) ep = eidM[1];
    if (!ep) {
      const p = href.match(/\/ep-(\d+)\/?/);
      if (p) ep = p[1];
    }
    if (!ep) {
      const tx = stripTags(tag).match(/(\d+)/);
      if (tx) ep = String(parseInt(tx[1], 10));
    }
    if (!ep) ep = '1';
    if (seen[ep]) continue;
    seen[ep] = true;
    eps.push({ ep: ep, url: href });
  }

  // If the grid selector changed, search the full page for /video/ID/ep-N/ links.
  const vre = new RegExp('href="([^"]*/video/' + id + '/(?:ep-(\\d+)/)?)"', 'g');
  while ((m = vre.exec(html)) !== null) {
    const ep = m[2] || '1';
    if (seen[ep]) continue;
    seen[ep] = true;
    eps.push({ ep: ep, url: fix(m[1]) });
  }

  if (!eps.length) eps.push({ ep: '1', url: SITE + '/video/' + id + '/' });
  eps.sort(function (a, b) { return parseInt(a.ep, 10) - parseInt(b.ep, 10); });
  return eps;
}

function normalizePlayUrl(u) {
  if (!u) return '';
  u = String(u)
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .trim();
  if (u.indexOf('//') === 0) u = 'https:' + u;
  if (u.indexOf('/') === 0) u = SITE + u;
  return u;
}

function extractPlay(html, ep) {
  let play = '';
  const m = html.match(/id=["']videoInitialData["'][^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    try {
      const data = JSON.parse(m[1]);
      const srcs = data && data.epPlaySrcs ? data.epPlaySrcs : {};
      play = srcs[String(ep || '1')] || (data && data.videoSrc) || '';
    } catch (e) {}
  }

  play = normalizePlayUrl(play);

  if (!/^https?:\/\//i.test(play)) {
    const direct = html.match(/https?:\\?\/\\?\/[^"]+?\.m3u8(?:\?[^"'<>\s]*)?/i) ||
                   html.match(/https?:\/\/[^"'<>\s]+?\.m3u8(?:\?[^"'<>\s]*)?/i);
    if (direct) play = normalizePlayUrl(direct[0]);
  }
  return play;
}

export default {
  init(ext) {
    this.ext = ext || {};
  },

  home(filter) {
    return JSON.stringify({ class: CLASSES });
  },

  homeVod() {
    try {
      const html = getHtml(SITE + '/');
      return JSON.stringify({ list: parseGridCards(html, true) });
    } catch (e) {
      return JSON.stringify({ list: [] });
    }
  },

  category(tid, pg, filter, extend) {
    const page = Math.max(1, parseInt(pg || '1', 10) || 1);
    try {
      let url;
      if (tid === 'home') {
        url = SITE + '/';
      } else {
        const id = String(tid || '').replace(/^\/+|\/+$/g, '');
        url = SITE + '/' + id + '/' + (page > 1 ? page + '/' : '');
      }
      const html = getHtml(url);
      const list = String(tid).indexOf('rank') !== -1 ? parseRanks(html) : parseGridCards(html, false);
      return JSON.stringify({
        list: list,
        page: page,
        pagecount: list.length ? page + 1 : page,
        limit: list.length || 20,
        total: list.length ? (page + 1) * (list.length || 20) : page * 20
      });
    } catch (e) {
      return JSON.stringify({ list: [], page: page, pagecount: page });
    }
  },

  detail(id) {
    id = String(id || '').trim();
    if (!id) return JSON.stringify({ list: [] });
    try {
      const url = SITE + '/video/' + id + '/';
      const html = getHtml(url, SITE + '/');
      const eps = parseEpisodes(html, id);
      const playList = [];
      for (let i = 0; i < eps.length; i++) {
        const ep = eps[i];
        const name = '第' + ep.ep + '集';
        // Pass exact episode page URL + episode number to play().
        playList.push(name + '$' + ep.url + '|||' + ep.ep);
      }

      const vod = {
        vod_id: id,
        vod_name: parseTitle(html, id),
        vod_pic: parsePic(html),
        vod_play_from: '黄果',
        vod_play_url: playList.join('#')
      };
      return JSON.stringify({ list: [vod] });
    } catch (e) {
      return JSON.stringify({ list: [] });
    }
  },

  search(wd, quick, pg) {
    const key = String(wd || '').trim();
    const page = Math.max(1, parseInt(pg || '1', 10) || 1);
    if (!key) return JSON.stringify({ list: [], page: page, pagecount: page });
    try {
      let url = SITE + '/search/video/' + encodeURIComponent(key) + '/';
      if (page > 1) url += page + '/';
      const html = getHtml(url, SITE + '/');
      const list = parseGridCards(html, false);
      return JSON.stringify({
        list: list,
        page: page,
        pagecount: list.length ? page + 1 : page,
        limit: list.length || 20,
        total: list.length ? (page + 1) * (list.length || 20) : page * 20
      });
    } catch (e) {
      return JSON.stringify({ list: [], page: page, pagecount: page });
    }
  },

  play(flag, id, vipFlags) {
    try {
      const raw = String(id || '');
      const parts = raw.split('|||');
      const pageUrl = fix(parts[0]);
      const ep = parts.length > 1 ? parts[1] : '1';
      if (!pageUrl) return JSON.stringify({ parse: 0, url: '' });

      const html = getHtml(pageUrl, SITE + '/');
      const play = extractPlay(html, ep);
      if (!play) return JSON.stringify({ parse: 0, url: '' });

      return JSON.stringify({
        parse: 0,
        url: play,
        header: {
          'User-Agent': UA,
          'Referer': SITE + '/'
        }
      });
    } catch (e) {
      return JSON.stringify({ parse: 0, url: '' });
    }
  }
};
