import fs from 'fs';

let content = fs.readFileSync('./server.ts', 'utf-8');
content = content.replace(/ && p\.ownerUsername === username/g, '');
fs.writeFileSync('./server.ts', content);

console.log("Replaced ownerUsername checks");
