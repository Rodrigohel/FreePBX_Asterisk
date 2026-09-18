import mysql from 'mysql2/promise';
import { config } from '../config.js';

let pool = null;

let loggedOnce = false;

/**
 * Pool lazy de conexões ao banco de CDR do FreePBX (asteriskcdrdb).
 * Lança erro se a conexão falhar, para permitir que quem chamou (os
 * services) faça fallback a mock em vez de derrubar o backend inteiro.
 */
export async function getCdrPool() {
  if (pool) return pool;
  try {
    pool = mysql.createPool({
      host: config.cdr.host,
      port: config.cdr.port,
      database: config.cdr.database,
      user: config.cdr.user,
      password: config.cdr.password,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
    // valida a conexão
    const conn = await pool.getConnection();
    conn.release();
    if (!loggedOnce) {
      console.log('[CDR] conectado com sucesso ao banco', config.cdr.database);
      loggedOnce = true;
    }
    return pool;
  } catch (err) {
    pool = null;
    console.error('[CDR] erro de conexão:', err && err.message ? err.message : err);
    throw err;
  }
}
