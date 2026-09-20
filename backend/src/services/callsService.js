import { amiClient } from '../ami/amiClient.js';
import { getCdrPool } from './cdrClient.js';
import { config } from '../config.js';
import { mockActiveCalls, mockCallsSummary, mockTodaySummary } from './mockData.js';

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
};

export async function getCallsSummary(range) {
  const cfg = RANGE_TO_SQL[range] || RANGE_TO_SQL.today;

  if (config.forceMock) {
    return { ...mockCallsSummary(range), source: 'mock' };
  }

  try {
    const pool = await getCdrPool();
    // dcontext 'from-internal' = originada internamente (realizada);
    // demais contextos 'from-trunk'/'from-pstn' etc = recebida externamente.
    const [rows] = await pool.query(
      `SELECT ${cfg.groupExpr} AS bucket,
              SUM(CASE WHEN dcontext NOT LIKE 'from-internal%' THEN 1 ELSE 0 END) AS recebidas,
              SUM(CASE WHEN dcontext LIKE 'from-internal%' THEN 1 ELSE 0 END) AS realizadas,
              SUM(CASE WHEN disposition = 'NO ANSWER' THEN 1 ELSE 0 END) AS perdidas,
              SUM(CASE WHEN disposition = 'FAILED' THEN 1 ELSE 0 END) AS falhas
       FROM cdr
       WHERE ${cfg.where}
       GROUP BY bucket
       ORDER BY bucket ASC`
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

function directionOf(dcontext) {
  return dcontext && dcontext.startsWith('from-internal') ? 'made' : 'received';
}

export async function getExtensionCallsToday(number, limit = 20) {
  if (config.forceMock) {
    return { data: [], source: 'mock' };
  }
  try {
    const pool = await getCdrPool();
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
      direction: directionOf(r.dcontext),
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
      direction: directionOf(r.dcontext),
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
      direction: directionOf(r.dcontext),
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

// Mesmo resumo de "hoje", mas pra um dia qualquer — usado pelo painel pra
// deixar escolher "Ontem" ou uma data específica, não só o dia atual.
export async function getDaySummary(date) {
  const day = date || new Date().toISOString().slice(0, 10);

  if (config.forceMock) {
    return { ...mockTodaySummary(), date: day, source: 'mock' };
  }

  try {
    const pool = await getCdrPool();
    const [[totals]] = await pool.query(
      `SELECT
         SUM(CASE WHEN dcontext NOT LIKE 'from-internal%' THEN 1 ELSE 0 END) AS received,
         SUM(CASE WHEN dcontext LIKE 'from-internal%' THEN 1 ELSE 0 END) AS made,
         SUM(CASE WHEN disposition = 'NO ANSWER' THEN 1 ELSE 0 END) AS missed,
         SUM(CASE WHEN disposition = 'FAILED' THEN 1 ELSE 0 END) AS failed,
         AVG(NULLIF(billsec, 0)) AS avgDuration,
         SUM(billsec) AS totalDuration
       FROM cdr
       WHERE calldate >= ? AND calldate < DATE_ADD(?, INTERVAL 1 DAY)`,
      [day, day]
    );

    const [mostUsedRows] = await pool.query(
      `SELECT src AS extension, COUNT(*) AS total
       FROM cdr
       WHERE calldate >= ? AND calldate < DATE_ADD(?, INTERVAL 1 DAY) AND dcontext LIKE 'from-internal%'
       GROUP BY src
       ORDER BY total DESC
       LIMIT 1`,
      [day, day]
    );

    return {
      date: day,
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
    return { ...mockTodaySummary(), date: day, source: 'mock', error: err.message };
  }
}

export async function getTodaySummary() {
  return getDaySummary(new Date().toISOString().slice(0, 10));
}
