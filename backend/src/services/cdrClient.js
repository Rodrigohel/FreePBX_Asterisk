import mysql from 'mysql2/promise';
import { config } from '../config.js';

let pool = null;

/**
 * Pool lazy de conexões ao banco de CDR do FreePBX (asteriskcdrdb).
 * Retorna null se a conexão falhar, para permitir fallback a mock
 * em vez de derrubar o backend inteiro.
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
    return pool;
  } catch (err) {
    pool = null;
    throw err;
  }
}
