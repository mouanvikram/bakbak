import bcrypt from "bcrypt";

export const hashedPassword = async (passowrd: string) => {
  return bcrypt.hash(passowrd, 10);
};

export const comparePassword = async (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};
