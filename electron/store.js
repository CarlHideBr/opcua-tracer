const Store = require('electron-store');

const schema = {
  servers: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        endpointUrl: { type: 'string' },
        username: { type: 'string' },
        // Do not store passwords unless user opts-in; we default to empty
        rememberPassword: { type: 'boolean', default: false },
        password: { type: 'string' }
      }
    }
  },
  charts: {
    type: 'array',
    default: []
  }
};

const store = new Store({ schema, name: 'opc-ua-tracer' });

module.exports = {
  listServers() {
    return store.get('servers');
  },
  addServer(server) {
    const servers = store.get('servers');
    const updated = [...servers.filter(s => s.id !== server.id), server];
    store.set('servers', updated);
    return updated;
  },
  removeServer(id) {
    const servers = store.get('servers').filter(s => s.id !== id);
    store.set('servers', servers);
    return servers;
  },
  getCharts() {
    return store.get('charts');
  },
  saveCharts(charts) {
    store.set('charts', charts);
    return charts;
  }
};
