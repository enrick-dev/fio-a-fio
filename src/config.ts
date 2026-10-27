// Nome do app: troque aqui (e no index.html / manifest.webmanifest).
export const APP_NAME = 'Fio a Fio';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.app.created', // cria e gerencia só a agenda do próprio app
  'https://www.googleapis.com/auth/tasks', // lista de tarefas
].join(' ');
