import AsteriskManager from 'asterisk-manager';
import { EventEmitter } from 'node:events';
import { config } from '../config.js';

/**
 * Wrapper fino sobre `asterisk-manager` (AMI) com reconexão automática e
 * uma API baseada em Promises para as ações usadas pelo dashboard.
 * Emite 'connected' / 'disconnected' / 'error' para quem quiser observar o estado.
 */
class AmiClient extends EventEmitter {
  constructor() {
    super();
    this.ami = null;
    this.connected = false;
    this.connecting = false;
  }

  connect() {
    if (this.connecting || this.connected) return;
    this.connecting = true;

    // events=true habilita o stream de eventos (necessário p/ status em tempo real)
    this.ami = new AsteriskManager(
      config.ami.port,
      config.ami.host,
      config.ami.user,
      config.ami.password,
      true
    );
    this.ami.keepConnected();

    this.ami.on('connect', () => {
      this.connected = true;
      this.connecting = false;
      this.emit('connected');
    });

    this.ami.on('close', () => {
      this.connected = false;
      this.emit('disconnected');
    });

    this.ami.on('error', (err) => {
      this.connected = false;
      this.connecting = false;
      this.emit('error', err);
    });

    // Repassa eventos crus para quem quiser reagir em tempo real
    // (ex.: broadcast via WebSocket para o frontend)
    this.ami.on('managerevent', (evt) => this.emit('managerevent', evt));
  }

  isConnected() {
    return this.connected;
  }

  /**
   * Executa uma ação AMI e resolve com a resposta (e eventuais eventos
   * relacionados, quando a ação retorna uma lista via múltiplos eventos).
   */
  action(action, collectEvent) {
    return new Promise((resolve, reject) => {
      if (!this.ami || !this.connected) {
        reject(new Error('AMI não conectado'));
        return;
      }

      const collected = [];
      let onEvent;
      if (collectEvent) {
        onEvent = (evt) => {
          if (evt.event && evt.event.toLowerCase() === collectEvent.toLowerCase()) {
            collected.push(evt);
          }
        };
        this.ami.on('managerevent', onEvent);
      }

      this.ami.action(action, (err, res) => {
        if (collectEvent) {
          // dá um tempo curto para os eventos da lista chegarem após a resposta final
          setTimeout(() => {
            this.ami.removeListener('managerevent', onEvent);
            if (err) reject(err);
            else resolve({ response: res, events: collected });
          }, 250);
          return;
        }
        if (err) reject(err);
        else resolve(res);
      });
    });
  }
}

export const amiClient = new AmiClient();
