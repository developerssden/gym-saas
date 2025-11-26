import bcrypt from "bcryptjs";
var key = "x!A%D*G-KaPdSgVkYp3s5v8y/B?E(H+M";

// Function to hash and salt passwords
export async function hashPassword(password: string) {
  const hash = await bcrypt.hash(password, 10);
  return hash;
}

// Function to verify password
export async function verifyPassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}