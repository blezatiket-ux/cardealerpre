exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
    
    try {
        const authHeader = event.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, body: JSON.stringify({ error: 'No token' }) };
        }
        
        const token = authHeader.split(' ')[1];
        
        // Decode token
        const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        // Check expiration
        if (tokenData.exp < Date.now()) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Token expired' }) };
        }
        
        // Return user data
        return {
            statusCode: 200,
            body: JSON.stringify({
                userId: tokenData.userId,
                username: tokenData.username,
                role: tokenData.role,
                valid: true
            })
        };
        
    } catch (error) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
};