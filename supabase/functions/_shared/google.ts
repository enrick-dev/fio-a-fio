// Chamadas às APIs do Google (OAuth, Tasks e Calendar) via fetch.

export class GoogleAuthError extends Error {}
export class GoogleNotFound extends Error {}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    if (json.error === 'invalid_grant') throw new GoogleAuthError('Acesso ao Google revogado ou expirado');
    throw new Error(`Falha ao renovar token do Google: ${json.error_description ?? json.error}`);
  }
  return json.access_token as string;
}

export class GoogleClient {
  constructor(private token: string) {}

  async call<T = any>(method: string, url: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 204) return undefined as T;
      if (res.status === 404 || res.status === 410) throw new GoogleNotFound(url);
      if (res.status === 401) throw new GoogleAuthError('Token do Google inválido');
      if (res.status === 429 || res.status >= 500 || (res.status === 403 && attempt < 3 && (await isRateLimit(res.clone())))) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
      const text = await res.text();
      if (!res.ok) throw new Error(`Google ${method} ${url} → ${res.status}: ${text.slice(0, 300)}`);
      return (text ? JSON.parse(text) : undefined) as T;
    }
    throw new Error(`Google ${method} ${url}: muitas tentativas`);
  }

  // ---- Tasks ----
  async ensureTaskList(existingId: string | null, title: string): Promise<string> {
    if (existingId) {
      try {
        await this.call('GET', `https://tasks.googleapis.com/tasks/v1/users/@me/lists/${existingId}`);
        return existingId;
      } catch (e) {
        if (!(e instanceof GoogleNotFound)) throw e;
      }
    }
    const created = await this.call('POST', 'https://tasks.googleapis.com/tasks/v1/users/@me/lists', { title });
    return created.id;
  }

  listTasks(listId: string) {
    return this.paged<any>(
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`,
    );
  }

  insertTask(listId: string, task: unknown) {
    return this.call('POST', `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, task);
  }
  patchTask(listId: string, id: string, task: unknown) {
    return this.call('PATCH', `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${id}`, task);
  }
  deleteTask(listId: string, id: string) {
    return this.call('DELETE', `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${id}`);
  }

  // ---- Calendar ----
  async ensureCalendar(existingId: string | null, summary: string, timeZone: string): Promise<string> {
    if (existingId) {
      try {
        await this.call('GET', `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(existingId)}`);
        return existingId;
      } catch (e) {
        if (!(e instanceof GoogleNotFound)) throw e;
      }
    }
    const created = await this.call('POST', 'https://www.googleapis.com/calendar/v3/calendars', { summary, timeZone });
    return created.id;
  }

  insertEvent(calId: string, ev: unknown) {
    return this.call('POST', `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, ev);
  }
  patchEvent(calId: string, id: string, ev: unknown) {
    return this.call('PATCH', `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${id}`, ev);
  }
  deleteEvent(calId: string, id: string) {
    return this.call('DELETE', `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${id}`);
  }

  private async paged<T>(url: string): Promise<T[]> {
    const out: T[] = [];
    let pageToken: string | undefined;
    do {
      const sep = url.includes('?') ? '&' : '?';
      const page = await this.call('GET', pageToken ? `${url}${sep}pageToken=${pageToken}` : url);
      out.push(...(page?.items ?? []));
      pageToken = page?.nextPageToken;
    } while (pageToken);
    return out;
  }
}

async function isRateLimit(res: Response) {
  try {
    const t = await res.text();
    return /rateLimitExceeded|userRateLimitExceeded/.test(t);
  } catch {
    return false;
  }
}

export async function getGoogleEmail(token: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const j = await res.json();
  return j.email ?? null;
}
