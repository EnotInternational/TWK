// api.js
const BASE_URL = 'http://26.26.77.45:5000/'; // Замените на актуальный IP бэкендера

export const agentApi = {
  // Инициализировать поле случайными агентами
  initField: async (width, height, agents_count) => {
    const response = await fetch(`${BASE_URL}/api/field`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width, height, agents_count })
    });
    if (!response.ok) throw new Error('Ошибка инициализации');
    return response.json(); // Поле успешно создано[cite: 8]
  },

  // Получить текущее состояние поля
  getField: async () => {
    const response = await fetch(`${BASE_URL}/api/field`);
    if (!response.ok) throw new Error('Ошибка получения поля');
    return response.json(); // Текущее состояние поля[cite: 7]
  },

  // Очистить поле (удалить всех агентов)[cite: 6]
  clearField: async () => {
    const response = await fetch(`${BASE_URL}/api/field`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Ошибка очистки');
    return response.json(); // Поле очищено[cite: 6]
  },

  // Обновить параметры конкретного агента
  updateAgent: async (agent_id, hunger, x, y) => {
    const response = await fetch(`${BASE_URL}/api/agents/${agent_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hunger, x, y }) // Координаты и голод - целые числа
    });
    if (!response.ok) throw new Error('Агент не найден');
    return response.json();
  }
};