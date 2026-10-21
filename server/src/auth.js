import jwt from 'jsonwebtoken';

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  return value || 'dev-only-secret';
};

export const signToken = (user) => jwt.sign({ sub: String(user._id), name: user.name }, secret(), { expiresIn: '7d' });

// Returns { id, name } or throws if the token is missing, forged or expired
export function verifyToken(token) {
  const { sub, name } = jwt.verify(token ?? '', secret());
  return { id: sub, name };
}

export function requireAuth(req, res, next) {
  try {
    req.user = verifyToken(req.get('authorization')?.replace(/^Bearer /, ''));
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again.' });
  }
}
