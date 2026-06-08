/**
 * Playwright Global Teardown
 *
 * Executado UMA VEZ após todos os testes.
 * Não reverte o snapshot (ele será revertido no próximo globalSetup via reset).
 */

import path from 'path';
import fs from 'fs';

const SNAPSHOT_FILE = path.resolve(__dirname, '.snapshot');

export default async function globalTeardown() {
  // Remove arquivo de snapshot para não deixar lixo
  if (fs.existsSync(SNAPSHOT_FILE)) {
    fs.unlinkSync(SNAPSHOT_FILE);
  }
  console.log('\n✅ [globalTeardown] Concluído.\n');
}
