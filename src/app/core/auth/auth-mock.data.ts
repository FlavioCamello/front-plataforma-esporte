import { AuthUser } from '../models/auth-user.model';

export interface MockAuthAccount {
  email: string;
  password: string;
  token: string;
  user: AuthUser;
}

/** Contas locais apenas para desenvolvimento (`useAuthMock: true`). */
export const MOCK_AUTH_ACCOUNTS: MockAuthAccount[] = [
  {
    email: 'usuario@dev.local',
    password: 'Usuario@123',
    token: 'dev-mock.user',
    user: {
      id: 'dev-user-1',
      email: 'usuario@dev.local',
      name: 'Usuário (dev)',
      pictureUrl: null,
      accountType: 'Athlete',
      profileComplete: true,
    },
  },
];

export function findMockAccount(email: string, password: string): MockAuthAccount | null {
  const normalizedEmail = email.trim().toLowerCase();
  return (
    MOCK_AUTH_ACCOUNTS.find(
      (account) =>
        account.email.toLowerCase() === normalizedEmail && account.password === password
    ) ?? null
  );
}

export function findMockAccountByToken(token: string): MockAuthAccount | null {
  return MOCK_AUTH_ACCOUNTS.find((account) => account.token === token) ?? null;
}
