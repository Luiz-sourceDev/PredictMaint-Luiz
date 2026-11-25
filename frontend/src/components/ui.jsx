'use client';
import { useCallback, useContext, createContext, useEffect, useRef, useState } from 'react';
import { NOMES, num } from '@/lib/util';

/* ---------- pecinhas ---------- */
export const Badge = ({ k, children }) => <span className={`pm-b pm-b-${k}`}>{children ?? NOMES[k] ?? k}</span>;
export const SaudeBar = ({ v }) => <div className="pm-health"><div className="pm-bar"><i style={{ width: v + '%' }} /></div><span>{v}%</span></div>;
export const Vazio = ({ titulo, sub, children }) => <div className="pm-empty"><strong>{titulo}</strong>{sub && <span className="d-block">{sub}</span>}{children && <div className="pm-empty-acao">{children}</div>}</div>;
export const Mini = ({ rotulo, valor }) => <div className="pm-mini"><span className="pm-lbl">{rotulo}</span><b>{valor}</b></div>;

/* ---------- carregamento de dados ---------- */
export function useLoad(fn, deps = []) {
  const [s, setS] = useState({ data: null, erro: null, carregando: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    setS(x => ({ ...x, erro: null, carregando: true }));
    try { const data = await fn(); setS({ data, erro: null, carregando: false }); }
    catch (e) { setS({ data: null, erro: e.message, carregando: false }); }
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...s, recarregar: run, setData: d => setS(x => ({ ...x, data: typeof d === 'function' ? d(x.data) : d })) };
}
export function Carga({ l, children }) {
  if (l.erro) return <div className="pm-empty"><strong>Não consegui carregar esta tela.</strong>{l.erro}<div className="mt-3"><button className="btn btn-primary" onClick={l.recarregar}>Tentar de novo</button></div></div>;
  if (l.carregando && !l.data) return <p className="text-secondary" role="status">Carregando os dados…</p>;
  return children(l.data);
}

/* ---------- toast ---------- */
const ToastCtx = createContext(() => { });
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [lista, setLista] = useState([]);
  const add = useCallback((msg, tipo = 'dark') => {
    const id = Math.random();
    setLista(x => [...x, { id, msg, tipo }]);
    setTimeout(() => setLista(x => x.filter(t => t.id !== id)), 5500);
  }, []);
  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 2000 }}>
        {lista.map(t => (
          <div key={t.id} className={`toast show align-items-center border-0 text-bg-${t.tipo}`} role="status">
            <div className="d-flex"><div className="toast-body">{t.msg}</div>
              <button className={`btn-close ${t.tipo === 'warning' ? '' : 'btn-close-white'} me-2 m-auto`} aria-label="Fechar" onClick={() => setLista(x => x.filter(y => y.id !== t.id))} /></div>
          </div>))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- modal (usa só as classes do Bootstrap) ---------- */
export function Modal({ titulo, onClose, size = '', footer, children }) {
  useEffect(() => {
    document.body.classList.add('modal-open');
    const k = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => { document.body.classList.remove('modal-open'); document.removeEventListener('keydown', k); };
  }, [onClose]);
  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" onMouseDown={e => e.target === e.currentTarget && onClose()}>
        <div className={`modal-dialog modal-dialog-scrollable modal-dialog-centered ${size}`}>
          <div className="modal-content">
            <div className="modal-header"><h2 className="modal-title h5">{titulo}</h2><button className="btn-close" aria-label="Fechar" onClick={onClose} /></div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}

/* ---------- gráfico de linha em SVG ---------- */
export function LineChart({ pts, limite, limiteLabel = 'Limite de alarme', unit = '', h = 220, big = false, min = 0, dec = 1, label = 'Gráfico de tendência' }) {
  const ref = useRef(null), svgRef = useRef(null);
  const [W, setW] = useState(600), [hv, setHv] = useState(null);
  useEffect(() => {
    const el = ref.current, f = () => setW(Math.max(el.clientWidth, 280));
    f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  if (!pts || !pts.length) return <div className="pm-chart" ref={ref} />;
  const m = { t: 18, r: 20, b: 30, l: big ? 48 : 14 };
  const max = Math.max(...pts.map(p => p.y), limite ?? 0) * 1.1 || 1;
  const X = i => m.l + (W - m.l - m.r) * (pts.length < 2 ? .5 : i / (pts.length - 1));
  const Y = v => h - m.b - (h - m.t - m.b) * ((v - min) / (max - min || 1));
  const step = Math.max(1, Math.ceil(pts.length / (big ? 8 : 3)));
  let idx = big ? pts.map((_, i) => i).filter(i => i % step === 0 || i === pts.length - 1).filter((i, k, a) => !(k > 0 && i - a[k - 1] < step / 2)) : [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  idx = [...new Set(idx)];
  const fmt = p => `${p.x} · ${num(p.y, dec)}${unit ? (unit.startsWith(' ') || unit === '%' ? '' : ' ') + unit : ''}`;
  const li = hv ?? pts.length - 1, ponto = pts[li];
  const mover = e => {
    const r = svgRef.current.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width);
    setHv(Math.max(0, Math.min(pts.length - 1, Math.round((x - m.l) / ((W - m.l - m.r) / (pts.length - 1 || 1))))));
  };
  const escala = svgRef.current ? svgRef.current.getBoundingClientRect() : null;
  return (
    <div className="pm-chart" ref={ref}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label} onPointerMove={mover} onPointerLeave={() => setHv(null)}>
        {[0, 1, 2, 3, 4].map(k => { const v = min + (max - min) * k / 4, y = Y(v); return <g key={k}><line className="grid" x1={m.l} x2={W - m.r} y1={y} y2={y} />{big && <text className="tick" x={m.l - 8} y={y + 4} textAnchor="end">{num(v, dec)}</text>}</g>; })}
        {idx.map(i => <text key={i} className="tick" x={X(i)} y={h - 8} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}>{pts[i].x}</text>)}
        {limite != null && <g><line className="limit" x1={m.l} x2={W - m.r} y1={Y(limite)} y2={Y(limite)} /><text className="limit-t" x={W - m.r} y={Y(limite) - 6} textAnchor="end">{limiteLabel}</text></g>}
        <path className="line" d={pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('')} />
        {hv != null && <line className="cross" x1={X(hv)} x2={X(hv)} y1={m.t} y2={h - m.b} />}
        <circle className="dot" cx={X(li)} cy={Y(ponto.y)} r="6" />
        <rect x={m.l} y="0" width={W - m.l - m.r} height={h} fill="transparent" />
      </svg>
      {hv != null && escala && <div className="pm-tip" style={{ left: X(hv) * escala.width / W, top: Y(ponto.y) * escala.height / h }}>{fmt(ponto)}</div>}
    </div>
  );
}

/* ---------- medidor de vida útil ---------- */
export function Gauge({ dias, max = 30 }) {
  const r = 70, cx = 90, cy = 90, a0 = 150, pt = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  const arc = (a, b) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  const f = Math.max(.03, Math.min(dias / max, 1)), cor = dias <= 7 ? 'var(--pm-red)' : dias <= 21 ? 'var(--pm-yellow)' : 'var(--pm-green)';
  return (
    <svg className="gauge" viewBox="0 0 180 150" role="img" aria-label={`${dias} dias de vida útil restante`}>
      <path className="g-bg" d={arc(a0, a0 + 240)} /><path d={arc(a0, a0 + 240 * f)} style={{ stroke: cor }} />
      <text className="g-num" x="90" y="92" textAnchor="middle">{dias} {dias === 1 ? 'dia' : 'dias'}</text>
      <text className="g-t" x="90" y="110" textAnchor="middle">vida útil restante</text>
    </svg>
  );
}
