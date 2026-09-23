import http from 'node:http';
import crypto from 'node:crypto';

export class IcfWebSocketServer {
  /**
   * @param {object} options
   * @param {number} [options.port=8765] - WebSocket listen port.
   * @param {string} [options.host='127.0.0.1'] - Listen host.
   */
  constructor(options = {}) {
    this.port = options.port || 8765;
    this.host = options.host || '127.0.0.1';
    this.clients = new Set();
    this.server = null;
  }

  /**
   * Start the WebSocket server.
   * @returns {Promise<number>} Bound port.
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', clients: this.clients.size }));
          return;
        }
        res.writeHead(426, { 'Content-Type': 'text/plain' });
        res.end('Upgrade Required - ICF WebSocket Server');
      });

      this.server.on('upgrade', (req, socket) => {
        const upgradeHeader = req.headers['upgrade'];
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
          socket.destroy();
          return;
        }

        const key = req.headers['sec-websocket-key'];
        if (!key) {
          socket.destroy();
          return;
        }

        const acceptHash = crypto
          .createHash('sha1')
          .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
          .digest('base64');

        const headers = [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          `Sec-WebSocket-Accept: ${acceptHash}`
        ];

        socket.write(headers.join('\r\n') + '\r\n\r\n');
        this.clients.add(socket);

        socket.on('close', () => {
          this.clients.delete(socket);
        });

        socket.on('error', () => {
          this.clients.delete(socket);
          socket.destroy();
        });
      });

      this.server.listen(this.port, this.host, () => {
        resolve(this.port);
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Broadcast UTF-8 text message / JSON payload to all connected clients.
   * @param {string|object} data
   */
  broadcast(data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const frame = this._encodeFrame(text);

    for (const client of this.clients) {
      if (client.writable) {
        client.write(frame);
      } else {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Encode text payload into an unmasked RFC 6455 WebSocket frame.
   * @private
   */
  _encodeFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    const length = payload.length;

    let header;
    if (length <= 125) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + text opcode
      header[1] = length;
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    return Buffer.concat([header, payload]);
  }

  /**
   * Close all connections and stop the server.
   */
  async close() {
    for (const client of this.clients) {
      try {
        client.destroy();
      } catch {
        // Ignore close errors
      }
    }
    this.clients.clear();

    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
      this.server = null;
    }
  }
}
