import mysql from 'mysql2/promise';
import { config } from '../config.js';

let pool = null;

/**
 * Pool opcional para o banco `asterisk` do FreePBX (não o de CDR), usado
 * apenas para resolver o nome amigável de cada ramal (ex.: tabela `users`).
 * O schema exato varia entre versões do FreePBX — ajuste a query em
 * `extensionsService.js` conforme o seu ambiente. Se a conexão falhar,
 * os nomes caem para "Ramal <número>".
 */
export async function getPbxDbPool() {
  if (pool) return pool;
  if (!config.pbxDb.host) return null;
  try {
    pool = mysql.createPool({
      host: config.pbxDb.host,
      port: config.pbxDb.port,
      database: config.pbxDb.database,
      user: config.pbxDb.user,
      password: config.pbxDb.password,
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
    });
    const conn = await pool.getConnection();
    conn.release();
    return pool;
  } catch (err) {
    pool = null;
    throw err;
  }
}
