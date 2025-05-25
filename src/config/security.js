const jwt = require("jsonwebtoken");
const config = require("./config");

const JWT_SECRET = process.env.JWT_SECRET || "tu-secreto-seguro-aqui";
const TOKEN_EXPIRATION = "1h";

const generateToken = (userData) => {
  return jwt.sign(
    {
      role: userData.role,
      userId: userData.id,
      permissions: config.PERMISSIONS[userData.role],
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRATION },
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  JWT_SECRET,
  TOKEN_EXPIRATION,
};
