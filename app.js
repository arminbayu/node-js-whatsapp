const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const axios = require('axios');
const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(express.static(__dirname + '/view'));
app.get('/', (req, res) => {
  res.sendFile('view/index.html', {
    root: __dirname
  });
});

const sessions = [];
const SESSIONS_FILE = './whatsapp-sessions.json';

const createSessionsFileIfNotExists = function () {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log('Sessions file created successfully.');
    } catch (err) {
      console.log('Failed to create sessions file: ', err);
    }
  }
}

createSessionsFileIfNotExists();

const setSessionsFile = function (sessions) {
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
    if (err) {
      console.log(err);
    }
  });
}

const getSessionsFile = function () {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
}

const createSession = function (
  device_name,
  phone_number,
  client_id,
  description
) {
  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },
    authStrategy: new LocalAuth({
      clientId: client_id
    })
  });

  client.initialize();

  client.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
      io.emit('qr', { client_id: client_id, src: url });
      io.emit('message', { client_id: client_id, text: 'QR Code received, scan please!' });
    });
  });

  client.on('ready', () => {
    io.emit('ready', { client_id: client_id });
    io.emit('message', { client_id: client_id, text: 'Whatsapp is ready!' });

    const number = phoneNumberFormatter(phone_number);
    client.sendMessage(number, "Whatsapp is ready!");

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.client_id == client_id);
    savedSessions[sessionIndex].ready = true;
    setSessionsFile(savedSessions);
  });

  client.on('authenticated', () => {
    io.emit('authenticated', { client_id: client_id });
    io.emit('message', { client_id: client_id, text: 'Whatsapp is authenticated!' });
  });

  client.on('auth_failure', function () {
    io.emit('message', { client_id: client_id, text: 'Auth failure, restarting...' });
  });

  client.on('disconnected', (reason) => {
    io.emit('message', { client_id: client_id, text: 'Whatsapp is disconnected!' });
    client.destroy();
    client.initialize();

    // Menghapus pada file sessions
    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.client_id == client_id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);

    io.emit('remove-session', client_id);
  });

  // Tambahkan client ke sessions
  sessions.push({
    device_name: device_name,
    phone_number: phone_number,
    client_id: client_id,
    description: description,
    client: client
  });

  // Menambahkan session ke file
  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex(sess => sess.client_id == client_id);

  if (sessionIndex == -1) {
    savedSessions.push({
      device_name: device_name,
      phone_number: phone_number,
      client_id: client_id,
      description: description,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }
}

const init = function (socket) {
  const savedSessions = getSessionsFile();

  if (savedSessions.length > 0) {
    if (socket) {
      /**
       * At the first time of running (e.g. restarting the server), our client is not ready yet!
       * It will need several time to authenticating.
       * 
       * So to make people not confused for the 'ready' status
       * We need to make it as FALSE for this condition
       */
      // savedSessions.forEach((e, i, arr) => {
      //   arr[i].ready = false;
      // });

      socket.emit('init', savedSessions);
    } else {
      savedSessions.forEach(sess => {
        createSession(
          sess.device_name,
          sess.phone_number,
          sess.client_id,
          sess.description
        );
      });
    }
  }
}

init();

// Socket IO
io.on('connection', function (socket) {
  init(socket);

  socket.on('create-session', function (data) {
    createSession(
      data.device_name,
      data.phone_number,
      data.client_id,
      data.description
    );
  });
});

// Send message
app.post('/send-message', async (req, res) => {
  try {
    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;

    const auth = req.headers.authorization;
    var client = sessions.find(sess => sess.client_id == auth);

    if (!client) {
      return res.status(422).json({
        status: false,
        message: `The auth is not found!`
      })
    } else {
      client = client.client
    }

    const isRegisteredNumber = await client.isRegisteredUser(number);

    if (!isRegisteredNumber) {
      return res.status(422).json({
        status: false,
        message: 'The number is not registered'
      });
    }

    client.sendMessage(number, message).then(response => {
      res.status(200).json({
        status: true,
        response: response
      });
    }).catch(err => {
      res.status(500).json({
        status: false,
        response: err
      });
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      response: `Error : ${err.message}`
    });
  }
});

server.listen(port, function () {
  console.log('App running on *: ' + port);
});
