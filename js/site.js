
const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const s5 = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const seno = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
const rampa = (p, a, b) => clamp((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const setVar = (el, k, v) => { if (!el) return; const m = el.__v || (el.__v = {}); if (m[k] === v) return; m[k] = v; el.style.setProperty(k, v); };

const SEM = new Set((new URLSearchParams(location.search).get('sem') || '').split(',').filter(Boolean));
if (SEM.has('mascara')) document.documentElement.classList.add('sem-mascara');
if (SEM.has('vidro')) document.documentElement.classList.add('sem-vidro');
const estado = {
  tema: html.getAttribute('data-tema') || 'claro',
  perfil: html.getAttribute('data-perfil') || 'forte',
  reduzido: html.getAttribute('data-movimento') === 'reduzido',
  P: 0, cenaAtiva: 1, p: {}, scrollY: 0, vh: innerHeight,
  manifesto: null, portaoAberto: false,
};
const NOMES = { 1: 'O rio sem prova', 2: 'A medição', 3: 'A regra', 4: 'O pagamento chega', 5: 'A prova pública', 6: 'O piloto', 7: 'Experimente' };
const TEMAS_CLARO = { fundo: [0xdf, 0xe9, 0xe8] }, TEMAS_ESCURO = { fundo: [0x0b, 0x2b, 0x30] };


function aplicarTema(t, animar = true) {
  if (t === estado.tema) return;
  estado.tema = t; html.setAttribute('data-tema', t);
  try { localStorage.setItem('wata.site.tema', t); } catch (e) {  }
  $$('[data-tema]', $('.nav')).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === t)));
  $$('img[data-icone]').forEach(i => { i.src = `assets/icones/vidro/${t}/96/${i.dataset.icone}.svg`; });
  $$('img[data-logo]').forEach(i => { i.src = t === 'escuro' ? 'assets/logo/wata-horizontal-vidro-negativo.svg' : 'assets/logo/wata-horizontal-vidro.svg'; });
  mundo.trocarTema();
}
$$('[data-tema]', $('.nav')).forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.tema === estado.tema)); b.addEventListener('click', () => aplicarTema(b.dataset.tema)); });
$$('img[data-icone]').forEach(i => { i.src = `assets/icones/vidro/${estado.tema}/96/${i.dataset.icone}.svg`; });
$$('img[data-logo]').forEach(i => { i.src = estado.tema === 'escuro' ? 'assets/logo/wata-horizontal-vidro-negativo.svg' : 'assets/logo/wata-horizontal-vidro.svg'; });
const btnMov = $('#btn-movimento');
btnMov.setAttribute('aria-pressed', String(estado.reduzido));
const btnMov2 = $('#btn-movimento-rodape'); if (btnMov2) { btnMov2.textContent = estado.reduzido ? 'Ver com animação' : 'Ver sem animação'; btnMov2.addEventListener('click', () => btnMov.click()); }
btnMov.addEventListener('click', () => {
  const novo = !estado.reduzido;
  try { localStorage.setItem('wata.site.movimento', novo ? 'reduzido' : 'completo'); } catch (e) {  }
  location.reload();
});


const cenas = $$('.cena').map(sec => ({ el: sec, n: +sec.dataset.cena, pin: +sec.dataset.pin, portao: sec.dataset.portao ? +sec.dataset.portao : null, top: 0, altura: 0, percurso: 0 }));
function medir() {
  estado.vh = innerHeight;
  cenas.forEach(c => {
    c.el.style.height = estado.reduzido ? '' : `${c.pin}vh`;
    const r = c.el.getBoundingClientRect(); c.top = r.top + scrollY; c.altura = r.height; c.percurso = Math.max(1, c.altura - estado.vh);
  });
  mundo.redimensionar();
}


const regua = (() => { const ind = $('#indicador i'); return { atualizar(P) { ind.style.width = `${P * 100}%`; } }; })();


const mundo = (() => {
  const cv = $('#mundo'); const ctx = cv.getContext('2d', { alpha: false, desynchronized: true });
  const cache = new Map();
  let res = 1280, dpr = 1, W = 0, H = 0, ultimo = null; let antigo = null, antigoT0 = 0;
  const FOCO = { 1: [.68, .5], 2: [.62, .55], 3: [.66, .5], 4: [.55, .5], 5: [.62, .55], 6: [.5, .6], 7: [.6, .45] };
  const FOCO_RETRATO = { 1: [.72, .5], 2: [.6, .5], 3: [.6, .5], 4: [.82, .45], 5: [.62, .5], 6: [.5, .6], 7: [.62, .4] };
  function escolherRes() {
    const larg = innerWidth * Math.min(devicePixelRatio || 1, 2);
    if (estado.perfil === 'leve') return 960;
    return larg > 1100 ? 1280 : 960;
  }
  function redimensionar() {
    const r = escolherRes(); if (r !== res) { res = r; }
    const alvoW = Math.min(innerWidth * Math.min(devicePixelRatio || 1, 2), res); dpr = alvoW / innerWidth;
    W = Math.round(innerWidth * dpr); H = Math.round(innerHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    desenhar(true);
  }
  function chave(cena, tema = estado.tema) { return `${cena}-${tema}-${res}`; }
  function info(cena) { const m = estado.manifesto; return m && m.cenas && m.cenas[cena]; }
  async function carregar(cena, tema = estado.tema) {
    const k = chave(cena, tema); if (cache.has(k)) return cache.get(k);
    const inf = info(cena); const ent = { quadros: [], n: 0, pronto: false, cena, tema };
    cache.set(k, ent);
    const m = estado.manifesto; const reserva = m && m.reserva && m.reserva[cena] && m.reserva[cena][tema];
    if (!inf || !inf.temas.includes(tema)) {
      const img = reserva ? await carregarImagem(`assets/seq/${reserva.replace('{res}', res)}`) : null; if (img) { ent.quadros = [img]; ent.n = 1; } ent.pronto = true; if (cache.get(k) === ent) desenhar(); return ent;
    }
    const n = inf.n; ent.n = n; ent.quadros = new Array(n).fill(null);
    const ordem = [];
    for (const i of [0, n - 1, Math.floor(n / 2)]) if (!ordem.includes(i)) ordem.push(i);
    for (let i = 0; i < n; i++) if (!ordem.includes(i)) ordem.push(i);
    const base = `assets/seq/c${cena}/${tema}/${res}/`;
    let ativos = 0; const fila = [...ordem];
    await new Promise(resolve => {
      const prox = () => {
        if (!fila.length) { if (!ativos) resolve(); return; }
        if (ativos >= 4) return;
        const i = fila.shift(); ativos++;
        carregarImagem(`${base}q${String(i).padStart(3, '0')}.webp`).then(img => { ent.quadros[i] = img; ativos--; if (cache.get(k) === ent) desenhar(); prox(); prox(); });
      };
      prox(); prox(); prox(); prox();
    });
    ent.pronto = true; podar(); return ent;
  }
  function carregarImagem(src) {
    return new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = () => { if ('createImageBitmap' in window) createImageBitmap(im).then(res, () => res(im)); else res(im); }; im.onerror = () => res(null); im.src = src; });
  }
  function podar() {
    const vivas = [estado.cenaAtiva - 1, estado.cenaAtiva, estado.cenaAtiva + 1].map(c => chave(c));
    for (const [k, ent] of cache) if (!vivas.includes(k) && ent.pronto) { ent.quadros.forEach(q => q && q.close && q.close()); cache.delete(k); }
  }
  function quadroEm(ent, p) {
    if (!ent || !ent.n) return null;
    const f = p * (ent.n - 1); let i = Math.floor(f), t = f - i;
    const acha = (j, dir) => { for (let k = 0; k < ent.n; k++) { const jj = j + k * dir; if (jj >= 0 && jj < ent.n && ent.quadros[jj]) return jj; } return -1; };
    const a = acha(i, -1), b = acha(i + 1, 1);
    if (a < 0 && b < 0) return null;
    if (a < 0) return [ent.quadros[b], null, 0];
    if (b < 0 || a === b) return [ent.quadros[a], null, 0];
    const mist = (f - a) / (b - a); return [ent.quadros[a], ent.quadros[b], clamp(mist)];
  }
  function cobrir(img, foco) {
    const iw = img.width, ih = img.height, s = Math.max(W / iw, H / ih); const dw = iw * s, dh = ih * s;
    const dx = clamp((W - dw) * foco[0] / Math.max(1e-6, 1) , W - dw, 0), dy = clamp((H - dh) * foco[1], H - dh, 0);
    return [dx, dy, dw, dh];
  }
  function desenharQuadro(ent, p, alpha, cena) {
    const q = quadroEm(ent, p); if (!q) return false;
    const [a, b, t] = q; const foco = (innerHeight > innerWidth ? FOCO_RETRATO[cena] : FOCO[cena]) || [.5, .5];
    ctx.globalAlpha = alpha; ctx.drawImage(a, ...cobrir(a, foco));
    if (b && t > 0.02) { ctx.globalAlpha = alpha * t; ctx.drawImage(b, ...cobrir(b, foco)); }
    ctx.globalAlpha = 1; return true;
  }
  let pedido = false, ultimaChave = '';
  function desenhar(forca = false) {
    if (SEM.has('mundo')) return;
    if (!forca) { const ent = cache.get(chave(estado.cenaAtiva)); const p = estado.p[estado.cenaAtiva] ?? 0; const n = ent ? ent.n : 1; const k = `${estado.cenaAtiva}:${Math.round(p * (n - 1) * 32)}:${p > 0.9 ? Math.round(p * 200) : 0}:${estado.tema}`; if (k === ultimaChave && !antigo) return; ultimaChave = k; }
    if (pedido && !forca) return; pedido = true;
    requestAnimationFrame(() => {
      pedido = false;
      const ativa = estado.cenaAtiva; const p = estado.p[ativa] ?? 0;
      const ent = cache.get(chave(ativa));
      const fundo = estado.tema === 'escuro' ? TEMAS_ESCURO.fundo : TEMAS_CLARO.fundo;
      ctx.fillStyle = `rgb(${fundo.join(',')})`;
      const desenhou = !!(ent && desenharQuadro(ent, p, 1, ativa)); if (!desenhou) { ctx.fillRect(0, 0, W, H); ultimaChave = ''; }
      if (p > 0.9 && ativa < 7) { const prox = cache.get(chave(ativa + 1)); if (prox) desenharQuadro(prox, 0, s5((p - 0.9) / 0.1), ativa + 1); }
      if (antigo) { const t = (performance.now() - antigoT0) / 480; if (t < 1) { ctx.globalAlpha = 1 - s5(t); ctx.drawImage(antigo, 0, 0, W, H); ctx.globalAlpha = 1; requestAnimationFrame(() => desenhar(true)); } else antigo = null; }
      ultimo = { ativa, p };
      vivo.quadroPronto();
    });
  }
  async function preparar(ativa) {
    carregar(ativa); if (ativa < 7) carregar(ativa + 1); if (ativa > 1) carregar(ativa - 1);
  }
  function trocarTema() { if (!estado.reduzido && W && H) { antigo = document.createElement('canvas'); antigo.width = W; antigo.height = H; antigo.getContext('2d').drawImage(cv, 0, 0); antigoT0 = performance.now(); } cache.forEach(ent => ent.quadros.forEach(q => q && q.close && q.close())); cache.clear(); preparar(estado.cenaAtiva); desenhar(true); }
  async function quadroFinal(cena, tema) {
    const inf = info(cena); const m = estado.manifesto; const reserva = m && m.reserva && m.reserva[cena] && m.reserva[cena][tema];
    if (inf && inf.temas.includes(tema)) return `assets/seq/c${cena}/${tema}/${res}/q${String(inf.n - 1).padStart(3, '0')}.webp`;
    return reserva ? `assets/seq/${reserva.replace('{res}', res)}` : '';
  }
  return { cv, ctx, redimensionar, desenhar, preparar, trocarTema, quadroFinal, get res() { return res; }, get dpr() { return dpr; } };
})();


const vivo = (() => {
  const cv = $('#vivo'); let gl = null, prog = null, tex = null, buf = null, ativo = false, toques = [], particulas = null, raf = 0, ultimoTex = -1;
  const MAXT = 3;
  function iniciar() {
    if (estado.reduzido) return false;
    gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return false;
    const vs = `attribute vec2 a; varying vec2 v; void main(){ v = a*0.5+0.5; v.y = 1.0-v.y; gl_Position = vec4(a,0.0,1.0); }`;
    const fs = `precision mediump float; varying vec2 v; uniform sampler2D t; uniform vec2 res; uniform float dark; uniform vec3 toq[${MAXT}]; uniform float idade[${MAXT}]; uniform int n;
      float s5(float x){ x=clamp(x,0.0,1.0); return x*x*x*(x*(x*6.0-15.0)+10.0); }
      void main(){
        float asp = res.x/res.y; vec2 uv = v; vec2 off = vec2(0.0); float clar = 0.0; float brilho = 0.0;
        for(int i=0;i<${MAXT};i++){ if(i>=n) break; vec3 q = toq[i]; float a = idade[i];
          vec2 d2 = (uv - q.xy) * vec2(asp,1.0); float d = length(d2); float r = q.z * (0.25 + 0.75*s5(a*1.6));
          float vida = 1.0 - s5(a);
          for(int k=0;k<3;k++){ float rk = r*(1.0 + 0.28*float(k)); float w = 0.012 + 0.01*float(k); float x = (d - rk)/w; float g = exp(-x*x);
            off += normalize(d2 + 1e-5) * g * 0.012 * vida * (1.0 - 0.3*float(k)) / vec2(asp,1.0); brilho += g * 0.10 * vida * (1.0-0.25*float(k)); }
          float dentro = 1.0 - s5((d - r*0.55)/(r*0.45)); clar = max(clar, dentro * vida);
        }
        vec3 c = texture2D(t, uv + off).rgb;
        vec3 fogC = dark > 0.5 ? vec3(0.10,0.17,0.17) : vec3(0.74,0.69,0.55);
        vec3 claroC = dark > 0.5 ? vec3(0.06,0.23,0.26) : vec3(0.93,0.96,0.95);
        vec3 des = (c - fogC*0.55) / 0.45; des = mix(des, claroC, 0.45);
        if(dark > 0.5){ des = c*1.25 + vec3(0.03,0.09,0.10); }
        c = mix(c, clamp(des,0.0,1.0), clar*0.95);
        c += brilho * (dark>0.5 ? vec3(0.4,0.7,0.8) : vec3(1.0));
        float alpha = clamp(clar*1.0 + brilho*2.0 + length(off)*40.0, 0.0, 1.0);
        gl_FragColor = vec4(c*alpha, alpha);
      }`;
    const sh = (tp, src) => { const s = gl.createShader(tp); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.BLEND);
    return true;
  }
  function redimensionar() { const s = estado.perfil === 'leve' ? 0.5 : 1; cv.width = Math.round(innerWidth * s); cv.height = Math.round(innerHeight * s); if (gl) gl.viewport(0, 0, cv.width, cv.height); }
  function tocar(x, y) {
    if (!gl && !iniciar()) return; if (!gl) return;
    const raio = 0.17 * (innerHeight / innerWidth) * (innerWidth / innerHeight);
    toques.push({ x, y, r: 0.17, t0: performance.now() }); if (toques.length > MAXT) toques.shift();
    if (!ativo) { ativo = true; cv.style.opacity = '1'; passo(); }
    const dica = $('#dica-1'); if (dica) dica.dataset.tocou = '1';
  }
  function passo() {
    const agora = performance.now(); toques = toques.filter(t => agora - t.t0 < 2400);
    if (!toques.length) { ativo = false; gl.clear(gl.COLOR_BUFFER_BIT); return; }
    desenhar(agora); raf = requestAnimationFrame(passo);
  }
  function quadroPronto() { ultimoTex = -1; }
  function desenhar(agora) {
    gl.useProgram(prog);
    if (ultimoTex !== estado.P) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, mundo.cv); ultimoTex = estado.P; }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); const a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(prog, 'res'), cv.width, cv.height); gl.uniform1f(gl.getUniformLocation(prog, 'dark'), estado.tema === 'escuro' ? 1 : 0);
    const tq = new Float32Array(MAXT * 3), id = new Float32Array(MAXT);
    toques.forEach((t, i) => { tq[i * 3] = t.x; tq[i * 3 + 1] = t.y; tq[i * 3 + 2] = t.r; id[i] = (agora - t.t0) / 2400; });
    gl.uniform3fv(gl.getUniformLocation(prog, 'toq'), tq); gl.uniform1fv(gl.getUniformLocation(prog, 'idade'), id); gl.uniform1i(gl.getUniformLocation(prog, 'n'), toques.length);
    gl.uniform1i(gl.getUniformLocation(prog, 't'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function aquecer() { if (!gl && !estado.reduzido) { try { iniciar(); } catch (e) { gl = null; } } }
  return { tocar, redimensionar, quadroPronto, aquecer, get estado() { return { ativo, n: toques.length, gl: !!gl, link: gl && prog ? gl.getProgramParameter(prog, gl.LINK_STATUS) : null, log: gl && prog ? gl.getProgramInfoLog(prog) : null, vp: gl ? Array.from(gl.getParameter(gl.VIEWPORT)) : null, err: gl ? gl.getError() : null, toq: toques.map(t => [t.x, t.y, t.r]) }; } };
})();


const particulas = (() => {
  if (estado.reduzido || estado.perfil !== 'forte' || SEM.has('particulas')) return { passo() {} };
  const cv = document.createElement('canvas'); cv.id = 'particulas'; cv.setAttribute('aria-hidden', 'true'); $('#palco').insertBefore(cv, $('#vivo'));
  const ctx = cv.getContext('2d', { alpha: true }); let W = 0, H = 0; const N = 140; const ps = [];
  let semente = 7; const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
  for (let i = 0; i < N; i++) ps.push({ x: rnd(), y: rnd(), z: 0.3 + rnd() * 0.7, r: 0.6 + rnd() * 2.2, f: rnd() * 6.28, v: 0.004 + rnd() * 0.01 });
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32; const g = sprite.getContext('2d'); const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.45, 'rgba(255,255,255,.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  function redimensionar() { W = cv.width = Math.round(innerWidth / 2); H = cv.height = Math.round(innerHeight / 2); }
  redimensionar(); addEventListener('resize', redimensionar);
  let ultimo = performance.now(); let zonas = [];
  function zonasCalmas() { const sec = document.getElementById(`cena-${estado.cenaAtiva}`); zonas = sec ? [...sec.querySelectorAll('.bloco, .gesto, .grade, .parametros, .marcas, .hash')].map(e => e.getBoundingClientRect()).filter(r => r.width && r.height).map(r => ({ x: r.left / innerWidth, y: r.top / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight })) : []; }
  setInterval(zonasCalmas, 400);
  function passo() {
    const agora = performance.now(); const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
    const P = estado.P; const ato = P < 0.3 ? 0 : P < 0.6 ? 1 : 2; const escuro = estado.tema === 'escuro';
    const cor = ato === 0 ? (escuro ? '#9a8d6a' : '#8a7a52') : (escuro ? '#bfeeff' : '#ffffff'); const alfa = ato === 0 ? 0.34 : ato === 1 ? 0.22 : 0.3;
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = escuro ? 'screen' : 'source-over';
    for (const p of ps) {
      p.y -= p.v * dt * (ato === 0 ? 0.6 : 1.4) * p.z; p.x += Math.sin(agora / 2400 + p.f) * 0.00025 * p.z; if (p.y < -0.05) p.y = 1.05; if (p.x < -0.05) p.x = 1.05; if (p.x > 1.05) p.x = -0.05;
      const yy = (p.y + P * 0.35 * p.z) % 1.1 - 0.05; const xx = p.x;
      let calma = 1; for (const z of zonas) { const dx = Math.max(z.x - xx, 0, xx - (z.x + z.w)), dy = Math.max(z.y - yy, 0, yy - (z.y + z.h)); const d = Math.hypot(dx * innerWidth, dy * innerHeight); if (d < 90) calma = Math.min(calma, d / 90); }
      if (calma <= 0.02) continue;
      const s = p.r * p.z * (ato === 0 ? 2.2 : 1.4); ctx.globalAlpha = alfa * calma * (0.5 + 0.5 * Math.sin(agora / 900 + p.f) ** 2);
      ctx.drawImage(sprite, xx * W - s, yy * H - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = cor; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
  }
  (function laco() { passo(); requestAnimationFrame(laco); })();
  return { passo };
})();


(() => {
  const btn = $('#toque-agua'); if (!btn) return;
  let down = null;
  btn.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  btn.addEventListener('pointerup', e => { if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; if (dx * dx + dy * dy <= 64) { const t0 = performance.now(); vivo.tocar(e.clientX / innerWidth, e.clientY / innerHeight); requestAnimationFrame(() => { btn.dataset.latencia = String(Math.round(performance.now() - t0)); }); } down = null; });
  btn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); const t0 = performance.now(); vivo.tocar(0.62, 0.52); requestAnimationFrame(() => { btn.dataset.latencia = String(Math.round(performance.now() - t0)); }); } });
})();


const gesto = (() => {
  const box = $('#gesto'), anel = $('#anel'), valor = $('#anel-valor'), nota = $('.nota', anel), reserva = $('#btn-liberar'), c4 = cenas.find(c => c.n === 4);
  const CIRC = 2 * Math.PI * 60; let v = 0, segurando = false, raf = 0, ultimo = 0, tentativas = 0, timerReserva = 0;
  function mostrar(n) { v = clamp(n, 0, 70); nota.style.strokeDashoffset = String(CIRC - CIRC * (v / 100)); valor.textContent = String(Math.round(v)); anel.setAttribute('aria-valuenow', String(Math.round(v))); }
  function tick(t) { const dt = Math.min(250, t - ultimo) / 1000; ultimo = t;
    if (segurando) v += 70 / 1.6 * dt; else v -= 70 / 0.4 * dt;
    mostrar(v);
    if (v >= 70 && !estado.portaoAberto) { travar(); return; }
    if (v <= 0 && !segurando) { mostrar(0); return; }
    raf = requestAnimationFrame(tick); }
  function comecar() { if (estado.portaoAberto) return; segurando = true; ultimo = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
  function soltar() { segurando = false; }
  function travar() { estado.portaoAberto = true; mostrar(70); anel.dataset.travado = 'true'; anel.setAttribute('aria-label', 'Nota mínima atingida: pagamento liberado'); $('#gesto-dica').textContent = 'Nota mínima atingida. O pagamento desce. Role para continuar.'; box.dataset.reserva = 'false'; clearTimeout(timerReserva); document.dispatchEvent(new CustomEvent('wata:portao')); }
  if (estado.reduzido) { mostrar(70); anel.dataset.travado = 'true'; estado.portaoAberto = true; $('#gesto-dica').textContent = 'Nota mínima atingida: 70. O pagamento desce para quem cuidou.'; anel.disabled = true; return { aoTentar() {} }; }
  const alvo = c4.el.querySelector('.fixo');
  for (const el of [anel, alvo]) {
    el.addEventListener('pointerdown', e => { if (e.target.closest('.bloco, .estado, .reserva, a')) return; if (el === alvo && !c4.ativaAgora) return; e.preventDefault(); el.setPointerCapture && el !== alvo && el.setPointerCapture(e.pointerId); comecar(); });
    el.addEventListener('pointerup', soltar); el.addEventListener('pointercancel', soltar); el.addEventListener('pointerleave', e => { if (el === anel) soltar(); });
  }
  anel.addEventListener('contextmenu', e => e.preventDefault());
  anel.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !segurando) { e.preventDefault(); comecar(); } });
  anel.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') soltar(); });
  reserva.addEventListener('click', () => { segurando = false; travar(); });
  function mostrarReserva() { if (!estado.portaoAberto) box.dataset.reserva = 'true'; }
  return {
    aoTentar() { tentativas++; if (tentativas >= 3) mostrarReserva(); if (!timerReserva) timerReserva = setTimeout(mostrarReserva, 6000); },
  };
})();


const hash = (() => { const el = $('#hash .chars'); if (!el) return null; const h = el.dataset.hash; const a = h.slice(0, 56), b = h.slice(56);
  el.innerHTML = a.split('').map(c => `<span class="c">${c}</span>`).join('') + `<span class="lupa vidro">${b.split('').map(c => `<span class="c">${c}</span>`).join('')}</span>`;
  const spans = $$('.c', el); return { atualizar(p) { const k = Math.floor(rampa(p, 0.2, 0.6) * spans.length); spans.forEach((s, i) => s.classList.toggle('on', i < k)); } }; })();
const grade = (() => { const cels = $$('#grade .c');
  return { atualizar(p) { const acesos = Math.floor(rampa(p, 0.06, 0.62) * 19.99); cels.forEach(c => { const i = +c.dataset.i; setVar(c, '--o', i < acesos ? '1' : '0'); }); } }; })();
const marcas = (() => { const ms = $$('.marcas .m'); const barra = $('#nota-barra');
  return { atualizar(p) { ms.forEach(m => setVar(m, '--o', p >= +m.dataset.p ? '1' : '0')); const f = s5(rampa(p, 0.15, 0.85)) * 0.96 * 500; barra.setAttribute('y', 510 - f); barra.setAttribute('height', f); } }; })();


function textoHero(c, p) {
  const a = c.q.a, b = c.q.b;
  if (a && b) { const va = clamp(1.15 - 2.6 * p), vb = clamp((p - 0.40) * 4.2); setVar(a, 'opacity', va.toFixed(3)); setVar(b, 'opacity', vb.toFixed(3)); a.setAttribute('aria-hidden', String(vb > 0.5)); b.setAttribute('aria-hidden', String(vb <= 0.5)); }
}
function aplicarCena(c, p) {
  const sec = c.el; if (!c.q) c.q = { bloco: $('.bloco', sec), estado: $('.estado', sec), dataP: $$('[data-p]', sec).filter(el => !el.classList.contains('m')), gesto: $('#gesto'), dica: $('#dica-1'), a: $('[data-manchete="a"]', sec), b: $('[data-manchete="b"]', sec) };
  const bloco = c.q.bloco, estadoEl = c.q.estado;
  if (c.ultimoP === p) return; c.ultimoP = p;
  let v = 1, m = 140;
  if (c.n === 1) { textoHero(c, p); const dica = c.q.dica; if (dica) setVar(dica, 'opacity', (clamp(1 - rampa(p, 0.04, 0.08)) * (dica.dataset.tocou ? 0.6 : 1)).toFixed(3)); m = p > 0.88 ? lerp(140, 10, s5((p - 0.88) / 0.12)) : 140; }
  else if (c.n === 4) { v = (p > 0.6 && p < 0.8) ? 1 - s5(rampa(p, 0.6, 0.64)) * (1 - s5(rampa(p, 0.76, 0.8))) : 1; m = p > 0.9 ? lerp(140, 10, s5((p - 0.9) / 0.1)) : 140; setVar(c.q.gesto, '--v', clamp(1 - rampa(p, 0.66, 0.8)).toFixed(3)); }
  else if (c.n === 7) { v = s5(rampa(p, 0.05, 0.25)); }
  else { v = s5(rampa(p, 0.03, 0.14)); m = p > 0.88 ? lerp(140, 10, s5((p - 0.88) / 0.12)) : 140; }
  if (bloco) { setVar(bloco, '--v', v.toFixed(3)); setVar(bloco, '--m', `${m.toFixed(1)}%`); setVar(bloco, '--py', `${((0.5 - p) * 56).toFixed(1)}px`); }
  if (!c.q.vidros) c.q.vidros = $$('.gesto, .parametros, .marcas, .grade, .hash', sec);
  const pg = `${((0.5 - p) * 96).toFixed(1)}px`; c.q.vidros.forEach(el => setVar(el, '--pg', pg));
  c.q.dataP.forEach(el => { setVar(el, '--b', p >= +el.dataset.p ? '1' : '0.18'); });
  if (c.n === 3) marcas.atualizar(p);
  if (c.n === 5 && hash) hash.atualizar(p);
  if (c.n === 6) grade.atualizar(p);
}


let ultimaRolagem = 0, portaoY = 0, tentativasPortao = 0;
function aoRolar() {
  const t0 = performance.now();
  const y = scrollY; estado.scrollY = y;
  let ativa = 1, Pacum = 0, total = 0;
  cenas.forEach(c => { const p = clamp((y - c.top) / c.percurso); estado.p[c.n] = p; c.ativaAgora = y >= c.top - estado.vh * 0.5 && y < c.top + c.altura - estado.vh * 0.5; if (y >= c.top - 1) ativa = c.n; total += c.percurso; });
  const c4 = cenas.find(c => c.n === 4);
  if (c4 && !estado.reduzido && !estado.portaoAberto) { portaoY = c4.top + c4.portao * c4.percurso; if (y > portaoY + 2) { scrollTo({ top: portaoY, behavior: 'instant' }); estado.p[4] = c4.portao; gesto.aoTentar(); } }
  let acum = 0; cenas.forEach(c => { acum += estado.p[c.n] * c.percurso; }); estado.P = clamp(acum / total);
  if (ativa !== estado.cenaAtiva) { estado.cenaAtiva = ativa; mundo.preparar(ativa); }
  cenas.forEach(c => { if (Math.abs(c.n - ativa) <= 1) aplicarCena(c, estado.p[c.n]); });
  regua.atualizar(estado.P, ativa);
  mundo.desenhar();
  (estado.medidas ||= []).push(performance.now() - t0); if (estado.medidas.length > 2000) estado.medidas.shift();
}


async function modoEstatico() {
  for (const c of cenas) { const src = await mundo.quadroFinal(c.n, estado.tema); $('.fixo', c.el).style.background = `url(${src}) center/cover no-repeat`; aplicarCena(c, 1); }
  $('#palco').style.display = 'none';
}


async function iniciar() {
  try { const r = await fetch('assets/seq/manifesto.json', { cache: 'force-cache' }); if (r.ok) estado.manifesto = await r.json(); } catch (e) { estado.manifesto = null; }
  medir();
  if (estado.reduzido) { await modoEstatico(); regua.atualizar(0); addEventListener('scroll', () => { regua.atualizar(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)); }, { passive: true }); return; }
  vivo.redimensionar();
  if ('requestIdleCallback' in window) requestIdleCallback(() => vivo.aquecer(), { timeout: 1200 }); else setTimeout(() => vivo.aquecer(), 1200);
  mundo.preparar(1);
  aoRolar();
  let agendado = false;
  addEventListener('scroll', () => { if (agendado) return; agendado = true; requestAnimationFrame(() => { agendado = false; aoRolar(); }); }, { passive: true });
  addEventListener('resize', () => { medir(); vivo.redimensionar(); aoRolar(); });
  document.addEventListener('wata:portao', () => { aoRolar(); });
  $$('.nav a[href^="#"], footer a[href^="#"], .botao[href^="#"]').forEach(a => a.addEventListener('click', e => { const alvo = document.getElementById(a.getAttribute('href').slice(1)); if (!alvo) return; e.preventDefault(); const c = cenas.find(x => x.el === alvo); const y = c ? c.top + (c.n === 1 ? 0 : c.percurso * 0.06) : alvo.getBoundingClientRect().top + scrollY - 100; scrollTo({ top: y, behavior: estado.reduzido ? 'auto' : 'smooth' }); alvo.setAttribute('tabindex', '-1'); alvo.focus({ preventScroll: true }); }));
}
iniciar();
window.__wata = estado; window.__vivo = vivo; Object.defineProperty(estado, 'resMundo', { get: () => mundo.res });
