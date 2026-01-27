const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(express.static(__dirname));

// Redireciona qualquer acesso para o index.html (Correção para Deploy)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Shadow Of Mystery (Client-Side) running on port ${PORT}`);
});