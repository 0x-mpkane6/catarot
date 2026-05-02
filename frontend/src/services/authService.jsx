export const login = async (email, password) => {
  // giả lập delay giống API
  await new Promise((resolve) => setTimeout(resolve, 500));

  // mock data
  if (email === "admin@gmail.com" && password === "123456") {
    return {
      success: true,
      user: {
        id: 1,
        name: "Admin",
        email: "admin@gmail.com",
      },
      token: "fake-jwt-token-123",
    };
  }

  throw new Error("Sai email hoặc mật khẩu");
};