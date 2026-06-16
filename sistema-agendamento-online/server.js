require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '5584999072807';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    service TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    status TEXT DEFAULT 'agendado',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Token não informado.' });
  }

  const [, token] = authHeader.split(' ');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
}

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Preencha todos os campos.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'A senha precisa ter no mínimo 6 caracteres.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email.toLowerCase(), hashedPassword],
    function (error) {
      if (error) {
        return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
      }

      return res.status(201).json({ message: 'Conta criada com sucesso.' });
    }
  );
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Informe e-mail e senha.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], async (error, user) => {
    if (error || !user) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  });
});

app.get('/api/me', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

app.get('/api/appointments', authMiddleware, (req, res) => {
  db.all(
    'SELECT * FROM appointments WHERE user_id = ? ORDER BY appointment_date ASC, appointment_time ASC',
    [req.user.id],
    (error, appointments) => {
      if (error) {
        return res.status(500).json({ message: 'Erro ao buscar agendamentos.' });
      }

      return res.json({ appointments });
    }
  );
});

app.post('/api/appointments', authMiddleware, (req, res) => {
  const { client_name, client_phone, service, appointment_date, appointment_time, notes } = req.body;

  if (!client_name || !client_phone || !service || !appointment_date || !appointment_time) {
    return res.status(400).json({ message: 'Preencha os campos obrigatórios.' });
  }

  db.get(
    `SELECT id FROM appointments
     WHERE user_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelado'`,
    [req.user.id, appointment_date, appointment_time],
    (error, conflict) => {
      if (conflict) {
        return res.status(409).json({ message: 'Este horário já está ocupado.' });
      }

      db.run(
        `INSERT INTO appointments
        (user_id, client_name, client_phone, service, appointment_date, appointment_time, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, client_name, client_phone, service, appointment_date, appointment_time, notes || ''],
        function (insertError) {
          if (insertError) {
            return res.status(500).json({ message: 'Erro ao criar agendamento.' });
          }

          return res.status(201).json({
            message: 'Agendamento criado com sucesso.',
            appointment_id: this.lastID
          });
        }
      );
    }
  );
});

app.patch('/api/appointments/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const allowedStatus = ['agendado', 'confirmado', 'cancelado', 'concluido'];

  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ message: 'Status inválido.' });
  }

  db.run(
    'UPDATE appointments SET status = ? WHERE id = ? AND user_id = ?',
    [status, req.params.id, req.user.id],
    function (error) {
      if (error) {
        return res.status(500).json({ message: 'Erro ao atualizar status.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Agendamento não encontrado.' });
      }

      return res.json({ message: 'Status atualizado com sucesso.' });
    }
  );
});

app.delete('/api/appointments/:id', authMiddleware, (req, res) => {
  db.run(
    'DELETE FROM appointments WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function (error) {
      if (error) {
        return res.status(500).json({ message: 'Erro ao excluir agendamento.' });
      }

      return res.json({ message: 'Agendamento excluído com sucesso.' });
    }
  );
});

app.get('/api/whatsapp-link/:id', authMiddleware, (req, res) => {
  db.get(
    'SELECT * FROM appointments WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    (error, appointment) => {
      if (error || !appointment) {
        return res.status(404).json({ message: 'Agendamento não encontrado.' });
      }

      const message = `Olá, ${appointment.client_name}! Seu agendamento para ${appointment.service} está marcado para ${appointment.appointment_date} às ${appointment.appointment_time}.`;
      const link = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

      return res.json({ link, message });
    }
  );
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
