const request = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `Request failed with status ${response.status}`);
  }

  return response.json();
};

export const api = {
  getHealth: () => request('/health'),
  getCourses: () => request('/courses'),
  getStudents: () => request('/students'),
  login: (credentials) =>
    request('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
};
