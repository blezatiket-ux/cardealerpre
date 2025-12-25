exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
    
    try {
        const authHeader = event.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'No token provided' })
            };
        }
        
        const token = authHeader.split(' ')[1];
        
        // Decode the simple token
        const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        // Check if token is expired
        if (tokenData.exp < Date.now()) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Token expired' })
            };
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                userId: tokenData.userId,
                role: tokenData.role,
                valid: true
            })
        };
        
    } catch (error) {
        console.error('Verify auth error:', error);
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid token' })
        };
    }
};