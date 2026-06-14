export function isValidPassword(password) {
  if (typeof password !== "string") return false;

  const trimmedPassword = password.trim();
  const hasMinLength = trimmedPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(trimmedPassword);
  const hasNumber = /\d/.test(trimmedPassword);

  return hasMinLength && hasLetter && hasNumber;
}
