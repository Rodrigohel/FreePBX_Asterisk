import { db } from '../db/sqlite.js';

const insertStmt = db.prepare(`INSERT OR IGNORE INTO favorite_extensions (number, created_at) VALUES (?, ?)`);
const deleteStmt = db.prepare(`DELETE FROM favorite_extensions WHERE number = ?`);
const listStmt = db.prepare(`SELECT number FROM favorite_extensions`);

let cache = null;

function loadCache() {
  if (!cache) cache = new Set(listStmt.all().map((r) => r.number));
  return cache;
}

export function getFavoriteNumbers() {
  return Array.from(loadCache());
}

export function isFavorite(number) {
  return loadCache().has(number);
}

export function addFavorite(number) {
  insertStmt.run(number, new Date().toISOString());
  loadCache().add(number);
}

export function removeFavorite(number) {
  deleteStmt.run(number);
  loadCache().delete(number);
}
