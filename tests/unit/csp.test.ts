/**
 * CSP policy must be validated so that edits are caught by the test suite
 * rather than causing runtime policy violations in the main renderer.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSP =
  "default-src 'self' app:; img-src 'self' data: blob: http: https:; media-src 'self' blob: http: https:; worker-src 'self' blob:; child-src 'self' blob:; connect-src 'self' http: https: ws: wss: app:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;";

const htmlFiles = [
  resolve(__dirname, '../../src/renderer/index.html'),
] as const;

describe('Content-Security-Policy', () => {
  for (const file of htmlFiles) {
    it(`${file} carries the canonical CSP`, () => {
      const content = readFileSync(file, 'utf8');
      expect(content).toContain(`content="${CSP}"`);
    });
  }



  it('img-src includes http: for LAN HTTP poster images', () => {
    const src = htmlFiles.map((f) => readFileSync(f, 'utf8').match(/img-src ([^;]+)/)?.[1]);
    for (const img of src) {
      expect(img).toContain('http:');
    }
  });

  it('worker-src includes blob: for HLS enableWorker:true', () => {
    const src = htmlFiles.map((f) => readFileSync(f, 'utf8').match(/worker-src ([^;]+)/)?.[1]);
    for (const worker of src) {
      expect(worker).toContain('blob:');
    }
  });

  it('connect-src includes wss: and app: for secure WebSocket and hub scheme', () => {
    const src = htmlFiles.map((f) => readFileSync(f, 'utf8').match(/connect-src ([^;]+)/)?.[1]);
    for (const conn of src) {
      expect(conn).toContain('wss:');
      expect(conn).toContain('app:');
    }
  });

  it("script-src does not contain 'unsafe-inline'", () => {
    for (const file of htmlFiles) {
      const content = readFileSync(file, 'utf8');
      const scriptMatch = content.match(/script-src ([^;]+)/)?.[1];
      expect(scriptMatch).not.toContain("'unsafe-inline'");
    }
  });
});
