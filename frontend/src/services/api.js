const BASE_URL = "http://127.0.0.1:8000/api";

export const registerUser = async (data) => {
  return fetch(`${BASE_URL}/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};

export const sendMessage = async (data) => {
  return fetch(`${BASE_URL}/send/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};

export const getMessages = async (sender, receiver) => {
  return fetch(`${BASE_URL}/messages/?sender=${sender}&receiver=${receiver}`);
};