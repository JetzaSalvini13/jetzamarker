(async ()=> {
  const u = 'JetzaSalvini13';
  const headers = { 'User-Agent': 'node', 'Accept': 'application/vnd.github.v3+json' };
  try {
    const res = await fetch(`https://api.github.com/users/${u}/repos?sort=updated&per_page=5`, { headers });
    console.log('GitHub API status:', res.status);
    const repos = await res.json();
    if (!Array.isArray(repos)) { console.error('No repos array', repos); process.exit(1); }
    for (const r of repos) {
      const name = r.name || '<no-name>';
      const html = r.html_url || '<no-url>';
      const thumb = `https://opengraph.githubassets.com/1/${u}/${name}`;
      let ok = false;
      try { const h = await fetch(thumb, { method: 'GET' }); ok = h.status === 200; } catch (e) { ok = false; }
      console.log(`${name} | ${html} | thumb: ${thumb} | thumbOK: ${ok}`);
    }
  } catch (e) { console.error('ERROR', e); process.exit(1); }
})();
