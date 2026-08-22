import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('./public');

function cover(one, two, label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${one}"/><stop offset="1" stop-color="${two}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="450" cy="120" r="170" fill="white" opacity=".09"/><circle cx="130" cy="500" r="220" fill="black" opacity=".12"/><text x="48" y="520" fill="white" font-family="Arial" font-size="46" font-weight="700">${label}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const songs = [
    {title:'Midnight Drive', artist:'The Paper Kites', year:'2018', image_url:'midnight.jpg', s3_url:cover('#5b54d9','#151327','MIDNIGHT')},
    {title:'Golden Hour', artist:'Sunset Avenue', year:'2021', image_url:'golden.jpg', s3_url:cover('#ff9f43','#5c1841','GOLDEN HOUR')},
    {title:'American Dream', artist:'Wild Rivers', year:'2019', image_url:'american.jpg', s3_url:cover('#167d83','#092c42','AMERICAN')},
    {title:'Slow Motion', artist:'Violet Skies', year:'2022', image_url:'slow.jpg', s3_url:cover('#a55eea','#27123e','SLOW MOTION')}
];
let subscriptions = [songs[0], songs[1]];

function json(response, body, status = 200) {
    response.writeHead(status, {'Content-Type':'application/json'});
    response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/user') return json(response, {user_name:'Martin'});
    if (url.pathname === '/api/subscriptions') return json(response, {success:true, data:subscriptions});
    if (url.pathname === '/api/query' && request.method === 'POST') return json(response, {success:true, data:songs});
    if (url.pathname === '/api/subscribe' && request.method === 'POST') return json(response, {success:true});
    if (url.pathname === '/api/unsubscribe' && request.method === 'POST') return json(response, {success:true});

    const requested = url.pathname === '/' ? '/login.html' : url.pathname;
    const filePath = path.join(root, requested);
    if (!filePath.startsWith(root)) return json(response, {error:'Not found'}, 404);
    try {
        const content = await readFile(filePath);
        const type = filePath.endsWith('.css') ? 'text/css' : 'text/html';
        response.writeHead(200, {'Content-Type':`${type}; charset=utf-8`});
        response.end(content);
    } catch {
        response.writeHead(404);
        response.end('Not found');
    }
});

server.listen(4174, () => console.log('Preview server: http://localhost:4174'));
