const https = require('https');

const options = {
    hostname: 'api.github.com',
    path: '/repos/marcelomatz/Heapi/releases',
    method: 'GET',
    headers: { 'User-Agent': 'node.js' }
};

https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const releases = JSON.parse(data);
        let total = 0;
        for (const r of releases) {
            for (const a of r.assets || []) {
                total += a.download_count;
            }
        }
        console.log('Heapi total downloads (API raw):', total);
    });
});
