# AgendaPro Online

Sistema profissional de agendamento online com autenticação, login, dashboard, banco SQLite e integração com WhatsApp.

## Cores usadas

- Roxo principal: `#2A0081`
- Azul claro: `#B7E7FC`
- Rosa destaque: `#BA1650`

## Como rodar o projeto

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

3. Edite o número do WhatsApp no `.env`:

```env
WHATSAPP_NUMBER=5584999072807
```

Use o formato com DDI + DDD + número.

4. Rode o sistema:

```bash
npm start
```

5. Acesse no navegador:

```bash
http://localhost:3000
```

## Recursos

- Cadastro de usuário
- Login com JWT
- Senha criptografada com bcrypt
- Cadastro de agendamentos
- Validação de conflito de horário
- Status: agendado, confirmado, cancelado e concluído
- Integração com WhatsApp via link automático
- Layout responsivo para desktop e mobile

## Observação importante

Este sistema usa SQLite para facilitar o teste local. Para produção, recomendo migrar para PostgreSQL ou MySQL, configurar HTTPS, variáveis de ambiente seguras e deploy em servidor/VPS.
