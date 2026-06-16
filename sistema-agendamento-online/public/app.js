const API_URL = window.location.origin;
const tokenKey = 'agendapro_token';
const userKey = 'agendapro_user';

const authScreen = document.getElementById('auth-screen');
const dashboard = document.getElementById('dashboard');
const authMessage = document.getElementById('auth-message');
const appointmentMessage = document.getElementById('appointment-message');
const appointmentsList = document.getElementById('appointments-list');
const welcome = document.getElementById('welcome');

function getToken() {
  return localStorage.getItem(tokenKey);
}

function getUser() {
  const user = localStorage.getItem(userKey);
  return user ? JSON.parse(user) : null;
}

function setSession(token, user) {
  localStorage.setItem(tokenKey, token);
  localStorage.setItem(userKey, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
}

function showDashboard() {
  const user = getUser();
  authScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');
  welcome.textContent = user ? `Bem-vindo(a), ${user.name}.` : '';
  loadAppointments();
}

function showAuth() {
  dashboard.classList.add('hidden');
  authScreen.classList.remove('hidden');
}

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Ocorreu um erro inesperado.');
  }

  return data;
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.form').forEach((form) => form.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.form).classList.add('active');
    authMessage.textContent = '';
  });
});

document.getElementById('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';

  try {
    const payload = {
      name: document.getElementById('register-name').value.trim(),
      email: document.getElementById('register-email').value.trim(),
      password: document.getElementById('register-password').value
    };

    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    authMessage.textContent = data.message + ' Agora faça login.';
    event.target.reset();
    document.querySelector('[data-form="login-form"]').click();
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';

  try {
    const payload = {
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value
    };

    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setSession(data.token, data.user);
    showDashboard();
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  showAuth();
});

document.getElementById('appointment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  appointmentMessage.textContent = '';

  try {
    const payload = {
      client_name: document.getElementById('client-name').value.trim(),
      client_phone: document.getElementById('client-phone').value.trim(),
      service: document.getElementById('service').value.trim(),
      appointment_date: document.getElementById('appointment-date').value,
      appointment_time: document.getElementById('appointment-time').value,
      notes: document.getElementById('notes').value.trim()
    };

    const data = await apiRequest('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    appointmentMessage.textContent = data.message;
    event.target.reset();
    loadAppointments();
  } catch (error) {
    appointmentMessage.textContent = error.message;
  }
});

document.getElementById('refresh-btn').addEventListener('click', loadAppointments);

async function loadAppointments() {
  appointmentsList.innerHTML = '<p>Carregando agendamentos...</p>';

  try {
    const data = await apiRequest('/api/appointments');

    if (!data.appointments.length) {
      appointmentsList.innerHTML = '<p>Nenhum agendamento cadastrado ainda.</p>';
      return;
    }

    appointmentsList.innerHTML = data.appointments.map((appointment) => `
      <article class="appointment-card">
        <h4>${escapeHtml(appointment.client_name)}</h4>
        <p><strong>Serviço:</strong> ${escapeHtml(appointment.service)}</p>
        <p><strong>Telefone:</strong> ${escapeHtml(appointment.client_phone)}</p>
        <p><strong>Data:</strong> ${formatDate(appointment.appointment_date)} às ${appointment.appointment_time}</p>
        ${appointment.notes ? `<p><strong>Obs:</strong> ${escapeHtml(appointment.notes)}</p>` : ''}
        <span class="status">${appointment.status.toUpperCase()}</span>
        <div class="card-actions">
          <button class="small-btn whatsapp" onclick="openWhatsApp(${appointment.id})">WhatsApp</button>
          <button class="small-btn" onclick="updateStatus(${appointment.id}, 'confirmado')">Confirmar</button>
          <button class="small-btn" onclick="updateStatus(${appointment.id}, 'concluido')">Concluir</button>
          <button class="small-btn cancel" onclick="updateStatus(${appointment.id}, 'cancelado')">Cancelar</button>
          <button class="small-btn cancel" onclick="deleteAppointment(${appointment.id})">Excluir</button>
        </div>
      </article>
    `).join('');
  } catch (error) {
    appointmentsList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function openWhatsApp(id) {
  try {
    const data = await apiRequest(`/api/whatsapp-link/${id}`);
    window.open(data.link, '_blank');
  } catch (error) {
    alert(error.message);
  }
}

async function updateStatus(id, status) {
  try {
    await apiRequest(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    loadAppointments();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteAppointment(id) {
  const confirmDelete = confirm('Deseja excluir este agendamento?');
  if (!confirmDelete) return;

  try {
    await apiRequest(`/api/appointments/${id}`, {
      method: 'DELETE'
    });
    loadAppointments();
  } catch (error) {
    alert(error.message);
  }
}

function formatDate(date) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

if (getToken()) {
  showDashboard();
} else {
  showAuth();
}
