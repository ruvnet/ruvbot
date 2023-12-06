import * as http from 'http';
const server = http.createServer((_req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});
const port = 3000;
const hostname = "0.0.0.0"
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});