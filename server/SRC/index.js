// index.js
import express from 'express';

const app = express();
const PORT = 3010;

app.get('/', (req, res) => {
  res.send('Hi from ROYAL STACK');
});


app.listen(PORT, () => {
  console.log(`Server running at  http://localhost:${PORT}`);
});
