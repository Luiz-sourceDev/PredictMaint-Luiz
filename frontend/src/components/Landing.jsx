/* Página de apresentação do PredictMaint (abaixo do login, na página inicial).
   Conteúdo estático: não chama a API. Os números de exemplo vêm dos dados de demonstração. */

const PASSOS = [
  ['1', 'Medir', 'Técnicos registram vibração, temperatura e corrente de cada máquina, com data e hora.'],
  ['2', 'Prever', 'A regressão linear traça a tendência das últimas medições e calcula quando a máquina chega ao limite crítico.'],
  ['3', 'Alertar', 'Antes da falha, o sistema abre o alerta com a data prevista e a ação recomendada, e avisa a equipe.'],
  ['4', 'Agir', 'Do próprio alerta sai a ordem de serviço, acompanhada no quadro até o reparo concluído.'],
];

const KAN = [
  ['Aberta', ['OS-0232 Inspeção elétrica', 'OS-0236 Troca de correia']],
  ['Em andamento', ['OS-0233 Troca de óleo']],
  ['Aguardando peça', ['OS-0222 Ajuste de pressão']],
  ['Concluída', ['OS-0229 Rolamento PH-03']],
];
const TL = [['Chamado registrado', 1], ['OS criada', 1], ['Em reparo', 2], ['Concluído', 0]];
const CEDO = 33946, TARDE = 92026;
const brl = v => 'R$ ' + v.toLocaleString('pt-BR');

function Tendencia() {
  const pts = [[30, 150], [75, 142], [120, 128], [165, 122], [210, 105], [255, 96], [300, 80]];
  return (
    <svg className="lp-graf" viewBox="0 0 420 190" role="img" aria-label="Gráfico: as leituras sobem e a reta projeta a falha para daqui a alguns dias">
      <line className="lp-lim" x1="20" x2="410" y1="38" y2="38" /><text className="lp-lim-t" x="22" y="30">Limite crítico</text>
      <line className="lp-reta" x1="30" y1="153" x2="300" y2="80" />
      <line className="lp-reta lp-proj" x1="300" y1="80" x2="385" y2="38" />
      {pts.map(([x, y]) => <circle key={x} cx={x} cy={y} r="5" className="lp-pt" />)}
      <circle cx="385" cy="38" r="7" className="lp-falha" />
      <text className="lp-falha-t" x="372" y="24" textAnchor="end">Falha prevista</text>
      <text className="lp-eixo" x="300" y="182" textAnchor="middle">hoje</text>
    </svg>
  );
}

const RECURSOS = [
  ['Previsão de falhas', 'A tendência de cada grandeza vira uma data prevista, com o grau de confiança da reta.', <Tendencia key="g" />],
  ['Ordens de serviço', 'Quadro por etapa, com prioridade, equipe e prazo. Cada OS nasce de um alerta ou de um chamado.',
    <div key="k" className="lp-kan">{KAN.map(([c, os]) => <div key={c}><small>{c}</small>{os.map(o => <p key={o}>{o}</p>)}</div>)}</div>],
  ['Orçamento manutenciário', 'Compara cuidar agora com esperar quebrar, somando mão de obra, peças e produção parada. Exemplo com a PH-03:',
    <div key="o" className="lp-orc"><div><small>Cuidar agora</small><b>{brl(CEDO)}</b></div><div className="x"><small>Esperar quebrar</small><b>{brl(TARDE)}</b></div><p>Esperar sai {(TARDE / CEDO).toFixed(1).replace('.', ',')} vezes mais caro</p></div>],
  ['Chamados do chão de fábrica', 'O funcionário abre o chamado com foto pelo celular e acompanha cada etapa até o reparo.',
    <ol key="t" className="lp-tl">{TL.map(([t, s]) => <li key={t} className={s === 1 ? 'done' : s === 2 ? 'now' : ''}>{t}</li>)}</ol>],
];

const EXTRAS = [
  ['Dashboard de indicadores', 'Disponibilidade, MTBF, MTTR, saúde dos ativos e prazos das OS em uma tela.'],
  ['Central de alertas', 'Alertas por limite e por tendência, com nível, previsão e ação recomendada.'],
  ['Avisos no sininho', 'Gestores e técnicos recebem os avisos importantes assim que acontecem.'],
  ['Usuários e perfis', 'O gestor cadastra pessoas, liga e desliga acessos, e o efeito é imediato.'],
];

const PERFIS = [
  ['Gestor', 'Acompanha indicadores, prioriza ordens de serviço, aprova orçamentos e gerencia usuários.'],
  ['Técnico', 'Registra medições, recebe alertas e atualiza o andamento das ordens de serviço.'],
  ['Funcionário', 'Abre chamados com foto e acompanha o atendimento, sem acesso às telas de gestão.'],
];

export default function Landing() {
  return (
    <div className="lp">
      <section className="lp-sec lp-problema" id="problema">
        <div className="lp-wrap lp-duo">
          <div>
            <p className="lp-kick">O problema</p>
            <h2>Máquina parada custa mais do que manutenção.</h2>
          </div>
          <div>
            <p>Na maioria das fábricas, a manutenção só acontece depois da quebra. A linha para, a peça chega com urgência e a equipe trabalha sob pressão.</p>
            <p>O PredictMaint acompanha as medições de cada máquina e mostra a tendência de piora com dias de antecedência, para que a manutenção seja planejada, e não improvisada.</p>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="como-funciona">
        <div className="lp-wrap">
          <p className="lp-kick">Como funciona</p>
          <h2>Da medição à ordem de serviço, em quatro passos.</h2>
          <ol className="lp-passos">{PASSOS.map(([n, t, d]) => <li key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></li>)}</ol>
        </div>
      </section>

      <section className="lp-sec lp-claro" id="recursos">
        <div className="lp-wrap">
          <p className="lp-kick">Recursos</p>
          <h2>Tudo o que a manutenção precisa, em um só sistema.</h2>
          <div className="lp-recursos">{RECURSOS.map(([t, d, v]) => <article key={t} className="lp-rec"><div className="lp-rec-vis">{v}</div><h3>{t}</h3><p>{d}</p></article>)}</div>
          <div className="lp-extras">{EXTRAS.map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}</div>
        </div>
      </section>

      <section className="lp-sec" id="perfis">
        <div className="lp-wrap">
          <p className="lp-kick">Para cada pessoa</p>
          <h2>Cada perfil vê o que precisa.</h2>
          <div className="lp-perfis">{PERFIS.map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}</div>
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-wrap">
          <h2>Antecipe a próxima falha.</h2>
          <a href="#entrar" className="btn btn-primary btn-lg">Entrar no PredictMaint</a>
        </div>
      </section>

      <footer className="lp-rodape"><div className="lp-wrap"><img src="/mantech-logo.png" alt="Mantech" /><span>PredictMaint · Mantech Solutions · Projeto Integrador SENAI 2026</span></div></footer>
    </div>
  );
}
