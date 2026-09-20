import { amiClient } from '../ami/amiClient.js';
import { getCdrPool } from './cdrClient.js';
import { config } from '../config.js';
import { getSettings } from './settingsService.js';
import { mockActiveCalls, mockCallsSummary, mockTodaySummary, mockTopUnitsReport, mockCallHeatmap } from './mockData.js';

function stateFromChannelState(channelStateDesc) {
  const s = (channelStateDesc || '').toLowerCase();
  if (s.includes('ring')) return 'ringing';
  if (s.includes('up')) return 'in_progress';
  return 'in_progress';
}

function extNumberFromChannel(channel) {
  // Ex.: "PJSIP/1002-0000001a" -> "1002"
  const match = /^[A-Za-z]+\/(\d+)-/.exec(channel || '');
  return match ? match[1] : null;
}

export async function getActiveCalls() {
  if (config.forceMock || !amiClient.isConnected()) {
    return { data: mockActiveCalls(), source: 'mock' };
  }

  try {
    const { events } = await amiClient.action({ Action: 'CoreShowChannels' }, 'CoreShowChannel');

    const calls = events
      .filter((evt) => extNumberFromChannel(evt.channel))
      .map((evt) => {
        const ext = extNumberFromChannel(evt.channel);
        const durationSeconds = Number(evt.duration) || 0;
        const state = stateFromChannelState(evt.channelstatedesc);
        const direction = evt.context && evt.context.startsWith('from-') ? 'inbound' : 'outbound';
        return {
          ext,
          name: evt.calleridname && evt.calleridname !== '<unknown>' ? evt.calleridname : `Ramal ${ext}`,
          destination: evt.connectedlinenum || evt.exten || '—',
          direction,
          state,
          durationSeconds,
        };
      });

    return { data: calls, source: 'ami' };
  } catch (err) {
    return { data: mockActiveCalls(), source: 'mock', error: err.message };
  }
}

// Ramais da portaria/interfone, configuráveis em Configurações. Servem pra
// classificar "recebida" (chegou pra portaria) vs. "realizada" (saiu da
// portaria) do ponto de vista de quem atende o interfone — já que porteiro
// e apartamento são ambos ramais internos do mesmo PBX, a distinção antiga
// "chamada interna vs. linha externa" não tinha nada a ver com quem ligou
// pra quem, e classificava toda chamada porteiro<->apartamento como
// "realizada" (por ter sido discada por um ramal interno), mesmo quando o
// morador é quem ligou pra portaria.
function getPorteiroNumbers() {
  const raw = getSettings().porteiroExtensions || '';
  return raw.split(',').map((n) => n.trim()).filter(Boolean);
}

// Monta a expressão SQL (com seus parâmetros, na ordem em que os "?"
// aparecem no texto) que classifica cada linha do CDR como 'received' ou
// 'made'. Com ramal(is) de portaria configurado(s): quem discou (src) é a
// portaria -> 'made'; quem recebeu (dst) é a portaria -> 'received'.
// Chamada que não envolve nenhum ramal de portaria (ex.: apartamento
// ligando pra outro apartamento, ou uma linha externa de verdade) cai no
// critério antigo como reserva. Sem nenhum ramal de portaria configurado,
// usa só o critério antigo.
function directionCaseSql(porteiroNumbers) {
  const fallback = `CASE WHEN dcontext LIKE 'from-internal%' THEN 'made' ELSE 'received' END`;
  if (porteiroNumbers.length === 0) {
    return { sql: fallback, params: [] };
  }
  const placeholders = porteiroNumbers.map(() => '?').join(',');
  return {
    sql: `CASE
            WHEN src IN (${placeholders}) THEN 'made'
            WHEN dst IN (${placeholders}) THEN 'received'
            ELSE (${fallback})
          END`,
    params: [...porteiroNumbers, ...porteiroNumbers],
  };
}

function directionOf(row, porteiroNumbers) {
  if (porteiroNumbers.includes(row.src)) return 'made';
  if (porteiroNumbers.includes(row.dst)) return 'received';
  return row.dcontext && row.dcontext.startsWith('from-internal') ? 'made' : 'received';
}

const RANGE_TO_SQL = {
  today: {
    where: 'calldate >= CURDATE()',
    // agrupa por hora
    groupExpr: "DATE_FORMAT(calldate, '%H:00')",
    labelFormatter: (v) => v.replace(':00', 'h'),
  },
  '7d': {
    where: 'calldate >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
    groupExpr: "DATE(calldate)",
    labelFormatter: (v) => new Date(v).toLocaleDateString('pt-BR', { weekday: 'short' }),
  },
  '30d': {
    where: 'calldate >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)',
    groupExpr: "YEARWEEK(calldate, 3)",
    labelFormatter: (v, i) => `Sem ${i + 1}`,
  },
  '12m': {
    where: 'calldate >= DATE_SUB(DATE_FORMAT(CURDATE(), "%Y-%m-01"), INTERVAL 11 MONTH)',
    groupExpr: "DATE_FORMAT(calldate, '%Y-%m')",
    labelFormatter: (v) => {
      const [year, month] = v.split('-').map(Number);
      return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    },
  },
};

export async function getCallsSummary(range) {
  const cfg = RANGE_TO_SQL[range] || RANGE_TO_SQL.today;

  if (config.forceMock) {
    return { ...mockCallsSummary(range), source: 'mock' };
  }

  try {
    const pool = await getCdrPool();
    const { sql: directionSql, params: directionParams } = directionCaseSql(getPorteiroNumbers());
    const [rows] = await pool.query(
      `SELECT ${cfg.groupExpr} AS bucket,
              SUM(CASE WHEN direction = 'received' THEN 1 ELSE 0 END) AS recebidas,
              SUM(CASE WHEN direction = 'made' THEN 1 ELSE 0 END) AS realizadas,
              SUM(CASE WHEN disposition = 'NO ANSWER' THEN 1 ELSE 0 END) AS perdidas,
              SUM(CASE WHEN disposition = 'FAILED' THEN 1 ELSE 0 END) AS falhas
       FROM (SELECT *, ${directionSql} AS direction FROM cdr WHERE ${cfg.where}) t
       GROUP BY bucket
       ORDER BY bucket ASC`,
      directionParams
    );

    const categories = rows.map((r, i) => cfg.labelFormatter(String(r.bucket), i));
    const recebidas = rows.map((r) => Number(r.recebidas));
    const realizadas = rows.map((r) => Number(r.realizadas));
    const perdidas = rows.map((r) => Number(r.perdidas));
    const falhas = rows.map((r) => Number(r.falhas));

    return { categories, recebidas, realizadas, perdidas, falhas, source: 'cdr' };
  } catch (err) {
    return { ...mockCallsSummary(range), source: 'mock', error: err.message };
  }
}

export async function getExtensionCallsToday(number, limit = 20) {
  if (config.forceMock) {
    return { data: [], source: 'mock' };
  }
  try {
    const pool = await getCdrPool();
    const porteiroNumbers = getPorteiroNumbers();
    const [rows] = await pool.query(
      `SELECT calldate, src, dst, disposition, billsec, dcontext
       FROM cdr
       WHERE calldate >= CURDATE() AND (src = ? OR dst = ?)
       ORDER BY calldate DESC
       LIMIT ?`,
      [number, number, limit]
    );
    const data = rows.map((r) => ({
      at: r.calldate,
      src: r.src,
      dst: r.dst,
      disposition: r.disposition,
      durationSeconds: r.billsec,
      direction: directionOf(r, porteiroNumbers),
    }));
    return { data, source: 'cdr' };
  } catch (err) {
    return { data: [], source: 'mock', error: err.message };
  }
}

export async function searchCallHistory({ q, from, to, page = 1, pageSize = 25 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const offset = (safePage - 1) * safePageSize;
  const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  if (config.forceMock) {
    return { data: [], total: 0, page: safePage, pageSize: safePageSize, source: 'mock' };
  }

  try {
    const pool = await getCdrPool();
    const porteiroNumbers = getPorteiroNumbers();
    const like = q ? `%${q}%` : null;
    const whereClauses = ['calldate >= ?', 'calldate < DATE_ADD(?, INTERVAL 1 DAY)'];
    const params = [fromDate, toDate];
    if (like) {
      whereClauses.push('(src LIKE ? OR dst LIKE ?)');
      params.push(like, like);
    }
    const where = whereClauses.join(' AND ');

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM cdr WHERE ${where}`, params);
    const [rows] = await pool.query(
      `SELECT calldate, src, dst, disposition, billsec, dcontext
       FROM cdr
       WHERE ${where}
       ORDER BY calldate DESC
       LIMIT ? OFFSET ?`,
      [...params, safePageSize, offset]
    );

    const data = rows.map((r) => ({
      at: r.calldate,
      src: r.src,
      dst: r.dst,
      disposition: r.disposition,
      durationSeconds: r.billsec,
      direction: directionOf(r, porteiroNumbers),
    }));

    return { data, total: Number(total), page: safePage, pageSize: safePageSize, source: 'cdr' };
  } catch (err) {
    return { data: [], total: 0, page: safePage, pageSize: safePageSize, source: 'mock', error: err.message };
  }
}

// Mesma busca de searchCallHistory, mas sem paginação — usado pra exportar
// um relatório em CSV. Limitado a 5000 linhas por chamada como proteção
// contra períodos gigantes sem filtro.
export async function exportCallHistory({ q, from, to }) {
  const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  if (config.forceMock) {
    return { data: [], source: 'mock' };
  }

  try {
    const pool = await getCdrPool();
    const porteiroNumbers = getPorteiroNumbers();
    const like = q ? `%${q}%` : null;
    const whereClauses = ['calldate >= ?', 'calldate < DATE_ADD(?, INTERVAL 1 DAY)'];
    const params = [fromDate, toDate];
    if (like) {
      whereClauses.push('(src LIKE ? OR dst LIKE ?)');
      params.push(like, like);
    }
    const where = whereClauses.join(' AND ');

    const [rows] = await pool.query(
      `SELECT calldate, src, dst, disposition, billsec, dcontext
       FROM cdr
       WHERE ${where}
       ORDER BY calldate DESC
       LIMIT 5000`,
      params
    );

    const data = rows.map((r) => ({
      at: r.calldate,
      src: r.src,
      dst: r.dst,
      disposition: r.disposition,
      durationSeconds: r.billsec,
      direction: directionOf(r, porteiroNumbers),
    }));

    return { data, source: 'cdr' };
  } catch (err) {
    return { data: [], source: 'mock', error: err.message };
  }
}

// Chamadas não atendidas hoje, agrupadas por ramal de destino — útil pra
// portaria ver quais unidades não atenderam quando ligaram (ex.: visitante
// ou entrega na portaria, morador não atendeu o interfone).
export async function getMissedCallsToday(limit = 50) {
  if (config.forceMock) {
    return { data: [], source: 'mock' };
  }
  try {
    const pool = await getCdrPool();
    const [rows] = await pool.query(
      `SELECT dst, COUNT(*) AS total, MAX(calldate) AS lastAt
       FROM cdr
       WHERE calldate >= CURDATE() AND disposition = 'NO ANSWER'
       GROUP BY dst
       ORDER BY total DESC, lastAt DESC
       LIMIT ?`,
      [limit]
    );
    const data = rows.map((r) => ({ number: r.dst, total: Number(r.total), lastAt: r.lastAt }));
    return { data, source: 'cdr' };
  } catch (err) {
    return { data: [], source: 'mock', error: err.message };
  }
}

// Resumo agregado num período (de "from" até "to", inclusive) — usado tanto
// pra um único dia (getDaySummary, from = to) quanto pra um mês inteiro no
// relatório mensal.
export async function getPeriodSummary({ from, to } = {}) {
  const fromDate = from || new Date().toISOString().slice(0, 10);
  const toDate = to || fromDate;

  if (config.forceMock) {
    return { ...mockTodaySummary(), from: fromDate, to: toDate, source: 'mock' };
  }

  try {
    const pool = await getCdrPool();
    const porteiroNumbers = getPorteiroNumbers();
    const { sql: directionSql, params: directionParams } = directionCaseSql(porteiroNumbers);

    const [[totals]] = await pool.query(
      `SELECT
         SUM(CASE WHEN direction = 'received' THEN 1 ELSE 0 END) AS received,
         SUM(CASE WHEN direction = 'made' THEN 1 ELSE 0 END) AS made,
         SUM(CASE WHEN disposition = 'NO ANSWER' THEN 1 ELSE 0 END) AS missed,
         SUM(CASE WHEN disposition = 'FAILED' THEN 1 ELSE 0 END) AS failed,
         AVG(NULLIF(billsec, 0)) AS avgDuration,
         SUM(billsec) AS totalDuration
       FROM (
         SELECT *, ${directionSql} AS direction FROM cdr
         WHERE calldate >= ? AND calldate < DATE_ADD(?, INTERVAL 1 DAY)
       ) t`,
      [...directionParams, fromDate, toDate]
    );

    const [mostUsedRows] = await pool.query(
      `SELECT src AS extension, COUNT(*) AS total
       FROM (
         SELECT *, ${directionSql} AS direction FROM cdr
         WHERE calldate >= ? AND calldate < DATE_ADD(?, INTERVAL 1 DAY)
       ) t
       WHERE direction = 'made'
       GROUP BY src
       ORDER BY total DESC
       LIMIT 1`,
      [...directionParams, fromDate, toDate]
    );

    return {
      from: fromDate, to: toDate,
      received: Number(totals.received) || 0,
      made: Number(totals.made) || 0,
      missed: Number(totals.missed) || 0,
      failed: Number(totals.failed) || 0,
      avgDurationSeconds: Math.round(Number(totals.avgDuration) || 0),
      totalDurationSeconds: Number(totals.totalDuration) || 0,
      mostUsedExtension: mostUsedRows[0]?.extension || null,
      source: 'cdr',
    };
  } catch (err) {
    return { ...mockTodaySummary(), from: fromDate, to: toDate, source: 'mock', error: err.message };
  }
}

// Mesmo resumo, mas pra um dia qualquer — usado pelo painel pra deixar
// escolher "Ontem" ou uma data específica, não só o dia atual.
export async function getDaySummary(date) {
  const day = date || new Date().toISOString().slice(0, 10);
  const result = await getPeriodSummary({ from: day, to: day });
  return { ...result, date: day };
}

export async function getTodaySummary() {
  return getDaySummary(new Date().toISOString().slice(0, 10));
}

// Ranking das unidades que mais ligaram pra portaria (do ponto de vista da
// portaria: chamadas 'received') e das que mais deixaram de atender quando
// a portaria ligou (chamadas com disposition NO ANSWER tendo a unidade como
// destino, excluindo a própria portaria) — útil pro síndico identificar
// unidades com uso atípico ou que raramente atendem o interfone.
export async function getTopUnitsReport({ from, to, limit = 10 } = {}) {
  const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

  if (config.forceMock) {
    return { ...mockTopUnitsReport(), from: fromDate, to: toDate, source: 'mock' };
  }

  try {
    const pool = await getCdrPool();
    const porteiroNumbers = getPorteiroNumbers();
    const { sql: directionSql, params: directionParams } = directionCaseSql(porteiroNumbers);

    const [mostActiveRows] = await pool.query(
      `SELECT src AS number, COUNT(*) AS total
       FROM (
         SELECT *, ${directionSql} AS direction FROM cdr
         WHERE calldate >= ? AND calldate < DATE_ADD(?, INTERVAL 1 DAY)
       ) t
       WHERE direction = 'received'
       GROUP BY src
       ORDER BY total DESC
       LIMIT ?`,
      [...directionParams, fromDate, toDate, safeLimit]
    );

    const porteiroPlaceholders = porteiroNumbers.length ? porteiroNumbers.map(() => '?').join(',') : null;
    const excludePorteiro = porteiroPlaceholders ? `AND dst NOT IN (${porteiroPlaceholders})` : '';
    const [mostMissedRows] = await pool.query(
      `SELECT dst AS number, COUNT(*) AS total
       FROM cdr
       WHERE calldate >= ? AND calldate < DATE_ADD(?, INTERVAL 1 DAY) AND disposition = 'NO ANSWER' ${excludePorteiro}
       GROUP BY dst
       ORDER BY total DESC
       LIMIT ?`,
      [fromDate, toDate, ...porteiroNumbers, safeLimit]
    );

    return {
      from: fromDate, to: toDate,
      mostActive: mostActiveRows.map((r) => ({ number: r.number, total: Number(r.total) })),
      mostMissed: mostMissedRows.map((r) => ({ number: r.number, total: Number(r.total) })),
      source: 'cdr',
    };
  } catch (err) {
    return { ...mockTopUnitsReport(), from: fromDate, to: toDate, source: 'mock', error: err.message };
  }
}

// Volume de chamadas por dia da semana x hora, num período — mostra os
// horários de pico do interfone pra ajudar a planejar escala da portaria.
export async function getCallHeatmap({ from, to } = {}) {
  const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  if (config.forceMock) {
    return { ...mockCallHeatmap(), from: fromDate, to: toDate, source: 'mock' };
  }

  try {
    const pool = await getCdrPool();
    // DAYOFWEEK do MySQL: 1=domingo..7=sábado — normaliza pra 0=domingo..6=sábado
    const [rows] = await pool.query(
      `SELECT (DAYOFWEEK(calldate) - 1) AS dow, HOUR(calldate) AS hour, COUNT(*) AS total
       FROM cdr
       WHERE calldate >= ? AND calldate < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY dow, hour`,
      [fromDate, toDate]
    );

    const totals = new Map(rows.map((r) => [`${r.dow}-${r.hour}`, Number(r.total)]));
    const cells = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        cells.push({ dow, hour, total: totals.get(`${dow}-${hour}`) || 0 });
      }
    }

    return { cells, from: fromDate, to: toDate, source: 'cdr' };
  } catch (err) {
    return { ...mockCallHeatmap(), from: fromDate, to: toDate, source: 'mock', error: err.message };
  }
}
