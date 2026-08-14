import { api } from '../api/api.client';

export async function getUserLanguage(
  telegramId: string,
): Promise<string> {
  try {
    const response = await api.get(`/users/${telegramId}`);

    return response.data?.user?.language || 'uz_lat';
  } catch (error) {
    console.error('Get user language error:', error);
    return 'uz_lat';
  }
}

export async function registerUser(data: {
  telegramId: string;
  username?: string;
  displayName?: string;
  language: string;
}) {
  return api.post('/users/register', data);
}

export async function getUser(telegramId: string) {
  const response = await api.get(`/users/${telegramId}`);
  return response.data?.user;
}

export async function savePhone(
  telegramId: string,
  phoneNumber: string,
) {
  return api.patch(`/users/${telegramId}/phone`, {
    phoneNumber,
  });
}