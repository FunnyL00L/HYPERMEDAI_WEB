import fs from 'fs';

let content = fs.readFileSync('./src/components/Dashboard.tsx', 'utf-8');
content = content.replace(/ class="/g, ' className="');
content = content.replace(/ class=\{/g, ' className=\{');
fs.writeFileSync('./src/components/Dashboard.tsx', content);

console.log("Replaced all class with className");
