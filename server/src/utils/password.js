import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

export const validatePassword = (password) => {
    // Minimum 8 characters, at least one uppercase, one lowercase, one number, one special character
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return minLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecial;
};
