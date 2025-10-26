export const loadBoolean = (key, defaultValue = false) => {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw === '1';
};

export const saveBoolean = (key, value) => {
  localStorage.setItem(key, value ? '1' : '0');
};

export const loadJSON = (key, fallback = undefined) => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
};

export const saveJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};
