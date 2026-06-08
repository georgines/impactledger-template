/**
 * Script injetado em cada página via page.addInitScript().
 *
 * Responsabilidades:
 *  1. Mock do Date.now() com offset ajustável (para simular passagem de tempo).
 *  2. Mock do window.ethereum apontando para o Anvil local.
 *     - eth_requestAccounts / eth_accounts → retorna a conta selecionada.
 *     - Todas as outras chamadas → proxy para http://localhost:8545.
 *     - Anvil tem contas desbloqueadas, logo eth_sendTransaction funciona sem chave.
 *  3. Expõe window.__setEthAccount(addr) e window.__advanceTime(ms) para os testes.
 */
export const MOCK_ETHEREUM_SCRIPT = /* javascript */ `
;(function () {
  'use strict';

  // ── Offset de tempo persistido entre navegações via localStorage ───────────
  var _timeOffset = 0;
  try {
    _timeOffset = parseInt(localStorage.getItem('__pw_time_offset') || '0', 10) || 0;
  } catch (_) {}
  window.__pw_time_offset = _timeOffset;

  var _origDateNow = Date.now.bind(Date);
  Date.now = function () { return _origDateNow() + window.__pw_time_offset; };

  // ── Mock do ethereum ────────────────────────────────────────────────────────
  // Restaura endereço persistido entre navegações (page.goto faz full-reload)
  var _addr = null;
  try {
    _addr = localStorage.getItem('__pw_eth_addr') || null;
  } catch (_) {}
  var _listeners = {};

  window.ethereum = {
    isMetaMask: true,
    get selectedAddress() { return _addr; },

    request: async function (args) {
      var method = args.method;
      var params = args.params || [];

      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        return _addr ? [_addr] : [];
      }
      if (method === 'eth_coinbase') {
        return _addr;
      }

      if ((method === 'eth_sendTransaction' || method === 'eth_sendRawTransaction') && window.__rejectNextTransaction) {
        window.__rejectNextTransaction = false;
        var rejected = new Error('User rejected the transaction');
        rejected.code = 4001;
        throw rejected;
      }

      var response = await fetch('http://localhost:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: method, params: params })
      });
      var json = await response.json();
      if (json.error) {
        var err = new Error(json.error.message || 'RPC Error');
        err.code = json.error.code;
        err.data = json.error.data;
        throw err;
      }
      return json.result;
    },

    on: function (event, fn) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(fn);
    },

    removeListener: function (event, fn) {
      if (_listeners[event]) {
        _listeners[event] = _listeners[event].filter(function (f) { return f !== fn; });
      }
    },

    emit: function (event, data) {
      (_listeners[event] || []).forEach(function (fn) { fn(data); });
    }
  };

  // Exposto para os testes via page.evaluate()
  window.__setEthAccount = function (addr) {
    _addr = addr;
    try {
      if (addr) {
        localStorage.setItem('__pw_eth_addr', addr);
      } else {
        localStorage.removeItem('__pw_eth_addr');
      }
    } catch (_) {}
    window.ethereum.emit('accountsChanged', addr ? [addr] : []);
  };

  window.__advanceTime = function (offsetMs) {
    window.__pw_time_offset = offsetMs;
    try { localStorage.setItem('__pw_time_offset', String(offsetMs)); } catch (_) {}
  };
})();
`;
