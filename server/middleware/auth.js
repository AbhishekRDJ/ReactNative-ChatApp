import jwt from "jsonwebtoken"

const auth = async (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: payload.userId, email: payload.email };
        next();

    } catch (error) {
        throw new Error('Authentication failed in middleware')

    }
}

export { auth }