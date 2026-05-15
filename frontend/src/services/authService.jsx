import api from "./api";

export const login = async (email, password) => {
  const response = await api.post("/api/auth/login", {
    email,
    password,
  });

  return response.data;
};

export const register = async (
  email,
  password,
  role = "member"
) => {
  const response = await api.post("/api/auth/register", {
    email,
    password,
    role,
  });

  return response.data;
};